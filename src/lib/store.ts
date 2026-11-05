import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import seed from "./seed.json";
import { HOME_DEFAULT, type DocKey, type SiteDocs } from "./types";

const SEED: SiteDocs = { ...(seed as unknown as Omit<SiteDocs, "home">), home: HOME_DEFAULT };

export const defaultsFor = <K extends DocKey>(key: K): SiteDocs[K] =>
  structuredClone(SEED[key]) as SiteDocs[K];

/** Read one document; null when it has never been saved (the site then uses its built-in content). */
export async function loadDoc<K extends DocKey>(key: K): Promise<SiteDocs[K] | null> {
  const snap = await getDoc(doc(db, "site", key));
  if (!snap.exists()) return null;
  try {
    return JSON.parse(snap.data()["json"] as string) as SiteDocs[K];
  } catch {
    return null;
  }
}

/** Save one document and keep the previous version in `site_history` so a mistake can be undone. */
export async function saveDoc<K extends DocKey>(key: K, value: SiteDocs[K]): Promise<void> {
  const ref = doc(db, "site", key);
  const before = await getDoc(ref);
  const who = auth.currentUser?.email ?? "unknown";
  if (before.exists()) {
    await setDoc(doc(db, "site_history", `${key}_${Date.now()}`), {
      key,
      json: before.data()["json"],
      savedBy: who,
      savedAt: serverTimestamp(),
    });
  }
  await setDoc(ref, { json: JSON.stringify(value), updatedBy: who, updatedAt: serverTimestamp() });
}

export async function listAdmins(): Promise<string[]> {
  const snap = await getDocs(collection(db, "admins"));
  return snap.docs.map((d) => d.id).sort();
}
export const addAdmin = (email: string) =>
  setDoc(doc(db, "admins", email.trim().toLowerCase()), { addedBy: auth.currentUser?.email ?? "" });
export const removeAdmin = (email: string) => deleteDoc(doc(db, "admins", email));

/** True when a document has been published at least once. */
export async function publishedKeys(): Promise<Record<string, Date | null>> {
  const snap = await getDocs(collection(db, "site"));
  const out: Record<string, Date | null> = {};
  snap.docs.forEach((d) => {
    const at = d.data()["updatedAt"] as { toDate?: () => Date } | undefined;
    out[d.id] = at?.toDate?.() ?? null;
  });
  return out;
}
