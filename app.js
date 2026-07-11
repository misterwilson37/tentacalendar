// ============================================================
// Tentacalendar — app.js
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
  buildQueue, projectProgress, remainingWork, normalizeStage,
  isDayAllowed, addAllowedDays, allowedNeighbors, setDeadlineHour,
  fmtTime, fmtDay, QUEUE_VERSION
} from "./queue.js?v=0.8.0";
import { celebrate, CELEBRATE_VERSION } from "./celebrate.js?v=0.1.1";

export const APP_VERSION = "0.10.0";
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
  if (S.editingProjectId) updateProject(S.editingProjectId, payload).then(cancelProjectEdit);
  else addProject(payload).then(() => { $("#project-name").value = ""; suggestProjectColor(true); });
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
