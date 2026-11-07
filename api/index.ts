import { createApp } from "../server/app.js";
import { firestoreStore } from "../server/firestore-store.js";

/** One function for every API route and /sso/team (see the rewrites in vercel.json). */
let handler: ((request: Request) => Promise<Response>) | undefined;

export default {
  async fetch(request: Request) {
    handler ??= createApp({ store: firestoreStore(), env: process.env });
    return handler(request);
  },
};
