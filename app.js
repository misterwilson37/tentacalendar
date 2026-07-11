// ============================================================
// Tentacalendar — app.js
// Version 0.15.0 — "the year that fits" (D70)
// 0.15.0:
//  · Annual view (né Year wall) auto-density is now WINDOW-FIT, like
//    the timeline: month rows share the real screen height, GL clamps
//    5–14; the floor is 3px borderless hairline bars, so a fully
//    loaded Katie-year still fits one screen before it ever scrolls.
//    (Column count mirrors the CSS breakpoints — change together.)
//  · Annual week heights are UNIFORM (global max concurrency), so the
//    12 calendars line up like a real wall instead of July towering
//    over an empty August (Jake). Stacked Months keeps per-week fit.
//  · Bar labels appear on ANY bar tall enough to hold them (≥16px and
//    ≥3 days) — the Annual view included, e.g. with ▮ pinned.
//  · NOT a bug, recorded for posterity: progress fill is positional in
//    time (D30a) — a May–July project at 25% shows its saturation in
//    MAY; a July-onward window shows only ghost. Jan–Dec reveals it.
// Version 0.14.0 — "the whole year on the wall" (D69)
// 0.14.0:
//  · YEAR WALL layout (the view Jake was picturing all along): 12 mini
//    month calendars in a 4×3 grid — the wall of calendars. New
//    default; ▦▦/▦/▬ toggle. Zooming a wall month renders it big
//    (stacked-month styling). Wall bars never carry inline labels —
//    hover/tap/legend speak. Wall auto-density runs one notch thinner.
//  · BAR SIZE control (Jake): Auto (per-layout judgment, incl. the
//    timeline's window fit) or pinned ▮ 20px / ▪ 10px / ▁ 5px bars —
//    persisted per device (tc-year-barsize).
// Version 0.13.0 — "the wall calendar" (D68)
// 0.13.0:
//  · MONTH-GRID layout (Jake's "traditional view"): months stacked,
//    Sun–Sat columns, weeks as rows; bars clip per week ∩ month with
//    per-week lane packing (gcal-style), same drag/stretch/tap/fill.
//    Toggle (▦ Month grid ⇄ ▬ Timeline) left of the mode buttons;
//    grid is the default, choice persists (tc-year-layout). The
//    days-in-a-row layout now has its name in the UI: a Gantt chart.
//  · Timeline bars size to the WINDOW: total lanes share the real
//    vertical space (clamped 9–34px lanes), re-flowing on resize —
//    2K gets thick bars, phones get readable slivers.
//  · ＋ New project FAB (bottom-right of the year view) reparents the
//    REAL project form into a modal — listeners, color assistant, and
//    working-day interception ride along — and returns it on close.
// Version 0.12.0 — "days are key" (D66)
// 0.12.0:
//  · Day texture in BOTH year rows and month zoom: weekend shading
//    blocks, faint day gridlines, stronger Monday week lines (month
//    boundaries remain strongest). Compact grids shed day lines first.
//  · Adaptive bar density for Katie's real concurrency: ≤4 lanes =
//    full 20px bars with inline labels; ≤9 = half-height 10px; beyond
//    = quarter-height 5px. Thin bars drop inline labels — hover titles,
//    tap popovers, and the legend carry the names (Jake's suggestion).
//  · Rows now size to the lanes they actually use (a quiet quarter is
//    a short quarter) while every project keeps its one global lane.
// Version 0.11.0 — "PHASE 2: the year view" (D65)
// 0.11.0:
//  · Header 📅 toggles between Today and a quarter-aligned year view:
//    4 rows × 3 months, three anchor modes (Jan–Dec / quarter-first /
//    month-first, D31), ◀▶ pages 12 months, "back to now" resets.
//  · Project bars (D30a): pale ghost of the project color saturating
//    left-to-right by pipeline %, continuous across quarter rows via
//    per-segment gradient clipping; global lane packing keeps each
//    project on ONE lane all year; today line; legend + tap-for-details
//    popover (D27); labels hide on narrow grids (container query).
//  · Drag to move, edge-drag to stretch (D32): document-level pointer
//    listeners survive re-renders; live date readout in the nav label;
//    release snaps to the tier's working days (start fwd / end back,
//    order-guarded — same rules as the form and 🔁 duplicate).
//  · Tap a month name to zoom it full-width with day ticks (D18);
//    ◀▶ then steps one month; "◱ whole year" returns.
//  · View + anchor mode persist per device (tc-view / tc-year-mode).
// Version 0.10.0 — "the encore" (Katie's notes field, D63)
// 0.10.0:
//  · Tasks get an optional NOTES field: short title in the row, details
//    behind a ▸ toggle underneath (tap the title or the chevron).
//  · Row layout v2 (the phone smoking-gun screenshot): queue/waiting/
//    done rows are now two lines — [checkbox + title] over [tier chip +
//    actions] — so long titles wrap as prose instead of one-word
//    columns squeezed beside four buttons. Shared rowScaffold builder.
// Version 0.9.0 — "the goodbye release" (Inky's last)
// 0.9.0:
//  · D62 rev: dup modal gains "✎⋮ Review the pipeline first…" — edits
//    next year's stage list BEFORE anything is created (stages editor
//    borrowed via the "@dup" target; dup modal hides and returns).
//  · Snooze row: remind me in 1 day / 1 week / 1 month (30d alone was
//    too blunt).
//  · Un-dater broadened: remnants come in TWO flavors — after/end/0
//    (Katie's window experiments) AND after/start/0 (the 0.6.0/0.6.1
//    editors' default, per the D50 caveat). v0.8.0 only caught "end";
//    Jake's screenshot showed the other half untouched. Now any
//    After + 0wd row converts, either anchor.
// Version 0.8.0 — "the smoke-test release"
// 0.8.0:
//  · D61: queue hides a tier's items on days outside its allowedDays
//    (Katie's weekend queue is clear of Work; cards still show all).
//  · D62: duplicate-for-next-year is a REVIEW FORM — name (with the
//    year token auto-bumped, e.g. resv2606 → resv2706), dates, color,
//    tier, workload all editable before creation; "Remind me in a
//    month" snoozes it into a real task instead.
//  · Date/time fields: task due defaults to today; clicking any
//    date/time input opens the native picker (showPicker) where the
//    browser supports it, instead of demanding the tiny icon.
//  · Stage-editor rows: undated stages now GHOST their anchor/offset
//    controls (visibility, not display) so columns stay aligned — the
//    "name field ate the row" report was the layout collapsing into
//    the vacancy left by display:none.
// Version 0.7.0 — "the exit-checklist release"
// 0.7.0:
//  · DECISION MODAL v2 (D57): rows are LIVE (re-derived from real
//    state every render), ✓ completes the ACTIVE stage (the old code
//    completed the deadline stage — Jake's "still on the first phase"
//    bug), 🕐 replaces ↷ and reschedules the overdue DEADLINE to the
//    tier's next allowed day 9 AM, modal auto-closes when emptied.
//  · Collapsible project cards + pinned header buttons + finished
//    projects folded into their own section (D56).
//  · Un-complete-parent rewind modal, 3 options (D53).
//  · Duplicate-for-next-year: completion prompt + 🔁 card button (D59).
//  · Settings split into tabs; deadline hour (D51) + decision
//    threshold (D52) settable; per-tier allowed-day toggles (D60);
//    tier color conflict assistant (D55).
//  · ⓘ popover fix (D58): a tap inside a <label> re-dispatches a
//    click to the label's control, and THAT second click closed the
//    popover in the same instant it opened. preventDefault() stops
//    the forwarding. (Jake: "the i doesn't show anything.")
// 0.6.x: D50 undated stages, D49 versioned module imports, D43–D48
// priority engine v2 + modals + filters.
// ============================================================

import { CONFIG_VERSION } from "./config.js?v=0.4.0";
import {
  watchAuth, signIn, signOutUser, STORE_VERSION,
  subscribeTiers, subscribeTasks, subscribeEvents, subscribeConfig,
  subscribeProjects, subscribeStageTemplate,
  addTask, addFollowUp, setTaskDone, deleteTask, updateTask, rewindFollowUps,
  addProject, addProjectWithStages, deleteProject, updateProject,
  setStageDone, setStageDue, setProjectStages,
  saveTier, deleteTier, saveConfig, saveStageTemplate
} from "./store.js?v=0.8.0";
import {
  buildQueue, projectProgress, remainingWork, normalizeStage, nextDeadline,
  isDayAllowed, addAllowedDays, allowedNeighbors, setDeadlineHour,
  fmtTime, fmtDay, QUEUE_VERSION
} from "./queue.js?v=0.8.0";
import { celebrate, CELEBRATE_VERSION } from "./celebrate.js?v=0.1.1";

export const APP_VERSION = "0.15.0";
const $ = sel => document.querySelector(sel);
const DAY_MS = 86400000;

// ---------- State ----------
const S = {
  user: null,
  tiers: [], tasks: [], events: [], projects: [], stageTemplate: [],
  config: null,
  viewDay: Date.now(),
  editingTaskId: null,
  editingProjectId: null,
  dueTarget: null,          // {projectId, stageIndex}
  stagesTarget: null,       // projectId
  weekendPending: null,     // {payload, field} mid-validation project save
  decisionIds: null,        // Set of item keys while decision modal is open (D57)
  dupTarget: null,          // {projectId, stages} pending duplicate (D59/D62)
  stagesFromDup: false,     // stages editor opened FROM the dup modal (D62 rev)
  expandedNotes: new Set(), // task ids with details open (D63; ephemeral by design)
  uncheckTarget: null,      // task pending the un-complete rewind choice (D53)
  expandedProjects: new Set(JSON.parse(localStorage.getItem("tc-expanded-projects") || "[]")), // D56
  showFinished: localStorage.getItem("tc-show-finished") === "1",  // D56
  hiddenTierIds: new Set(JSON.parse(localStorage.getItem("tc-hidden-tiers") || "[]")),
  view: localStorage.getItem("tc-view") === "year" ? "year" : "day",   // D65 (persists per device)
  yearMode: localStorage.getItem("tc-year-mode") || "calendar",        // D31 anchor mode
  yearOffset: 0,           // months shifted from the mode's anchor (±12 per arrow)
  yearZoom: null,          // D18 month zoom: month-start ts, or null for the 12-month grid
  yearLayout: localStorage.getItem("tc-year-layout") || "wall",  // D68/D69: "wall" | "grid" | "timeline"
  yearBarSize: localStorage.getItem("tc-year-barsize") || "auto", // D69: "auto" | "full" | "half" | "quarter"
  lastSuggestedColor: "#4dabf7",
  unsubs: []
};

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  reportVersions();
  $("#signin-btn").addEventListener("click", () => signIn().catch(err => alert(err.message)));
  $("#signout-btn").addEventListener("click", () => signOutUser());
  $("#settings-btn").addEventListener("click", openSettings);
  $("#settings-close").addEventListener("click", closeSettings);
  $("#day-prev").addEventListener("click", () => shiftDay(-1));
  $("#day-next").addEventListener("click", () => shiftDay(1));
  $("#day-today").addEventListener("click", () => { S.viewDay = Date.now(); render(); });

  // D65 year view
  $("#view-toggle").addEventListener("click", () => setView(S.view === "year" ? "day" : "year"));
  $("#yv-prev").addEventListener("click", () => shiftYear(-1));
  $("#yv-next").addEventListener("click", () => shiftYear(1));
  $("#yv-today").addEventListener("click", () => { S.yearOffset = 0; S.yearZoom = null; renderYear(); });
  $("#yv-unzoom").addEventListener("click", () => { S.yearZoom = null; renderYear(); });
  $("#yv-modes").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => {
      S.yearMode = b.dataset.mode;
      localStorage.setItem("tc-year-mode", S.yearMode);
      S.yearOffset = 0; S.yearZoom = null;
      renderYear();
    }));
  $("#yv-layouts").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => {
      S.yearLayout = b.dataset.layout;
      localStorage.setItem("tc-year-layout", S.yearLayout);
      renderYear();
    }));
  $("#yv-sizes").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => {
      S.yearBarSize = b.dataset.size;
      localStorage.setItem("tc-year-barsize", S.yearBarSize);
      renderYear();
    }));
  $("#yv-add-project").addEventListener("click", openYvProjectModal);
  $("#yv-project-close").addEventListener("click", closeYvProjectModal);
  window.addEventListener("resize", () => {           // D68: timeline resizes with the window
    clearTimeout(yvResizeT);
    yvResizeT = setTimeout(() => { if (S.view === "year") renderYear(); }, 150);
  });
  $("#task-form").addEventListener("submit", onTaskFormSubmit);
  $("#task-cancel").addEventListener("click", cancelTaskEdit);
  $("#project-form").addEventListener("submit", onProjectFormSubmit);
  $("#project-cancel").addEventListener("click", cancelProjectEdit);
  $("#project-color").addEventListener("input", checkProjectColor);
  $("#tier-add").addEventListener("click", () => tierEditorRow({}, true));
  $("#stage-add").addEventListener("click", () => stageTemplateRow({ name: "", direction: "none", anchor: "start", offsetDays: 0 }, true));
  $("#settings-save").addEventListener("click", onSaveSettings);
  $("#cfg-poll").addEventListener("input", updatePollCostHint);
  $("#due-save").addEventListener("click", dueSave);
  $("#due-clear").addEventListener("click", dueClear);
  $("#due-cancel").addEventListener("click", () => { $("#due-modal").hidden = true; });
  $("#stages-save").addEventListener("click", stagesSave);
  $("#stages-cancel").addEventListener("click", () => {
    $("#stages-modal").hidden = true;
    if (S.stagesFromDup) { S.stagesFromDup = false; $("#dup-modal").hidden = false; } // back to the dup form, unsaved
  });
  $("#stage-proj-add").addEventListener("click", () =>
    projStageRow({ name: "", direction: "none", anchor: "start", offsetDays: 0, completedAt: null, dueAt: null }, -1, true));
  // Cleanup for pre-D50 experiments: rows saved as after/end/0 were
  // "dated at project end" by accident — flip them to No date IN THE
  // EDITOR (nothing writes until Save, so it's reviewable).
  $("#stage-proj-undate").addEventListener("click", () => {
    // BOTH remnant flavors (Jake's screenshot): after/end/0 (window
    // experiments) and after/start/0 (0.6.0/0.6.1 editor default).
    for (const row of document.querySelectorAll("#stage-proj-editor .stage-tmpl-row")) {
      if (row.querySelector(".st-dir").value === "after" &&
          (parseInt(row.querySelector(".st-off").value, 10) || 0) === 0) {
        row.querySelector(".st-dir").value = "none";
        syncTimingRow(row);
      }
    }
  });
  $("#decision-close").addEventListener("click", closeDecision);

  // Settings tabs (D52)
  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab)));

  // Tier color conflict assistant (D55) — delegated, rows are dynamic
  $("#tier-editor").addEventListener("input", ev => {
    if (ev.target.classList.contains("t-color") || ev.target.classList.contains("t-name")) checkTierColors();
  });

  // Un-complete rewind modal (D53)
  $("#uncheck-oops").addEventListener("click", () => resolveUncheck("oops"));
  $("#uncheck-rewind").addEventListener("click", () => resolveUncheck("rewind"));
  $("#uncheck-keep").addEventListener("click", () => resolveUncheck("keep"));

  // Duplicate-for-next-year modal (D59)
  $("#dup-yes").addEventListener("click", dupConfirm);
  $("#dup-stages").addEventListener("click", openDupStages);
  $("#dup-snooze-1").addEventListener("click", () => dupSnooze(1));
  $("#dup-snooze-7").addEventListener("click", () => dupSnooze(7));
  $("#dup-snooze-30").addEventListener("click", () => dupSnooze(30));
  $("#dup-no").addEventListener("click", () => { S.dupTarget = null; $("#dup-modal").hidden = true; });

  // Any date/time field opens its native picker on click/focus where
  // supported (Chromium). Safari ignores showPicker — typing still works.
  document.addEventListener("click", ev => {
    const inp = ev.target;
    if (inp instanceof HTMLInputElement && (inp.type === "date" || inp.type === "time") && inp.showPicker) {
      try { inp.showPicker(); } catch (_) { /* needs gesture / unsupported */ }
    }
  });

  $("#task-date").value = toDateInput(new Date()); // due date defaults to today

  // Tap-to-reveal ⓘ popovers (phones can't hover).
  // D58: preventDefault() is load-bearing — when the ⓘ lives inside a
  // <label>, the label re-dispatches the click to its form control, and
  // that second click's target isn't the dot OR the popover, so the
  // handler's else-branch hid the popover in the same tick it appeared.
  document.addEventListener("click", ev => {
    const dot = ev.target.closest(".info-dot");
    const pop = $("#popover");
    if (dot && dot.dataset.info) {
      ev.preventDefault();
      pop.textContent = dot.dataset.info;
      pop.hidden = false;
      const r = dot.getBoundingClientRect();
      pop.style.top = `${r.bottom + 6}px`;
      pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
      ev.stopPropagation();
    } else if (!ev.target.closest("#popover")) {
      pop.hidden = true;
    }
  });

  watchAuth(onSignedIn, onSignedOut);
  setInterval(tick, 60 * 1000);
  setInterval(drift, 5 * 1000);
});

function reportVersions() {
  const cssVersion = getComputedStyle(document.documentElement)
    .getPropertyValue("--tc-version").trim().replace(/"/g, "") || "?";
  const htmlVersion = document.body.dataset.htmlVersion || "?";
  const report =
    `app.js ${APP_VERSION} · store.js ${STORE_VERSION} · queue.js ${QUEUE_VERSION} · ` +
    `celebrate.js ${CELEBRATE_VERSION} · config.js ${CONFIG_VERSION} · css ${cssVersion} · html ${htmlVersion}`;
  $("#version").textContent = "v" + APP_VERSION;
  $("#version").title = report;
  const line = $("#versions-line");
  if (line) line.textContent = report;
}

function onSignedIn(user) {
  S.user = user;
  $("#auth-screen").hidden = true;
  $("#app-screen").hidden = false;
  $("#user-label").textContent = user.email;
  setView(S.view); // D65: restore this device's last view (year renders on first snapshot)
  S.unsubs.push(subscribeTiers(t => { S.tiers = t; refreshTierSelects(); renderFilters(); render(); }));
  S.unsubs.push(subscribeTasks(t => { S.tasks = t; render(); maybeDecisionTime(); }));
  S.unsubs.push(subscribeEvents(e => { S.events = e; render(); }));
  S.unsubs.push(subscribeProjects(p => { S.projects = p; suggestProjectColor(); render(); maybeDecisionTime(); }));
  S.unsubs.push(subscribeStageTemplate(t => { S.stageTemplate = t; }));
  S.unsubs.push(subscribeConfig(c => {
    S.config = c;
    setDeadlineHour(c?.deadlineHour ?? 16); // D51 — queue math follows settings
    render();
  }));
}

function onSignedOut() {
  S.unsubs.forEach(u => u());
  S.unsubs = [];
  S.user = null;
  $("#auth-screen").hidden = false;
  $("#app-screen").hidden = true;
}

// ---------- Tick / rollover / drift ----------
let lastTickDay = new Date().getDate();

function tick() {
  const d = new Date();
  if (d.getDate() !== lastTickDay) {
    lastTickDay = d.getDate();
    S.viewDay = Date.now();
    maybeDecisionTime();
  }
  render();
}

// D37: drift transforms #drift-wrap, NEVER <body>.
let driftT = 0;
function drift() {
  driftT += 0.03;
  const wrap = $("#drift-wrap");
  if (wrap) wrap.style.transform =
    `translate(${(Math.sin(driftT) * 2).toFixed(2)}px, ${(Math.cos(driftT * 0.7) * 2).toFixed(2)}px)`;
}

function shiftDay(n) { S.viewDay += n * DAY_MS; render(); }

// ---------- Tier filters (D47) ----------

function persistHidden() {
  localStorage.setItem("tc-hidden-tiers", JSON.stringify([...S.hiddenTierIds]));
}

function renderFilters() {
  const box = $("#tier-filters");
  if (!box) return;
  box.innerHTML = "";
  for (const t of S.tiers) {
    const chip = document.createElement("button");
    const hidden = S.hiddenTierIds.has(t.id);
    chip.className = "filter-chip" + (hidden ? " chip-off" : "");
    chip.textContent = (hidden ? "○ " : "● ") + t.name;
    chip.style.borderColor = t.color;
    if (!hidden) chip.style.background = hexToRgba(t.color, 0.18);
    chip.title = hidden ? `Show ${t.name} in the queue` : `Hide ${t.name} from the queue (this device only)`;
    chip.addEventListener("click", () => {
      if (!hidden && (t.rank ?? 99) <= 4) {
        if (!confirm(`"${t.name}" is a top-priority tier (rank ${t.rank}). Hide it from this device's queue anyway?\n\nHidden tiers are also excluded from overdue check-ins until you show them again.`)) return;
      }
      if (hidden) S.hiddenTierIds.delete(t.id); else S.hiddenTierIds.add(t.id);
      persistHidden();
      renderFilters();
      render();
    });
    box.append(chip);
  }
}

// ---------- Rendering ----------

function render() {
  if (!S.user) return;
  const now = Date.now();
  const q = buildQueue({
    tasks: S.tasks, events: S.events, tiers: S.tiers, projects: S.projects,
    now, viewDay: S.viewDay, hiddenTierIds: S.hiddenTierIds
  });

  const sameDay = new Date(S.viewDay).toDateString() === new Date(now).toDateString();
  $("#day-label").textContent = sameDay ? `Today — ${fmtDay(S.viewDay)}` : fmtDay(S.viewDay);
  $("#day-today").hidden = sameDay;

  renderPinned(q.pinned, now);
  renderQueue(q.items, now);
  renderWaiting(q.waiting);
  renderDone(q.doneToday);
  renderProjects(now);
  renderDecision(); // D57: modal rows track live state while open
  if (S.view === "year") renderYear(); // D65: live updates flow into the grid
}

function tierChip(tier) {
  const span = document.createElement("span");
  span.className = "chip";
  span.textContent = tier ? tier.name : "?";
  span.style.background = tier ? tier.color : "#666";
  return span;
}

function renderPinned(pinned, now) {
  const box = $("#pinned");
  box.innerHTML = "";
  box.hidden = pinned.length === 0;
  for (const e of pinned) {
    const row = document.createElement("div");
    row.className = "row pinned-row";
    row.append(tierChip(e.tier));
    const label = document.createElement("div");
    label.className = "row-main";
    const mins = Math.round((e.time - now) / 60000);
    label.innerHTML = `<strong>${esc(e.title)}</strong><span class="sub">${
      mins > 0 ? `in ${mins} min — ${fmtTime(e.time)}` : `NOW — ${fmtTime(e.time)}`
    }</span>`;
    row.append(label);
    box.append(row);
  }
}

function staleGlow(row, deadline, now) {
  const days = (now - deadline) / DAY_MS;
  if (days <= 0) return;
  const blur = Math.min(3 + days * 3.5, 16);
  const alpha = Math.min(0.25 + days * 0.12, 0.7);
  row.style.boxShadow = `0 0 ${blur.toFixed(0)}px rgba(255,107,107,${alpha.toFixed(2)})`;
}

/** Time + date, date omitted only when it's the viewed day (the Bonnie fix). */
function whenLabel(ts) {
  return sameDayAsView(ts) ? fmtTime(ts) : `${fmtTime(ts)} ${fmtDay(ts)}`;
}

/** D63 row layout: line 1 = lead (checkbox/dot) + title (+ ▸ when the
 *  task has notes), line 2 = tier chip + actions pinned right, details
 *  expanding underneath. One builder so queue/waiting/done stay twins. */
function rowScaffold(row, { lead, tier, mainHTML, buttons = [], notes = "", noteKey = null }) {
  row.classList.add("row-2l");
  const top = document.createElement("div");
  top.className = "row-top";
  if (lead) top.append(lead);
  const main = document.createElement("div");
  main.className = "row-main";
  main.innerHTML = mainHTML;
  top.append(main);
  const hasNotes = !!(notes && String(notes).trim()) && noteKey != null;
  if (hasNotes) {
    const open = S.expandedNotes.has(noteKey);
    const chev = document.createElement("button");
    chev.type = "button";
    chev.className = "icon-btn note-chev";
    chev.textContent = open ? "▾" : "▸";
    chev.title = open ? "Hide details" : "Show details";
    const toggle = () => {
      if (S.expandedNotes.has(noteKey)) S.expandedNotes.delete(noteKey);
      else S.expandedNotes.add(noteKey);
      render();
    };
    chev.addEventListener("click", toggle);
    main.classList.add("has-notes");
    main.title = open ? "Hide details" : "Show details";
    main.addEventListener("click", toggle);
    top.append(chev);
  }
  row.append(top);
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (tier !== undefined) actions.append(tierChip(tier));
  const spacer = document.createElement("span");
  spacer.className = "row-spacer";
  actions.append(spacer, ...buttons);
  row.append(actions);
  if (hasNotes && S.expandedNotes.has(noteKey)) {
    const n = document.createElement("div");
    n.className = "row-notes";
    n.textContent = String(notes);
    row.append(n);
  }
}

function renderQueue(items, now) {
  const list = $("#queue");
  list.innerHTML = "";
  if (items.length === 0) {
    list.innerHTML = `<div class="empty">Nothing in the queue. The octopus rests. 🐙</div>`;
    return;
  }
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "row" + (it.expired ? " overdue" : "") + (it.kind === "event" ? " event-row" : "");
    if (it.kind === "stage") {
      row.style.borderLeft = `4px solid ${it.projectColor || "#4dd0c4"}`;
      const pct = Math.round((it.progressPct || 0) * 100);
      row.style.background =
        `linear-gradient(90deg, ${hexToRgba(it.projectColor || "#4dd0c4", 0.16)} ${pct}%, transparent ${pct}%)`;
    }
    if (it.expired) staleGlow(row, it.kind === "stage" ? it.deadline : it.originalDue, now);

    let lead;
    if (it.kind === "task") {
      lead = document.createElement("input");
      lead.type = "checkbox";
      lead.addEventListener("change", ev => {
        setTaskDone(it.id, lead.checked);
        if (lead.checked) celebrate(1, clickPoint(ev));
      });
    } else if (it.kind === "stage") {
      lead = document.createElement("input");
      lead.type = "checkbox";
      lead.title = `Mark "${it.title}" done`;
      lead.addEventListener("change", ev => onStageToggle(it.projectId, it.stageIndex, lead.checked, ev));
    } else {
      lead = document.createElement("span");
      lead.className = "event-dot";
      lead.textContent = "📌";
    }

    let sub;
    if (it.kind === "event") {
      sub = fmtTime(it.time) + (it.end ? "–" + fmtTime(it.end) : "");
    } else if (it.kind === "stage") {
      const dl = `${esc(it.deadlineStageName)} — ${fmtDay(it.deadline)}${it.deadlineManual ? " " + fmtTime(it.deadline) : ""}`;
      sub = it.expired
        ? `<s>${dl}</s> <span class="badge">❗ missed</span>`
        : `next: ${dl}` + (it.workload !== 2 ? ` · ${it.workload === 3 ? "heavy" : "light"}` : "");
    } else if (it.expired) {
      sub = `<s>${whenLabel(it.originalDue)}</s> → ${fmtTime(it.time)} <span class="badge">❗ overdue</span>`;
    } else {
      sub = whenLabel(it.originalDue);
    }
    const stagePrefix = it.kind === "stage"
      ? `<span class="stage-proj" style="color:${it.projectColor}">${esc(it.projectName)}</span> · ` : "";
    const buttons = it.kind === "task" ? [
      iconBtn("✎", "Edit this task", () => startTaskEdit(it.raw)),
      iconBtn("↳", "Add follow-up", () => followUpPrompt(it)),
      iconBtn("✕", "Delete", () => { if (confirm(`Delete "${it.title}"?`)) deleteTask(it.id); })
    ] : it.kind === "stage" ? [
      iconBtn("⏰", "Set/change this stage's hard due date", () =>
        openDueDialog(it.projectId, it.stageIndex, it.title, it.dueAt))
    ] : [];
    rowScaffold(row, {
      lead, tier: it.tier,
      mainHTML: `<strong>${stagePrefix}${esc(it.title)}</strong><span class="sub">${sub}</span>`,
      buttons,
      notes: it.kind === "task" ? (it.raw?.notes || "") : "",
      noteKey: it.kind === "task" ? it.id : null
    });
    list.append(row);
  }
}

function sameDayAsView(ts) {
  return new Date(ts).toDateString() === new Date(S.viewDay).toDateString();
}

function renderWaiting(waiting) {
  const box = $("#waiting");
  const list = $("#waiting-list");
  list.innerHTML = "";
  box.hidden = waiting.length === 0;
  for (const t of waiting) {
    const parent = S.tasks.find(p => p.id === t.parentTaskId);
    const tier = S.tiers.find(x => x.id === t.tierId);
    const row = document.createElement("div");
    row.className = "row waiting-row";
    rowScaffold(row, {
      lead: null, tier,
      mainHTML: `<strong>${esc(t.title)}</strong><span class="sub">+${t.offsetDays}d after: ${esc(parent ? parent.title : "(deleted task)")}</span>`,
      buttons: [
        iconBtn("✎", "Edit title / offset", () => {
          const title = prompt("Follow-up title:", t.title);
          if (title === null) return;
          const days = parseInt(prompt("Days after parent completion:", t.offsetDays), 10);
          if (isNaN(days)) return;
          updateTask(t.id, { title: title.trim() || t.title, offsetDays: days });
        }),
        iconBtn("✕", "Delete", () => deleteTask(t.id))
      ],
      notes: t.notes || "",
      noteKey: t.id
    });
    list.append(row);
  }
}

function renderDone(done) {
  const box = $("#done");
  const list = $("#done-list");
  list.innerHTML = "";
  box.hidden = done.length === 0;
  $("#done-count").textContent = done.length;
  for (const t of done) {
    const tier = S.tiers.find(x => x.id === t.tierId);
    const row = document.createElement("div");
    row.className = "row done-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.addEventListener("change", () => onTaskUncheck(t));
    rowScaffold(row, {
      lead: cb, tier,
      mainHTML: `<strong>✓ ${esc(t.title)}</strong><span class="sub">done ${fmtTime(t.completedAt)}</span>`,
      notes: t.notes || "",
      noteKey: t.id
    });
    list.append(row);
  }
}

// ---------- Project panel ----------

function persistExpanded() {
  localStorage.setItem("tc-expanded-projects", JSON.stringify([...S.expandedProjects]));
}

function renderProjects(now) {
  const box = $("#projects-list");
  box.innerHTML = "";
  $("#projects-empty").hidden = S.projects.length !== 0;

  // D56: unfinished projects up top (whatever their dates — a stalled
  // past project stays visible on purpose); finished ones fold into
  // their own collapsed section below. Both keep start-date order.
  const open = S.projects.filter(p => !p.completedAt);
  const finished = S.projects.filter(p => p.completedAt);

  for (const p of open) box.append(projectCard(p));

  if (finished.length) {
    const toggle = document.createElement("button");
    toggle.className = "mini finished-toggle";
    toggle.textContent = `${S.showFinished ? "▾" : "▸"} Finished ✓ (${finished.length})`;
    toggle.title = "Completed projects, kept for the record";
    toggle.addEventListener("click", () => {
      S.showFinished = !S.showFinished;
      localStorage.setItem("tc-show-finished", S.showFinished ? "1" : "0");
      render();
    });
    box.append(toggle);
    if (S.showFinished) for (const p of finished) box.append(projectCard(p));
  }
}

/** D56: collapsed = header row + dates + progress bar. The header row
 *  never wraps: [chevron][name (wraps internally)][buttons] — the
 *  buttons Jake kept losing to the second row are now pinned. */
function projectCard(p) {
  const prog = projectProgress(p);
  const expanded = S.expandedProjects.has(p.id);
  const card = document.createElement("div");
  card.className = "project-card" + (p.completedAt ? " project-done" : "");
  card.style.borderTop = `3px solid ${p.color}`;

  const head = document.createElement("div");
  head.className = "project-head";
  head.title = expanded ? "Collapse" : "Expand stages";
  const chev = document.createElement("span");
  chev.className = "proj-chevron";
  chev.textContent = expanded ? "▾" : "▸";
  const nameEl = document.createElement("strong");
  nameEl.textContent = p.name;
  const btns = document.createElement("span");
  btns.className = "proj-btns";
  btns.append(
    iconBtn("🔁", "Duplicate this project for next year (same window, stages reset)", () => openDuplicateModal(p)),
    iconBtn("✎", "Edit project (name, color, tier, dates, workload)", () => startProjectEdit(p)),
    iconBtn("✎⋮", "Edit this project's stages (rename, reorder, add, remove)", () => openStagesDialog(p)),
    iconBtn("✕", "Delete project", () => {
      if (confirm(`Delete project "${p.name}" and its pipeline?`)) deleteProject(p.id);
    })
  );
  head.append(chev, nameEl, btns);
  head.addEventListener("click", ev => {
    if (ev.target.closest("button")) return; // buttons act, header toggles
    if (expanded) S.expandedProjects.delete(p.id); else S.expandedProjects.add(p.id);
    persistExpanded();
    render();
  });
  card.append(head);

  const wl = p.workload === 3 ? " · heavy" : p.workload === 1 ? " · light" : "";
  const dates = document.createElement("div");
  dates.className = "project-dates sub";
  dates.textContent = `${fmtDay(p.startDate)} – ${fmtDay(p.endDate)}${wl}` +
    (p.completedAt ? ` · finished ${fmtDay(p.completedAt)}` : "");
  card.append(dates);

  const barWrap = document.createElement("div");
  barWrap.className = "progress-wrap";
  barWrap.title = `${prog.done}/${prog.total} stages`;
  const bar = document.createElement("div");
  bar.className = "progress-fill";
  bar.style.width = `${(prog.pct * 100).toFixed(0)}%`;
  bar.style.background = p.color;
  barWrap.append(bar);
  const barLabel = document.createElement("span");
  barLabel.className = "progress-label";
  barLabel.textContent = `${prog.done}/${prog.total}`;
  barWrap.append(barLabel);
  card.append(barWrap);

  if (!expanded) return card;

  const stages = p.stages || [];
  const activeIdx = stages.findIndex(x => !x.completedAt);
  const list = document.createElement("div");
  list.className = "stage-list";
  stages.forEach((sRaw, i) => {
    const st = normalizeStage(sRaw);
    const row = document.createElement("div");
    row.className = "stage-row"
      + (st.completedAt ? " stage-done" : "")
      + (i === activeIdx ? " stage-active" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!st.completedAt;
    cb.addEventListener("change", ev => onStageToggle(p.id, i, cb.checked, ev));
    row.append(cb);

    const label = document.createElement("span");
    label.className = "stage-name";
    label.textContent = st.name;
    row.append(label);

    if (st.direction && st.direction !== "none") {
      const code = `${st.direction === "before" ? "−" : "+"}${st.offsetDays}wd ${st.anchor === "end" ? "end" : "start"}`;
      row.append(badge(code, `${st.offsetDays} working day(s) ${st.direction} project ${st.anchor} (counts this tier's allowed days)`));
    }
    if (st.dueAt) {
      const due = badge(`⏰ ${fmtDay(st.dueAt)}`, "Hard due date — click to change/clear");
      due.classList.add("clickable");
      due.addEventListener("click", () => openDueDialog(p.id, i, st.name, st.dueAt));
      row.append(due);
    } else if (!st.completedAt) {
      const setDue = iconBtn("⏰", "Set a hard due date", () => openDueDialog(p.id, i, st.name, null));
      setDue.classList.add("stage-due-btn");
      row.append(setDue);
    }
    list.append(row);
  });
  card.append(list);
  return card;
}

async function onStageToggle(projectId, stageIndex, done, ev) {
  const result = await setStageDone(projectId, stageIndex, done);
  if (done && result) {
    celebrate(result.allDone ? 3 : 2, clickPoint(ev));
    // D59: once the fireworks land, offer next year's run.
    if (result.allDone) {
      const p = S.projects.find(x => x.id === projectId);
      if (p) setTimeout(() => openDuplicateModal(p), 2600);
    }
  }
}

// ---------- Duplicate for next year (D59) ----------

/** Same calendar date next year; Feb 29 clamps to Feb 28. */
function plusOneYear(ts) {
  const d = new Date(ts);
  const m = d.getMonth();
  d.setFullYear(d.getFullYear() + 1);
  if (d.getMonth() !== m) d.setDate(0); // rolled over → back to month end
  return d.getTime();
}

function openDuplicateModal(p) {
  const tier = S.tiers.find(t => t.id === p.tierId);
  const allowed = tier?.allowedDays;
  // Shift the window +1 year, then snap onto the tier's working days:
  // start slides FORWARD to the next allowed day, end slides BACK to the
  // previous one (never widening the window), with an order guard.
  let startDate = plusOneYear(p.startDate);
  let endDate = plusOneYear(p.endDate);
  if (!isDayAllowed(startDate, allowed)) startDate = allowedNeighbors(startDate, allowed).next;
  if (!isDayAllowed(endDate, allowed)) endDate = allowedNeighbors(endDate, allowed).prev;
  if (endDate < startDate) endDate = allowedNeighbors(startDate, allowed).next;
  // D62 rev: the stage list is part of the review — copied (and reset)
  // up front so "✎⋮ Review the pipeline first…" can edit it pre-create.
  const stages = (p.stages || []).map(sRaw => {
    const st = normalizeStage(sRaw);
    return {
      name: st.name,
      direction: st.direction || "none",
      anchor: st.anchor || "start",
      offsetDays: st.offsetDays || 0,
      completedAt: null,
      dueAt: null
    };
  });
  S.dupTarget = { projectId: p.id, stages };
  $("#dup-text").textContent =
    `Everything below is pre-filled for next year and editable — double-check before creating. ` +
    `The ${stages.length}-stage pipeline copies over exactly as this project has it (surgery included), ` +
    `checkboxes and hard dues reset; review or reshape it first with ✎⋮ below.`;
  $("#dup-name").value = bumpYearTokens(p.name, new Date(p.startDate).getFullYear(), new Date(startDate).getFullYear());
  $("#dup-start").value = toDateInput(new Date(startDate));
  $("#dup-end").value = toDateInput(new Date(endDate));
  $("#dup-color").value = p.color;
  const taskTiers = S.tiers.filter(t => t.kind !== "anchor");
  $("#dup-tier").innerHTML = taskTiers.map(t =>
    `<option value="${t.id}">${t.rank} — ${esc(t.name)}</option>`).join("");
  $("#dup-tier").value = p.tierId;
  $("#dup-workload").value = String(p.workload || 2);
  $("#dup-modal").hidden = false;
}

/** D62: bump year tokens in a project name — the full year (2026→2027)
 *  and Katie's YYNN codes (resv2606→resv2706, where the first two
 *  digits are the two-digit year of the project's start). */
function bumpYearTokens(name, fromYear, toYear) {
  let out = String(name);
  out = out.replace(new RegExp(`(^|\\D)${fromYear}(?=\\D|$)`, "g"), `$1${toYear}`);
  const fyy = String(fromYear % 100).padStart(2, "0");
  const tyy = String(toYear % 100).padStart(2, "0");
  out = out.replace(new RegExp(`(^|\\D)${fyy}(\\d{2})(?=\\D|$)`, "g"), `$1${tyy}$2`);
  return out;
}

function dupConfirm() {
  const t = S.dupTarget;
  if (!t) { $("#dup-modal").hidden = true; return; }
  const p = S.projects.find(x => x.id === t.projectId);
  if (!p) { S.dupTarget = null; $("#dup-modal").hidden = true; return; }
  const name = $("#dup-name").value.trim() || p.name;
  const startDate = new Date(`${$("#dup-start").value}T00:00`).getTime();
  const endDate = new Date(`${$("#dup-end").value}T00:00`).getTime();
  const tierId = $("#dup-tier").value;
  const workload = parseInt($("#dup-workload").value, 10) || 2;
  if (isNaN(startDate) || isNaN(endDate)) { alert("Both dates are needed."); return; }
  if (endDate < startDate) { alert("Project can't end before it starts. (The octopus checked.)"); return; }
  // Edited dates still respect the chosen tier's working days (D60).
  const tier = S.tiers.find(x => x.id === tierId);
  for (const [label, ts] of [["start", startDate], ["end", endDate]]) {
    if (!isDayAllowed(ts, tier?.allowedDays)) {
      const { prev, next } = allowedNeighbors(ts, tier?.allowedDays);
      alert(`${fmtDay(ts)} is outside ${tier ? tier.name + "'s" : "this tier's"} working days — ` +
        `try ${fmtDay(prev)} or ${fmtDay(next)} for the ${label} date.`);
      return;
    }
  }
  const stages = t.stages || [];
  S.dupTarget = null;
  $("#dup-modal").hidden = true;
  addProjectWithStages({
    name, color: $("#dup-color").value, tierId, workload, startDate, endDate, stages
  }).then(ref => {
    // Open the new card so the pipeline is immediately reviewable
    // (✎⋮ from there for stage surgery — "Excel setup" → five steps).
    if (ref?.id) { S.expandedProjects.add(ref.id); persistExpanded(); }
  });
}

/** D62 rev: edit next year's pipeline BEFORE it exists — borrows the
 *  per-project stages editor against the staged copy ("@dup" target). */
function openDupStages() {
  if (!S.dupTarget) return;
  const p = S.projects.find(x => x.id === S.dupTarget.projectId);
  S.stagesTarget = "@dup";
  S.stagesFromDup = true;
  $("#dup-modal").hidden = true;
  $("#stages-title").textContent = `✎ Stages — next year's ${p ? p.name : "run"}`;
  const box = $("#stage-proj-editor");
  box.innerHTML = "";
  (S.dupTarget.stages || []).forEach(st => projStageRow(st, -1, false));
  $("#stages-modal").hidden = false;
}

/** D62: "too soon after the fireworks" escape hatch — snooze the
 *  duplication decision into a real task 1/7/30 days out. */
function dupSnooze(days) {
  const t = S.dupTarget;
  S.dupTarget = null;
  $("#dup-modal").hidden = true;
  if (!t) return;
  const p = S.projects.find(x => x.id === t.projectId);
  if (!p) return;
  const tier = S.tiers.find(x => x.id === p.tierId);
  let due = Date.now() + days * DAY_MS;
  if (!isDayAllowed(due, tier?.allowedDays)) due = allowedNeighbors(due, tier?.allowedDays).next;
  const d = new Date(due); d.setHours(9, 0, 0, 0);
  addTask({
    title: `🔁 Set up next year's "${p.name}"?`,
    tierId: p.tierId,
    dueAt: d.getTime(),
    escalation: { every: 1, unit: "days" }
  });
}

function badge(text, title) {
  const b = document.createElement("span");
  b.className = "stage-badge";
  b.textContent = text;
  b.title = title || "";
  return b;
}

function clickPoint(ev) {
  if (ev && ev.target) {
    const r = ev.target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return {};
}

// ---------- Due-date dialog ----------

function openDueDialog(projectId, stageIndex, stageName, existingDueAt) {
  S.dueTarget = { projectId, stageIndex };
  $("#due-title").textContent = `Hard due date — ${stageName}`;
  if (existingDueAt) {
    const d = new Date(existingDueAt);
    $("#due-date").value = toDateInput(d);
    $("#due-time").value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } else {
    $("#due-date").value = "";
    $("#due-time").value = "17:00";
  }
  $("#due-clear").hidden = !existingDueAt;
  $("#due-modal").hidden = false;
}

function dueSave() {
  const date = $("#due-date").value;
  if (!date || !S.dueTarget) { $("#due-modal").hidden = true; return; }
  const time = $("#due-time").value || "17:00";
  setStageDue(S.dueTarget.projectId, S.dueTarget.stageIndex, new Date(`${date}T${time}`).getTime());
  $("#due-modal").hidden = true;
}

function dueClear() {
  if (S.dueTarget) setStageDue(S.dueTarget.projectId, S.dueTarget.stageIndex, null);
  $("#due-modal").hidden = true;
}

// ---------- Per-project stage surgery (D42) ----------

function openStagesDialog(p) {
  S.stagesTarget = p.id;
  $("#stages-title").textContent = `✎ Stages — ${p.name}`;
  const box = $("#stage-proj-editor");
  box.innerHTML = "";
  (p.stages || []).forEach((st, i) => projStageRow(normalizeStage(st), i, false));
  $("#stages-modal").hidden = false;
}

function timingSelects(st) {
  const dir = st.direction || "none";
  const undated = dir === "none";
  return `
    <select class="st-dir" title="No date: this stage is pipeline weight — it just has to happen before the next dated thing. Before/After: this stage has a real target date.">
      <option value="none" ${undated ? "selected" : ""}>No date</option>
      <option value="before" ${dir === "before" ? "selected" : ""}>Before</option>
      <option value="after" ${dir === "after" ? "selected" : ""}>After</option>
    </select>
    <select class="st-anchor${undated ? " st-ghost" : ""}" title="Counted from project start or project end">
      <option value="start" ${st.anchor !== "end" ? "selected" : ""}>start</option>
      <option value="end" ${st.anchor === "end" ? "selected" : ""}>end</option>
    </select>
    <label class="st-off-label${undated ? " st-ghost" : ""}" title="Working-day offset — this tier's off days never count."><input class="st-off" type="number" min="0" value="${st.offsetDays || 0}">wd</label>`;
}

function syncTimingRow(row) {
  // st-ghost (visibility) keeps the columns aligned across dated and
  // undated rows — display:none let the name field swallow the space.
  const undated = row.querySelector(".st-dir").value === "none";
  row.querySelector(".st-anchor").classList.toggle("st-ghost", undated);
  row.querySelector(".st-off-label").classList.toggle("st-ghost", undated);
}

function projStageRow(st, origIndex, isNew) {
  const box = $("#stage-proj-editor");
  const row = document.createElement("div");
  row.className = "stage-tmpl-row" + (st.completedAt ? " proj-stage-done" : "");
  row.dataset.orig = String(origIndex);
  row.innerHTML = `
    <span class="st-move"><button type="button" class="st-up" title="Move up">▲</button><button type="button" class="st-down" title="Move down">▼</button></span>
    <input class="st-name" type="text" value="${esc(st.name || "")}" placeholder="Stage name">
    ${timingSelects(st)}
    <span class="st-flags">${st.completedAt ? "✓" : ""}${st.dueAt ? " ⏰" : ""}</span>
    <button type="button" class="st-del" title="Remove stage from this project">✕</button>`;
  wireTmplRow(row, box);
  box.append(row);
  if (isNew) row.querySelector(".st-name").focus();
}

function stagesSave() {
  if (S.stagesTarget === "@dup") {
    // D62 rev: collect into the staged copy — nothing writes until
    // "Create next year's run"; checkboxes/dues stay reset by design.
    if (S.dupTarget) {
      S.dupTarget.stages = [...document.querySelectorAll("#stage-proj-editor .stage-tmpl-row")].map(row => ({
        name: row.querySelector(".st-name").value.trim() || "Untitled stage",
        direction: row.querySelector(".st-dir").value,
        anchor: row.querySelector(".st-anchor").value,
        offsetDays: clampInt(row.querySelector(".st-off").value, 0, 365, 0),
        completedAt: null,
        dueAt: null
      }));
      $("#dup-text").textContent = $("#dup-text").textContent.replace(/The \d+-stage pipeline/, `The ${S.dupTarget.stages.length}-stage pipeline`);
    }
    S.stagesTarget = null;
    S.stagesFromDup = false;
    $("#stages-modal").hidden = true;
    $("#dup-modal").hidden = false;
    return;
  }
  const p = S.projects.find(x => x.id === S.stagesTarget);
  if (!p) { $("#stages-modal").hidden = true; return; }
  const orig = p.stages || [];
  const stages = [...document.querySelectorAll("#stage-proj-editor .stage-tmpl-row")].map(row => {
    const oi = parseInt(row.dataset.orig, 10);
    const carried = (oi >= 0 && orig[oi]) ? orig[oi] : { completedAt: null, dueAt: null };
    return {
      name: row.querySelector(".st-name").value.trim() || "Untitled stage",
      direction: row.querySelector(".st-dir").value,
      anchor: row.querySelector(".st-anchor").value,
      offsetDays: clampInt(row.querySelector(".st-off").value, 0, 365, 0),
      completedAt: carried.completedAt ?? null,
      dueAt: carried.dueAt ?? null
    };
  });
  setProjectStages(S.stagesTarget, stages);
  $("#stages-modal").hidden = true;
}

// ---------- Overdue decision modal (D46) ----------

function decisionKey() {
  const d = new Date();
  return `tc-decision-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Items ≥ threshold days past deadline in visible tiers, right now. */
function staleItems() {
  const now = Date.now();
  const threshold = (S.config?.decisionThresholdDays ?? 2) * DAY_MS; // D52
  const q = buildQueue({
    tasks: S.tasks, events: S.events, tiers: S.tiers, projects: S.projects,
    now, viewDay: now, hiddenTierIds: S.hiddenTierIds
  });
  return q.items.filter(it =>
    it.expired && (now - (it.kind === "stage" ? it.deadline : it.originalDue)) >= threshold);
}

/** One project = one modal row across its whole lifetime in the modal,
 *  however many stages it burns through while it's open. */
function decisionItemKey(it) {
  return it.kind === "stage" ? `proj:${it.projectId}` : `task:${it.id}`;
}

function maybeDecisionTime() {
  if (!S.user || S.decisionIds) return;           // already open
  if (localStorage.getItem(decisionKey())) return; // today's shot is spent
  const stale = staleItems();
  if (!stale.length) return;
  localStorage.setItem(decisionKey(), "1"); // once per day per device
  S.decisionIds = new Set(stale.map(decisionItemKey));
  renderDecision();
  $("#decision-modal").hidden = false;
}

function closeDecision() {
  S.decisionIds = null;
  $("#decision-modal").hidden = true;
}

/** D57: the modal is a live view. Every render re-derives its rows from
 *  current state, so ✓ and 🕐 visibly resolve items, a project row
 *  advances to its next stage instead of lying, and the modal closes
 *  itself once everything is dealt with. */
function renderDecision() {
  if (!S.decisionIds) return;
  const current = staleItems().filter(it => S.decisionIds.has(decisionItemKey(it)));
  if (!current.length) { closeDecision(); return; }
  const now = Date.now();
  const list = $("#decision-list");
  list.innerHTML = "";
  for (const it of current) {
    const overdueSince = it.kind === "stage" ? it.deadline : it.originalDue;
    const days = Math.floor((now - overdueSince) / DAY_MS);
    const row = document.createElement("div");
    row.className = "row decision-row";
    const main = document.createElement("div");
    main.className = "row-main";
    if (it.kind === "stage") {
      // Show the ACTIVE stage (what ✓ completes); name the overdue
      // deadline separately when it's a different, later stage.
      const dl = it.deadlineStageIndex !== it.stageIndex
        ? ` · deadline: ${esc(it.deadlineStageName)}` : "";
      main.innerHTML = `<strong>${esc(it.projectName)}: ${esc(it.title)}</strong>` +
        `<span class="sub">${days} day${days === 1 ? "" : "s"} overdue${dl}</span>`;
    } else {
      main.innerHTML = `<strong>${esc(it.title)}</strong>` +
        `<span class="sub">${days} day${days === 1 ? "" : "s"} overdue</span>`;
    }
    row.append(main);
    // D60: reschedule lands on the tier's next ALLOWED day — a weekend
    // check is unnecessary by construction (disallowed days are skipped).
    const target = (() => {
      const t = addAllowedDays(now, 1, it.tier?.allowedDays);
      const d = new Date(t); d.setHours(9, 0, 0, 0); return d.getTime();
    })();
    row.append(
      iconBtn("✓", it.kind === "stage" ? `Mark "${it.title}" done` : "Mark it done", ev => {
        if (it.kind === "stage") onStageToggle(it.projectId, it.stageIndex, true, ev);
        else { setTaskDone(it.id, true); celebrate(1, clickPoint(ev)); }
      }),
      iconBtn("🕐", `Reschedule to ${fmtDay(target)} 9:00 AM`, () => {
        if (it.kind === "stage") setStageDue(it.projectId, it.deadlineStageIndex, target);
        else updateTask(it.id, { dueAt: target });
      })
    );
    list.append(row);
  }
}

// ---------- Task form (create + edit) ----------

function refreshTierSelects() {
  const taskTiers = S.tiers.filter(t => t.kind !== "anchor"); // rank-sorted upstream
  const taskOpts = taskTiers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const projOpts = taskTiers.map(t => `<option value="${t.id}">${t.rank} — ${esc(t.name)}</option>`).join("");
  const keep1 = $("#task-tier").value, keep2 = $("#project-tier").value;
  $("#task-tier").innerHTML = taskOpts;
  $("#project-tier").innerHTML = projOpts;
  if (keep1 && taskTiers.some(t => t.id === keep1)) $("#task-tier").value = keep1;
  if (keep2 && taskTiers.some(t => t.id === keep2)) {
    $("#project-tier").value = keep2;
  } else {
    const work = taskTiers.find(t => t.name.toLowerCase() === "work");
    if (work) $("#project-tier").value = work.id;
  }
}

function startTaskEdit(task) {
  S.editingTaskId = task.id;
  $("#task-form-title").textContent = "✎ Edit task";
  $("#task-submit").textContent = "Save changes";
  $("#task-cancel").hidden = false;
  $("#task-title").value = task.title;
  $("#task-notes").value = task.notes || "";
  $("#task-tier").value = task.tierId;
  const d = new Date(task.dueAt);
  $("#task-date").value = toDateInput(d);
  $("#task-time").value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  $("#task-esc-n").value = task.escalation?.every ?? 1;
  $("#task-esc-unit").value = task.escalation?.unit ?? "hours";
  $("#task-title").focus();
}

function cancelTaskEdit() {
  S.editingTaskId = null;
  $("#task-form-title").textContent = "New task";
  $("#task-submit").textContent = "Add to the tentacles";
  $("#task-cancel").hidden = true;
  $("#task-form").reset();
  $("#task-time").value = "09:00";
  $("#task-esc-n").value = 1;
}

function onTaskFormSubmit(ev) {
  ev.preventDefault();
  const title = $("#task-title").value.trim();
  const tierId = $("#task-tier").value;
  const date = $("#task-date").value;
  const time = $("#task-time").value || "09:00";
  const every = parseInt($("#task-esc-n").value, 10) || 1;
  const unit = $("#task-esc-unit").value;
  if (!title || !tierId || !date) return;
  const dueAt = new Date(`${date}T${time}`).getTime();
  const payload = { title, tierId, dueAt, escalation: { every, unit }, notes: $("#task-notes").value.trim() };
  if (S.editingTaskId) updateTask(S.editingTaskId, payload).then(cancelTaskEdit);
  else addTask(payload).then(() => { $("#task-title").value = ""; $("#task-notes").value = ""; });
}

// ---------- Project form (create + edit) + weekend interception (D45) ----------

function startProjectEdit(p) {
  S.editingProjectId = p.id;
  $("#project-form-title").textContent = "✎ Edit project";
  $("#project-submit").textContent = "Save changes";
  $("#project-cancel").hidden = false;
  $("#project-name").value = p.name;
  $("#project-color").value = p.color;
  $("#project-tier").value = p.tierId;
  $("#project-workload").value = String(p.workload || 2);
  $("#project-start").value = toDateInput(new Date(p.startDate));
  $("#project-end").value = toDateInput(new Date(p.endDate));
  checkProjectColor();
  $("#project-name").focus();
}

function cancelProjectEdit() {
  S.editingProjectId = null;
  $("#project-form-title").textContent = "New project";
  $("#project-submit").textContent = "Launch pipeline";
  $("#project-cancel").hidden = true;
  $("#project-form").reset();
  $("#project-workload").value = "2";
  suggestProjectColor(true);
  $("#project-color-hint").textContent = "";
}

function onProjectFormSubmit(ev) {
  ev.preventDefault();
  const name = $("#project-name").value.trim();
  const color = $("#project-color").value;
  const tierId = $("#project-tier").value;
  const workload = parseInt($("#project-workload").value, 10) || 2;
  const start = $("#project-start").value;
  const end = $("#project-end").value;
  if (!name || !tierId || !start || !end) return;
  const payload = {
    name, color, tierId, workload,
    startDate: new Date(`${start}T00:00`).getTime(),
    endDate: new Date(`${end}T00:00`).getTime()
  };
  if (payload.endDate < payload.startDate) {
    alert("Project can't end before it starts. (The octopus checked.)");
    return;
  }
  validateWeekends(payload, "startDate");
}

/** D45→D60: project start/end should land on the tier's ALLOWED days —
 *  everything else is computed from them. A tier that allows all seven
 *  days (e.g. Personal) never triggers this modal. Checks fields one at
 *  a time via the interception modal. */
function validateWeekends(payload, field) {
  if (field === null) { commitProject(payload); return; }
  const next = field === "startDate" ? "endDate" : null;
  const tier = S.tiers.find(t => t.id === payload.tierId);
  const allowed = tier?.allowedDays;
  if (isDayAllowed(payload[field], allowed)) { validateWeekends(payload, next); return; }
  const { prev, next: after } = allowedNeighbors(payload[field], allowed);
  S.weekendPending = { payload, field, next, fri: prev, mon: after };
  const which = field === "startDate" ? "start" : "end";
  const dow = new Date(payload[field]).toLocaleDateString([], { weekday: "long" });
  $("#weekend-text").textContent =
    `${fmtDay(payload[field])} is a ${dow} — that's outside ${tier ? `the ${tier.name} tier's` : "this tier's"} working days, ` +
    `and pipeline math only counts those. Keep it as the project ${which} date anyway?`;
  $("#weekend-fri").textContent = `No — ${fmtDay(prev)}`;
  $("#weekend-mon").textContent = `No — ${fmtDay(after)}`;
  $("#weekend-modal").hidden = false;
}

function weekendChoice(choice) {
  const w = S.weekendPending;
  $("#weekend-modal").hidden = true;
  if (!w) return;
  S.weekendPending = null;
  if (choice === "back") return;
  if (choice === "fri") w.payload[w.field] = w.fri;
  if (choice === "mon") w.payload[w.field] = w.mon;
  // "yes" keeps the weekend date as chosen
  if (w.field === "startDate") $("#project-start").value = toDateInput(new Date(w.payload.startDate));
  else $("#project-end").value = toDateInput(new Date(w.payload.endDate));
  validateWeekends(w.payload, w.next);
}
document.addEventListener("DOMContentLoaded", () => {
  $("#weekend-yes").addEventListener("click", () => weekendChoice("yes"));
  $("#weekend-fri").addEventListener("click", () => weekendChoice("fri"));
  $("#weekend-mon").addEventListener("click", () => weekendChoice("mon"));
  $("#weekend-back").addEventListener("click", () => weekendChoice("back"));
});

function commitProject(payload) {
  if (S.editingProjectId) updateProject(S.editingProjectId, payload).then(() => { cancelProjectEdit(); closeYvProjectModal(); });
  else addProject(payload).then(() => { $("#project-name").value = ""; suggestProjectColor(true); closeYvProjectModal(); }); // D68: new bar appears behind the closing modal
}

// ---------- Color conflict assistant (D40) ----------

const COLOR_POOL = [
  "#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc",
  "#f783ac", "#63e6be", "#e599f7", "#ff9f43", "#54a0ff", "#00d2d3",
  "#feca57", "#5f27cd", "#48dbfb", "#1dd1a1"
];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// ---------- D65: Year view (Phase 2) ----------
// Quarter-aligned 4 rows × 3 months (D31: calendar / quarter-first /
// month-first anchors), D30a ghost bars saturating left-to-right by
// pipeline %, D32 drag-to-move + edge-drag-to-stretch, D18 month zoom,
// D27 legend + tap details. Bars are %-positioned inside each row, so
// one renderer serves the year grid AND the zoomed single month.

let yvTapSquelch = false; // a completed drag must not fire the tap popover
let yvDragging = false;

function startOfDayTs(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

function setView(v) {
  S.view = v;
  localStorage.setItem("tc-view", v);
  $("main").hidden = v === "year";           // D35's [hidden]!important beats main's display:grid
  $("#year-view").hidden = v !== "year";
  const b = $("#view-toggle");
  b.textContent = v === "year" ? "📋" : "📅";
  b.title = v === "year" ? "Today view" : "Year view";
  if (v === "year") renderYear();
}

/** First month of the visible 12 (D31 mode + paging offset). */
function yearAnchorMonth() {
  const now = new Date();
  let m0 = 0;
  if (S.yearMode === "quarter") m0 = Math.floor(now.getMonth() / 3) * 3;
  else if (S.yearMode === "month") m0 = now.getMonth();
  return new Date(now.getFullYear(), m0 + S.yearOffset, 1);
}

function shiftYear(n) {
  if (S.yearZoom != null) {
    const z = new Date(S.yearZoom);
    S.yearZoom = new Date(z.getFullYear(), z.getMonth() + n, 1).getTime();
  } else {
    S.yearOffset += n * 12;
  }
  renderYear();
}

function yvDetails(p, prog) {
  const tier = S.tiers.find(t => t.id === p.tierId);
  const nd = nextDeadline(p, tier?.allowedDays);
  const s0 = startOfDayTs(p.startDate || 0), e0 = startOfDayTs(p.endDate || p.startDate || 0);
  let out = `${p.name}\n${fmtDay(s0)} → ${fmtDay(e0)} · ${prog.done}/${prog.total} stages (${Math.round(prog.pct * 100)}%)`;
  if (p.completedAt) out += "\n✓ complete";
  else if (nd) out += `\nnext: ${nd.stage.name} — ${fmtDay(nd.date)}`;
  return out;
}

function yvShowDetails(bar, p) {
  const pop = $("#popover");
  pop.textContent = yvDetails(p, projectProgress(p));
  pop.hidden = false;
  const r = bar.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
}

/** Commit a drag: snap to the tier's working days exactly like the
 *  form save does (start forward, end back, order-guarded — D59/D60). */
function commitBarDrag(p, ns, ne) {
  const allowed = S.tiers.find(t => t.id === p.tierId)?.allowedDays;
  if (!isDayAllowed(ns, allowed)) ns = allowedNeighbors(ns, allowed).next;
  if (!isDayAllowed(ne, allowed)) ne = allowedNeighbors(ne, allowed).prev;
  if (ne < ns) ne = allowedNeighbors(ns, allowed).next;
  updateProject(p.id, { startDate: ns, endDate: ne });
}

/** D32 pointer plumbing. Listeners live on document during the drag so
 *  re-renders can't orphan the gesture; the grabbed bar previews via
 *  transform/width only, and truth is committed on release (Firestore's
 *  latency compensation re-renders the real thing instantly). */
function wireBarDrag(bar, p, rowSpanMs, lanes) {
  bar.addEventListener("pointerdown", ev => {
    if (yvDragging || (ev.button != null && ev.button !== 0)) return;
    const mode = ev.target.classList && ev.target.classList.contains("yv-handle")
      ? (ev.target.classList.contains("l") ? "start" : "end") : "move";
    const laneW = lanes.getBoundingClientRect().width || 1;
    const msPerPx = rowSpanMs / laneW;
    const originX = ev.clientX;
    const baseW = bar.getBoundingClientRect().width;
    const s0 = startOfDayTs(p.startDate || 0);
    const e0 = startOfDayTs(p.endDate || p.startDate || 0);
    let moved = false, ns = s0, ne = e0;
    yvDragging = true;
    const onMove = e => {
      const dx = e.clientX - originX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      bar.classList.add("dragging");
      const dDays = Math.round(dx * msPerPx / DAY_MS);
      ns = s0; ne = e0;
      if (mode !== "end") ns += dDays * DAY_MS;
      if (mode !== "start") ne += dDays * DAY_MS;
      if (ne < ns) { if (mode === "start") ns = ne; else ne = ns; }
      const px = dDays * DAY_MS / msPerPx;
      if (mode === "move") bar.style.transform = `translateX(${px}px)`;
      else if (mode === "start") {
        bar.style.transform = `translateX(${Math.min(px, baseW - 8)}px)`;
        bar.style.width = `${Math.max(8, baseW - px)}px`;
      } else {
        bar.style.width = `${Math.max(8, baseW + px)}px`;
      }
      $("#yv-label").textContent = `${fmtDay(ns)} → ${fmtDay(ne)}`;
      e.preventDefault();
    };
    const finish = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      yvDragging = false;
      if (moved) {
        yvTapSquelch = true;
        setTimeout(() => { yvTapSquelch = false; }, 50);
        commitBarDrag(p, ns, ne);
      }
      renderYear(); // restores label + geometry; the snapshot re-renders saved truth
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
  });
  bar.addEventListener("click", ev => {
    ev.stopPropagation(); // keep the global popover-closer out of it
    if (yvTapSquelch || yvDragging) return;
    yvShowDetails(bar, p);
  });
}

function renderYearLegend(projs) {
  const box = $("#yv-legend");
  box.innerHTML = "";
  for (const p of projs) {
    const k = document.createElement("span");
    k.className = "yv-key";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = p.color || "#4dd0c4";
    const prog = projectProgress(p);
    k.append(sw, document.createTextNode(`${p.name} · ${prog.done}/${prog.total}`));
    k.title = yvDetails(p, prog);
    box.append(k);
  }
}

let yvResizeT = 0;

// ---------- D68: ＋ New project modal (form reparenting) ----------
let projFormReturn = null; // where the form goes home to

function openYvProjectModal() {
  const title = $("#project-form-title"), form = $("#project-form");
  if (!projFormReturn) projFormReturn = { parent: title.parentElement, next: form.nextElementSibling };
  $("#yv-project-slot").append(title, form);
  $("#yv-project-modal").hidden = false;
  $("#project-name").focus();
}

function closeYvProjectModal() {
  const modal = $("#yv-project-modal");
  if (modal.hidden) return;
  modal.hidden = true;
  const { parent, next } = projFormReturn;
  parent.insertBefore($("#project-form-title"), next);
  parent.insertBefore($("#project-form"), next);
}

// ---------- D68: month-grid layout ----------

/** A month's Sun-anchored week windows: [{ws,we}] plus [mS,mE). */
function gridWeeksOfMonth(monthStart) {
  const d0 = new Date(monthStart);
  const mE = new Date(d0.getFullYear(), d0.getMonth() + 1, 1).getTime();
  const first = new Date(monthStart);
  first.setDate(first.getDate() - first.getDay()); // back to Sunday
  const weeks = [];
  const c = new Date(first);
  while (c.getTime() < mE) {
    const ws = c.getTime();
    const e = new Date(c);
    e.setDate(e.getDate() + 7);
    weeks.push([ws, e.getTime()]);
    c.setDate(c.getDate() + 7);
  }
  return { mS: monthStart, mE, weeks };
}

/** D69: the user-pinned bar sizing, or null when "auto" (each layout
 *  then applies its own judgment). Pins are honest pixels everywhere. */
function yvPinnedSize() {
  return { full: { LANE: 24, BAR: 20 }, half: { LANE: 14, BAR: 10 }, quarter: { LANE: 9, BAR: 5 } }[S.yearBarSize] || null;
}

/** Wall-calendar rendering: bars clip to week ∩ month (so shared
 *  spillover weeks don't show the same bar in two month blocks), and
 *  lanes pack PER WEEK, gcal-style. Drag works within a week row —
 *  the live date readout still tracks past its edges. */
function renderYearGrid(grid, monthsList, projs, now, wall = false) {
  // Pass 1: pack every week; the max concurrency sets the density.
  const months = monthsList.map(m => {
    const { mS, mE, weeks } = gridWeeksOfMonth(m);
    const packed = weeks.map(([ws, we]) => {
      const lo = Math.max(ws, mS), hi = Math.min(we, mE);
      const segs = [], laneEnds = [];
      for (const p of projs) {
        const ps = startOfDayTs(p.startDate || 0);
        const pe = startOfDayTs(p.endDate || p.startDate || 0) + DAY_MS;
        const segS = Math.max(ps, lo), segE = Math.min(pe, hi);
        if (segE <= segS) continue;
        let li = laneEnds.findIndex(le => le <= segS);
        if (li === -1) { li = laneEnds.length; laneEnds.push(segE); } else laneEnds[li] = segE;
        segs.push({ p, ps, pe, segS, segE, lane: li });
      }
      return { ws, we, segs, laneCount: laneEnds.length };
    });
    return { mS, mE, weeks: packed };
  });
  const maxConc = months.reduce((mx, m) => Math.max(mx, 0, ...m.weeks.map(w => w.laneCount)), 0);
  const wallLanes = Math.max(1, maxConc);   // D70: Annual weeks are uniform
  const pin = yvPinnedSize();               // D69: pins beat every auto
  let GL, GB;
  if (pin) { GL = pin.LANE; GB = pin.BAR; }
  else if (wall) {
    // D70: window-fit, timeline-style. Column count MIRRORS the CSS
    // breakpoints (1150/850/520) — change both together.
    const gw = grid.getBoundingClientRect().width || 1200;
    const cols = gw >= 1150 ? 4 : gw >= 850 ? 3 : gw >= 520 ? 2 : 1;
    const monthRows = Math.ceil(months.length / cols);
    const avail = Math.max(240, window.innerHeight - grid.getBoundingClientRect().top - 110);
    const maxWeeks = Math.max(...months.map(m => m.weeks.length));
    GL = Math.floor((avail / monthRows - 40) / (maxWeeks * wallLanes));
    GL = Math.max(5, Math.min(14, GL));     // floor = hairline
    GB = Math.max(3, GL - (GL <= 8 ? 2 : 4)); // small lanes keep more of their budget
  } else {
    GL = maxConc <= 4 ? 20 : maxConc <= 9 ? 13 : 9;
    GB = GL - 4;
  }
  const gLabels = GB >= 16 && true;         // D70: any bar tall enough speaks (wall included)

  const dows = wall ? ["S", "M", "T", "W", "T", "F", "S"]
                    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayTs = startOfDayTs(now);
  for (const m of months) {
    const box = document.createElement("div");
    box.className = "yvg-month";
    const md = new Date(m.mS);
    const head = document.createElement("div");
    head.className = "yvg-head";
    const nd0 = new Date(now);
    if (nd0.getFullYear() === md.getFullYear() && nd0.getMonth() === md.getMonth()) head.classList.add("yv-now");
    head.textContent = wall
      ? md.toLocaleDateString([], md.getMonth() === 0 ? { month: "short", year: "numeric" } : { month: "short" })
      : md.toLocaleDateString([], { month: "long", year: "numeric" });
    if (S.yearZoom == null) {
      head.title = "Zoom to this month";
      head.addEventListener("click", () => { S.yearZoom = m.mS; renderYear(); });
    }
    box.append(head);

    const dowRow = document.createElement("div");
    dowRow.className = "yvg-dow";
    dows.forEach(d => {
      const sp = document.createElement("span");
      sp.textContent = d;
      dowRow.append(sp);
    });
    box.append(dowRow);

    for (const wk of m.weeks) {
      const wkEl = document.createElement("div");
      wkEl.className = "yvg-week";
      const daysEl = document.createElement("div");
      daysEl.className = "yvg-days";
      const c = new Date(wk.ws);
      for (let i = 0; i < 7; i++) {
        const cell = document.createElement("div");
        cell.className = "yvg-day";
        const ts = c.getTime();
        const inMonth = ts >= m.mS && ts < m.mE;
        if (!inMonth) cell.classList.add("yvg-out");
        if (c.getDay() === 0 || c.getDay() === 6) cell.classList.add("yvg-we");
        if (inMonth && ts === todayTs) cell.classList.add("yvg-today");
        cell.textContent = c.getDate();
        daysEl.append(cell);
        c.setDate(c.getDate() + 1);
      }
      wkEl.append(daysEl);

      const lanes = document.createElement("div");
      lanes.className = "yvg-lanes";
      lanes.style.height = `${(wall ? wallLanes : Math.max(1, wk.laneCount)) * GL + 3}px`; // D70: Annual lines up
      const span = wk.we - wk.ws;
      for (const g of wk.segs) {
        const bar = document.createElement("div");
        bar.className = "yv-bar" + (g.ps < g.segS ? " cont-l" : "") + (g.pe > g.segE ? " cont-r" : "");
        bar.style.left = `${((g.segS - wk.ws) / span) * 100}%`;
        bar.style.width = `${((g.segE - g.segS) / span) * 100}%`;
        bar.style.top = `${g.lane * GL}px`;
        bar.style.height = `${GB}px`;
        bar.style.setProperty("--bar-r", GB >= 14 ? "5px" : GB >= 5 ? "3px" : "2px");
        if (GB <= 4) bar.classList.add("thin");             // D70: hairlines drop the border
        const prog = projectProgress(g.p);
        const fillT = g.ps + prog.pct * (g.pe - g.ps);
        const fillPct = Math.max(0, Math.min(1, (fillT - g.segS) / (g.segE - g.segS))) * 100;
        const col = g.p.color || "#4dd0c4";
        bar.style.background = `linear-gradient(90deg, ${hexToRgba(col, 0.95)} ${fillPct}%, ${hexToRgba(col, 0.28)} ${fillPct}%)`;
        if (gLabels && (g.segE - g.segS) >= 3 * DAY_MS) {
          const lbl = document.createElement("span");
          lbl.className = "yv-bar-label";
          lbl.textContent = g.p.name;
          if (fillPct < 35) {
            lbl.style.color = "#dce7f0";
            lbl.style.textShadow = "0 1px 2px rgba(0,0,0,.7)";
          }
          bar.append(lbl);
        }
        bar.title = yvDetails(g.p, prog);
        if (g.ps === g.segS) { const h = document.createElement("div"); h.className = "yv-handle l"; bar.append(h); }
        if (g.pe === g.segE) { const h = document.createElement("div"); h.className = "yv-handle r"; bar.append(h); }
        wireBarDrag(bar, g.p, span, lanes);
        lanes.append(bar);
      }
      wkEl.append(lanes);
      box.append(wkEl);
    }
    grid.append(box);
  }
}

function renderYear() {
  if (S.view !== "year" || !S.user) return;
  const grid = $("#yv-grid");
  grid.innerHTML = "";
  const now = Date.now();

  // Row windows: one zoomed month, or 4 quarter-aligned rows of 3.
  let rows = [];
  if (S.yearZoom != null) {
    const z = new Date(S.yearZoom);
    rows.push([z.getTime(), new Date(z.getFullYear(), z.getMonth() + 1, 1).getTime()]);
  } else {
    const a = yearAnchorMonth();
    for (let r = 0; r < 4; r++) {
      rows.push([
        new Date(a.getFullYear(), a.getMonth() + r * 3, 1).getTime(),
        new Date(a.getFullYear(), a.getMonth() + r * 3 + 3, 1).getTime()
      ]);
    }
  }
  const winStart = rows[0][0], winEnd = rows[rows.length - 1][1];

  // Nav chrome
  if (S.yearZoom != null) {
    $("#yv-label").textContent = new Date(S.yearZoom).toLocaleDateString([], { month: "long", year: "numeric" });
  } else {
    const a1 = new Date(winStart), a2 = new Date(winEnd - 1);
    $("#yv-label").textContent = a1.getMonth() === 0
      ? String(a1.getFullYear())
      : `${a1.toLocaleDateString([], { month: "short", year: "numeric" })} – ${a2.toLocaleDateString([], { month: "short", year: "numeric" })}`;
  }
  $("#yv-today").hidden = S.yearOffset === 0 && S.yearZoom == null;
  $("#yv-unzoom").hidden = S.yearZoom == null;
  $("#yv-modes").querySelectorAll("button").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === S.yearMode));

  // Visible projects — everything intersecting the window, finished
  // included (their bars read fully saturated; that IS the year story).
  const projs = S.projects
    .filter(p => startOfDayTs(p.startDate || 0) < winEnd &&
                 startOfDayTs(p.endDate || p.startDate || 0) + DAY_MS > winStart)
    .sort((x, y) => (x.startDate || 0) - (y.startDate || 0));
  $("#yv-empty").hidden = projs.length !== 0;
  $("#yv-layouts").querySelectorAll("button").forEach(b =>
    b.classList.toggle("active", b.dataset.layout === S.yearLayout));

  $("#yv-sizes").querySelectorAll("button").forEach(b =>
    b.classList.toggle("active", b.dataset.size === S.yearBarSize));

  // D68/D69: calendar layouts take over here; the Gantt continues below.
  // A zoomed wall month renders BIG (stacked-month styling) — the wall
  // cell look is for the 12-up overview only.
  const wall = S.yearLayout === "wall" && S.yearZoom == null;
  grid.classList.toggle("yv-wall", wall);
  if (S.yearLayout !== "timeline") {
    const monthsList = [];
    if (S.yearZoom != null) monthsList.push(S.yearZoom);
    else {
      const a = yearAnchorMonth();
      for (let m = 0; m < 12; m++) monthsList.push(new Date(a.getFullYear(), a.getMonth() + m, 1).getTime());
    }
    renderYearGrid(grid, monthsList, projs, now, wall);
    renderYearLegend(projs);
    return;
  }

  // Global greedy lane packing: a project keeps ONE lane all year.
  const laneOf = new Map(), laneEnds = [];
  for (const p of projs) {
    const s0 = startOfDayTs(p.startDate || 0), e0 = startOfDayTs(p.endDate || p.startDate || 0);
    let li = laneEnds.findIndex(le => le < s0);
    if (li === -1) { li = laneEnds.length; laneEnds.push(e0); } else laneEnds[li] = e0;
    laneOf.set(p.id, li);
  }
  // D68: bars size to the WINDOW — the rows' total lanes share the
  // vertical space Jake actually has (2K gets thick bars, phones get
  // slivers), clamped to 9–34px lanes; a resize re-flows (debounced).
  const rowLanes = rows.map(([rs0, re0]) => projs.reduce((mx, p) => {
    const ps0 = startOfDayTs(p.startDate || 0);
    const pe0 = startOfDayTs(p.endDate || p.startDate || 0) + DAY_MS;
    return (pe0 <= rs0 || ps0 >= re0) ? mx : Math.max(mx, laneOf.get(p.id) + 1);
  }, 1));
  const totalLanes = rowLanes.reduce((a, b) => a + b, 0);
  const pin = yvPinnedSize();                               // D69: pins beat the window fit
  const avail = Math.max(220, window.innerHeight - grid.getBoundingClientRect().top - 150);
  const LANE_H = pin ? pin.LANE
    : Math.max(9, Math.min(34, Math.floor((avail - rows.length * 46) / totalLanes)));
  const BAR_H = LANE_H - 4;
  const showLabels = BAR_H >= 16;

  for (const [rs, re] of rows) {
    const span = re - rs;
    const row = document.createElement("div");
    row.className = "yv-row";

    // Month headers flex-grown by day count (day ticks when zoomed).
    const months = document.createElement("div");
    months.className = "yv-months";
    if (S.yearZoom != null) {
      const dcount = Math.round(span / DAY_MS);
      for (let d = 0; d < dcount; d++) {
        const c = document.createElement("div");
        c.className = "yv-month yv-day-tick";
        c.style.flexGrow = 1;
        c.textContent = d + 1;
        months.append(c);
      }
    } else {
      for (let m = 0; m < 3; m++) {
        const ms = new Date(rs);
        ms.setMonth(ms.getMonth() + m);
        const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
        const c = document.createElement("div");
        c.className = "yv-month";
        const nd = new Date(now);
        if (nd.getFullYear() === ms.getFullYear() && nd.getMonth() === ms.getMonth()) c.classList.add("yv-now");
        c.style.flexGrow = Math.round((me.getTime() - ms.getTime()) / DAY_MS);
        c.textContent = ms.toLocaleDateString([], ms.getMonth() === 0 ? { month: "short", year: "numeric" } : { month: "short" });
        c.title = "Zoom to this month";
        c.addEventListener("click", () => { S.yearZoom = ms.getTime(); renderYear(); });
        months.append(c);
      }
    }
    row.append(months);

    const lanes = document.createElement("div");
    lanes.className = "yv-lanes";
    const rowMax = projs.reduce((mx, p) => {
      const ps0 = startOfDayTs(p.startDate || 0);
      const pe0 = startOfDayTs(p.endDate || p.startDate || 0) + DAY_MS;
      return (pe0 <= rs || ps0 >= re) ? mx : Math.max(mx, laneOf.get(p.id));
    }, 0);
    lanes.style.height = `${(rowMax + 1) * LANE_H + 4}px`; // only the lanes this row uses

    // D66 day texture (both views): weekend shading, faint day lines,
    // stronger Monday week lines; month boundaries strongest.
    const cur = new Date(rs);
    while (cur.getTime() < re) {
      const ts = cur.getTime();
      if (cur.getDay() === 6) {                 // Saturday → shade through Sunday
        const wkEnd = new Date(cur);
        wkEnd.setDate(wkEnd.getDate() + 2);
        const w = document.createElement("div");
        w.className = "yv-weekend";
        w.style.left = `${((ts - rs) / span) * 100}%`;
        w.style.width = `${((Math.min(wkEnd.getTime(), re) - ts) / span) * 100}%`;
        lanes.append(w);
      }
      if (ts !== rs && cur.getDate() !== 1) {   // 1sts get the month line below
        const gl = document.createElement("div");
        gl.className = "yv-gridline " + (cur.getDay() === 1 ? "yv-weekline" : "yv-dayline");
        gl.style.left = `${((ts - rs) / span) * 100}%`;
        lanes.append(gl);
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (S.yearZoom == null) {
      for (let m = 1; m < 3; m++) {
        const ms = new Date(rs);
        ms.setMonth(ms.getMonth() + m);
        const gl = document.createElement("div");
        gl.className = "yv-gridline";
        gl.style.left = `${((ms.getTime() - rs) / span) * 100}%`;
        lanes.append(gl);
      }
    }

    if (now >= rs && now < re) {
      const t = document.createElement("div");
      t.className = "yv-todayline";
      t.style.left = `${((now - rs) / span) * 100}%`;
      lanes.append(t);
    }

    for (const p of projs) {
      const ps = startOfDayTs(p.startDate || 0);
      const pe = startOfDayTs(p.endDate || p.startDate || 0) + DAY_MS; // end day inclusive
      if (pe <= rs || ps >= re) continue;
      const segS = Math.max(ps, rs), segE = Math.min(pe, re);
      const bar = document.createElement("div");
      bar.className = "yv-bar" + (ps < rs ? " cont-l" : "") + (pe > re ? " cont-r" : "");
      bar.style.left = `${((segS - rs) / span) * 100}%`;
      bar.style.width = `${((segE - segS) / span) * 100}%`;
      bar.style.top = `${laneOf.get(p.id) * LANE_H + 2}px`;
      bar.style.height = `${BAR_H}px`;
      bar.style.setProperty("--bar-r", BAR_H >= 16 ? "6px" : "3px");

      // D30a: pale ghost of the project color, saturating left-to-right
      // by pipeline % — computed against the WHOLE bar, clipped to this
      // segment, so multi-quarter projects fill continuously.
      const prog = projectProgress(p);
      const fillT = ps + prog.pct * (pe - ps);
      const fillPct = Math.max(0, Math.min(1, (fillT - segS) / (segE - segS))) * 100;
      const c = p.color || "#4dd0c4";
      bar.style.background = `linear-gradient(90deg, ${hexToRgba(c, 0.95)} ${fillPct}%, ${hexToRgba(c, 0.28)} ${fillPct}%)`;

      if (showLabels) { // thin bars speak through hover/tap/legend (D66)
        const lbl = document.createElement("span");
        lbl.className = "yv-bar-label";
        lbl.textContent = p.name;
        if (fillPct < 35) { // label sits over the ghost — go light-on-dark
          lbl.style.color = "#dce7f0";
          lbl.style.textShadow = "0 1px 2px rgba(0,0,0,.7)";
        }
        bar.append(lbl);
      }
      bar.title = yvDetails(p, prog);

      // Stretch handles only where this segment shows a TRUE end.
      if (ps >= rs) { const h = document.createElement("div"); h.className = "yv-handle l"; bar.append(h); }
      if (pe <= re) { const h = document.createElement("div"); h.className = "yv-handle r"; bar.append(h); }
      wireBarDrag(bar, p, span, lanes);
      lanes.append(bar);
    }
    row.append(lanes);
    grid.append(row);
  }
  renderYearLegend(projs);
}

function hexToRgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function colorDistance(h1, h2) {
  const [r1, g1, b1] = hexToRgb(h1), [r2, g2, b2] = hexToRgb(h2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
function bestFreeColor() {
  const used = S.projects.filter(p => p.id !== S.editingProjectId).map(p => p.color);
  if (!used.length) return COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
  let best = COLOR_POOL[0], bestScore = -1;
  for (const c of COLOR_POOL) {
    const score = Math.min(...used.map(u => colorDistance(c, u)));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
function suggestProjectColor(force = false) {
  const field = $("#project-color");
  if (!field || S.editingProjectId) return;
  if (force || field.value.toLowerCase() === S.lastSuggestedColor.toLowerCase()) {
    const c = bestFreeColor();
    field.value = c;
    S.lastSuggestedColor = c;
    checkProjectColor();
  }
}
function checkProjectColor() {
  const hint = $("#project-color-hint");
  if (!hint) return;
  const chosen = $("#project-color").value;
  let nearest = null, nearestDist = Infinity;
  for (const p of S.projects) {
    if (p.id === S.editingProjectId) continue;
    const d = colorDistance(chosen, p.color);
    if (d < nearestDist) { nearestDist = d; nearest = p; }
  }
  if (nearest && nearestDist < 25) {
    hint.textContent = `⚠️ Same color as ${nearest.name} (${fmtDay(nearest.startDate)} – ${fmtDay(nearest.endDate)}). Try ${bestFreeColor()}.`;
  } else if (nearest && nearestDist < 60) {
    hint.textContent = `⚠️ Very close to ${nearest.name} (${fmtDay(nearest.startDate)} – ${fmtDay(nearest.endDate)}). Try ${bestFreeColor()}.`;
  } else {
    hint.textContent = "";
  }
}

// ---------- Un-complete rewind (D53) ----------

/** Incomplete children that HAVE a dueAt were materialized by this
 *  parent's completion (follow-ups are born with dueAt:null). */
function materializedKids(parentId) {
  return S.tasks.filter(t =>
    t.parentTaskId === parentId && t.dueAt != null && !t.completedAt);
}

function onTaskUncheck(t) {
  const kids = materializedKids(t.id);
  if (!kids.length) { setTaskDone(t.id, false); return; }
  S.uncheckTarget = t;
  const names = kids.map(k => `"${k.title}" (${fmtDay(k.dueAt)})`).join(", ");
  $("#uncheck-title").textContent = `Un-complete "${t.title}"?`;
  $("#uncheck-text").textContent =
    `Completing it scheduled ${kids.length === 1 ? "a follow-up" : "follow-ups"}: ${names}. What should happen?`;
  $("#uncheck-modal").hidden = false;
  render(); // snap the checkbox back to ✓ until a choice is made
}

function resolveUncheck(choice) {
  const t = S.uncheckTarget;
  S.uncheckTarget = null;
  $("#uncheck-modal").hidden = true;
  if (!t) return;
  if (choice === "oops") { render(); return; }        // stays done, follow-ups keep dates
  if (choice === "rewind") {                          // truly not done: pull kids back to Waiting
    setTaskDone(t.id, false).then(() => rewindFollowUps(t.id));
    return;
  }
  setTaskDone(t.id, false);                           // "keep": un-done, follow-ups stay dated
}

function followUpPrompt(item) {
  const title = prompt(`Follow-up to "${item.title}":`, `Follow up: ${item.title}`);
  if (!title) return;
  const days = parseInt(prompt("How many days after completion?", "3"), 10);
  if (isNaN(days)) return;
  addFollowUp(item.id, { title, offsetDays: days, tierId: item.tier?.id || item.raw.tierId });
}

// ---------- Settings ----------

function switchSettingsTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-pane").forEach(p =>
    { p.hidden = p.dataset.pane !== tab; });
}

function openSettings() {
  $("#settings-modal").hidden = false;
  switchSettingsTab("tiers");
  const c = S.config || {};
  $("#cfg-carryover").value = c.carryoverWriteHour ?? 9;
  $("#cfg-sleep-start").value = c.sleepStart ?? 22;
  $("#cfg-sleep-end").value = c.sleepEnd ?? 6;
  $("#cfg-poll").value = c.pollIntervalMinutes ?? 60;
  $("#cfg-deadline-hour").value = c.deadlineHour ?? 16;   // D51
  $("#cfg-decision-days").value = c.decisionThresholdDays ?? 2; // D52
  updatePollCostHint();
  const box = $("#tier-editor");
  box.innerHTML = "";
  for (const t of S.tiers) tierEditorRow(t, false);
  checkTierColors();
  const stBox = $("#stage-template-editor");
  stBox.innerHTML = "";
  for (const st of S.stageTemplate) stageTemplateRow(normalizeStage(st), false);
}

/** D55: tiers get the same conflict assistant projects have. One shared
 *  hint line under the editor names the closest colliding pair. */
function checkTierColors() {
  const hint = $("#tier-color-hint");
  if (!hint) return;
  const rows = [...document.querySelectorAll("#tier-editor .tier-row")].map(r => ({
    name: r.querySelector(".t-name").value.trim() || "Untitled",
    color: r.querySelector(".t-color").value
  }));
  let worst = null;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = colorDistance(rows[i].color, rows[j].color);
      if (d < 60 && (!worst || d < worst.d)) worst = { d, a: rows[i], b: rows[j] };
    }
  }
  if (!worst) { hint.textContent = ""; return; }
  const used = rows.map(r => r.color.toLowerCase());
  const fresh = TIER_PALETTE.filter(c => !used.includes(c));
  let suggestion = fresh[0] || TIER_PALETTE[0];
  if (fresh.length) {
    let bestScore = -1;
    for (const cand of fresh) {
      const score = Math.min(...used.map(u => colorDistance(cand, u)));
      if (score > bestScore) { bestScore = score; suggestion = cand; }
    }
  }
  hint.textContent = worst.d < 25
    ? `⚠️ ${worst.a.name} and ${worst.b.name} are the same color. Try ${suggestion}.`
    : `⚠️ ${worst.a.name} and ${worst.b.name} are very close. Try ${suggestion}.`;
}

const TIER_PALETTE = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc", "#f783ac", "#63e6be", "#ffc9c9", "#a5d8ff"];

function tierEditorRow(t, isNew) {
  const box = $("#tier-editor");
  if (isNew) {
    const ranks = [...box.querySelectorAll(".t-rank")].map(el => parseInt(el.value, 10) || 0);
    const used = new Set([...box.querySelectorAll(".t-color")].map(el => el.value.toLowerCase()));
    const fresh = TIER_PALETTE.filter(c => !used.has(c));
    t = {
      rank: (ranks.length ? Math.max(...ranks) : 0) + 1,
      color: (fresh.length ? fresh : TIER_PALETTE)[Math.floor(Math.random() * (fresh.length ? fresh.length : TIER_PALETTE.length))],
      kind: "task"
    };
  }
  const row = document.createElement("div");
  row.className = "tier-row";
  row.dataset.id = t.id || "";
  // D60: which days count for this tier — reschedule targets, project
  // date interception, and stage-offset math all follow these toggles.
  const allowed = new Set((Array.isArray(t.allowedDays) && t.allowedDays.length) ? t.allowedDays : [1, 2, 3, 4, 5]);
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const dayToggles = dayNames.map((n, d) =>
    `<label class="t-day" title="${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d]}"><input type="checkbox" class="t-dow" data-dow="${d}" ${allowed.has(d) ? "checked" : ""}>${n}</label>`
  ).join("");
  row.innerHTML = `
    <input class="t-rank" type="number" min="1" value="${t.rank ?? 1}" title="Priority rank: only breaks ties in the queue now (D43), but orders the filter chips and dropdowns">
    <input class="t-name" type="text" value="${esc(t.name || "")}" placeholder="Tier name">
    <input class="t-color" type="color" value="${t.color || "#4dabf7"}" title="Tier color (chips in the queue)">
    <select class="t-kind" title="Tasks = checkable items you create here. Calendar = appointments pulled from a Google Calendar (they pin near their start time and never nag).">
      <option value="task" ${t.kind !== "anchor" ? "selected" : ""}>Tasks</option>
      <option value="anchor" ${t.kind === "anchor" ? "selected" : ""}>Calendar</option>
    </select>
    <label class="t-carry-label" title="If tasks in this tier are still unchecked at midnight, they get written onto tomorrow's Google Calendar with a ❗ at the carryover hour below. (Phase 3 feature.)"><input class="t-carry" type="checkbox" ${t.midnightCarryover ? "checked" : ""}> ❗ carryover</label>
    <button class="t-del" title="Delete tier">✕</button>
    <span class="t-days" title="Working days for this tier: reschedules land on these days, project dates outside them get intercepted, and pipeline offsets only count them. Weekend jobs? Check Sa/Su." ${t.kind === "anchor" ? "hidden" : ""}>${dayToggles}</span>
    <input class="t-cal" type="text" value="${esc(t.gcalCalendarId || "")}"
      placeholder="Google Calendar ID — GCal ⚙️ → pick calendar → 'Integrate calendar' → Calendar ID"
      title="Which Google Calendar feeds this tier. calendar.google.com → ⚙️ Settings → click the calendar → 'Integrate calendar' → Calendar ID. Your main personal calendar's ID is just your Gmail address."
      ${t.kind === "anchor" ? "" : "hidden"}>`;
  row.querySelector(".t-kind").addEventListener("change", ev => {
    row.querySelector(".t-cal").hidden = ev.target.value !== "anchor";
    row.querySelector(".t-days").hidden = ev.target.value === "anchor";
  });
  row.querySelector(".t-del").addEventListener("click", () => {
    if (row.dataset.id) {
      if (!confirm(`Delete tier "${t.name}"? Tasks in it will show as "?" until re-tiered.`)) return;
      deleteTier(row.dataset.id);
    }
    row.remove();
  });
  box.append(row);
  if (isNew) row.querySelector(".t-name").focus();
}

function wireTmplRow(row, box) {
  row.querySelector(".st-dir").addEventListener("change", () => syncTimingRow(row));
  row.querySelector(".st-up").addEventListener("click", () => {
    if (row.previousElementSibling) box.insertBefore(row, row.previousElementSibling);
  });
  row.querySelector(".st-down").addEventListener("click", () => {
    if (row.nextElementSibling) box.insertBefore(row.nextElementSibling, row);
  });
  row.querySelector(".st-del").addEventListener("click", () => row.remove());
}

function stageTemplateRow(st, isNew) {
  const box = $("#stage-template-editor");
  const row = document.createElement("div");
  row.className = "stage-tmpl-row";
  row.innerHTML = `
    <span class="st-move"><button class="st-up" title="Move up">▲</button><button class="st-down" title="Move down">▼</button></span>
    <input class="st-name" type="text" value="${esc(st.name || "")}" placeholder="Stage name">
    ${timingSelects(st)}
    <button class="st-del" title="Remove stage">✕</button>`;
  wireTmplRow(row, box);
  box.append(row);
  if (isNew) row.querySelector(".st-name").focus();
}

function onSaveSettings() {
  saveConfig({
    carryoverWriteHour: clampInt($("#cfg-carryover").value, 0, 23, 9),
    pollIntervalMinutes: clampInt($("#cfg-poll").value, 5, 1440, 60),
    sleepStart: clampInt($("#cfg-sleep-start").value, 0, 23, 22),
    sleepEnd: clampInt($("#cfg-sleep-end").value, 0, 23, 6),
    deadlineHour: clampInt($("#cfg-deadline-hour").value, 0, 23, 16),      // D51
    decisionThresholdDays: clampInt($("#cfg-decision-days").value, 1, 30, 2) // D52
  });
  for (const row of document.querySelectorAll(".tier-row")) {
    const kind = row.querySelector(".t-kind").value;
    // D60: gather the day toggles; an accidental zero-day tier falls
    // back to Mon–Fri rather than making scheduling math impossible.
    let allowedDays = [...row.querySelectorAll(".t-dow")]
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.dataset.dow, 10));
    if (!allowedDays.length) allowedDays = [1, 2, 3, 4, 5];
    const data = {
      rank: clampInt(row.querySelector(".t-rank").value, 1, 99, 99),
      name: row.querySelector(".t-name").value.trim() || "Untitled",
      color: row.querySelector(".t-color").value,
      kind,
      midnightCarryover: row.querySelector(".t-carry").checked,
      gcalCalendarId: kind === "anchor" ? row.querySelector(".t-cal").value.trim() : "",
      allowedDays
    };
    if (kind === "anchor") data.defaultLeadWindowMinutes = 30;
    saveTier(row.dataset.id || null, data);
  }
  const stages = [...document.querySelectorAll("#stage-template-editor .stage-tmpl-row")].map(row => ({
    name: row.querySelector(".st-name").value.trim() || "Untitled stage",
    direction: row.querySelector(".st-dir").value,
    anchor: row.querySelector(".st-anchor").value,
    offsetDays: clampInt(row.querySelector(".st-off").value, 0, 365, 0)
  }));
  saveStageTemplate(stages);
  closeSettings();
}

function closeSettings() { $("#settings-modal").hidden = true; }

function updatePollCostHint() {
  const raw = parseInt($("#cfg-poll").value, 10);
  const mins = clampInt($("#cfg-poll").value, 5, 1440, 60);
  const runs = Math.round((60 / mins) * 24 * 30.4);
  const clampNote = (!isNaN(raw) && raw !== mins) ? `Minimum is 5 minutes, so I'm using ${mins}. ` : "";
  $("#poll-cost-hint").textContent =
    `${clampNote}Checking every ${mins} min ≈ ${runs.toLocaleString()} checks/month ` +
    `(avg 30.4 days). Google charges nothing until 2,000,000/month — unreachable here. ` +
    `(Phase 3 feature — has no effect yet.)`;
}

// ---------- Utils ----------

function toDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function iconBtn(txt, title, fn) {
  const b = document.createElement("button");
  b.className = "icon-btn";
  b.textContent = txt;
  b.title = title;
  b.addEventListener("click", fn);
  return b;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
