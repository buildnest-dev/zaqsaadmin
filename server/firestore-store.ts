import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import type { AdminUser, SessionRecord, SiteRecord, Store } from "./store.js";

/** FIREBASE_SERVICE_ACCOUNT is the service-account JSON, either as plain JSON or base64 of it. */
function credentialFromEnv(raw: string | undefined) {
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return cert(JSON.parse(text));
}

let cached: Firestore | undefined;
function database(): Firestore {
  if (cached) return cached;
  const app =
    getApps()[0] ?? initializeApp({ credential: credentialFromEnv(process.env["FIREBASE_SERVICE_ACCOUNT"]) });
  cached = getFirestore(app);
  return cached;
}

const toIso = (value: unknown) =>
  value && typeof (value as { toDate?: () => Date }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : null;

/** Collections used here are closed to browsers by the Firestore rules; only this server can touch them. */
export function firestoreStore(db: Firestore = database()): Store {
  const users = db.collection("admin_users");
  const sessions = db.collection("admin_sessions");
  const rate = db.collection("admin_rate");
  const site = db.collection("site");
  const rateRef = (key: string) => rate.doc(key.replace(/\//g, "_"));
  return {
    async getUser(email) {
      const snap = await users.doc(email).get();
      return snap.exists ? (snap.data() as AdminUser) : null;
    },
    async putUser(user) {
      await users.doc(user.email).set(user);
    },
    async claimTotpStep(email, step) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(users.doc(email));
        if (!snap.exists) return false;
        const last = (snap.data() as AdminUser).lastTotpStep ?? 0;
        if (step <= last) return false;
        tx.update(users.doc(email), { lastTotpStep: step });
        return true;
      });
    },
    async putSession(idHash, record: SessionRecord) {
      await sessions.doc(idHash).set(record);
    },
    async getSession(idHash) {
      const snap = await sessions.doc(idHash).get();
      return snap.exists ? (snap.data() as SessionRecord) : null;
    },
    async deleteSession(idHash) {
      await sessions.doc(idHash).delete();
    },
    async hit(key, limit, windowMs, now) {
      const ref = rateRef(key);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data() as { count: number; resetAt: number } | undefined;
        const entry = data && data.resetAt > now ? data : { count: 0, resetAt: now + windowMs };
        entry.count += 1;
        tx.set(ref, entry);
        return entry.count <= limit;
      });
    },
    async clearHits(key) {
      await rateRef(key).delete();
    },
    async getSite(key): Promise<SiteRecord | null> {
      const snap = await site.doc(key).get();
      if (!snap.exists) return null;
      const data = snap.data() as { json?: string; updatedAt?: unknown };
      return { json: String(data.json ?? ""), updatedAt: toIso(data.updatedAt) };
    },
    async listSite() {
      const snap = await site.get();
      return Object.fromEntries(snap.docs.map((d) => [d.id, toIso(d.data()["updatedAt"])]));
    },
    async putSite(key, json, who) {
      const ref = site.doc(key);
      const before = await ref.get();
      if (before.exists) {
        await db
          .collection("site_history")
          .doc(`${key}_${Date.now()}`)
          .set({ key, json: before.data()?.["json"], savedBy: who, savedAt: FieldValue.serverTimestamp() });
      }
      await ref.set({ json, updatedBy: who, updatedAt: FieldValue.serverTimestamp() });
    },
  };
}
