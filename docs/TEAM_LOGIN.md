# Team site sign-in via admin approval

How someone gets into `team.schools.zaqsa.com` (School OS): they ask to sign in, a ZAQSA admin
confirms them on `admin.zaqsa.com` and reads them a one-time code over the phone, they type it.
Optional "remember this device" keeps them from being asked every time.

The two sites share one Firestore collection, `login_requests` (project `zaqsa2026-44d9f`).
**The team site's server** (never the browser) writes to it with a Firebase **service account**,
which ignores Firestore rules. Admins use the admin site, which can only read requests and confirm
or reject them (see `firestore.rules`).

## Flow

1. Person enters their ZAQSA team email on the team site (and ticks "remember me" if they want).
   The team site first checks the email belongs to an active team account and has no valid
   "remembered device" cookie. Only then does it create a request:

   `login_requests/{id}` (use an unguessable random id, 20+ chars)

   | field | value |
   | --- | --- |
   | `email` | lowercase team email |
   | `name` | their name (shown to the admin) |
   | `device` | short text, e.g. browser + OS from the User-Agent |
   | `ip` | their IP |
   | `status` | `"pending"` |
   | `remember` | `true` / `false` |
   | `createdAt` | server timestamp |

2. The admin site shows it live (badge, banner, page "Team sign-ins"). The admin confirms, and the
   site writes `status: "approved"`, `codeHash`, `expiresAt` (now + 10 min), `attempts: 0`,
   `decidedBy`, `decidedAt`. Or the admin rejects: `status: "denied"`.

3. The team site shows a "Enter the code" box and checks the request on the server:

   - Load `login_requests/{id}` and require: `status == "approved"`, `expiresAt` in the future,
     `email` equals the email this browser asked for, and `attempts < 5`.
   - Compute `sha256_hex(id + ":" + code)` and compare it with `codeHash` (constant time).
   - Wrong code: increment `attempts`. At 5, set `status: "locked"`.
   - Right code: set `status: "used"` **in a transaction** (so a code works once), then create the
     team session. If `remember` is true, also set a long-lived trusted-device cookie (for example
     30 days, httpOnly, secure, host-only) tied to this email.
   - A request still `pending` after 15 minutes is expired: ignore it.

4. The team site polls (or listens) so it can tell the person "waiting for approval", "approved,
   enter the code", or "rejected".

## Code hash test vector

`sha256_hex("req123:482913")` = `07f3038d83bea185157dc82278fd322191825d640d9b636f86a60ebc1bd58ec6`

## Rules of the road

- Only the server may touch `login_requests`, and the service-account key stays in server env
  variables only. Never put it in browser code or commit it.
- Rate-limit creating requests (per email and per IP) so the admin screen cannot be flooded.
- Never log codes or the service-account key.
- Remembered devices should be revocable (a "sign out everywhere" or a per-user version number
  checked on every request) and should end if the team account is disabled.
