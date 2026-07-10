// ============================================================
// Tentacalendar — app.js
// Version 0.6.1
// 0.6.1: internal module imports are now version-queried (D49) —
// ?v= on <script> tags does NOT cache-bust ES module imports, so a
// stale cached config.js (missing CONFIG_VERSION) killed the whole
// module graph with a SyntaxError before any code ran.
// 0.6.0 ("Priority Engine v2"): D43 sort wired, workload select,
// next-deadline labels, tier filter chips (D47), grouped overdue
// decision modal (D46), weekend-date interception (D45), plus the
// 0.5.x features: due-date dialog, per-project stage surgery,
// tap popovers, numbered project-tier dropdown.
// ============================================================

import { CONFIG_VERSION } from "./config.js?v=0.4.0";
import {
  watchAuth, signIn, signOutUser, STORE_VERSION,
  subscribeTiers, subscribeTasks, subscribeEvents, subscribeConfig,
  subscribeProjects, subscribeStageTemplate,
  addTask, addFollowUp, setTaskDone, deleteTask, updateTask,
  addProject, deleteProject, updateProject, setStageDone, setStageDue, setProjectStages,
  saveTier, deleteTier, saveConfig, saveStageTemplate
} from "./store.js?v=0.6.1";
import {
  buildQueue, projectProgress, remainingWork, normalizeStage,
  isWeekend, addWeekdays, weekendNeighbors,
  fmtTime, fmtDay, QUEUE_VERSION
} from "./queue.js?v=0.5.0";
import { celebrate, CELEBRATE_VERSION } from "./celebrate.js?v=0.1.1";

export const APP_VERSION = "0.6.1";
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
  $("#stage-add").addEventListener("click", () => stageTemplateRow({ name: "", direction: "after", anchor: "start", offsetDays: 0 }, true));
  $("#settings-save").addEventListener("click", onSaveSettings);
  $("#cfg-poll").addEventListener("input", updatePollCostHint);
  $("#due-save").addEventListener("click", dueSave);
  $("#due-clear").addEventListener("click", dueClear);
  $("#due-cancel").addEventListener("click", () => { $("#due-modal").hidden = true; });
  $("#stages-save").addEventListener("click", stagesSave);
  $("#stages-cancel").addEventListener("click", () => { $("#stages-modal").hidden = true; });
  $("#stage-proj-add").addEventListener("click", () =>
    projStageRow({ name: "", direction: "after", anchor: "start", offsetDays: 0, completedAt: null, dueAt: null }, -1, true));
  $("#decision-close").addEventListener("click", () => { $("#decision-modal").hidden = true; });

  // Tap-to-reveal ⓘ popovers (phones can't hover).
  document.addEventListener("click", ev => {
    const dot = ev.target.closest(".info-dot");
    const pop = $("#popover");
    if (dot && dot.dataset.info) {
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
  S.unsubs.push(subscribeConfig(c => { S.config = c; }));
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

    if (it.kind === "task") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("change", ev => {
        setTaskDone(it.id, cb.checked);
        if (cb.checked) celebrate(1, clickPoint(ev));
      });
      row.append(cb);
    } else if (it.kind === "stage") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.title = `Mark "${it.title}" done`;
      cb.addEventListener("change", ev => onStageToggle(it.projectId, it.stageIndex, cb.checked, ev));
      row.append(cb);
    } else {
      const dot = document.createElement("span");
      dot.className = "event-dot";
      dot.textContent = "📌";
      row.append(dot);
    }

    row.append(tierChip(it.tier));

    const main = document.createElement("div");
    main.className = "row-main";
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
    main.innerHTML = `<strong>${stagePrefix}${esc(it.title)}</strong><span class="sub">${sub}</span>`;
    row.append(main);

    if (it.kind === "task") {
      row.append(
        iconBtn("✎", "Edit this task", () => startTaskEdit(it.raw)),
        iconBtn("↳", "Add follow-up", () => followUpPrompt(it)),
        iconBtn("✕", "Delete", () => { if (confirm(`Delete "${it.title}"?`)) deleteTask(it.id); })
      );
    }
    if (it.kind === "stage") {
      row.append(iconBtn("⏰", "Set/change this stage's hard due date", () =>
        openDueDialog(it.projectId, it.stageIndex, it.title, it.dueAt)));
    }
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
    row.append(tierChip(tier));
    const main = document.createElement("div");
    main.className = "row-main";
    main.innerHTML = `<strong>${esc(t.title)}</strong><span class="sub">+${t.offsetDays}d after: ${esc(parent ? parent.title : "(deleted task)")}</span>`;
    row.append(main);
    row.append(
      iconBtn("✎", "Edit title / offset", () => {
        const title = prompt("Follow-up title:", t.title);
        if (title === null) return;
        const days = parseInt(prompt("Days after parent completion:", t.offsetDays), 10);
        if (isNaN(days)) return;
        updateTask(t.id, { title: title.trim() || t.title, offsetDays: days });
      }),
      iconBtn("✕", "Delete", () => deleteTask(t.id))
    );
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
    cb.addEventListener("change", () => setTaskDone(t.id, false));
    row.append(cb, tierChip(tier));
    const main = document.createElement("div");
    main.className = "row-main";
    main.innerHTML = `<strong>✓ ${esc(t.title)}</strong><span class="sub">done ${fmtTime(t.completedAt)}</span>`;
    row.append(main);
    list.append(row);
  }
}

// ---------- Project panel ----------

function renderProjects(now) {
  const box = $("#projects-list");
  box.innerHTML = "";
  $("#projects-empty").hidden = S.projects.length !== 0;

  for (const p of S.projects) {
    const prog = projectProgress(p);
    const card = document.createElement("div");
    card.className = "project-card" + (p.completedAt ? " project-done" : "");
    card.style.borderTop = `3px solid ${p.color}`;

    const head = document.createElement("div");
    head.className = "project-head";
    const wl = p.workload === 3 ? " · heavy" : p.workload === 1 ? " · light" : "";
    head.innerHTML = `<strong>${esc(p.name)}</strong><span class="sub">${fmtDay(p.startDate)} – ${fmtDay(p.endDate)}${wl}</span>`;
    head.append(
      iconBtn("✎", "Edit project (name, color, tier, dates, workload)", () => startProjectEdit(p)),
      iconBtn("✎⋮", "Edit this project's stages (rename, reorder, add, remove)", () => openStagesDialog(p)),
      iconBtn("✕", "Delete project", () => {
        if (confirm(`Delete project "${p.name}" and its pipeline?`)) deleteProject(p.id);
      })
    );
    card.append(head);

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

      if (st.offsetDays || st.anchor === "end") {
        const code = `${st.direction === "before" ? "−" : "+"}${st.offsetDays}wd ${st.anchor === "end" ? "end" : "start"}`;
        row.append(badge(code, `${st.offsetDays} weekday(s) ${st.direction} project ${st.anchor}`));
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
    box.append(card);
  }
}

async function onStageToggle(projectId, stageIndex, done, ev) {
  const result = await setStageDone(projectId, stageIndex, done);
  if (done && result) celebrate(result.allDone ? 3 : 2, clickPoint(ev));
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
  return `
    <select class="st-dir" title="Before or after the anchor date">
      <option value="before" ${st.direction === "before" ? "selected" : ""}>Before</option>
      <option value="after" ${st.direction !== "before" ? "selected" : ""}>After</option>
    </select>
    <select class="st-anchor" title="Counted from project start or project end">
      <option value="start" ${st.anchor !== "end" ? "selected" : ""}>start</option>
      <option value="end" ${st.anchor === "end" ? "selected" : ""}>end</option>
    </select>
    <label class="st-off-label" title="Weekday offset — weekends never count."><input class="st-off" type="number" min="0" value="${st.offsetDays || 0}">wd</label>`;
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

function maybeDecisionTime() {
  if (!S.user) return;
  if (localStorage.getItem(decisionKey())) return;
  const now = Date.now();
  const q = buildQueue({
    tasks: S.tasks, events: S.events, tiers: S.tiers, projects: S.projects,
    now, viewDay: now, hiddenTierIds: S.hiddenTierIds
  });
  const stale = q.items.filter(it =>
    it.expired && (now - (it.kind === "stage" ? it.deadline : it.originalDue)) >= 2 * DAY_MS);
  if (!stale.length) return;
  localStorage.setItem(decisionKey(), "1"); // once per day per device
  const list = $("#decision-list");
  list.innerHTML = "";
  for (const it of stale) {
    const days = Math.floor((now - (it.kind === "stage" ? it.deadline : it.originalDue)) / DAY_MS);
    const row = document.createElement("div");
    row.className = "row decision-row";
    const main = document.createElement("div");
    main.className = "row-main";
    const name = it.kind === "stage" ? `${it.projectName}: ${it.deadlineStageName}` : it.title;
    main.innerHTML = `<strong>${esc(name)}</strong><span class="sub">${days} day${days === 1 ? "" : "s"} overdue</span>`;
    row.append(main);
    const nextWd = (() => { const t = addWeekdays(now, 1); const d = new Date(t); d.setHours(9, 0, 0, 0); return d.getTime(); })();
    row.append(
      iconBtn("✓", "Mark it done", ev => {
        if (it.kind === "stage") onStageToggle(it.projectId, it.deadlineStageIndex, true, ev);
        else { setTaskDone(it.id, true); celebrate(1, clickPoint(ev)); }
        row.remove();
      }),
      iconBtn("↷", `Reschedule to ${fmtDay(nextWd)} 9:00 AM`, () => {
        if (it.kind === "stage") setStageDue(it.projectId, it.deadlineStageIndex, nextWd);
        else updateTask(it.id, { dueAt: nextWd });
        row.remove();
      })
    );
    list.append(row);
  }
  $("#decision-modal").hidden = false;
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
  const payload = { title, tierId, dueAt, escalation: { every, unit } };
  if (S.editingTaskId) updateTask(S.editingTaskId, payload).then(cancelTaskEdit);
  else addTask(payload).then(() => { $("#task-title").value = ""; });
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

/** D45: project start/end must be weekdays — everything else is computed
 *  from them. Checks fields one at a time via the weekend modal. */
function validateWeekends(payload, field) {
  if (field === null) { commitProject(payload); return; }
  const next = field === "startDate" ? "endDate" : null;
  if (!isWeekend(payload[field])) { validateWeekends(payload, next); return; }
  const { fri, mon } = weekendNeighbors(payload[field]);
  S.weekendPending = { payload, field, next, fri, mon };
  const which = field === "startDate" ? "start" : "end";
  const dow = new Date(payload[field]).toLocaleDateString([], { weekday: "long" });
  $("#weekend-text").textContent =
    `${fmtDay(payload[field])} is a ${dow} — are you sure you want that as the project ${which} date? Pipeline math counts weekdays only.`;
  $("#weekend-fri").textContent = `No — ${fmtDay(fri)}`;
  $("#weekend-mon").textContent = `No — ${fmtDay(mon)}`;
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

function followUpPrompt(item) {
  const title = prompt(`Follow-up to "${item.title}":`, `Follow up: ${item.title}`);
  if (!title) return;
  const days = parseInt(prompt("How many days after completion?", "3"), 10);
  if (isNaN(days)) return;
  addFollowUp(item.id, { title, offsetDays: days, tierId: item.tier?.id || item.raw.tierId });
}

// ---------- Settings ----------

function openSettings() {
  $("#settings-modal").hidden = false;
  const c = S.config || {};
  $("#cfg-carryover").value = c.carryoverWriteHour ?? 9;
  $("#cfg-sleep-start").value = c.sleepStart ?? 22;
  $("#cfg-sleep-end").value = c.sleepEnd ?? 6;
  $("#cfg-poll").value = c.pollIntervalMinutes ?? 60;
  updatePollCostHint();
  const box = $("#tier-editor");
  box.innerHTML = "";
  for (const t of S.tiers) tierEditorRow(t, false);
  const stBox = $("#stage-template-editor");
  stBox.innerHTML = "";
  for (const st of S.stageTemplate) stageTemplateRow(normalizeStage(st), false);
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
    <input class="t-cal" type="text" value="${esc(t.gcalCalendarId || "")}"
      placeholder="Google Calendar ID — GCal ⚙️ → pick calendar → 'Integrate calendar' → Calendar ID"
      title="Which Google Calendar feeds this tier. calendar.google.com → ⚙️ Settings → click the calendar → 'Integrate calendar' → Calendar ID. Your main personal calendar's ID is just your Gmail address."
      ${t.kind === "anchor" ? "" : "hidden"}>`;
  row.querySelector(".t-kind").addEventListener("change", ev => {
    row.querySelector(".t-cal").hidden = ev.target.value !== "anchor";
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
    sleepEnd: clampInt($("#cfg-sleep-end").value, 0, 23, 6)
  });
  for (const row of document.querySelectorAll(".tier-row")) {
    const kind = row.querySelector(".t-kind").value;
    const data = {
      rank: clampInt(row.querySelector(".t-rank").value, 1, 99, 99),
      name: row.querySelector(".t-name").value.trim() || "Untitled",
      color: row.querySelector(".t-color").value,
      kind,
      midnightCarryover: row.querySelector(".t-carry").checked,
      gcalCalendarId: kind === "anchor" ? row.querySelector(".t-cal").value.trim() : ""
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
