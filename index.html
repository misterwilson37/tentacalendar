// ============================================================
// Tentacalendar — queue.js
// Version 0.14.0
// 0.14.0 (D89): projectSpans now sort by PRIORITY, not the alphabet —
// expired first, then next deadline, then the D86 piles (Jake: "projects
// should be in priority order"; ten bars sorted A–Z said nothing about
// what matters). Spans carry deadlineAt/expired/nextStageName. Also
// weekAnchorFor(): Sun–Sat / Mon–Sun / rolling today+6, because
// reflecting on the week just gone IS how you plan the next one — the
// past columns aren't dead space (Jake corrected me on this).
// 0.13.0 (D88): buildWeek() — N honest days (one buildQueue per column,
// so expiry/off-days/the D86 piles all come free) + the two spanning
// strips: projectSpans (bars with stage pips) and bannerSpans (one bar
// per all-day event). Projects DON'T repeat down the columns: D48 rides
// them through their whole window, which would render a 3-month project
// seven times — a stage row lands only on its deadline day (plus today
// if expired), and the SPAN goes up top where a span belongs. Also
// addDaysLocal(): calendar day-stepping, because ts+DAY_MS repeats a
// date across DST fall-back and would drop a day from the week.
// 0.12.0 (D86): the clear-deck tiebreaker is now GROUPED, not blended.
// D85 multiplied workload by pct-or-1-pct, which made a U: urgency rose
// at both ends and SAGGED in the middle, so a 30%-done project outranked
// a 65%-done one (Jake: "too confusing"). Now two piles split at
// CLEAR_DECK_THRESHOLD, pile first: past-threshold (MOST done first),
// then catch-up (LEAST done first), then tasks/events. Workload only
// breaks an exact-pct tie — heavier first. Four equal projects at T=60%
// sort 95 → 65 → 30 → 40. Still tiebreaker ONLY (Jake's option A).
// 0.11.0 (D85): CLEAR-THE-DECK priority — first cut, the blended weight
// superseded by D86 above. setClearDeckThreshold/the config rail land here.
// 0.10.0 (D82): timed events whose window has PASSED (end — or start
// +1h grace when endless — is behind now) leave the live list for a
// passedEvents array, TODAY only; viewing other days shows everything
// in place (a past day is all "passed"; a future day, none).
// 0.9.0 (D80): ALL-DAY events split out of the chronological queue
// into a BANNERS list — "things that are happening" (Zoo Camp week,
// parents in town) vs "things to go to at a time." Banners carry
// day-N-of-M span math (all-day ends are EXCLUSIVE, per Google), sort
// tier-rank-then-start, respect hidden tiers, never pin, never expire,
// and never demand a checkbox. Timed events are unchanged: queue rows
// at their slot, pinned in their lead window, aging off at midnight.
// 0.8.0 (D61): the queue respects tier working days — when the VIEWED
// day isn't in a tier's allowedDays, that tier's tasks and project
// stages don't appear (Katie's Saturday is clear of Work items; the
// project cards still show everything, and Monday brings it all back,
// including the decision modal). Events/anchors are unaffected, as
// are Done-today and Waiting.
// 0.7.0 (D51/D60): configurable deadline hour (default 16 = 4 PM,
// set from settings via setDeadlineHour) + per-tier ALLOWED DAYS.
// "Weekday math" is now "working-day math": every tier declares
// which days of the week count (default Mon–Fri). Stage offsets,
// pipeline windows, date interception, and reschedule targets all
// count only the owning tier's allowed days. isWeekend/addWeekdays/
// weekendNeighbors remain as Mon–Fri wrappers for compatibility.
// 0.6.0 (D50): UNDATED stages are first-class — direction:"none".
// ============================================================

export const QUEUE_VERSION = "0.14.0";

const DAY_MS = 24 * 60 * 60 * 1000;

// D51: computed (date-only) deadlines are "due by this hour" (24-hr).
// Default 4 PM; settings/config.deadlineHour overrides via the setter.
let DEADLINE_HOUR = 16;
export function setDeadlineHour(h) {
  const n = parseInt(h, 10);
  DEADLINE_HOUR = (!isNaN(n) && n >= 0 && n <= 23) ? n : 16;
}
export function getDeadlineHour() { return DEADLINE_HOUR; }

// D85: completion point (0–1) where a project flips from "keep abreast"
// to "clear the deck" in the level-3 queue tiebreaker. Settings-driven,
// default 60%; fed from the config subscription via setClearDeckThreshold.
let CLEAR_DECK_THRESHOLD = 0.6;
export function setClearDeckThreshold(frac) {
  const n = Number(frac);
  CLEAR_DECK_THRESHOLD = (isFinite(n) && n >= 0 && n <= 1) ? n : 0.6;
}
export function getClearDeckThreshold() { return CLEAR_DECK_THRESHOLD; }

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

/** D43 level 3 (pre-D85): remaining pipeline fraction × workload. No longer
 *  in the sort — D86's deckRank/compareDeck below own that. Kept as a utility. */
export function remainingWork(project) {
  const { done, total } = projectProgress(project);
  if (!total) return 0;
  return ((total - done) / total) * (project.workload || 2);
}

/**
 * D86 level-3 grouping — supersedes D85's single blended weight.
 * Two PILES, split at CLEAR_DECK_THRESHOLD, and the pile always wins:
 *   0 = CLEAR THE DECK (pct >= T) — every one of these outranks every
 *       catch-up project, no matter how heavy the catch-up one is.
 *   1 = CATCH UP (pct < T) — still behind; keep everything abreast.
 *   2 = not a project (tasks/events carry no pipeline) — sorts last at
 *       this level, exactly as remainingWork:0 always did.
 * Ordering INSIDE a pile lives in compareDeck below.
 */
export function deckRank(project, threshold = CLEAR_DECK_THRESHOLD) {
  const { total, pct } = projectProgress(project);
  if (!total) return 2;
  return pct >= threshold ? 0 : 1;
}

/**
 * D86 level-3 comparator (Jake's grouped two-tier model). Given a 60%
 * threshold, four otherwise-identical projects sort 95 → 65 → 30 → 40:
 *   · pile first — past the threshold beats not-past, always;
 *   · inside CLEAR THE DECK: MOST done first (95 before 65 — finish it);
 *   · inside CATCH UP: LEAST done first (30 before 40 — rescue laggards);
 *   · workload ONLY breaks a genuine tie (two projects at the same pct):
 *     heavier first — the peer review takes longer, so it needs to be out
 *     the door sooner (Jake).
 * Deliberately NOT a blended score: workload can never carry a catch-up
 * project over a clear-deck one, and there's no U-shaped sag in the
 * middle where a barely-started project outranks a nearly-finished one.
 */
export function compareDeck(a, b) {
  const ra = a.deckRank ?? 2, rb = b.deckRank ?? 2;
  if (ra !== rb) return ra - rb;                    // pile dominates
  if (ra === 2) return 0;                           // tasks/events: neutral here
  const pa = a.progressPct || 0, pb = b.progressPct || 0;
  if (pa !== pb) return ra === 0 ? pb - pa : pa - pb; // clear: most done; catch-up: least done
  return (b.workload || 0) - (a.workload || 0);     // tie → heavier first
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

/**
 * Calendar-safe day step, always landing on a LOCAL midnight.
 * Do not replace with `ts + n*DAY_MS`: across a fall-back boundary that
 * day is 25 hours, so Nov 1 00:00 + DAY_MS = Nov 1 23:00 — startOfDay
 * would hand back Nov 1 AGAIN and the week would show a duplicate day
 * and silently drop one. setDate() walks the calendar, which is what a
 * week actually is. (Nashville observes DST; TZ is America/Chicago.)
 */
export function addDaysLocal(ts, n) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Whole days from local midnight `from` to the day containing `ts`. */
function dayOffset(from, ts) {
  return Math.round((startOfDay(ts) - startOfDay(from)) / DAY_MS); // rounding absorbs DST's ±1h
}
function endOfDay(ts) { return startOfDay(ts) + DAY_MS; }

// ---------- The queue ----------

/**
 * D43 sort:
 *   1. expired first (missed things at the very top, oldest deadline first)
 *   2. chronological by deadline/due — TIER DOES NOT MATTER HERE
 *   3. clear-deck piles (D86): past-threshold projects (most-done first),
 *      then catch-up projects (least-done first), then tasks/events;
 *      workload only breaks an exact-pct tie (heavier first)
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
  // D61: is the VIEWED day outside this tier's working days? Off-day
  // tiers vanish from the queue (not from cards, Done, or Waiting).
  const viewDow = new Date(viewDay).getDay();
  const offDay = tierId => {
    const t = tierById[tierId];
    return !!t && t.kind !== "anchor" && !allowedSet(t.allowedDays).has(viewDow);
  };
  const hidden = id => hiddenTierIds.has(id);

  // --- All-day banners (D80): ambient truth, not appointments ---
  const banners = events
    .filter(e => e.allDay && !hidden(e.tierId))
    .filter(e => e.start < dayEnd && (e.end || e.start + DAY_MS) > dayStart)
    .map(e => {
      const s0 = startOfDay(e.start);
      const endEx = e.end || e.start + DAY_MS;         // all-day end is EXCLUSIVE
      const dayTotal = Math.max(1, Math.round((endEx - s0) / DAY_MS));
      const dayN = Math.min(dayTotal, Math.max(1, Math.round((dayStart - s0) / DAY_MS) + 1));
      return { id: e.id, title: e.title, tier: tierById[e.tierId] || null, start: e.start, end: e.end || null, dayN, dayTotal };
    })
    .sort((a, b) => (rankOf(a.tier?.id) - rankOf(b.tier?.id)) || (a.start - b.start));

  // --- Events (anchors); D82: past windows sink out of the live list,
  // but only when the view IS today ---
  // (viewingToday already computed above for pin/escalation logic)
  const isPast = e => viewingToday && (e.end ?? e.start + 3600000) <= now;
  const passedEvents = events
    .filter(e => !e.allDay && !hidden(e.tierId) && isPast(e))
    .filter(e => e.start < dayEnd && (e.end || e.start) >= dayStart)
    .map(e => ({ id: e.id, title: e.title, start: e.start, end: e.end || null, tier: tierById[e.tierId] || null }))
    .sort((a, b) => a.start - b.start);

  const dayEvents = events
    .filter(e => !e.allDay && !hidden(e.tierId) && !isPast(e))
    .filter(e => e.start < dayEnd && (e.end || e.start) >= dayStart)
    .map(e => ({
      kind: "event", id: e.id, title: e.title,
      tier: tierById[e.tierId] || null,
      time: e.start, end: e.end || null,
      sortTime: e.start, expired: false, deckRank: 2,
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
    if (offDay(t.tierId)) continue; // D61
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
      deckRank: 2,
      escalation: t.escalation || { every: 1, unit: "hours" },
      raw: t
    });
  }

  // --- Projects (one item each: active stage shown, next deadline sorted) ---
  for (const p of projects) {
    if (hidden(p.tierId)) continue;
    if (offDay(p.tierId)) continue; // D61
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
      deckRank: deckRank(p),
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
    const deck = compareDeck(a, b);
    if (deck !== 0) return deck;                                            // 3 clear-deck piles (D86)
    const ra = rankOf(a.tier?.id), rb = rankOf(b.tier?.id);
    if (ra !== rb) return ra - rb;                                          // 4 tier
    return String(a.title).localeCompare(String(b.title));                  // 5 alphabet
  });

  doneToday.sort((a, b) => b.completedAt - a.completedAt);
  waiting.sort((a, b) => rankOf(a.tierId) - rankOf(b.tierId));

  return { pinned, items, waiting, doneToday, banners, passedEvents };
}

/**
 * D88 — THE WEEK. Seven (or N) honest days plus the two spanning strips.
 *
 * buildQueue owns the truth for a single day, so this calls it once per
 * column: expiry, D61 off-day tiers, escalation slots, the D86 piles and
 * the whole sort come along for free. What this adds is everything that
 * only exists ACROSS days.
 *
 * PROJECTS DO NOT REPEAT DOWN THE COLUMNS. D48 rides a project through
 * every day of its pipeline window, which is right for "what could I
 * touch today?" and wrong for a week — a 3-month project would render in
 * all seven columns. So a stage row appears ONLY on the day its deadline
 * actually lands (plus today, if it's expired — a missed thing must not
 * vanish just because we changed views). The project's SPAN lives in the
 * top strip instead, where a span belongs.
 *
 * Returns:
 *   days[]        — { dayStart, isToday, isPast, items, load, passedEvents }
 *   projectSpans  — bars for the top strip, with stage pips per day index
 *   bannerSpans   — all-day events as one bar each, not one pill per day
 * Both span lists carry fromIdx/toIdx CLIPPED to the window, plus
 * clippedLeft/clippedRight so the UI can show "this continues offscreen"
 * rather than lying about a start date.
 */
export function buildWeek({ tasks, events, tiers, projects = [], now, anchorDay, days = 7, hiddenTierIds = new Set() }) {
  const start = startOfDay(anchorDay);
  const today = startOfDay(now);
  const weekEndEx = addDaysLocal(start, days); // exclusive
  const hidden = id => hiddenTierIds.has(id);
  const tierById = {};
  tiers.forEach(t => { tierById[t.id] = t; });

  const cols = [];
  for (let i = 0; i < days; i++) {
    const dayStart = addDaysLocal(start, i);
    const dayEnd = addDaysLocal(start, i + 1);
    const isToday = dayStart === today;
    const q = buildQueue({ tasks, events, tiers, projects, now, viewDay: dayStart, hiddenTierIds });

    const items = q.items.filter(it => {
      if (it.kind !== "stage") return true;
      if (isToday && it.expired) return true;                   // missed: still shouts
      return it.deadline >= dayStart && it.deadline < dayEnd;   // otherwise: only on its day
    });

    cols.push({
      dayStart,
      isToday,
      isPast: dayStart < today,
      items,
      passedEvents: isToday ? q.passedEvents : [],
      load: {
        total: items.length,
        expired: items.filter(it => it.expired).length,
        events: items.filter(it => it.kind === "event").length,
        tasks: items.filter(it => it.kind === "task").length,
        stages: items.filter(it => it.kind === "stage").length
      }
    });
  }

  // --- Project bars (top strip) ---
  const projectSpans = [];
  for (const p of projects) {
    if (hidden(p.tierId)) continue;
    const stages = p.stages || [];
    if (!stages.length) continue;
    const activeIdx = stages.findIndex(s => !s.completedAt);
    if (activeIdx === -1) continue; // finished projects don't need a bar
    const allowedDays = tierById[p.tierId]?.allowedDays; // D60
    const [first, last] = projectPipelineWindow(p, allowedDays);
    const s0 = startOfDay(first), s1 = startOfDay(last);
    const nd = nextDeadline(p, allowedDays);
    const deadlineAt = nd ? nd.date : atDeadlineHour(p.endDate || last);
    const expired = now > deadlineAt;
    let rawFrom = dayOffset(start, s0), rawTo = dayOffset(start, s1);

    // D89 — NOTHING SILENTLY DISAPPEARS. A project whose whole pipeline
    // window is already in the past would fail the "is it this week?"
    // test and vanish — but D48 keeps an expired project alive on TODAY
    // until it's dealt with, and an overdue project is the FIRST thing a
    // planning board must show. So a late bar stretches to today.
    const todayIdx = dayOffset(start, now);
    const todayInWeek = todayIdx >= 0 && todayIdx < days;
    if (expired && todayInWeek && rawTo < todayIdx) rawTo = todayIdx;
    if (rawTo < 0 || rawFrom >= days) continue; // genuinely not this week

    const pips = [];
    stages.forEach((st, idx) => {
      if (!stageIsDated(st)) return;
      const when = stageEffectiveDate(p, st, allowedDays);
      if (when == null) return;
      const off = dayOffset(start, when);
      if (off < 0 || off >= days) return;
      pips.push({ dayIdx: off, name: st.name, index: idx, done: !!st.completedAt, isActive: idx === activeIdx });
    });

    const prog = projectProgress(p);
    projectSpans.push({
      id: p.id, name: p.name, color: p.color,
      tier: tierById[p.tierId] || null,
      deadlineAt,
      expired,
      deadlineStageName: nd ? nd.stage.name : "project end",
      deadlineIdx: (dayOffset(start, deadlineAt) >= 0 && dayOffset(start, deadlineAt) < days) ? dayOffset(start, deadlineAt) : null,
      progressPct: prog.pct,
      workload: p.workload || 2,
      fromIdx: Math.max(0, rawFrom),
      toIdx: Math.min(days - 1, rawTo),
      clippedLeft: rawFrom < 0,
      clippedRight: rawTo > days - 1,
      pct: prog.pct, done: prog.done, total: prog.total,
      deckRank: deckRank(p),
      activeStageName: stages[activeIdx].name,
      pips
    });
  }
  // D89: the SAME priority language as the queue (D43/D86) — expired
  // shouts, then soonest deadline, then the clear-deck piles. Alphabetical
  // ordering told Katie nothing about which bar to look at first.
  projectSpans.sort((a, b) =>
    (a.expired !== b.expired ? (a.expired ? -1 : 1) : 0) ||
    (a.deadlineAt - b.deadlineAt) ||
    compareDeck(a, b) ||
    String(a.name).localeCompare(String(b.name))
  );

  // --- All-day banners (top strip): ONE bar per event, not a pill per day ---
  const bannerSpans = [];
  for (const e of events) {
    if (!e.allDay || hidden(e.tierId)) continue;
    const s0 = startOfDay(e.start);
    const endEx = e.end || addDaysLocal(s0, 1);
    const s1 = startOfDay(endEx - 1); // inclusive last day
    if (s1 < start || s0 >= weekEndEx) continue;
    const rawFrom = dayOffset(start, s0), rawTo = dayOffset(start, s1);
    bannerSpans.push({
      id: e.id, title: e.title,
      tier: tierById[e.tierId] || null,
      start: e.start, end: e.end || null,
      fromIdx: Math.max(0, rawFrom),
      toIdx: Math.min(days - 1, rawTo),
      clippedLeft: rawFrom < 0,
      clippedRight: rawTo > days - 1,
      dayTotal: Math.max(1, dayOffset(s0, s1) + 1)
    });
  }
  bannerSpans.sort((a, b) => (a.fromIdx - b.fromIdx) || (b.toIdx - a.toIdx) || String(a.title).localeCompare(String(b.title)));

  const peak = Math.max(1, ...cols.map(c => c.load.total));
  cols.forEach(c => { c.loadShare = c.load.total / peak; }); // 0–1, for the header bar

  return { anchor: start, days: cols, dayCount: days, projectSpans, bannerSpans, peakLoad: peak };
}

/**
 * D89 — where does the week start? Three answers, all legitimate:
 *   "rolling" — today + 6. No wasted columns; best for a live kiosk.
 *   "sunday"  — Sun–Sat, the wall-calendar week.
 *   "monday"  — Mon–Sun, the working week (ISO).
 * Jake: the past columns are NOT dead space — "a part of it is also
 * reflecting on the week to work on next week." Planning needs the
 * week you just had. weekOffset pages by whole weeks either way.
 */
export function weekAnchorFor(mode, ref = Date.now(), weekOffset = 0) {
  const base = startOfDay(ref);
  if (mode === "sunday" || mode === "monday") {
    const startDow = mode === "monday" ? 1 : 0;
    const back = (new Date(base).getDay() - startDow + 7) % 7;
    return addDaysLocal(base, -back + weekOffset * 7);
  }
  return addDaysLocal(base, weekOffset * 7); // rolling
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtDay(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
