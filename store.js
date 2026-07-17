// ============================================================
// Tentacalendar — store.js
// Version 0.14.0 — D112: billable sessions (clockIn/clockOut/logSession/
// deleteSession + subscribeSessions). One open session max, enforced by
// the clockIn batch. The rules wildcard already covers the collection.
// (prev) Version 0.13.0
// Task schema gains recurrence {every, unit, anchor} + spawnedNextAt;
// setTaskDone materializes the next occurrence once, spawn-guarded;
// addInterval does the calendar-correct stepping.
// (prev) Version 0.12.0
// climax). setStageDone now reports hurrah + projectHasHurrah so the UI can
// aim the big celebration at the stage Katie says it belongs to.
// (prev) Version 0.11.1
// 0.11.1 (D102): the sign-in allowlist compares LOWERCASE, matching
// firestore.rules 0.2.0's .lower(). This list is NOT security — the rules
// are — but if the two disagree the app breaks in a way that looks like a
// login bug: client stricter = "bounced back to the sign-in screen", rules
// stricter = "Missing or insufficient permissions". Keep them symmetrical.
// 0.11.0
// 0.11.0 (D100): tasks carry estimateMinutes. D93 promoted "estimated time to
// complete" from nice-to-have to load-bearing: a task time is a DUE date, so
// with an estimate a task is a real block [due − estimate, due] with a real
// LENGTH, and that length is the whole answer to "can I fit dinner on
// Tuesday?". addTask destructures explicitly, so a new field would have been
// silently DROPPED — which is exactly the kind of nothing that looks like it
// works. null = unestimated; the clock grid draws those at a default and says
// so. updateTask already passes arbitrary fields through (D95 only special-
// cases dueAt), so editing an estimate needed no change there.
// 0.10.0
// 0.10.0 (D95): tasks remember being moved — firstDueAt (the original
// commitment) + rescheduleCount. Counted inside updateTask so EVERY path
// that changes a due date is caught, including ones not written yet.
// No migration: firstDueAt ?? dueAt at read time IS the backfill.
// Only a date that EXISTED can be moved: null → date is scheduling, not
// rescheduling, and doesn't count.
// 0.9.0 (D85): seed config gains clearDeckThreshold (0.6) — the point
// where the queue flips a project from "keep abreast" to "clear the
// deck." Additive; live DBs never reseed, so readers fall back to 0.6.
// 0.8.0 (D63): tasks carry an optional `notes` string (title stays
// short, details expand under the row). Additive — missing = none.
// 0.7.0: rewindFollowUps (D53 un-complete rewind), addProjectWithStages
// (D59 duplicate-for-next-year), per-tier allowedDays in seed (D60,
// Personal seeds 7-day), config seeds deadlineHour 16 + 
// decisionThresholdDays 2 (D51/D52). Live DBs never reseed — missing
// fields fall back in readers.
// 0.6.2: seed template uses dated/undated mix per D50.
// All Firebase interaction lives here: auth, seeding, live
// subscriptions, CRUD. Nothing in here touches the DOM.
// Schema per HANDOFF.md §3.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDocs, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { FIREBASE_CONFIG, ALLOWED_EMAILS, WORKSPACE_ID } from "./config.js?v=0.4.0";

export const STORE_VERSION = "0.14.0";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const wsRef = () => doc(db, "workspaces", WORKSPACE_ID);
const col = name => collection(db, "workspaces", WORKSPACE_ID, name);

// ---------- Auth ----------

export function watchAuth(onIn, onOut) {
  onAuthStateChanged(auth, async user => {
    if (user && ALLOWED_EMAILS.includes((user.email || "").toLowerCase())) {   // D102
      await ensureSeed(user);
      onIn(user);
    } else {
      if (user) await signOut(auth); // signed in but not allowlisted
      onOut();
    }
  });
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

// ---------- First-run seeding ----------
// Jake's confirmed tier queue (session 3):
//   1 Home (calendar/anchor)  2 Business (calendar/anchor)
//   3 Work  4 Family  5 Personal  6 Taiko
// Dark-theme ROYGBIV, all editable in settings.

// D60: allowedDays = which days of the week (0=Sun…6=Sat) this tier's
// scheduling math counts. Personal seeds 7-day (weekend jobs live there);
// missing field reads as Mon–Fri everywhere, so live DBs need no repair.
const WD = [1, 2, 3, 4, 5];
const SEED_TIERS = [
  { name: "Home",     rank: 1, color: "#ff6b6b", kind: "anchor", midnightCarryover: false, defaultLeadWindowMinutes: 30, gcalCalendarId: "" },
  { name: "Business", rank: 2, color: "#ffa94d", kind: "anchor", midnightCarryover: false, defaultLeadWindowMinutes: 30, gcalCalendarId: "" },
  { name: "Work",     rank: 3, color: "#ffd43b", kind: "task",   midnightCarryover: true,  allowedDays: WD },
  { name: "Family",   rank: 4, color: "#69db7c", kind: "task",   midnightCarryover: true,  allowedDays: WD },
  { name: "Personal", rank: 5, color: "#4dabf7", kind: "task",   midnightCarryover: false, allowedDays: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Taiko",    rank: 6, color: "#b197fc", kind: "task",   midnightCarryover: false, allowedDays: WD }
];

// Katie's universal project pipeline (session 5). Applied as a snapshot
// to each NEW project; per-project copies are then independent.
// phase: "before" = activates offsetDays before project start;
//        "during" = activates at project start (after predecessor done);
//        "after"  = activates offsetDays after project end.
const SEED_STAGES = [
  { name: "Engagement letter",        direction: "before", anchor: "start", offsetDays: 14 },
  { name: "Data request",             direction: "after",  anchor: "start", offsetDays: 0 },   // day one
  { name: "Excel setup",              direction: "none",   anchor: "start", offsetDays: 0 },
  { name: "Word setup",               direction: "none",   anchor: "start", offsetDays: 0 },
  { name: "Graphic setup",            direction: "none",   anchor: "start", offsetDays: 0 },
  { name: "Loss data processing",     direction: "after",  anchor: "start", offsetDays: 2 },
  { name: "Non-loss data processing", direction: "after",  anchor: "start", offsetDays: 3 },
  { name: "Data input",               direction: "none",   anchor: "start", offsetDays: 0 },
  { name: "Selections",               direction: "none",   anchor: "start", offsetDays: 0 },
  { name: "Proofing",                 direction: "before", anchor: "end",   offsetDays: 3 },
  { name: "Peer review",              direction: "before", anchor: "end",   offsetDays: 2 },
  { name: "Publication",              direction: "before", anchor: "end",   offsetDays: 0 },
  { name: "Client follow-up",         direction: "after",  anchor: "end",   offsetDays: 14 }
];

async function ensureSeed(user) {
  const ws = await getDoc(wsRef());
  if (ws.exists()) return;
  const batch = writeBatch(db);
  batch.set(wsRef(), { name: "Tentacalendar", memberEmails: ALLOWED_EMAILS, createdAt: Date.now(), createdBy: user.email });
  for (const t of SEED_TIERS) {
    batch.set(doc(col("tiers")), t);
  }
  batch.set(doc(db, "workspaces", WORKSPACE_ID, "settings", "config"), {
    carryoverWriteHour: 9,      // Jake: 9 AM, adjustable (open Q1 resolved)
    pollIntervalMinutes: 60,    // GCal poll cadence (phase 3); Jake: hourly default
    sleepStart: 22,             // 10 PM
    sleepEnd: 6,                // 6 AM
    deadlineHour: 16,           // D51: computed deadlines are "by 4 PM" (Jake)
    decisionThresholdDays: 2,   // D52: decision modal fires at ≥2 days overdue
    clearDeckThreshold: 0.6     // D85: project flips least-done→most-done at 60%
  });
  batch.set(doc(db, "workspaces", WORKSPACE_ID, "settings", "stageTemplate"), {
    stages: SEED_STAGES
  });
  await batch.commit();
}

// ---------- Live subscriptions ----------
// Each returns an unsubscribe function; callback receives an array of
// {id, ...data} (or a single object for config).

export function subscribeTiers(cb) {
  return onSnapshot(col("tiers"), snap => {
    const tiers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tiers.sort((a, b) => a.rank - b.rank);
    cb(tiers);
  });
}

export function subscribeTasks(cb) {
  return onSnapshot(col("tasks"), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeEvents(cb) {
  // Phase 1: eventsCache is empty until pollCalendars ships (HANDOFF §5 build
  // order, phase 3). The code path is live so the queue logic never changes.
  return onSnapshot(col("eventsCache"), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeConfig(cb) {
  return onSnapshot(doc(db, "workspaces", WORKSPACE_ID, "settings", "config"), snap => {
    cb(snap.exists() ? snap.data() : null);
  });
}

// ---------- Task CRUD ----------

export async function addTask({ title, tierId, dueAt, escalation, notes = "", projectId = null, estimateMinutes = null, recurrence = null }) {
  return addDoc(col("tasks"), {
    title, tierId, dueAt, escalation, notes,
    projectId,
    estimateMinutes,          // D100 — null = unestimated, NOT zero
    recurrence,               // D111 — {every, unit, anchor:"done"|"due"} or null; the Christmas cactus
    spawnedNextAt: null,      // D111 — set once the next occurrence exists; makes re-checks spawn-safe

    completedAt: null,
    parentTaskId: null,
    offsetDays: null,
    mirroredGcalEventId: null,
    createdBy: auth.currentUser?.email || "unknown",
    createdAt: Date.now()
  });
}

export async function addFollowUp(parentTaskId, { title, offsetDays, tierId }) {
  return addDoc(col("tasks"), {
    title, tierId,
    dueAt: null,               // materializes on parent completion (D4)
    escalation: { every: 1, unit: "hours" },
    projectId: null,
    completedAt: null,
    parentTaskId, offsetDays,
    mirroredGcalEventId: null,
    createdBy: auth.currentUser?.email || "unknown",
    createdAt: Date.now()
  });
}

/**
 * Toggle completion. On completion, materialize any waiting follow-ups (D4):
 * child.dueAt = completedAt + offsetDays days (same clock time as completion).
 * On un-completion, children that were materialized are NOT rewound —
 * simplest honest behavior; revisit if it ever bites.
 */
export async function setTaskDone(taskId, done) {
  const now = Date.now();
  await updateDoc(doc(col("tasks"), taskId), { completedAt: done ? now : null });
  if (!done) return;
  const q = query(col("tasks"), where("parentTaskId", "==", taskId));
  const kids = await getDocs(q);
  const batch = writeBatch(db);
  let any = false;
  kids.forEach(k => {
    const d = k.data();
    if (d.dueAt == null && !d.completedAt) {
      batch.update(k.ref, { dueAt: now + (d.offsetDays || 0) * 24 * 60 * 60 * 1000 });
      any = true;
    }
  });
  if (any) await batch.commit();

  // D111 — the Christmas cactus. A checked-off recurring task materializes
  // its NEXT occurrence: a brand-new independent task (same title, tier,
  // escalation, notes, project, estimate — and the recurrence itself; the
  // cactus keeps needing water). Anchor "done" (the default) = you just
  // watered it, so the interval starts NOW; anchor "due" = the schedule is
  // the schedule, interval starts from the printed due time (which can
  // land the next one already overdue — that's honesty, not a bug).
  // spawnedNextAt is the double-spawn guard: check → spawn → un-check →
  // re-check must NOT plant a second cactus. Un-checking does NOT delete
  // the spawn — simplest honest behavior, same words as follow-ups above;
  // revisit if it ever bites. Escalation (D3) is untouched: it nags THIS
  // instance; recurrence only sets the next one's due.
  const snap = await getDoc(doc(col("tasks"), taskId));
  const t = snap.exists() ? snap.data() : null;
  if (t?.recurrence?.every && !t.spawnedNextAt) {
    const r = t.recurrence;
    const base = (r.anchor === "due" && t.dueAt != null) ? t.dueAt : now;
    await addDoc(col("tasks"), {
      title: t.title, tierId: t.tierId,
      dueAt: addInterval(base, r.every, r.unit),
      escalation: t.escalation || { every: 1, unit: "hours" },
      notes: t.notes || "",
      projectId: t.projectId ?? null,
      estimateMinutes: t.estimateMinutes ?? null,
      recurrence: r,
      spawnedNextAt: null,
      completedAt: null, parentTaskId: null, offsetDays: null,
      mirroredGcalEventId: null,
      createdBy: auth.currentUser?.email || "recurrence",
      createdAt: now
    });
    await updateDoc(doc(col("tasks"), taskId), { spawnedNextAt: now });
  }
}

// D111 — interval math for recurrence. Fixed units are plain milliseconds;
// calendar units step via addMonthsStore in month quanta (months=1,
// years=12, decades=120, centuries=1200) so Jan-31 + 1 month = Feb-28/29,
// never Mar-3. addMonthsStore is a VERBATIM copy of queue.js's addMonths —
// duplicated on purpose to keep this module free of app-layer imports; the
// ship-check asserts the two bodies are character-identical (D98's parity
// answer, mechanized).
const REC_FIXED_MS = { minutes: 60000, hours: 3600000, days: 86400000, weeks: 7 * 86400000 };
const REC_MONTH_QUANTA = { months: 1, years: 12, decades: 120, centuries: 1200 };
function addMonthsStore(ts, n) {
  const d = new Date(ts);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.getTime();
}
export function addInterval(ts, every, unit) {
  const e = Math.max(1, every || 1);
  if (REC_MONTH_QUANTA[unit]) return addMonthsStore(ts, REC_MONTH_QUANTA[unit] * e);
  return ts + (REC_FIXED_MS[unit] || REC_FIXED_MS.days) * e;
}

/**
 * D53: pull a parent's materialized follow-ups back to "Waiting on…".
 * Any incomplete child that HAS a dueAt was materialized by a completion
 * (follow-ups are always born with dueAt:null) — reset those to null.
 * Completed children are left alone: they really happened.
 */
export async function rewindFollowUps(parentTaskId) {
  const q = query(col("tasks"), where("parentTaskId", "==", parentTaskId));
  const kids = await getDocs(q);
  const batch = writeBatch(db);
  let any = false;
  kids.forEach(k => {
    const d = k.data();
    if (d.dueAt != null && !d.completedAt) {
      batch.update(k.ref, { dueAt: null });
      any = true;
    }
  });
  if (any) await batch.commit();
}

export function deleteTask(taskId) {
  return deleteDoc(doc(col("tasks"), taskId));
}

/** Edit any task fields (title, tierId, dueAt, escalation, offsetDays...). */
/**
 * D95 — a due-date change is a RESCHEDULE, and the app remembers it.
 *   firstDueAt      — what she originally committed to
 *   rescheduleCount — how many times it moved since
 * Jake: "if she reschedules something 5 times, that's worthy of looking
 * at the _why_." Until now a reschedule overwrote dueAt and erased its
 * own evidence — the exact thing worth reflecting on.
 *
 * CENTRALISED HERE, not at the call sites, so every path that ever moves
 * a date is counted for free: the due dialog (D84), the decision modal's
 * 🕐 next-working-day, shelving to Waiting, and the drag-to-reschedule
 * that isn't built yet. A future caller cannot forget to count.
 *
 * NO MIGRATION, NO BACKFILL BUTTON. `firstDueAt ?? dueAt` at read time is
 * the retroactive answer: for a task predating this field, its current due
 * IS its first KNOWN due — honest, and costs zero writes to Katie's live
 * data. Jake asked whether we could backfill; the fallback IS the backfill.
 *
 * Escalation does NOT come through here (it only re-times the queue's
 * display slot, never dueAt), so nagging can't inflate the count. Only a
 * human moving a date does.
 */
export async function updateTask(taskId, fields) {
  const ref = doc(col("tasks"), taskId);
  if (!("dueAt" in fields)) return updateDoc(ref, fields);   // nothing to count

  const snap = await getDoc(ref);
  const cur = snap.exists() ? snap.data() : {};
  const patch = { ...fields };
  // You can only MOVE a commitment that existed. cur.dueAt == null means
  // this is the FIRST date this task ever had (born in Waiting, or picked
  // back up off the shelf) — that's scheduling, not rescheduling, and
  // counting it would inflate the number with a non-event. The count's
  // whole worth is that a 5 means something.
  if (cur.dueAt != null && cur.dueAt !== fields.dueAt) {   // a no-op save isn't a move either
    if (cur.firstDueAt == null) patch.firstDueAt = cur.dueAt;
    patch.rescheduleCount = (cur.rescheduleCount || 0) + 1;
  }
  return updateDoc(ref, patch);
}

/** D95 — read a task's original commitment. The ?? IS the backfill. */
export function taskFirstDue(t) { return t?.firstDueAt ?? t?.dueAt ?? null; }

// ---------- Projects & pipeline stages ----------

// ---------- D112: billable sessions (the paper replacement) ----------
// Katie's projects are FIXED-PRICE against assumed hours; the point of this
// ledger is next year's ask, not payroll. Sessions are {projectId, start,
// end|null}; at most one open (end:null) session exists at a time — the
// clockIn batch closes whatever is open in the same commit that opens the
// new one, so the 9-project shuffle is one tap and can never double-run.
export function subscribeSessions(cb) {
  return onSnapshot(col("sessions"), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** Close whatever is open at `at`, open projectId at `at` — one commit. */
export async function clockIn(projectId, at = Date.now()) {
  const open = await getDocs(query(col("sessions"), where("end", "==", null)));
  const batch = writeBatch(db);
  open.forEach(s => batch.update(s.ref, { end: Math.max(at, s.data().start) }));
  batch.set(doc(col("sessions")), {
    projectId, start: at, end: null,
    createdBy: auth.currentUser?.email || "unknown", createdAt: Date.now()
  });
  await batch.commit();
}

/** End the open session (whichever project holds it) at `at`, clamped so a
 *  backdated end can never precede its own start. */
export async function clockOut(at = Date.now()) {
  const open = await getDocs(query(col("sessions"), where("end", "==", null)));
  const batch = writeBatch(db);
  let any = false;
  open.forEach(s => { batch.update(s.ref, { end: Math.max(at, s.data().start) }); any = true; });
  if (any) await batch.commit();
}

/** D112 — the forgot-to-clock-in eraser: a manual, backdated session. If
 *  the OPEN session started before this one, it truncates where this one
 *  starts (honest boundaries: she stopped that work when she started this).
 *  A session that began INSIDE the manual window is left alone — v1 keeps
 *  overlap surgery simple; revisit if it ever bites. */
export async function logSession(projectId, start, end) {
  const open = await getDocs(query(col("sessions"), where("end", "==", null)));
  const batch = writeBatch(db);
  open.forEach(s => { if (s.data().start < start) batch.update(s.ref, { end: start }); });
  batch.set(doc(col("sessions")), {
    projectId, start, end,
    createdBy: auth.currentUser?.email || "unknown", createdAt: Date.now()
  });
  await batch.commit();
}

export function deleteSession(sessionId) {
  return deleteDoc(doc(col("sessions"), sessionId));
}

export function subscribeProjects(cb) {
  return onSnapshot(col("projects"), snap => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    projects.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
    cb(projects);
  });
}

export function subscribeStageTemplate(cb) {
  return onSnapshot(doc(db, "workspaces", WORKSPACE_ID, "settings", "stageTemplate"), snap => {
    cb(snap.exists() ? (snap.data().stages || []) : []);
  });
}

export function saveStageTemplate(stages) {
  return setDoc(doc(db, "workspaces", WORKSPACE_ID, "settings", "stageTemplate"), { stages });
}

/** New project snapshots the current template into its own editable stages. */
export async function addProject({ name, color, startDate, endDate, tierId, workload = 2 }) {
  const tmplSnap = await getDoc(doc(db, "workspaces", WORKSPACE_ID, "settings", "stageTemplate"));
  const template = tmplSnap.exists() ? (tmplSnap.data().stages || []) : [];
  const legacy = { before: ["before", "start"], during: ["after", "start"], after: ["after", "end"] };
  const stages = template.map(s => {
    const [dir, anc] = s.direction && s.anchor ? [s.direction, s.anchor] : (legacy[s.phase] || legacy.during);
    return { name: s.name, direction: dir, anchor: anc, offsetDays: s.offsetDays || 0, completedAt: null, dueAt: null };
  });
  return addDoc(col("projects"), {
    name, color, startDate, endDate, tierId, workload, stages,
    stretchUntilDone: false, completedAt: null,
    createdBy: auth.currentUser?.email || "unknown",
    createdAt: Date.now()
  });
}

/**
 * D59: create a project with an EXPLICIT stage array (used by
 * duplicate-for-next-year — the caller passes the source project's
 * pipeline with completedAt/dueAt already reset, so the template is
 * NOT consulted and one-off stage surgery survives the duplication).
 */
export function addProjectWithStages({ name, color, startDate, endDate, tierId, workload = 2, stages = [] }) {
  return addDoc(col("projects"), {
    name, color, startDate, endDate, tierId, workload, stages,
    stretchUntilDone: false, completedAt: null,
    createdBy: auth.currentUser?.email || "unknown",
    createdAt: Date.now()
  });
}

export function deleteProject(projectId) {
  return deleteDoc(doc(col("projects"), projectId));
}

/** Edit project fields (name, color, tierId, startDate, endDate). Stage
 *  activations are COMPUTED from dates, so moving a project reflows its
 *  pipeline automatically — no stage cleanup needed. */
export function updateProject(projectId, fields) {
  return updateDoc(doc(col("projects"), projectId), fields);
}

/**
 * Set/unset completion on one stage. Returns the updated stages array so the
 * caller can detect project completion (all stages done) for celebration level 3.
 */
export async function setStageDone(projectId, stageIndex, done) {
  const ref = doc(col("projects"), projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const stages = (snap.data().stages || []).map(s => ({ ...s }));
  if (!stages[stageIndex]) return null;
  stages[stageIndex].completedAt = done ? Date.now() : null;
  const allDone = stages.length > 0 && stages.every(s => s.completedAt);
  await updateDoc(ref, { stages, completedAt: allDone ? Date.now() : null });
  // D109 — a stage may carry `hurrah: true` (the designated climax; at most
  // one per project by editor convention, absent on stages that aren't it).
  // The caller decides the celebration level from these two facts:
  // publishing is the party, follow-up is paperwork.
  return {
    stages, allDone,
    hurrah: !!stages[stageIndex].hurrah,
    projectHasHurrah: stages.some(s => s.hurrah)
  };
}

/** Replace a project's entire stage array (rename/reorder/add/remove,
 *  D42). Caller is responsible for preserving completedAt/dueAt on
 *  surviving stages. Auto-recomputes project completion. */
export async function setProjectStages(projectId, stages) {
  const allDone = stages.length > 0 && stages.every(s => s.completedAt);
  return updateDoc(doc(col("projects"), projectId), {
    stages,
    completedAt: allDone ? Date.now() : null
  });
}

export async function setStageDue(projectId, stageIndex, dueAt) {
  const ref = doc(col("projects"), projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const stages = (snap.data().stages || []).map(s => ({ ...s }));
  if (!stages[stageIndex]) return;
  stages[stageIndex].dueAt = dueAt; // null clears
  await updateDoc(ref, { stages });
}

// ---------- Tier CRUD (settings) ----------

export function saveTier(tierId, data) {
  if (tierId) return updateDoc(doc(col("tiers"), tierId), data);
  return addDoc(col("tiers"), data);
}

export function deleteTier(tierId) {
  return deleteDoc(doc(col("tiers"), tierId));
}

// ---------- Config ----------

export function saveConfig(data) {
  return setDoc(doc(db, "workspaces", WORKSPACE_ID, "settings", "config"), data, { merge: true });
}
