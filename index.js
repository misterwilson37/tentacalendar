// ============================================================
// Tentacalendar — Cloud Functions
// functions/index.js — Version 0.4.0 (D135, the poll reconcile)
// 0.4.0: pollCalendars RECONCILES instead of replacing. It used to delete
// every cached event and re-write all of them under new auto-ids every
// hour regardless of change — ~180 document changes pushed to every open
// tab per run, ~2,900 billed reads per tab per day, scaling with users.
// Now: docs are keyed {tierId}_{gcalEventId} (what HANDOFF §3 always
// specified; the code had drifted to auto-ids, which is WHY nothing could
// be compared), only genuinely-changed events are written, and only
// vanished ones deleted. syncedAt was REMOVED from the payload — it was
// never read anywhere, and being Date.now() it would have made every doc
// differ every run and defeated the whole fix. Legacy auto-id docs delete
// themselves on the first run (they're not in the wanted set). Same
// discipline mirrorTasks has used since 0.2.0. No client change needed:
// nothing keys off an event's doc id, and eventsCache is read-only display.
// 0.3.0: PHASE 3 IS COMPLETE. Third job, ?job=carryover (and in "all"):
// 0.3.0: PHASE 3 IS COMPLETE. Third job, ?job=carryover (and in "all"):
// a task in a ❗ midnightCarryover tier that was due before today began
// and still isn't checked gets "❗ <task>" on today's calendar at
// config.carryoverWriteHour (default 9), tomato colorId 11 — D14, the
// "nothing silently disappears" promise. Deliberately NOT hour-triggered:
// "due before today started" is true whenever it runs, so the first
// waking tick (~06:07, past the 22–6 sleep gate) writes the 9 AM landing
// and no cron hiccup can skip a morning. Its own tag namespace
// (tcApp=tentacalendar-carryover) so the mirror — same calendar, keyed by
// tcTaskId — can't see these and patch the ❗ back to the due time.
// Reconciles TODAY only: create / re-time / delete-when-done; history stands.
// 0.2.0: one service, two jobs, routed by ?job= — "poll" (default),
// "mirror", or "all" (what the Scheduler should call). The mirror
// reconciles dated, incomplete tasks onto a DEDICATED write-shared
// calendar (cfg.mirrorCalendarId): create missing, patch drifted
// (title/time), delete completed/deleted/undated. Events are tagged
// with extendedProperties.private.tcTaskId, so the CALENDAR is the
// sync ledger — no task-doc writes, no schema changes. Honest due
// times only (escalation theater stays in the app). 30-min blocks.
// LOOP GUARD: refuses to mirror into any calendar attached to a tier.
// Scope widened readonly → calendar (rw).
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

const FUNCTIONS_VERSION = "0.4.0";
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

/** Local midnight of the day containing ts (TZ env makes this Nashville). */
function startOfLocalDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

/** YYYY-MM-DD in LOCAL time — half of a carryover event's identity. */
function localDateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** config.carryoverWriteHour, sane-guarded (D14 default 9 AM). */
function carryHour(cfg) {
  const n = parseInt(cfg.carryoverWriteHour, 10);
  return (!isNaN(n) && n >= 0 && n <= 23) ? n : 9;
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

    const tiersSnap = await db.collection(`workspaces/${WS}/tiers`).get();
    const allTiers = tiersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const calTiers = allTiers.filter(t => t.kind === "anchor" && t.gcalCalendarId);

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/calendar"] // rw: the mirror writes
    });
    const cal = google.calendar({ version: "v3", auth });
    const job = String(req.query.job || "poll").toLowerCase();

    const report = {
      version: FUNCTIONS_VERSION,
      tz: process.env.TZ || "(unset — running in UTC; set TZ=America/Chicago)",
      localHour: new Date().getHours(),
      job,
      jobs: {}
    };

    if (job === "poll" || job === "all") {
      report.jobs.poll = calTiers.length
        ? await runPoll(cal, calTiers)
        : { warning: "no anchor tiers have a gcalCalendarId — set them in ⚙️ Settings" };
    }
    if (job === "mirror" || job === "all") {
      try {
        report.jobs.mirror = await runMirror(cal, cfg, allTiers);
      } catch (err) {
        report.jobs.mirror = { error: String(err.message || err) };
      }
    }
    if (job === "carryover" || job === "all") {
      try {
        report.jobs.carryover = await runCarryover(cal, cfg, allTiers);
      } catch (err) {
        report.jobs.carryover = { error: String(err.message || err) };
      }
    }

    return res.json(report);
  } catch (err) {
    console.error("sync failed:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

/** Phase 3 step 1: calendars → eventsCache (unchanged logic, extracted). */
async function runPoll(cal, calTiers) {
  const timeMin = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const timeMax = new Date(Date.now() + HORIZON_MS).toISOString();
  const evCol = db.collection(`workspaces/${WS}/eventsCache`);
  const out = { window: { timeMin, timeMax }, tiers: {} };

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
              allDay: !!ev.start?.date
            });
          }
          pageToken = r.data.nextPageToken;
        } while (pageToken);
      } catch (err) {
        // Most common cause: calendar not shared with the service
        // account, or a typo'd calendar ID. Report and keep going —
        // one bad tier must not starve the others.
        out.tiers[tier.name] = { error: String(err.message || err) };
        continue;
      }

      // D135 — RECONCILE, don't replace. This used to delete every doc for
      // the tier and re-`set` all of them under FRESH AUTO-IDs, every hour,
      // whether or not anything had changed. Cost: ~90 deletes + ~90 writes
      // server-side per run, and — the expensive part — ~180 document
      // changes pushed to EVERY connected client's eventsCache listener,
      // ~16 times a day. That's ~2,900 billed reads per open tab per day
      // for data that almost never changes, and it scaled with user count,
      // which is precisely what made the app expensive to share.
      //
      // Two things had to be true to fix it, and the second is the one that
      // would have silently defeated a naive attempt:
      //   1. A STABLE KEY. Auto-ids made every doc unrecognisable next run,
      //      so nothing could be compared. HANDOFF §3 always said
      //      eventsCache/{gcalEventId}; the implementation had drifted.
      //      Prefixed with the tier id because the SAME calendar event can
      //      appear on two calendars (shared/invited), and a bare event-id
      //      key would let two tiers fight over one doc forever.
      //   2. syncedAt: Date.now() WAS IN THE PAYLOAD. Every doc would have
      //      differed on every run and "write only what changed" would have
      //      written everything anyway. Nothing in the codebase ever read
      //      it, so it's gone rather than excluded — keeping it and writing
      //      only on change would make it mean "last CHANGED", which is a
      //      lie in a field called syncedAt.
      // This is the same discipline mirrorTasks has used since D81, twenty
      // lines below. The poll was the odd one out.
      const oldSnap = await evCol.where("tierId", "==", tier.id).get();
      const have = new Map();
      oldSnap.docs.forEach(d => have.set(d.id, d.data()));

      const ops = [];
      const wanted = new Set();
      let created = 0, updated = 0, removed = 0;
      for (const e of fresh) {
        const key = eventDocId(tier.id, e.gcalEventId);
        if (!key) { ops.push(b => b.set(evCol.doc(), e)); created++; continue; } // no usable id: old behaviour
        wanted.add(key);
        const cur = have.get(key);
        if (!cur) { ops.push(b => b.set(evCol.doc(key), e)); created++; }
        else if (eventChanged(cur, e)) { ops.push(b => b.set(evCol.doc(key), e)); updated++; }
      }
      // Anything of this tier's that the calendar no longer has — including
      // every legacy auto-id doc, which migrates itself away on first run.
      for (const key of have.keys()) {
        if (!wanted.has(key)) { ops.push(b => b.delete(evCol.doc(key))); removed++; }
      }
      await commitChunked(ops);
      out.tiers[tier.name] = { created, updated, removed, unchanged: fresh.length - created - updated };
  }
  return out;
}

/** D135 — deterministic doc id. Firestore reserves ids matching __.*__ and
 *  forbids "/", so the event id is sanitised; the tier prefix keeps two
 *  calendars holding the same event from overwriting each other. */
function eventDocId(tierId, gcalEventId) {
  if (!tierId || !gcalEventId) return null;
  return `${tierId}_${String(gcalEventId).replace(/[^A-Za-z0-9_-]/g, "-")}`.slice(0, 400);
}

/** D135 — the fields that actually MATTER to the client. syncedAt is
 *  deliberately absent (it no longer exists); anything not listed here
 *  changing does not justify a write, because a write costs every open
 *  tab a read. */
const EVENT_FIELDS = ["gcalEventId", "title", "start", "end", "tierId", "leadWindowMinutes", "allDay"];
function eventChanged(cur, next) {
  return EVENT_FIELDS.some(f => (cur[f] ?? null) !== (next[f] ?? null));
}

/** Phase 3 step 2 (D81): tasks → the dedicated mirror calendar.
 *  Reconcile, don't append: the calendar's tcTaskId tags ARE the
 *  ledger. Dated + incomplete tasks exist there; everything else
 *  gets removed. Honest dueAt only — no escalation theater. */
async function runMirror(cal, cfg, allTiers) {
  const calId = (cfg.mirrorCalendarId || "").trim();
  if (!calId) return { skipped: "no mirrorCalendarId in ⚙️ Settings → Calendar" };
  // LOOP GUARD: mirroring into a polled calendar would feed every
  // task back into the queue as its own doppelgänger anchor.
  const clash = allTiers.find(t => t.gcalCalendarId === calId);
  if (clash) return { error: `mirrorCalendarId is the same calendar tier "${clash.name}" polls — that's a feedback loop. Use a dedicated calendar.` };

  const tierName = {};
  allTiers.forEach(t => { tierName[t.id] = t.name; });

  const tasksSnap = await db.collection(`workspaces/${WS}/tasks`).get();
  const want = new Map(); // taskId → desired event fields
  tasksSnap.docs.forEach(d => {
    const t = d.data();
    if (!t.dueAt || t.completedAt) return;   // waiting + done don't mirror
    want.set(d.id, { title: t.title || "(untitled)", dueAt: t.dueAt, tier: tierName[t.tierId] || "" });
  });

  const have = new Map(); // taskId → existing event
  let pageToken;
  do {
    const r = await cal.events.list({
      calendarId: calId,
      privateExtendedProperty: "tcApp=tentacalendar",
      maxResults: 250,
      pageToken
    });
    (r.data.items || []).forEach(ev => {
      if (ev.status === "cancelled") return;
      const tid = ev.extendedProperties?.private?.tcTaskId;
      if (tid) have.set(tid, ev);
    });
    pageToken = r.data.nextPageToken;
  } while (pageToken);

  const body = (id, w) => ({
    summary: w.title,
    description: `Tentacalendar${w.tier ? " · " + w.tier : ""}`,
    start: { dateTime: new Date(w.dueAt).toISOString() },
    end: { dateTime: new Date(w.dueAt + 30 * 60000).toISOString() },
    extendedProperties: { private: { tcApp: "tentacalendar", tcTaskId: id } }
  });

  let created = 0, updated = 0, removed = 0;
  for (const [id, w] of want) {
    const ev = have.get(id);
    if (!ev) {
      await cal.events.insert({ calendarId: calId, requestBody: body(id, w) });
      created++;
    } else {
      const evStart = ev.start?.dateTime ? Date.parse(ev.start.dateTime) : null;
      if (ev.summary !== w.title || evStart !== w.dueAt) {
        await cal.events.patch({ calendarId: calId, eventId: ev.id, requestBody: body(id, w) });
        updated++;
      }
    }
  }
  for (const [id, ev] of have) {
    if (!want.has(id)) {
      await cal.events.delete({ calendarId: calId, eventId: ev.id });
      removed++;
    }
  }
  return { calendar: calId, active: want.size, created, updated, removed };
}

/** Phase 3 step 3 (D14/D87): THE CARRYOVER — nothing silently disappears.
 *
 *  A task in a ❗ midnightCarryover tier that was due BEFORE today began
 *  and still isn't checked gets an event on TODAY's calendar at
 *  config.carryoverWriteHour (default 9 AM), titled "❗ <task>", tomato
 *  (colorId 11 — D14). One per task per day.
 *
 *  NO HOUR TRIGGER, on purpose. "Due before today started" is true
 *  whenever this runs, so the first waking tick of the day does the job
 *  (the 22–6 sleep gate means ~06:07, three hours of lead on a 9 AM
 *  landing) and a missed tick, an outage, or a changed Scheduler cadence
 *  can never silently skip a morning. Hour-gating would have been one
 *  cron hiccup away from a lie.
 *
 *  SEPARATE TAG NAMESPACE (tcApp=tentacalendar-carryover): the mirror
 *  queries tcApp=tentacalendar and keys its ledger by tcTaskId, so a
 *  shared tag would give it two events for one task and it would patch
 *  the ❗ back to the honest due time. These two jobs write to the same
 *  calendar and must not be able to see each other's events.
 *
 *  Reconciles TODAY only (the mirror's idiom — the calendar is the
 *  ledger): creates what's missing, re-times if carryoverWriteHour
 *  changed, deletes today's ❗ once the task is done/rescheduled/undated.
 *  Earlier days are never touched — history stands.
 */
async function runCarryover(cal, cfg, allTiers) {
  const calId = (cfg.mirrorCalendarId || "").trim();
  if (!calId) return { skipped: "no mirrorCalendarId in ⚙️ Settings → Timing — the carryover writes to the same dedicated calendar as the mirror" };
  // Same loop guard as the mirror: never write into a calendar we poll.
  const clash = allTiers.find(t => t.gcalCalendarId === calId);
  if (clash) return { error: `mirrorCalendarId is the same calendar tier "${clash.name}" polls — that's a feedback loop. Use a dedicated calendar.` };

  const carryTiers = new Map();
  allTiers.forEach(t => { if (t.midnightCarryover) carryTiers.set(t.id, t.name); });
  if (!carryTiers.size) return { skipped: "no tier has ❗ carryover checked (⚙️ Settings → Tiers)" };

  const now = Date.now();
  const todayStart = startOfLocalDay(now);
  const landing = new Date(now);
  landing.setHours(carryHour(cfg), 0, 0, 0);   // today at the carryover hour, DST-safe
  const landsAt = landing.getTime();
  const key = localDateKey(landsAt);

  // WANT: missed + still open + in a ❗ tier.
  const tasksSnap = await db.collection(`workspaces/${WS}/tasks`).get();
  const want = new Map(); // "taskId#YYYY-MM-DD" → fields
  tasksSnap.docs.forEach(d => {
    const t = d.data();
    if (t.completedAt) return;              // done
    if (t.dueAt == null) return;            // Waiting — never due, never missed
    if (!carryTiers.has(t.tierId)) return;  // tier opted out
    if (t.dueAt >= todayStart) return;      // due today or later = not missed YET
    want.set(`${d.id}#${key}`, {
      taskId: d.id,
      title: t.title || "(untitled)",
      dueAt: t.dueAt,
      tier: carryTiers.get(t.tierId) || ""
    });
  });

  // HAVE: today's carryover events only (timeMin bounds the read; the
  // key check keeps a changed write-hour from dragging in a stale day).
  const have = new Map();
  let pageToken;
  do {
    const r = await cal.events.list({
      calendarId: calId,
      privateExtendedProperty: "tcApp=tentacalendar-carryover",
      timeMin: new Date(todayStart).toISOString(),
      maxResults: 250,
      pageToken
    });
    (r.data.items || []).forEach(ev => {
      if (ev.status === "cancelled") return;
      const k = ev.extendedProperties?.private?.tcCarryKey;
      if (k && k.endsWith(`#${key}`)) have.set(k, ev);
    });
    pageToken = r.data.nextPageToken;
  } while (pageToken);

  const body = (k, w) => ({
    summary: `❗ ${w.title}`,
    description: `Tentacalendar carryover${w.tier ? " · " + w.tier : ""} — was due ${new Date(w.dueAt).toLocaleString()} and wasn't checked off.`,
    colorId: "11", // tomato (D14)
    start: { dateTime: new Date(landsAt).toISOString() },
    end: { dateTime: new Date(landsAt + 30 * 60000).toISOString() },
    extendedProperties: { private: { tcApp: "tentacalendar-carryover", tcCarryKey: k, tcTaskId: w.taskId } }
  });

  let created = 0, retimed = 0, removed = 0;
  for (const [k, w] of want) {
    const ev = have.get(k);
    if (!ev) {
      await cal.events.insert({ calendarId: calId, requestBody: body(k, w) });
      created++;
    } else {
      const evStart = ev.start?.dateTime ? Date.parse(ev.start.dateTime) : null;
      if (evStart !== landsAt) { // carryoverWriteHour moved since this was written
        await cal.events.patch({ calendarId: calId, eventId: ev.id, requestBody: body(k, w) });
        retimed++;
      }
    }
  }
  for (const [k, ev] of have) {
    if (!want.has(k)) { // checked off, rescheduled, or shelved to Waiting
      await cal.events.delete({ calendarId: calId, eventId: ev.id });
      removed++;
    }
  }

  return {
    calendar: calId,
    tiers: [...carryTiers.values()],
    landsAt: new Date(landsAt).toISOString(),
    missed: want.size, created, retimed, removed,
    alreadyThere: want.size - created - retimed
  };
}
