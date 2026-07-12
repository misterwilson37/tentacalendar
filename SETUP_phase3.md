# SETUP-PHASE3.md — The Calendar Poll (Cloud Functions, step 1 of 3)
**Version 0.1.5** | D75/D79/D80 | Everything here is browser-only — no CLI, no admin rights, works on the school Mac. Budget: realistically **$0/month** at this scale, but a card is required (Blaze).

**What you get:** every hour, `pollCalendars` reads the Google Calendars attached to your anchor tiers (Home, Business) and mirrors events into `eventsCache`. The web app has been subscribed to that collection since v0.1.0 — events appear in the Today queue (with 30-min pin behavior) the moment the first poll runs. **No client deploy needed.**

**The auth trick:** no OAuth. The function runs as a *service account* — a robot Google identity with an email address. You and Katie share your calendars with that email like it's a person. Read-only.

---

## Part 1 — Upgrade to Blaze (one-time)

1. **console.firebase.google.com** → tentacalendar project → ⚙️ next to Project Overview → **Usage and billing** → **Details & settings** → **Modify plan** → **Blaze**.
2. Attach a card. Then, IMPORTANT: **Budgets & alerts** → create a **$5 budget** with email alerts at 50/90/100%. (Expected spend: pennies. The alert is the smoke detector.)

## Part 2 — Enable the APIs (one-time)

Go to **console.cloud.google.com** (same Google account; pick the **tentacalendar** project in the top bar). Search box → enable each of:
1. **Google Calendar API**
2. **Cloud Run Admin API** (functions run on Cloud Run now)
3. **Cloud Build API**
4. **Cloud Scheduler API**

## Part 3 — Create the function (the paste job)
*(Rewritten 0.1.1 — Google folded Functions into Cloud Run, so your screen says "Deploy a web service / Create a batch job / Write a function." That last section is us.)*

1. On that Cloud Run screen, under **Write a function**, click the **Node.js** tile.
2. Top of the form:
   - **Service name:** `pollcalendars` — **all lowercase** (Cloud Run enforces it; only the *entry point* keeps the capital C)
   - **Region:** `us-east1`
   - **Runtime:** Node.js 20 if offered, otherwise the newest Node LTS (the code is compatible)
3. The rest of the form, top to bottom (0.1.2 — matches the form field-for-field):
   - **Trigger (optional):** SKIP — do not Add trigger. The service URL is HTTP-invocable by default; Scheduler just calls it.
   - **Authentication:** **Allow public access** (Google's IAM layer off; our x-poll-secret header is the actual lock)
   - **Billing:** **Request-based** (default — you pay for seconds of actual polling, not idle time)
   - **Service scaling:** **Auto**, **minimum 0** (scales to zero between polls = free; ignore the "set to 1" cold-start nudge — irrelevant for an hourly cron), **maximum 1** (this job never needs parallelism; caps any retry storm)
   - **Ingress:** **All** (NOT Internal — Scheduler and your curl arrive from the public internet); leave the load-balancer checkbox unchecked
4. Expand **Containers, Volumes, Networking, Security** → **Variables & Secrets** tab → **Add variable**, twice:
   - `POLL_SECRET` = a long random string you invent — 25–40 chars, **letters/digits/dashes only** (it travels in an HTTP header)
   - `TZ` = `America/Chicago`

> **What IS the poll secret?** A password you invent for the function. The URL allows public access, so the function's first line rejects any request that doesn't carry a matching `x-poll-secret` header. Without it, a stranger with the URL could only trigger extra polls (nuisance + pennies — they can't read or change your data), and with the secret they can't even do that. **You'll use it exactly twice more:** the curl test (Part 5) and the Scheduler header (Part 6) — then never in daily life. **Don't memorize it, don't commit it:** it lives ONLY in this env var and the Scheduler job, and it's always recoverable in the console (service → Edit & deploy new revision → Variables & Secrets). Contrast with config.js's Firebase values, which are safe on GitHub — those are identifiers; this is a key.
5. **Create.** You land in the inline **source editor**:
   - **Function entry point:** `pollCalendars` (capital C lives here)
   - Replace **index.js** with the repo's `functions/index.js`; replace **package.json** with `functions/package.json`
   - **Save and redeploy** (first build takes a few minutes)
6. The service **URL** sits at the top of the service page — copy it **to a scratch note**: it's used in exactly two places, the curl test (Part 5) and the Scheduler target (Part 6). **The URL is NOT a secret** — it's the street address; POLL_SECRET is the key. Strangers with the address get 403s.
7. **Did the variables take?** Two checks: (a) service → **Revisions** tab → current revision → its panel lists env vars in plain text; (b) better, the Part-5 curl report now prints `"tz"` (should say America/Chicago) and refuses with a distinct `"POLL_SECRET env var is not set"` message if you missed that one (functions 0.1.1 fails closed).

## Part 4 — Share the calendars with the robot

1. Find the **Service account** email (Jake's confirmed path: **Services** in the left nav → click `pollcalendars` → **Revisions** tab → under the latest deployment, **Security** in the right-hand panel). It looks like `PROJECT_NUMBER-compute@developer.gserviceaccount.com` — the number matches the messagingSenderId in config.js, a handy sanity check (looks like `PROJECT_NUMBER-compute@developer.gserviceaccount.com`). Copy that email.
2. **Jake and Katie, each, in Google Calendar (web):** hover the calendar in the left list → ⋮ → **Settings and sharing** → **Share with specific people or groups** → **Add** → paste the service-account email → permission **"See all event details"** → Send.
3. While you're there, copy each calendar's **Calendar ID** (Settings → *Integrate calendar* → Calendar ID; personal primaries are just your Gmail address).
4. In **Tentacalendar → ⚙️ Settings**, paste each Calendar ID into its anchor tier (Home, Business). The field's placeholder repeats these instructions.

## Part 5 — Test by hand (Terminal.app — curl needs no admin)

```
curl -H "x-poll-secret: YOUR_SECRET" "https://YOUR-FUNCTION-URL?force=1"
```
(`force=1` bypasses sleep hours for testing.) You should get JSON like `{"tiers":{"Home":{"removed":0,"written":17}, …}}`.
- `"error":"bad or missing x-poll-secret"` → header typo.
- A tier reporting `notFound`/`forbidden` → that calendar isn't shared with the robot, or the ID has a typo.
- Then check **Firestore → workspaces/primary/eventsCache** — documents! — and open the app: events in the queue under their tier chips.

## Part 6 — Put it on a schedule

1. Cloud Console → **Cloud Scheduler** → **Create job**.
2. **Name:** `poll-calendars-hourly` (Scheduler allows dashes) · **Region:** `us-east1` · **Frequency:** `7 * * * *` (hourly at :07 — off the top-of-hour stampede) · **Timezone:** America/Chicago.
3. **Target:** HTTP · **URL:** the function URL (no `?force=1` — sleep hours apply) · **Method:** GET · **Headers:** add `x-poll-secret` = your secret.
4. Create, then **Force run** once and check its status turns green.

> The `pollIntervalMinutes` field in app settings is informational for now — the actual cadence lives in this Scheduler job. Change the cron here if you ever want a different rhythm.

## Smoke tests (Phase 3, step 1)

- QQQ. `curl` with `force=1` returns a per-tier written count; eventsCache populates.
- RRR. Today queue shows today's Home/Business events, sorted by time among the tasks; an event starting within 30 min pins to the top.
- SSS. Add an event on your phone's Google Calendar → after the next hourly run (or a forced one), it's in the queue. Delete one → it vanishes after the next run (full-replace sync).
- TTT. Curl during sleep hours WITHOUT `force=1` → `{"skipped":"sleep hours"}`.
- UUU. Wrong secret → 403. No secret → 403.

## What's next (in Jake's confirmed order, D75)
1. ✅ **Poll** (this document)
2. **Mirror** — dated tasks pushed *to* GCal (`mirroredGcalEventId` field has been waiting in the schema since v0.1.0; needs calendar **write** permission for the robot: "Make changes to events")
3. **Carryover** — the 9 AM writes (`carryoverWriteHour`), a second Scheduler job
