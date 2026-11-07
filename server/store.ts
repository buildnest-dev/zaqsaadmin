export type AdminUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Authenticator secret, encrypted with ADMIN_DATA_KEY. */
  totpSecretEnc: string;
  lastTotpStep: number;
  disabled?: boolean;
};
export type SessionRecord = { email: string; expiresAt: number };
export type SiteRecord = { json: string; updatedAt: string | null };

/** Everything the server needs to remember. Firestore in production, memory in tests. */
export interface Store {
  getUser(email: string): Promise<AdminUser | null>;
  putUser(user: AdminUser): Promise<void>;
  /** Marks a code's time step as used. False when that step (or a newer one) was already used. */
  claimTotpStep(email: string, step: number): Promise<boolean>;
  putSession(idHash: string, record: SessionRecord): Promise<void>;
  getSession(idHash: string): Promise<SessionRecord | null>;
  deleteSession(idHash: string): Promise<void>;
  /** Counts an attempt; true while still within `limit` for the window. */
  hit(key: string, limit: number, windowMs: number, now: number): Promise<boolean>;
  clearHits(key: string): Promise<void>;
  getSite(key: string): Promise<SiteRecord | null>;
  listSite(): Promise<Record<string, string | null>>;
  putSite(key: string, json: string, who: string): Promise<void>;
}

export function memoryStore(): Store & { sites: Map<string, SiteRecord>; history: unknown[] } {
  const users = new Map<string, AdminUser>();
  const sessions = new Map<string, SessionRecord>();
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sites = new Map<string, SiteRecord>();
  const history: unknown[] = [];
  return {
    sites,
    history,
    async getUser(email) {
      return users.get(email) ?? null;
    },
    async putUser(user) {
      users.set(user.email, { ...user });
    },
    async claimTotpStep(email, step) {
      const user = users.get(email);
      if (!user || step <= user.lastTotpStep) return false;
      user.lastTotpStep = step;
      return true;
    },
    async putSession(idHash, record) {
      sessions.set(idHash, record);
    },
    async getSession(idHash) {
      return sessions.get(idHash) ?? null;
    },
    async deleteSession(idHash) {
      sessions.delete(idHash);
    },
    async hit(key, limit, windowMs, now) {
      const current = hits.get(key);
      const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
      entry.count += 1;
      hits.set(key, entry);
      return entry.count <= limit;
    },
    async clearHits(key) {
      hits.delete(key);
    },
    async getSite(key) {
      return sites.get(key) ?? null;
    },
    async listSite() {
      return Object.fromEntries([...sites].map(([key, value]) => [key, value.updatedAt]));
    },
    async putSite(key, json, who) {
      const before = sites.get(key);
      if (before) history.push({ key, json: before.json, savedBy: who });
      sites.set(key, { json, updatedAt: new Date().toISOString() });
    },
  };
}
