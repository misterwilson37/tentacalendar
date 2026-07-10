// ============================================================
// Tentacalendar — queue.js
// Version 0.4.0 (version export; stage items carry pipeline progress)
// Pure logic: escalation math, tier sorting, anchor pinning.
// No DOM. No Firebase. Everything here is testable in isolation.
// See HANDOFF.md D3, D6, D7.
// ============================================================

export const QUEUE_VERSION = "0.4.0";

const UNIT_MS = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000
};

/** Add n months to a timestamp, clamping day-of-month (Jan 31 + 1mo = Feb 28). */
function addMonths(ts, n) {
  const d = new Date(ts);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.getTime();
}

/**
 * D3: escalation is computed at render time, never stored.
 * Returns the task's *displayed* due time: the next escalation step >= now.
 * A task due Mon 9:00 with {every:1, unit:"hours"} viewed at 11:20 shows 12:00... 
 * actually shows the first step >= now, i.e. 12:00? No — steps are 10:00, 11:00, 12:00;
 * first step >= 11:20 is 12:00. The *current* slot shown is the step the task is
 * "waiting at": we show the smallest step >= now so it reads as the next nag time.
 */
export function effectiveDue(task, now) {
  if (task.completedAt) return null;
  if (task.dueAt == null) return null; // follow-up awaiting parent (D4)
  const base = task.dueAt;
  if (now <= base) return base;

  const esc = task.escalation || { every: 1, unit: "hours" };
  const every = Math.max(1, esc.every || 1);

  if (esc.unit === "months") {
    let t = base;
    let guard = 0;
    while (t < now && guard < 1200) { t = addMonths(t, every); guard++; }
    return t;
  }
  const stepMs = (UNIT_MS[esc.unit] || UNIT_MS.hours) * every;
  const k = Math.ceil((now - base) / stepMs);
  return base + k * stepMs;
}

/** True if the task's original due time has passed and it isn't done. */
export function isOverdue(task, now) {
  return !task.completedAt && task.dueAt != null && now > task.dueAt;
}

/** D7: is this event inside its lead window (pin above everything)? */
export function isPinned(event, now) {
  const lead = (event.leadWindowMinutes ?? 30) * 60 * 1000;
  return now >= event.start - lead && now < (event.end || event.start + 30 * 60 * 1000);
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function endOfDay(ts) {
  return startOfDay(ts) + 24 * 60 * 60 * 1000;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When does a stage become eligible to appear in the queue?
 * "before" = offsetDays BEFORE project start (engagement letter −14d).
 * "during" = offsetDays AFTER project start (0 = day one).
 * "after"  = offsetDays AFTER project end.
 * (A stage additionally only surfaces once it is the EARLIEST unchecked
 * stage — that's the sequential pipeline, handled in buildQueue.)
 */
export function stageActivation(project, stage) {
  const off = (stage.offsetDays || 0) * DAY_MS;
  if (stage.phase === "before") return (project.startDate || 0) - off;
  if (stage.phase === "after") return (project.endDate || 0) + off;
  return (project.startDate || 0) + off;
}

/** Pipeline progress for gradient fills / progress bars. */
export function projectProgress(project) {
  const stages = project.stages || [];
  if (!stages.length) return { done: 0, total: 0, pct: 0 };
  const done = stages.filter(s => s.completedAt).length;
  return { done, total: stages.length, pct: done / stages.length };
}

/**
 * Build the queue for a given day.
 * D6: sort by tier rank, then effective due time (overdue floats to top of ITS tier
 * because its effective due is "now-ish", but it never leaves its tier).
 * D7: pinned anchors above all tiers.
 *
 * @param {Object} p
 * @param {Array} p.tasks   raw task docs {id, title, tierId, dueAt, completedAt, escalation, parentTaskId, offsetDays}
 * @param {Array} p.events  normalized events {id, title, start, end, tierId, leadWindowMinutes}
 * @param {Array} p.tiers   {id, name, rank, color, kind: "anchor"|"task"}
 * @param {number} p.now
 * @param {number} p.viewDay  any timestamp within the day being viewed
 * @returns {{pinned:[], items:[], waiting:[], doneToday:[]}}
 */
export function buildQueue({ tasks, events, tiers, projects = [], now, viewDay }) {
  const dayStart = startOfDay(viewDay);
  const dayEnd = endOfDay(viewDay);
  const viewingToday = now >= dayStart && now < dayEnd;
  const tierById = Object.fromEntries(tiers.map(t => [t.id, t]));
  const rankOf = id => tierById[id]?.rank ?? 999;

  // --- Events for this day (anchors: context rows, no checkbox) ---
  const dayEvents = events
    .filter(e => e.start < dayEnd && (e.end || e.start) >= dayStart)
    .map(e => ({
      kind: "event",
      id: e.id,
      title: e.title,
      tier: tierById[e.tierId] || null,
      time: e.start,
      end: e.end || null,
      pinned: viewingToday && isPinned(e, now)
    }));

  const pinned = dayEvents.filter(e => e.pinned)
    .sort((a, b) => a.time - b.time);

  // --- Tasks ---
  // A task belongs to the viewed day if its ORIGINAL due date is that day,
  // OR (when viewing today) it is overdue from any earlier day — the backlog
  // always lives on "today" (D3: overdue renders at now).
  const active = [];
  const waiting = [];
  const doneToday = [];

  for (const t of tasks) {
    if (t.completedAt) {
      if (t.completedAt >= dayStart && t.completedAt < dayEnd) doneToday.push(t);
      continue;
    }
    if (t.dueAt == null) { waiting.push(t); continue; }
    const dueThisDay = t.dueAt >= dayStart && t.dueAt < dayEnd;
    const overdueIntoToday = viewingToday && t.dueAt < dayStart;
    if (dueThisDay || overdueIntoToday) {
      active.push({
        kind: "task",
        id: t.id,
        title: t.title,
        tier: tierById[t.tierId] || null,
        originalDue: t.dueAt,
        time: viewingToday ? effectiveDue(t, now) : t.dueAt,
        overdue: viewingToday && isOverdue(t, now),
        escalation: t.escalation || { every: 1, unit: "hours" },
        raw: t
      });
    }
  }

  // --- Project pipeline stages ---
  // Each project contributes at most ONE queue item: its earliest unchecked
  // stage (checking later stages early in the project panel simply means the
  // pipeline skips them when it gets there). It surfaces only once its
  // activation date arrives (before/during/after semantics).
  for (const p of projects) {
    const stages = p.stages || [];
    const idx = stages.findIndex(s => !s.completedAt);
    if (idx === -1) continue; // project fully complete
    const s = stages[idx];
    const act = stageActivation(p, s);
    const showThisDay = (act >= dayStart && act < dayEnd) || (viewingToday && act < dayStart);
    if (!showThisDay) continue;
    const hasDue = s.dueAt != null;
    const pseudo = { dueAt: s.dueAt, completedAt: null, escalation: { every: 1, unit: "hours" } };
    const prog = projectProgress(p);
    active.push({
      kind: "stage",
      id: `${p.id}#${idx}`,
      progressPct: prog.pct,
      projectId: p.id,
      stageIndex: idx,
      title: s.name,
      projectName: p.name,
      projectColor: p.color,
      tier: tierById[p.tierId] || null,
      hasDue,
      activatedAt: act,
      originalDue: hasDue ? s.dueAt : act,
      time: hasDue ? (viewingToday ? effectiveDue(pseudo, now) : s.dueAt) : act,
      overdue: hasDue && viewingToday && now > s.dueAt
    });
  }

  // Unpinned events join the main list so appointments read as context in-queue.
  const unpinnedEvents = dayEvents.filter(e => !e.pinned);

  const items = [...unpinnedEvents, ...active].sort((a, b) => {
    const ra = rankOf(a.tier?.id), rb = rankOf(b.tier?.id);
    if (ra !== rb) return ra - rb;
    return (a.time ?? 0) - (b.time ?? 0);
  });

  doneToday.sort((a, b) => b.completedAt - a.completedAt);
  waiting.sort((a, b) => rankOf(a.tierId) - rankOf(b.tierId));

  return { pinned, items, waiting, doneToday };
}

/** Human label like "9:00 AM" in local time. */
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Mon, Jun 8" style label. */
export function fmtDay(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
