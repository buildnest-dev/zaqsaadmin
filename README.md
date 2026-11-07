<p align="center"><img src="public/icon.png" alt="ZAQSA" width="72" /></p>

# ZAQSA Admin

The control panel for the ZAQSA website. Sign in with an approved Google account and change
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
| Admins | Who can sign in |

Anything you have not published yet keeps showing the content built into the website, so the
site never goes blank. "Reset to website defaults" loads the built-in content back into the form;
nothing changes until you press Publish. Every publish keeps the previous version in the
`site_history` collection.

## One-time setup

1. **Firestore rules.** Firebase console > Firestore Database > Rules: paste
   [`firestore.rules`](firestore.rules) and Publish. Until you do, saving fails with
   "insufficient permissions".
2. **Sign-in domain.** Firebase console > Authentication > Settings > Authorized domains: add the
   admin address (for example `admin.yourdomain.com`) and the `*.vercel.app` address Vercel gives
   you.
3. **Photo uploads.** Cloudinary (cloud name `qiam8gyn`) > Settings > Upload > Add upload preset:
   name `zaqsa_unsigned`, Signing mode **Unsigned**, folder `zaqsa`. Photos are uploaded straight
   from the browser, so no secret key is stored anywhere.
4. **Deploy.** Import this repo in Vercel (framework: Vite, defaults are fine). Then add the
   subdomain under Project > Settings > Domains.
5. **First publish.** Open each admin page once and press Publish so the website starts reading
   from Firestore.

The first admin is `zyqotech@gmail.com`. Add more under *Admins*.

## Run locally

```bash
npm install
npm run dev
```

## How it is built

React + Vite + Firebase (Google sign-in, Firestore). Each editable area is one document at
`site/<name>` in Firestore holding its data as JSON text, which keeps nested content (FAQs,
lists) simple and lets the public website read it with one plain request. Access control lives
in the Firestore rules, not in the page, so it holds even if someone calls the database
directly.

`src/lib/seed.json` is a copy of the website's built-in content, used as the starting point in
each form. Regenerate it if the website's built-in content changes a lot.
