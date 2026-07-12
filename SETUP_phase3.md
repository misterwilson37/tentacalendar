# SETUP-PHASE3.md — The Calendar Poll (Cloud Functions, step 1 of 3)
**Version 0.1.0** | D75 | Everything here is browser-only — no CLI, no admin rights, works on the school Mac. Budget: realistically **$0/month** at this scale, but a card is required (Blaze).

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

1. Cloud Console search → **Cloud Run functions** → **Create function**.
2. Settings:
   - **Environment:** 2nd gen · **Name:** `pollCalendars` · **Region:** `us-east1`
   - **Trigger:** HTTPS · **Authentication:** **Allow unauthenticated invocations** (the shared secret below is the lock; simplest browser-only path)
3. **Runtime, build… (expand):** Runtime service account: leave the default (note for Part 4). **Runtime environment variables** — add TWO:
   - `POLL_SECRET` = a long random string you invent (25+ chars; save it — you'll use it twice more)
   - `TZ` = `America/Chicago`
4. **Next** → Runtime **Node.js 20** → **Entry point:** `pollCalendars`
5. Inline editor: replace **index.js** with the repo's `functions/index.js`; replace **package.json** with `functions/package.json`.
6. **Deploy** (first build takes a few minutes). Copy the function **URL** from the trigger tab.

## Part 4 — Share the calendars with the robot

1. On the function's **Details** page find **Service account** (looks like `PROJECT_NUMBER-compute@developer.gserviceaccount.com`). Copy that email.
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
2. **Name:** `poll-calendars-hourly` · **Region:** `us-east1` · **Frequency:** `7 * * * *` (hourly at :07 — off the top-of-hour stampede) · **Timezone:** America/Chicago.
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
