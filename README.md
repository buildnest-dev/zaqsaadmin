<p align="center"><img src="public/icon.png" alt="ZAQSA" width="72" /></p>

# ZAQSA Admin

The control panel for the ZAQSA website. Sign in (password + authenticator code) and change
services, team, the home page text, the home showcase and company details. Changes are published
to Firestore and the public website picks them up within about a minute — no redeploy needed.

## What it manages

| Page in the admin | What changes on the website |
| --- | --- |
| Landing page | Home hero text, button text, the "eight ways to grow" heading |
| Services | Every service page and the services list: add, edit, reorder, delete, photo |
| Home showcase | The pinned core-service cards on the home page |
| Team | Founders and engineers on the About page, with photos |
| Company & contact | Phone, email, address, tagline in the footer and contact page |

Anything you have not published yet keeps showing the content built into the website, so the
site never goes blank. "Reset to website defaults" loads the built-in content back into the form;
nothing changes until you press Publish. Every publish keeps the previous version in the
`site_history` collection.

## Sign-in

Only emails in `ADMIN_ALLOWED_EMAILS` can sign in, with **password + a 6-digit authenticator code**.
There is no default password anywhere. Five wrong attempts per email or per IP lock that email/IP
for 15 minutes. Sessions last 8 hours (host-only, httpOnly cookie) and end on Sign out.

This site is also the only place ZAQSA team members sign in for the school platform:
`GET /sso/team?return=…&state=…` sends a signed-in person to the team site with a 60-second
signed token (HS256, `SSO_SHARED_SECRET`).

## One-time setup

1. **Environment variables** (Vercel > Settings > Environment Variables, see `.env.example`):
   `ADMIN_ALLOWED_EMAILS`, `SSO_SHARED_SECRET`, `TEAM_CALLBACK_URL`, `ADMIN_DATA_KEY`,
   `FIREBASE_SERVICE_ACCOUNT`. Redeploy after adding them.
2. **Firestore rules.** Publish [`firestore.rules`](firestore.rules) (Firebase console > Firestore
   Database > Rules). Browsers can then only read the website content; all writes go through the server.
3. **First sign-in.** On your own computer, with the same five values in the environment:
   `npm run create-admin -- you@example.com "Your Name"`. It asks for a password, stores only its
   hash and shows a QR code for your authenticator app. Run it again for the same email to reset
   the password or move to a new phone.
4. **Photo uploads.** Cloudinary (cloud name `qiam8gyn`) > Settings > Upload > Add upload preset:
   name `zaqsa_unsigned`, Signing mode **Unsigned**, folder `zaqsa`.
5. **Deploy.** Vercel (framework: Vite, defaults are fine) and the `admin.zaqsa.com` domain.
6. **First publish.** Open each admin page once and press Publish.

## Run locally

```bash
npm install
npm run dev
```

## How it is built

React + Vite for the pages, and one Vercel function (`api/index.ts`, code in `server/`) for
sign-in, sessions, saving and the team hand-off. Each editable area is one document at
`site/<name>` in Firestore holding its data as JSON text, which lets the public website read it
with one plain request. Admin accounts, sessions and rate limits live in Firestore collections that
browsers cannot touch.

`npm test` runs the server tests. `src/lib/seed.json` is a copy of the website built-in content.
