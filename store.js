// ============================================================
// Tentacalendar — store.js
// Version 0.6.0 (workload on projects; anchor/direction stage seed)
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

import { FIREBASE_CONFIG, ALLOWED_EMAILS, WORKSPACE_ID } from "./config.js";

export const STORE_VERSION = "0.6.0";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const wsRef = () => doc(db, "workspaces", WORKSPACE_ID);
const col = name => collection(db, "workspaces", WORKSPACE_ID, name);

// ---------- Auth ----------

export function watchAuth(onIn, onOut) {
  onAuthStateChanged(auth, async user => {
    if (user && ALLOWED_EMAILS.includes(user.email)) {
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

const SEED_TIERS = [
  { name: "Home",     rank: 1, color: "#ff6b6b", kind: "anchor", midnightCarryover: false, defaultLeadWindowMinutes: 30, gcalCalendarId: "" },
  { name: "Business", rank: 2, color: "#ffa94d", kind: "anchor", midnightCarryover: false, defaultLeadWindowMinutes: 30, gcalCalendarId: "" },
  { name: "Work",     rank: 3, color: "#ffd43b", kind: "task",   midnightCarryover: true },
  { name: "Family",   rank: 4, color: "#69db7c", kind: "task",   midnightCarryover: true },
  { name: "Personal", rank: 5, color: "#4dabf7", kind: "task",   midnightCarryover: false },
  { name: "Taiko",    rank: 6, color: "#b197fc", kind: "task",   midnightCarryover: false }
];

// Katie's universal project pipeline (session 5). Applied as a snapshot
// to each NEW project; per-project copies are then independent.
// phase: "before" = activates offsetDays before project start;
//        "during" = activates at project start (after predecessor done);
//        "after"  = activates offsetDays after project end.
const SEED_STAGES = [
  { name: "Engagement letter",        direction: "before", anchor: "start", offsetDays: 14 },
  { name: "Data request",             direction: "after",  anchor: "start", offsetDays: 0 },
  { name: "Excel setup",              direction: "after",  anchor: "start", offsetDays: 0 },
  { name: "Word setup",               direction: "after",  anchor: "start", offsetDays: 0 },
  { name: "Graphic setup",            direction: "after",  anchor: "start", offsetDays: 0 },
  { name: "Loss data processing",     direction: "after",  anchor: "start", offsetDays: 2 },
  { name: "Non-loss data processing", direction: "after",  anchor: "start", offsetDays: 3 },
  { name: "Data input",               direction: "after",  anchor: "start", offsetDays: 5 },
  { name: "Selections",               direction: "before", anchor: "end",   offsetDays: 4 },
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
    sleepEnd: 6                 // 6 AM
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

export async function addTask({ title, tierId, dueAt, escalation, projectId = null }) {
  return addDoc(col("tasks"), {
    title, tierId, dueAt, escalation,
    projectId,
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
}

export function deleteTask(taskId) {
  return deleteDoc(doc(col("tasks"), taskId));
}

/** Edit any task fields (title, tierId, dueAt, escalation, offsetDays...). */
export function updateTask(taskId, fields) {
  return updateDoc(doc(col("tasks"), taskId), fields);
}

// ---------- Projects & pipeline stages ----------

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
  return { stages, allDone };
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
