# SETUP.md — Tentacalendar Phase 1 Setup Guide
**Version 0.2.1** | Everything here is doable in ~20 minutes, costs $0, and needs no credit card.

> **v0.2.0 notes:** config.js now ships with BOTH allowlist emails already filled in (Jake + Katie) — only the Firebase config values still need pasting. **Recommended browser: Microsoft Edge, signed into your PERSONAL Google account** (Chromium core without the county-managed-Chrome problem, and none of Brave's shields that eat OAuth popups; works identically on Mac and PC). Safari also works. The sumnerk12.net account isn't on the allowlist — personal accounts only. Calendar IDs now live on each Calendar-type tier in ⚙️ Settings, with the where-to-find-it instructions in the field itself.

You've already done step 0 (repo + CNAME). Gold star. 🐙

---

## Part 1 — Create the Firebase project (free Spark plan)

1. Go to **https://console.firebase.google.com** signed in as **jacob.v.wilson@gmail.com**.
2. **Add project** → name it `tentacalendar`. (Firebase may append random characters to the project ID — that's fine.)
3. **Disable Google Analytics** when asked (we don't need it; one less thing).
4. Wait for creation, hit **Continue**.

> **Why no Blaze plan yet?** Cloud Functions (the GCal poll, task mirror, and midnight carryover) don't arrive until phase 3. Phase 1 — auth, database, live queue — runs entirely on the free Spark plan. You get to find out whether Katie's brain likes this thing before any card exists in the system.

## Part 2 — Turn on Authentication

1. Left sidebar → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → click **Google** → toggle **Enable**.
3. Set the support email to jacob.v.wilson@gmail.com → **Save**.
4. Still in Authentication → **Settings** tab → **Authorized domains** → **Add domain**:
   - `tentacalendar.misterwilson.org`
   - Your `*.github.io` domain is NOT needed if you only use the custom domain, but adding `YOURUSERNAME.github.io` too doesn't hurt during testing.
   - `localhost` is pre-authorized — useful if you ever test locally.

> **What this does:** Google sign-in popups only work on domains Firebase trusts. This is the step people forget, and the symptom is a popup that opens and instantly closes with an `auth/unauthorized-domain` error. Now you know.

## Part 3 — Create the Firestore database

1. Left sidebar → **Build → Firestore Database** → **Create database**.
2. Location: **nam5 (United States)** multi-region is fine; **us-east1** also fine. (Cannot be changed later — either is correct for Nashville.)
3. Choose **Start in production mode** (locked down — our rules open it to exactly two people).
4. Once created → **Rules** tab → delete everything there → paste the full contents of **firestore.rules** from the repo.
5. **IMPORTANT:** edit `KATIE_EMAIL_HERE@gmail.com` to Katie's actual Gmail **before** clicking **Publish**.

> **What this does:** These rules mean that even though the Firebase config in config.js is publicly visible on GitHub (that's normal and safe — it's an identifier, not a secret), nobody except your two Google accounts can read or write a single byte.

## Part 4 — Register the web app & get your config

1. Firebase console home → click the **</>** (Web) icon ("Add app").
2. Nickname: `tentacalendar-web`. Do **NOT** check Firebase Hosting (GitHub Pages is our host).
3. **Register app.** It shows a `firebaseConfig` code block.
4. Copy the six values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) into the matching fields in **config.js**.
5. ALLOWED_EMAILS already contains both of your addresses as of v0.3.0 — just confirm they match firestore.rules exactly.

## Part 5 — Deploy

1. Commit all files to the repo root (index.html, app.js, store.js, queue.js, config.js, tentacalendar.css, plus HANDOFF.md/SETUP.md/firestore.rules for the record).
2. Repo → **Settings → Pages** → confirm source is your main branch, root folder, and the custom domain shows tentacalendar.misterwilson.org with **Enforce HTTPS** checked (may take a few minutes to certify a new CNAME).
3. Visit **https://tentacalendar.misterwilson.org** → Sign in with Google → you should land on an empty queue with "The octopus rests."

First sign-in by either of you auto-seeds the workspace: your six tiers (Home, Business, Work, Family, Personal, Taiko in ROYGBIV), and default settings (9 AM carryover, hourly calendar poll, 10 PM–6 AM sleep).

## Part 6 — Smoke test (do these in order)

1. **Add a task** due 5 minutes ago, Work tier, nag every 1 hour → it should appear at the top of Work with ❗ overdue, original time struck through, next nag slot shown.
2. **Add a task** due tomorrow → use the ▶ arrow to see it on tomorrow's queue; it should NOT be on today.
3. **Check off** task 1 → it moves to "Done today" with a ✓ and a timestamp.
4. On any task, hit **↳** → create a follow-up "+3 days." It appears under "Waiting on…". Complete the parent → the follow-up materializes 3 days out (check with ▶▶▶).
5. Open the same URL **on your phone** while watching the big screen: check something off on the phone → the other screen updates in about a second. That's Firestore live sync, and it's the whole reason we built on it.
6. Open **⚙️ Settings** → rename a tier, change a color → queue chips update live.

## Troubleshooting quick hits

- **Popup opens & closes instantly** → Part 2 step 4 (authorized domains).
- **"Missing or insufficient permissions"** → rules email doesn't exactly match the signed-in account (check for typos, or you published rules before editing Katie's email).
- **Settings modal is open on page load, covering the sign-in screen** → you're running cached pre-0.3.0 CSS. Hard-refresh (Cmd+Shift+R). If it persists, verify tentacalendar.css?v=0.3.0 in index.html actually deployed.
- **Version number in the header doesn't match what you shipped** → hard-refresh (Ctrl+Shift+R); the ?v= query strings on script/css tags handle most cache-busting, but the browser can cling to index.html itself.
- **Signed in but bounced back to the sign-in screen** → the account you picked isn't in ALLOWED_EMAILS in config.js.
