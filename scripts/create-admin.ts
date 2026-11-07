/**
 * Creates (or re-enrols) one admin sign-in: asks for a password, makes a new authenticator
 * secret and shows it as a QR code. Nothing is stored in this repo and there is no default
 * password: the password is typed here once, hashed, and only the hash is saved.
 *
 *   npm run create-admin -- you@example.com "Your Name"
 *
 * Needs FIREBASE_SERVICE_ACCOUNT, ADMIN_DATA_KEY and ADMIN_ALLOWED_EMAILS in the environment
 * (the same values as in Vercel). Running it again for the same email replaces the password and
 * the authenticator, which is also how a lost phone is recovered.
 */
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import QRCode from "qrcode";
import { encrypt, newTotpSecret, otpauthUri } from "../server/crypto.js";
import { allowedEmails } from "../server/env.js";
import { firestoreStore } from "../server/firestore-store.js";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = (text) => {
        if (text.includes(question)) process.stdout.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
const name = (process.argv[3] ?? "").trim() || email.split("@")[0] || "Admin";
const dataKey = process.env["ADMIN_DATA_KEY"] ?? "";

if (!email) throw new Error('Usage: npm run create-admin -- you@example.com "Your Name"');
if (dataKey.length < 32) throw new Error("ADMIN_DATA_KEY must be set and at least 32 characters.");
if (!allowedEmails(process.env).includes(email)) {
  throw new Error(`${email} is not in ADMIN_ALLOWED_EMAILS. Add it there first.`);
}

const password = await ask("Choose a password (12+ characters): ", true);
if (password.length < 12) throw new Error("Password must be at least 12 characters.");
if ((await ask("Type it again: ", true)) !== password) throw new Error("The passwords do not match.");

const secret = newTotpSecret();
const store = firestoreStore();
const existing = await store.getUser(email);
await store.putUser({
  id: existing?.id ?? randomUUID(),
  email,
  name,
  passwordHash: await bcrypt.hash(password, 12),
  totpSecretEnc: encrypt(secret, dataKey),
  lastTotpStep: 0,
});

console.log("\nScan this QR code with an authenticator app (Google Authenticator, Authy, 1Password…):\n");
console.log(await QRCode.toString(otpauthUri(email, secret), { type: "terminal", small: true }));
console.log(`Or type this key in by hand: ${secret}`);
console.log(`\nDone. ${email} can now sign in at admin.zaqsa.com with the password and the 6-digit code.`);
process.exit(0);
