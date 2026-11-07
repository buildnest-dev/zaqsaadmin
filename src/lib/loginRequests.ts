import {
  Timestamp,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Sign-in requests from the team site (team.schools.zaqsa.com). The team site's server creates a
 * request in `login_requests`; an admin here confirms it and a one-time code is generated, which
 * the admin tells the person over the phone. Only a hash of the code is stored. See
 * docs/TEAM_LOGIN.md for the exact contract with the team site.
 */
export type RequestStatus = "pending" | "approved" | "denied" | "used" | "locked";

export type LoginRequest = {
  id: string;
  email: string;
  name: string;
  device: string;
  ip: string;
  createdAt: Date | null;
  status: RequestStatus;
  expiresAt: Date | null;
  decidedBy: string;
  remember: boolean;
};

/** A request nobody has answered within this time is treated as expired. */
export const PENDING_WINDOW_MS = 15 * 60 * 1000;
/** How long a generated code works. */
export const CODE_TTL_MS = 10 * 60 * 1000;

const toDate = (value: unknown): Date | null =>
  value && typeof (value as { toDate?: () => Date }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null;

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function watchRequests(
  onData: (requests: LoginRequest[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(collection(db, "login_requests"), orderBy("createdAt", "desc"), limit(40));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: text(data["email"]),
            name: text(data["name"]),
            device: text(data["device"]),
            ip: text(data["ip"]),
            createdAt: toDate(data["createdAt"]),
            status: (text(data["status"]) || "pending") as RequestStatus,
            expiresAt: toDate(data["expiresAt"]),
            decidedBy: text(data["decidedBy"]),
            remember: data["remember"] === true,
          };
        }),
      ),
    (problem) => onError(problem.message),
  );
}

/** A random 6-digit code (no modulo bias). */
export function generateCode(): string {
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0]! >= 4_294_000_000);
  return String(buffer[0]! % 1_000_000).padStart(6, "0");
}

/** sha256 hex of `${requestId}:${code}`. The team site computes the same to check a typed code. */
export async function hashCode(requestId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${requestId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Confirms the person and returns the code to read out. It cannot be shown again later. */
export async function approve(requestId: string): Promise<string> {
  const code = generateCode();
  await updateDoc(doc(db, "login_requests", requestId), {
    status: "approved",
    codeHash: await hashCode(requestId, code),
    expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS),
    attempts: 0,
    decidedBy: auth.currentUser?.email ?? "",
    decidedAt: serverTimestamp(),
  });
  return code;
}

export const deny = (requestId: string) =>
  updateDoc(doc(db, "login_requests", requestId), {
    status: "denied",
    decidedBy: auth.currentUser?.email ?? "",
    decidedAt: serverTimestamp(),
  });

/** Still waiting for an answer (and not too old). */
export const isPending = (request: LoginRequest, now = Date.now()) =>
  request.status === "pending" && !!request.createdAt && now - request.createdAt.getTime() < PENDING_WINDOW_MS;
