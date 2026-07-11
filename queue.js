// ============================================================
// Tentacalendar — queue.js
// Version 0.7.0
// 0.7.0 (D51/D60): configurable deadline hour (default 16 = 4 PM,
// set from settings via setDeadlineHour) + per-tier ALLOWED DAYS.
// "Weekday math" is now "working-day math": every tier declares
// which days of the week count (default Mon–Fri). Stage offsets,
// pipeline windows, date interception, and reschedule targets all
// count only the owning tier's allowed days. isWeekend/addWeekdays/
// weekendNeighbors remain as Mon–Fri wrappers for compatibility.
// 0.6.0 (D50): UNDATED stages are first-class — direction:"none".
// Most pipeline steps are weight, not deadlines; only dated stages
// (real offsets or hard dues) drive chronology. Legacy phase
// "during" now reads as UNDATED. Deadline fallback = project end.
// Priority engine v2 (D43), windows (D48).
// ============================================================

export const QUEUE_VERSION = "0.7.0";

const DAY_MS = 24 * 60 * 60 * 1000;

// D51: computed (date-only) deadlines are "due by this hour" (24-hr).
// Default 4 PM; settings/config.deadlineHour overrides via the setter.
let DEADLINE_HOUR = 16;
export function setDeadlineHour(h) {
  const n = parseInt(h, 10);
  DEADLINE_HOUR = (!isNaN(n) && n >= 0 && n <= 23) ? n : 16;
}
export function getDeadlineHour() { return DEADLINE_HOUR; }

const UNIT_MS = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: DAY_MS,
  weeks: 7 * DAY_MS
};

function addMonths(ts, n) {
  const d = new Date(ts);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.getTime();
}

// ---------- Working-day math (D45 weekdays → D60 per-tier days) ----------

/** Default working days: Mon–Fri (JS getDay: 0=Sun … 6=Sat). */
export const WEEKDAYS = [1, 2, 3, 4, 5];

/** Normalize a tier's allowedDays into a usable Set. Missing/empty →
 *  Mon–Fri, which keeps every pre-D60 tier behaving exactly as before. */
function allowedSet(allowedDays) {
  return (Array.isArray(allowedDays) && allowedDays.length)
    ? new Set(allowedDays) : new Set(WEEKDAYS);
}

export function isDayAllowed(ts, allowedDays) {
  return allowedSet(allowedDays).has(new Date(ts).getDay());
}

/** Move n ALLOWED days from ts (n<0 = backward). Disallowed days don't
 *  count. Guard prevents infinite loops on a pathological empty set. */
export function addAllowedDays(ts, n, allowedDays) {
  if (!n) return ts;
  const ok = allowedSet(allowedDays);
  let t = ts;
  const step = n > 0 ? DAY_MS : -DAY_MS;
  let left = Math.abs(n), guard = 0;
  while (left > 0 && guard++ < 4000) {
    t += step;
    if (ok.has(new Date(t).getDay())) left--;
  }
  return t;
}

/** Nearest allowed day at-or-before / at-or-after ts (for the date
 *  interception modal and duplicate-project snapping). */
export function allowedNeighbors(ts, allowedDays) {
  const ok = allowedSet(allowedDays);
  let prev = ts, next = ts, guard = 0;
  while (!ok.has(new Date(prev).getDay()) && guard++ < 14) prev -= DAY_MS;
  guard = 0;
  while (!ok.has(new Date(next).getDay()) && guard++ < 14) next += DAY_MS;
  return { prev, next };
}

// Mon–Fri wrappers (pre-D60 API, still used for defaults).

export function isWeekend(ts) {
  const dow = new Date(ts).getDay();
  return dow === 0 || dow === 6;
}

/** Move n WEEKDAYS from ts (n<0 = backward). Weekends don't count. */
export function addWeekdays(ts, n) {
  return addAllowedDays(ts, n, WEEKDAYS);
}

/** Nearest Friday before / Monday after a weekend date. */
export function weekendNeighbors(ts) {
  const { prev, next } = allowedNeighbors(ts, WEEKDAYS);
  return { fri: prev, mon: next };
}

// ---------- Stage timing (D44) ----------

/** Legacy migration: pre-0.5.0 stages used phase before/during/after.
 *  D50: "during" meant "sometime during the project" — UNDATED. */
export function normalizeStage(s) {
  if (s.direction) return s;
  const phase = s.phase || "during";
  const map = {
    before: { anchor: "start", direction: "before" },
    during: { anchor: "start", direction: "none" },
    after:  { anchor: "end",   direction: "after" }
  };
  return { ...s, ...(map[phase] || map.during) };
}

export function stageIsDated(s) {
  const n = normalizeStage(s);
  return n.dueAt != null || n.direction !== "none";
}

/** Computed target date: anchor(start|end) ± offsetDays counted in the
 *  owning tier's ALLOWED days (D60; default Mon–Fri), at the deadline
 *  hour (D51). Returns null for undated stages (D50). */
export function stageScheduledAt(project, stage, allowedDays) {
  const s = normalizeStage(stage);
  if (s.direction === "none") return null;
  const base = s.anchor === "end" ? (project.endDate || 0) : (project.startDate || 0);
  const dated = addAllowedDays(base, s.direction === "before" ? -(s.offsetDays || 0) : (s.offsetDays || 0), allowedDays);
  const d = new Date(dated);
  d.setHours(DEADLINE_HOUR, 0, 0, 0);
  return d.getTime();
}

/** A stage's real deadline: manual hard due wins; else the computed target;
 *  null when the stage is undated (it's weight, not a deadline). */
export function stageEffectiveDate(project, stage, allowedDays) {
  return stage.dueAt ?? stageScheduledAt(project, stage, allowedDays);
}

function atDeadlineHour(ts) { const d = new Date(ts); d.setHours(DEADLINE_HOUR, 0, 0, 0); return d.getTime(); }

/** [first, last] effective dates across ALL stages — the pipeline window (D48). */
export function projectPipelineWindow(project, allowedDays) {
  const start = project.startDate || 0, end = project.endDate || 0;
  const dated = (project.stages || [])
    .map(s => stageEffectiveDate(project, s, allowedDays))
    .filter(d => d != null);
  return [Math.min(start, ...dated), Math.max(end, ...dated)];
}

/** The NEXT dated commitment: earliest effective date among incomplete stages. */
export function nextDeadline(project, allowedDays) {
  const st = project.stages || [];
  let best = null;
  st.forEach((s, i) => {
    if (s.completedAt) return;
    const date = stageEffectiveDate(project, s, allowedDays);
    if (date == null) return; // undated = weight, not deadline (D50)
    if (!best || date < best.date) best = { date, stage: s, index: i };
  });
  return best; // null = no dated incomplete stages (caller falls back to project end)
}

export function projectProgress(project) {
  const stages = project.stages || [];
  if (!stages.length) return { done: 0, total: 0, pct: 0 };
  const done = stages.filter(s => s.completedAt).length;
  return { done, total: stages.length, pct: done / stages.length };
}

/** D43 level 3: remaining pipeline fraction × workload (1 light / 2 std / 3 heavy). */
export function remainingWork(project) {
  const { done, total } = projectProgress(project);
  if (!total) return 0;
  return ((total - done) / total) * (project.workload || 2);
}

// ---------- Task escalation (unchanged from v0.1.0, D3) ----------

export function effectiveDue(task, now) {
  if (task.completedAt) return null;
  if (task.dueAt == null) return null;
  const base = task.dueAt;
  if (now <= base) return base;
  const esc = task.escalation || { every: 1, unit: "hours" };
  const every = Math.max(1, esc.every || 1);
  if (esc.unit === "months") {
    let t = base, guard = 0;
    while (t < now && guard < 1200) { t = addMonths(t, every); guard++; }
    return t;
  }
  const stepMs = (UNIT_MS[esc.unit] || UNIT_MS.hours) * every;
  const k = Math.ceil((now - base) / stepMs);
  return base + k * stepMs;
}

export function isOverdue(task, now) {
  return !task.completedAt && task.dueAt != null && now > task.dueAt;
}

export function isPinned(event, now) {
  const lead = (event.leadWindowMinutes ?? 30) * 60 * 1000;
  return now >= event.start - lead && now < (event.end || event.start + 30 * 60 * 1000);
}

function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function endOfDay(ts) { return startOfDay(ts) + DAY_MS; }

// ---------- The queue ----------

/**
 * D43 sort:
 *   1. expired first (missed things at the very top, oldest deadline first)
 *   2. chronological by deadline/due — TIER DOES NOT MATTER HERE
 *   3. remaining pipeline × workload, higher first (tasks/events score 0)
 *   4. tier rank
 *   5. alphabetical
 * hiddenTierIds (D47 filter) removes those tiers from EVERYTHING here.
 */
export function buildQueue({ tasks, events, tiers, projects = [], now, viewDay, hiddenTierIds = new Set() }) {
  const dayStart = startOfDay(viewDay);
  const dayEnd = endOfDay(viewDay);
  const viewingToday = now >= dayStart && now < dayEnd;
  const tierById = Object.fromEntries(tiers.map(t => [t.id, t]));
  const rankOf = id => tierById[id]?.rank ?? 999;
  const hidden = id => hiddenTierIds.has(id);

  // --- Events (anchors) ---
  const dayEvents = events
    .filter(e => !hidden(e.tierId))
    .filter(e => e.start < dayEnd && (e.end || e.start) >= dayStart)
    .map(e => ({
      kind: "event", id: e.id, title: e.title,
      tier: tierById[e.tierId] || null,
      time: e.start, end: e.end || null,
      sortTime: e.start, expired: false, remainingWork: 0,
      pinned: viewingToday && isPinned(e, now)
    }));
  const pinned = dayEvents.filter(e => e.pinned).sort((a, b) => a.time - b.time);

  // --- Tasks ---
  const active = [];
  const waiting = [];
  const doneToday = [];
  for (const t of tasks) {
    if (hidden(t.tierId)) continue;
    if (t.completedAt) {
      if (t.completedAt >= dayStart && t.completedAt < dayEnd) doneToday.push(t);
      continue;
    }
    if (t.dueAt == null) { waiting.push(t); continue; }
    const dueThisDay = t.dueAt >= dayStart && t.dueAt < dayEnd;
    const overdueIntoToday = viewingToday && t.dueAt < dayStart;
    if (!(dueThisDay || overdueIntoToday)) continue;
    const expired = viewingToday && isOverdue(t, now);
    active.push({
      kind: "task", id: t.id, title: t.title,
      tier: tierById[t.tierId] || null,
      originalDue: t.dueAt,
      time: viewingToday ? effectiveDue(t, now) : t.dueAt, // escalation theater slot
      sortTime: t.dueAt,      // D43 level 2 uses the HONEST due, not the theater
      expired, overdue: expired,
      remainingWork: 0,
      escalation: t.escalation || { every: 1, unit: "hours" },
      raw: t
    });
  }

  // --- Projects (one item each: active stage shown, next deadline sorted) ---
  for (const p of projects) {
    if (hidden(p.tierId)) continue;
    const stages = p.stages || [];
    const activeIdx = stages.findIndex(s => !s.completedAt);
    if (activeIdx === -1) continue; // complete
    const allowedDays = tierById[p.tierId]?.allowedDays; // D60
    const [first, last] = projectPipelineWindow(p, allowedDays);
    // D48: invisible until its earliest pipeline date; rides the queue through
    // its last date; past that it lives on "today" as expired until dealt with.
    const inWindow = viewingToday
      ? now >= startOfDay(first)
      : (dayEnd > startOfDay(first) && dayStart <= last);
    if (!inWindow) continue;
    const nd = nextDeadline(p, allowedDays);
    const deadline = nd ? nd.date : atDeadlineHour(p.endDate || last);
    const expired = viewingToday && now > deadline;
    const prog = projectProgress(p);
    active.push({
      kind: "stage",
      id: `${p.id}#${activeIdx}`,
      projectId: p.id,
      stageIndex: activeIdx,
      title: stages[activeIdx].name,
      projectName: p.name,
      projectColor: p.color,
      tier: tierById[p.tierId] || null,
      progressPct: prog.pct,
      workload: p.workload || 2,
      remainingWork: remainingWork(p),
      deadlineStageName: nd ? nd.stage.name : "project end",
      deadlineStageIndex: nd ? nd.index : activeIdx,
      deadlineManual: nd ? nd.stage.dueAt != null : false,
      deadline,
      sortTime: deadline,
      time: deadline,
      originalDue: deadline,
      expired, overdue: expired,
      dueAt: stages[activeIdx].dueAt ?? null
    });
  }

  const unpinnedEvents = dayEvents.filter(e => !e.pinned);
  const items = [...unpinnedEvents, ...active].sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? -1 : 1;                 // 1 expired
    if ((a.sortTime ?? 0) !== (b.sortTime ?? 0)) return (a.sortTime ?? 0) - (b.sortTime ?? 0); // 2 chrono
    if ((b.remainingWork || 0) !== (a.remainingWork || 0)) return (b.remainingWork || 0) - (a.remainingWork || 0); // 3 work
    const ra = rankOf(a.tier?.id), rb = rankOf(b.tier?.id);
    if (ra !== rb) return ra - rb;                                          // 4 tier
    return String(a.title).localeCompare(String(b.title));                  // 5 alphabet
  });

  doneToday.sort((a, b) => b.completedAt - a.completedAt);
  waiting.sort((a, b) => rankOf(a.tierId) - rankOf(b.tierId));

  return { pinned, items, waiting, doneToday };
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtDay(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
