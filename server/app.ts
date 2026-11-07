import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { decrypt, matchTotp, randomToken, sha256 } from "./crypto.js";
import { TEAM_AUDIENCE, isAllowed, teamCallback, type Env } from "./env.js";
import type { AdminUser, Store } from "./store.js";

export type Deps = { store: Store; env: Env; now?: () => number };

export const COOKIE = "__Host-zaqsa_sid";
export const SESSION_MS = 8 * 60 * 60 * 1000;
const ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const DOC_KEYS = ["home", "services", "core", "team", "company"];
const MAX_DOC_CHARS = 900_000;
const GENERIC = "Sign-in failed. Check your details and try again.";

const baseHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders, "Content-Type": "application/json", ...extra },
  });

const sessionCookie = (value: string, maxAgeSeconds: number) =>
  `${COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "unknown";

/** Browsers always send Origin on fetch POST/PUT. Refuse requests that come from another site. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

let dummyHash: string | undefined;
const dummy = () => (dummyHash ??= bcrypt.hashSync(randomToken(12), 12));

/** The signed-in person, or null. Re-checks the allow-list on every request so removal is immediate. */
async function currentUser(request: Request, { store, env, now = Date.now }: Deps): Promise<AdminUser | null> {
  const id = readCookie(request, COOKIE);
  if (!id) return null;
  const session = await store.getSession(sha256(id));
  if (!session || session.expiresAt <= now()) return null;
  if (!isAllowed(env, session.email)) return null;
  const user = await store.getUser(session.email);
  return user && !user.disabled ? user : null;
}

async function login(request: Request, deps: Deps): Promise<Response> {
  const { store, env } = deps;
  const now = (deps.now ?? Date.now)();
  const fail = (status = 401) => json(status, { error: GENERIC });
  if (!sameOrigin(request)) return fail(403);

  let body: { email?: unknown; password?: unknown; code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";

  const ipKey = `ip:${clientIp(request)}`;
  const emailKey = `email:${email}`;
  const ipOk = await store.hit(ipKey, ATTEMPTS, WINDOW_MS, now);
  const emailOk = await store.hit(emailKey, ATTEMPTS, WINDOW_MS, now);
  if (!ipOk || !emailOk) return fail(429);

  // Always do the same work, so timing does not reveal whether an email exists or is allowed.
  const user = email && isAllowed(env, email) ? await store.getUser(email) : null;
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? dummy());
  let step: number | null = null;
  if (user && env.ADMIN_DATA_KEY) {
    try {
      step = matchTotp(decrypt(user.totpSecretEnc, env.ADMIN_DATA_KEY), code, now);
    } catch {
      step = null;
    }
  }
  if (!user || user.disabled || !passwordOk || step === null) return fail();
  if (!(await store.claimTotpStep(user.email, step))) return fail(); // this code was already used

  const id = randomToken(32);
  await store.putSession(sha256(id), { email: user.email, expiresAt: now + SESSION_MS });
  await store.clearHits(emailKey);
  return json(200, { email: user.email, name: user.name }, { "Set-Cookie": sessionCookie(id, SESSION_MS / 1000) });
}

async function logout(request: Request, deps: Deps): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "Forbidden" });
  const id = readCookie(request, COOKIE);
  if (id) await deps.store.deleteSession(sha256(id));
  return json(200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
}

/** Hands a signed-in person to the team site as a 60-second signed token. */
async function ssoTeam(request: Request, deps: Deps): Promise<Response> {
  const { env } = deps;
  const now = (deps.now ?? Date.now)();
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

  if (returnTo !== teamCallback(env)) return new Response("Bad request", { status: 400, headers: noStore });
  if (state.length < 16 || state.length > 200 || !/^[\x21-\x7e]+$/.test(state)) {
    return new Response("Bad request", { status: 400, headers: noStore });
  }

  const user = await currentUser(request, deps);
  if (!user) {
    const next = encodeURIComponent(url.pathname + url.search);
    return new Response(null, { status: 302, headers: { ...noStore, Location: `/sign-in?next=${next}` } });
  }

  const secret = env.SSO_SHARED_SECRET;
  if (!secret || secret.length < 32) return new Response("Sign-in handoff is not configured", { status: 500, headers: noStore });
  const issuedAt = Math.floor(now / 1000);
  const token = await new SignJWT({ email: user.email, name: user.name, state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("zaqsa-admin")
    .setAudience(TEAM_AUDIENCE)
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60)
    .sign(new TextEncoder().encode(secret));

  const target = new URL(returnTo);
  target.searchParams.set("token", token);
  target.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: { ...noStore, "Referrer-Policy": "no-referrer", Location: target.toString() },
  });
}

async function siteRoutes(request: Request, deps: Deps, key: string | null): Promise<Response> {
  const user = await currentUser(request, deps);
  if (!user) return json(401, { error: "Not signed in" });

  if (key === null) {
    if (request.method !== "GET") return json(405, { error: "Method not allowed" });
    return json(200, { keys: await deps.store.listSite() });
  }
  if (!DOC_KEYS.includes(key)) return json(404, { error: "Not found" });

  if (request.method === "GET") {
    const record = await deps.store.getSite(key);
    return json(200, { json: record?.json ?? null });
  }
  if (request.method === "PUT") {
    if (!sameOrigin(request)) return json(403, { error: "Forbidden" });
    let body: { json?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json(400, { error: "Invalid request" });
    }
    const text = body.json;
    if (typeof text !== "string" || text.length > MAX_DOC_CHARS) return json(400, { error: "Invalid content" });
    try {
      JSON.parse(text);
    } catch {
      return json(400, { error: "Invalid content" });
    }
    await deps.store.putSite(key, text, user.email);
    return json(200, { ok: true });
  }
  return json(405, { error: "Method not allowed" });
}

export function createApp(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
      const method = request.method;
      if (path === "/sso/team" && method === "GET") return await ssoTeam(request, deps);
      if (path === "/api/auth/login" && method === "POST") return await login(request, deps);
      if (path === "/api/auth/logout" && method === "POST") return await logout(request, deps);
      if (path === "/api/auth/me" && method === "GET") {
        const user = await currentUser(request, deps);
        return user ? json(200, { email: user.email, name: user.name }) : json(401, { error: "Not signed in" });
      }
      if (path === "/api/site") return await siteRoutes(request, deps, null);
      if (path.startsWith("/api/site/")) return await siteRoutes(request, deps, path.slice("/api/site/".length));
      return json(404, { error: "Not found" });
    } catch (problem) {
      console.error("admin api error", problem instanceof Error ? problem.message : "unknown"); // never log tokens
      return json(500, { error: "Something went wrong" });
    }
  };
}
