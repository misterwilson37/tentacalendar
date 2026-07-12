// ============================================================
// Tentacalendar — Cloud Functions
// functions/index.js — Version 0.1.1 (D75, Phase 3 step 1: the poll)
// 0.1.1: an UNSET POLL_SECRET now refuses everything with a distinct
// message (previously undefined === undefined let header-less requests
// through an unset lock — Jake's "did I miss the variables?" question
// exposed it). The JSON report now includes tz + localHour, so one
// curl verifies BOTH env vars.
//
// pollCalendars: reads Google Calendar events for every anchor tier
// with a gcalCalendarId and mirrors them into eventsCache. The web
// client has subscribed to eventsCache since v0.1.0 — no client
// changes needed; events appear in the queue the moment this runs.
//
// Deploy: Google Cloud Console inline editor (no CLI — Jake's school
// Mac has no admin rights). See SETUP-PHASE3.md. Plain
// functions-framework style on purpose: it's what the console's
// Cloud Run functions editor expects.
//
// Env vars (set in the console):
//   POLL_SECRET  — shared secret; requests must send x-poll-secret
//   TZ           — America/Chicago (makes all Date math Nashville-local,
//                  including all-day event midnights and sleep hours)
//
// Auth to Calendar: the function's runtime service account, using
// Application Default Credentials. Jake & Katie SHARE their calendars
// with that service account's email ("See all event details") — no
// OAuth dance, no token storage.
// ============================================================

const functions = require("@google-cloud/functions-framework");
const admin = require("firebase-admin");
const { google } = require("googleapis");

const FUNCTIONS_VERSION = "0.1.1";
const WS = "primary"; // one workspace (HANDOFF D12)

admin.initializeApp();
const db = admin.firestore();

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 1 * DAY_MS;    // yesterday's events still matter today
const HORIZON_MS = 60 * DAY_MS;    // two months out

/** Commit writes/deletes in chunks (Firestore batches cap at 500). */
async function commitChunked(ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    ops.slice(i, i + 450).forEach(fn => fn(batch));
    await batch.commit();
  }
}

/** Sleep-hours check (config sleepStart/sleepEnd, default 22–6),
 *  evaluated in TZ (America/Chicago). ?force=1 bypasses for testing. */
function isAsleep(cfg) {
  const hour = new Date().getHours(); // local, thanks to TZ env var
  const s = cfg.sleepStart ?? 22, e = cfg.sleepEnd ?? 6;
  return s > e ? (hour >= s || hour < e) : (hour >= s && hour < e);
}

/** All-day events arrive as bare dates; TZ makes this local midnight.
 *  (Google's all-day `end.date` is EXCLUSIVE — already what we want.) */
function parseWhen(when) {
  if (!when) return null;
  if (when.dateTime) return Date.parse(when.dateTime);
  if (when.date) return new Date(`${when.date}T00:00:00`).getTime();
  return null;
}

functions.http("pollCalendars", async (req, res) => {
  try {
    if (!process.env.POLL_SECRET) {
      // Fail CLOSED: an unset lock must not mean an open door.
      return res.status(403).json({ error: "POLL_SECRET env var is not set on this service — add it under Variables & Secrets and redeploy" });
    }
    if (req.get("x-poll-secret") !== process.env.POLL_SECRET) {
      return res.status(403).json({ error: "bad or missing x-poll-secret" });
    }

    const cfgSnap = await db.doc(`workspaces/${WS}/settings/config`).get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    if (isAsleep(cfg) && req.query.force !== "1") {
      return res.json({ version: FUNCTIONS_VERSION, skipped: "sleep hours" });
    }

    // Anchor tiers with a calendar attached (⚙️ Settings).
    const tiersSnap = await db.collection(`workspaces/${WS}/tiers`).get();
    const calTiers = tiersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.kind === "anchor" && t.gcalCalendarId);
    if (!calTiers.length) {
      return res.json({ version: FUNCTIONS_VERSION, warning: "no anchor tiers have a gcalCalendarId — set them in ⚙️ Settings" });
    }

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
    });
    const cal = google.calendar({ version: "v3", auth });

    const timeMin = new Date(Date.now() - LOOKBACK_MS).toISOString();
    const timeMax = new Date(Date.now() + HORIZON_MS).toISOString();
    const evCol = db.collection(`workspaces/${WS}/eventsCache`);
    const report = {
      version: FUNCTIONS_VERSION,
      tz: process.env.TZ || "(unset — running in UTC; set TZ=America/Chicago)",
      localHour: new Date().getHours(),
      window: { timeMin, timeMax },
      tiers: {}
    };

    for (const tier of calTiers) {
      const lead = tier.defaultLeadWindowMinutes ?? 30;
      const fresh = [];
      let pageToken;
      try {
        do {
          const r = await cal.events.list({
            calendarId: tier.gcalCalendarId,
            singleEvents: true,          // expand recurrences
            orderBy: "startTime",
            timeMin, timeMax,
            maxResults: 250,
            pageToken
          });
          for (const ev of r.data.items || []) {
            if (ev.status === "cancelled") continue;
            const start = parseWhen(ev.start);
            if (start == null) continue;
            fresh.push({
              gcalEventId: ev.id,
              title: ev.summary || "(untitled)",
              start,
              end: parseWhen(ev.end),
              tierId: tier.id,
              leadWindowMinutes: lead,
              allDay: !!ev.start?.date,
              syncedAt: Date.now()
            });
          }
          pageToken = r.data.nextPageToken;
        } while (pageToken);
      } catch (err) {
        // Most common cause: calendar not shared with the service
        // account, or a typo'd calendar ID. Report and keep going —
        // one bad tier must not starve the others.
        report.tiers[tier.name] = { error: String(err.message || err) };
        continue;
      }

      // Idempotent sync: replace this tier's slice of the cache.
      const oldSnap = await evCol.where("tierId", "==", tier.id).get();
      const ops = [];
      oldSnap.docs.forEach(d => ops.push(b => b.delete(d.ref)));
      fresh.forEach(e => ops.push(b => b.set(evCol.doc(), e)));
      await commitChunked(ops);
      report.tiers[tier.name] = { removed: oldSnap.size, written: fresh.length };
    }

    return res.json(report);
  } catch (err) {
    console.error("pollCalendars failed:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});
