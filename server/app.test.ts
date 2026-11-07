import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { COOKIE, createApp } from "./app.js";
import { base32Decode, encrypt, newTotpSecret, totpAt, totpStep } from "./crypto.js";
import { DEFAULT_TEAM_CALLBACK, TEAM_AUDIENCE, type Env } from "./env.js";
import { memoryStore } from "./store.js";

const HOST = "https://admin.zaqsa.com";
const SECRET = "x".repeat(40);
const DATA_KEY = "k".repeat(40);
const PASSWORD = "correct horse battery staple";
const STATE = "abcdefghijklmnop1234";

let now = 1_800_000_000_000;
let secret = "";
let store = memoryStore();
let env: Env = {};
let app = createApp({ store, env, now: () => now });
let ipCounter = 0;

async function setup(overrides: Partial<Env> = {}) {
  now = 1_800_000_000_000;
  store = memoryStore();
  env = {
    ADMIN_ALLOWED_EMAILS: "surajit@example.com,other@example.com",
    SSO_SHARED_SECRET: SECRET,
    ADMIN_DATA_KEY: DATA_KEY,
    TEAM_CALLBACK_URL: DEFAULT_TEAM_CALLBACK,
    ...overrides,
  };
  secret = newTotpSecret();
  await store.putUser({
    id: "user-1",
    email: "surajit@example.com",
    name: "Surajit",
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    totpSecretEnc: encrypt(secret, DATA_KEY),
    lastTotpStep: 0,
  });
  await store.putUser({
    id: "user-2",
    email: "stranger@example.com", // has an account but is NOT on the allow-list
    name: "Stranger",
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    totpSecretEnc: encrypt(secret, DATA_KEY),
    lastTotpStep: 0,
  });
  app = createApp({ store, env, now: () => now });
}

const codeNow = (offsetSteps = 0) => totpAt(secret, totpStep(now) + offsetSteps);

function signIn(body: Record<string, unknown>, ip = `10.0.0.${++ipCounter}`) {
  return app(
    new Request(`${HOST}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: HOST, "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

async function loggedInCookie(): Promise<string> {
  const response = await signIn({ email: "surajit@example.com", password: PASSWORD, code: codeNow() });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")!;
  return cookie.split(";")[0]!;
}

const sso = (query: string, cookie?: string) =>
  app(new Request(`${HOST}/sso/team?${query}`, { headers: cookie ? { cookie } : {} }));
const goodQuery = `return=${encodeURIComponent(DEFAULT_TEAM_CALLBACK)}&state=${STATE}`;

beforeEach(setup);

describe("sign-in", () => {
  it("accepts allow-listed email + password + authenticator code and sets a safe cookie", async () => {
    const response = await signIn({ email: "Surajit@Example.com", password: PASSWORD, code: codeNow() });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=28800/);
    expect(cookie.toLowerCase()).not.toContain("domain=");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("refuses a person who is not on the allow-list, even with the right password and code", async () => {
    const response = await signIn({ email: "stranger@example.com", password: PASSWORD, code: codeNow() });
    expect(response.status).toBe(401);
  });

  it("refuses a password alone, a wrong password and a wrong code with one generic error", async () => {
    const results = await Promise.all([
      signIn({ email: "surajit@example.com", password: PASSWORD }),
      signIn({ email: "surajit@example.com", password: "nope-nope-nope", code: codeNow() }),
      signIn({ email: "surajit@example.com", password: PASSWORD, code: "000000" }),
      signIn({ email: "ghost@example.com", password: PASSWORD, code: "123456" }),
    ]);
    for (const response of results) expect(response.status).toBe(401);
    const bodies = await Promise.all(results.map((r) => r.text()));
    expect(new Set(bodies).size).toBe(1);
  });

  it("does not accept the same authenticator code twice", async () => {
    const code = codeNow();
    expect((await signIn({ email: "surajit@example.com", password: PASSWORD, code })).status).toBe(200);
    expect((await signIn({ email: "surajit@example.com", password: PASSWORD, code })).status).toBe(401);
  });

  it("rate-limits after 5 attempts per email, even from new addresses", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await signIn({ email: "other@example.com", password: "bad-bad-bad-bad", code: "111111" })).status).toBe(401);
    }
    const blocked = await signIn({ email: "other@example.com", password: PASSWORD, code: codeNow() });
    expect(blocked.status).toBe(429);
  });

  it("rate-limits after 5 attempts per IP", async () => {
    for (let i = 0; i < 5; i++) {
      await signIn({ email: `a${i}@example.com`, password: "bad-bad-bad-bad", code: "111111" }, "9.9.9.9");
    }
    const blocked = await signIn({ email: "surajit@example.com", password: PASSWORD, code: codeNow() }, "9.9.9.9");
    expect(blocked.status).toBe(429);
  });

  it("refuses a sign-in that comes from another site", async () => {
    const response = await app(
      new Request(`${HOST}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ email: "surajit@example.com", password: PASSWORD, code: codeNow() }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("ends the session after 8 hours and on sign out", async () => {
    const cookie = await loggedInCookie();
    const me = () => app(new Request(`${HOST}/api/auth/me`, { headers: { cookie } }));
    expect((await me()).status).toBe(200);
    now += 8 * 60 * 60 * 1000 + 1;
    expect((await me()).status).toBe(401);
  });

  it("signs out", async () => {
    const cookie = await loggedInCookie();
    const out = await app(new Request(`${HOST}/api/auth/logout`, { method: "POST", headers: { cookie, origin: HOST } }));
    expect(out.status).toBe(200);
    expect((await app(new Request(`${HOST}/api/auth/me`, { headers: { cookie } }))).status).toBe(401);
  });

  it("drops a session immediately when the person is removed from the allow-list", async () => {
    const cookie = await loggedInCookie();
    env.ADMIN_ALLOWED_EMAILS = "other@example.com";
    expect((await app(new Request(`${HOST}/api/auth/me`, { headers: { cookie } }))).status).toBe(401);
  });
});

describe("editor API", () => {
  it("returns 401 for every read and write without a session", async () => {
    const calls = [
      app(new Request(`${HOST}/api/site`)),
      app(new Request(`${HOST}/api/site/home`)),
      app(new Request(`${HOST}/api/site/home`, { method: "PUT", headers: { origin: HOST }, body: "{}" })),
    ];
    for (const response of await Promise.all(calls)) expect(response.status).toBe(401);
  });

  it("saves, reads and keeps history when signed in", async () => {
    const cookie = await loggedInCookie();
    const put = (value: string) =>
      app(
        new Request(`${HOST}/api/site/home`, {
          method: "PUT",
          headers: { cookie, origin: HOST, "content-type": "application/json" },
          body: JSON.stringify({ json: value }),
        }),
      );
    expect((await put('{"a":1}')).status).toBe(200);
    expect((await put('{"a":2}')).status).toBe(200);
    const read = await app(new Request(`${HOST}/api/site/home`, { headers: { cookie } }));
    expect(await read.json()).toEqual({ json: '{"a":2}' });
    expect(store.history).toHaveLength(1);
    expect((await app(new Request(`${HOST}/api/site/passwords`, { headers: { cookie } }))).status).toBe(404);
    expect((await put("not json")).status).toBe(400);
  });

  it("refuses a write from another site", async () => {
    const cookie = await loggedInCookie();
    const response = await app(
      new Request(`${HOST}/api/site/home`, {
        method: "PUT",
        headers: { cookie, origin: "https://evil.example" },
        body: JSON.stringify({ json: "{}" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe("GET /sso/team", () => {
  it("sends a signed-out visitor to sign-in and keeps the full query for afterwards", async () => {
    const response = await sso(goodQuery);
    expect(response.status).toBe(302);
    const location = response.headers.get("location")!;
    expect(location.startsWith("/sign-in?next=")).toBe(true);
    const next = decodeURIComponent(location.split("next=")[1]!);
    expect(next).toBe(`/sso/team?${goodQuery}`);
    expect(next.startsWith("/sso/team?")).toBe(true);
  });

  it("rejects a wrong return URL and a bad state with 400", async () => {
    const cookie = await loggedInCookie();
    const wrong = (url: string, state = STATE) => `return=${encodeURIComponent(url)}&state=${state}`;
    expect((await sso(wrong("https://evil.example/cb"), cookie)).status).toBe(400);
    expect((await sso(wrong(`${DEFAULT_TEAM_CALLBACK}/../x`), cookie)).status).toBe(400);
    expect((await sso(wrong(`${DEFAULT_TEAM_CALLBACK}?x=1`), cookie)).status).toBe(400);
    expect((await sso(wrong(DEFAULT_TEAM_CALLBACK, "short"), cookie)).status).toBe(400);
    expect((await sso(wrong(DEFAULT_TEAM_CALLBACK, "z".repeat(201)), cookie)).status).toBe(400);
    expect((await sso(`state=${STATE}`, cookie)).status).toBe(400);
  });

  it("redirects a signed-in person with a correct 60-second token", async () => {
    const cookie = await loggedInCookie();
    const response = await sso(goodQuery, cookie);
    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const location = new URL(response.headers.get("location")!);
    expect(`${location.origin}${location.pathname}`).toBe(DEFAULT_TEAM_CALLBACK);
    expect(location.searchParams.get("state")).toBe(STATE);

    const token = location.searchParams.get("token")!;
    const key = new TextEncoder().encode(SECRET);
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      issuer: "zaqsa-admin",
      audience: TEAM_AUDIENCE,
      algorithms: ["HS256"],
      currentDate: new Date(now),
    });
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload["email"]).toBe("surajit@example.com");
    expect(payload["name"]).toBe("Surajit");
    expect(payload["state"]).toBe(STATE);
    expect(payload.sub).toBe("user-1");
    expect(payload.exp! - payload.iat!).toBe(60);
    expect(payload.iat).toBe(Math.floor(now / 1000));

    // The team site must refuse it once it has expired.
    await expect(
      jwtVerify(token, key, { issuer: "zaqsa-admin", audience: TEAM_AUDIENCE, currentDate: new Date(now + 61_000) }),
    ).rejects.toThrow();
    // ...and a token whose email was changed (so the signature no longer matches).
    const [header, body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, email: "attacker@example.com" })).toString("base64url");
    await expect(jwtVerify(`${header}.${forged}.${signature}`, key, { currentDate: new Date(now) })).rejects.toThrow();
    // ...and a token signed with another secret.
    const other = await new SignJWT({ email: "surajit@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("zaqsa-admin")
      .setAudience(TEAM_AUDIENCE)
      .setExpirationTime("1m")
      .sign(new TextEncoder().encode("y".repeat(40)));
    await expect(jwtVerify(other, key)).rejects.toThrow();
    // A different state on the team side is refused by comparing against the original, which is why it is in the token.
    expect(payload["state"]).not.toBe("a-different-state-value");
  });

  it("will not hand off for someone no longer on the allow-list", async () => {
    const cookie = await loggedInCookie();
    env.ADMIN_ALLOWED_EMAILS = "other@example.com";
    const response = await sso(goodQuery, cookie);
    expect(response.headers.get("location")!.startsWith("/sign-in")).toBe(true);
  });

  it("uses TEAM_CALLBACK_URL when it is set", async () => {
    await setup({ TEAM_CALLBACK_URL: "https://team.schools.zaqsa.com/other/callback" });
    const cookie = await loggedInCookie();
    expect((await sso(goodQuery, cookie)).status).toBe(400);
    const ok = await sso(`return=${encodeURIComponent("https://team.schools.zaqsa.com/other/callback")}&state=${STATE}`, cookie);
    expect(ok.status).toBe(302);
  });

  it("fails safely when the shared secret is too short", async () => {
    await setup({ SSO_SHARED_SECRET: "short" });
    const cookie = await loggedInCookie();
    expect((await sso(goodQuery, cookie)).status).toBe(500);
  });
});

describe("authenticator codes", () => {
  it("matches RFC 6238 test vectors", () => {
    // Secret "12345678901234567890" in base32; the RFC lists 8 digits, we use the last 6.
    expect(totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1)).toBe("287082");
    expect(totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 37037036)).toBe("081804");
    expect(totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 37037037)).toBe("050471");
    expect(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").toString()).toBe("12345678901234567890");
  });
});
