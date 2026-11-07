import seed from "./seed.json";
import { HOME_DEFAULT, type DocKey, type SiteDocs } from "./types";

const SEED: SiteDocs = { ...(seed as unknown as Omit<SiteDocs, "home">), home: HOME_DEFAULT };

export const defaultsFor = <K extends DocKey>(key: K): SiteDocs[K] =>
  structuredClone(SEED[key]) as SiteDocs[K];

/** Calls the admin server. A 401 means the session ended, so go back to the sign-in page. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 401) {
    window.location.assign("/sign-in");
    throw new Error("Your session ended. Please sign in again.");
  }
  if (!response.ok) throw new Error("Could not reach the server. Please try again.");
  return (await response.json()) as T;
}

/** Read one document; null when it has never been saved (the site then uses its built-in content). */
export async function loadDoc<K extends DocKey>(key: K): Promise<SiteDocs[K] | null> {
  const { json } = await api<{ json: string | null }>(`/api/site/${key}`);
  if (!json) return null;
  try {
    return JSON.parse(json) as SiteDocs[K];
  } catch {
    return null;
  }
}

/** Save one document. The server keeps the previous version in `site_history` so a mistake can be undone. */
export async function saveDoc<K extends DocKey>(key: K, value: SiteDocs[K]): Promise<void> {
  await api(`/api/site/${key}`, { method: "PUT", body: JSON.stringify({ json: JSON.stringify(value) }) });
}

/** When each document was last published (null if never). */
export async function publishedKeys(): Promise<Record<string, Date | null>> {
  const { keys } = await api<{ keys: Record<string, string | null> }>("/api/site");
  return Object.fromEntries(Object.entries(keys).map(([key, at]) => [key, at ? new Date(at) : null]));
}

export type Me = { email: string; name: string };

export async function currentUser(): Promise<Me | null> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  return response.ok ? ((await response.json()) as Me) : null;
}

export async function signIn(email: string, password: string, code: string): Promise<Me | null> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, code }),
  });
  return response.ok ? ((await response.json()) as Me) : null;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}
