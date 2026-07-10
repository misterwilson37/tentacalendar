// ============================================================
// Tentacalendar — app.js
// Version 0.4.0
// 0.4.0 ("The Katie Release"): edit-everything (tasks, projects,
// waiting follow-ups), queue progress wash on stage rows, color
// conflict assistant, drift-wrap fix (transform vs position:fixed,
// D37), per-file version reporting.
// ============================================================

import {
  watchAuth, signIn, signOutUser, STORE_VERSION,
  subscribeTiers, subscribeTasks, subscribeEvents, subscribeConfig,
  subscribeProjects, subscribeStageTemplate,
  addTask, addFollowUp, setTaskDone, deleteTask, updateTask,
  addProject, deleteProject, updateProject, setStageDone, setStageDue,
  saveTier, deleteTier, saveConfig, saveStageTemplate
} from "./store.js";
import { buildQueue, projectProgress, fmtTime, fmtDay, QUEUE_VERSION } from "./queue.js";
import { celebrate, CELEBRATE_VERSION } from "./celebrate.js";

export const APP_VERSION = "0.4.0";
const $ = sel => document.querySelector(sel);

// ---------- State ----------
const S = {
  user: null,
  tiers: [],
  tasks: [],
  events: [],
  projects: [],
  stageTemplate: [],
  config: null,
  viewDay: Date.now(),
  editingTaskId: null,
  editingProjectId: null,
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
  $("#stage-add").addEventListener("click", () => stageTemplateRow({ name: "", phase: "during", offsetDays: 0 }, true));
  $("#settings-save").addEventListener("click", onSaveSettings);
  $("#cfg-poll").addEventListener("input", updatePollCostHint);

  watchAuth(onSignedIn, onSignedOut);
  setInterval(tick, 60 * 1000);       // D22: 1-minute tick
  setInterval(drift, 5 * 1000);       // D21: slow sinusoidal pixel drift
});

function reportVersions() {
  const cssVersion = getComputedStyle(document.documentElement)
    .getPropertyValue("--tc-version").trim().replace(/"/g, "") || "?";
  const htmlVersion = document.body.dataset.htmlVersion || "?";
  const report =
    `app.js ${APP_VERSION} · store.js ${STORE_VERSION} · queue.js ${QUEUE_VERSION} · ` +
    `celebrate.js ${CELEBRATE_VERSION} · css ${cssVersion} · html ${htmlVersion}`;
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
  S.unsubs.push(subscribeTiers(t => { S.tiers = t; refreshTierSelects(); render(); }));
  S.unsubs.push(subscribeTasks(t => { S.tasks = t; render(); }));
  S.unsubs.push(subscribeEvents(e => { S.events = e; render(); }));
  S.unsubs.push(subscribeProjects(p => { S.projects = p; suggestProjectColor(); render(); }));
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
  if (d.getDate() !== lastTickDay) {        // midnight rollover (D22)
    lastTickDay = d.getDate();
    S.viewDay = Date.now();
  }
  render();
}

// D37: the drift transform lives on #drift-wrap, NEVER on <body> —
// a transform on an ancestor becomes the containing block for
// position:fixed descendants (the settings-modal-centered-way-
// downpage bug). Modal + confetti canvas live OUTSIDE the wrap.
let driftT = 0;
function drift() {
  driftT += 0.03;
  const x = Math.sin(driftT) * 2;
  const y = Math.cos(driftT * 0.7) * 2;
  const wrap = $("#drift-wrap");
  if (wrap) wrap.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
}

function shiftDay(n) {
  S.viewDay += n * 24 * 60 * 60 * 1000;
  render();
}

// ---------- Rendering ----------

function render() {
  if (!S.user) return;
  const now = Date.now();
  const q = buildQueue({
    tasks: S.tasks, events: S.events, tiers: S.tiers,
    projects: S.projects, now, viewDay: S.viewDay
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

/** Katie's aging glow: the longer something festers, the harder it is to ignore. */
function staleGlow(row, originalDue, now) {
  const days = (now - originalDue) / 86400000;
  if (days <= 0) return;
  const blur = Math.min(3 + days * 3.5, 16);
  const alpha = Math.min(0.25 + days * 0.12, 0.7);
  row.style.boxShadow = `0 0 ${blur.toFixed(0)}px rgba(255,107,107,${alpha.toFixed(2)})`;
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
    row.className = "row" + (it.overdue ? " overdue" : "") + (it.kind === "event" ? " event-row" : "");
    if (it.kind === "stage") {
      row.style.borderLeft = `4px solid ${it.projectColor || "#4dd0c4"}`;
      // Katie's progress wash: pale fill of the project color, left-to-right
      // by pipeline completion, so the glance shows step AND depth.
      const pct = Math.round((it.progressPct || 0) * 100);
      row.style.background =
        `linear-gradient(90deg, ${hexToRgba(it.projectColor || "#4dd0c4", 0.16)} ${pct}%, transparent ${pct}%)`;
    }
    if (it.overdue) staleGlow(row, it.originalDue, now);

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
    let timeLabel;
    if (it.kind === "event") {
      timeLabel = fmtTime(it.time) + (it.end ? "–" + fmtTime(it.end) : "");
    } else if (it.kind === "stage" && !it.hasDue) {
      timeLabel = sameDayAsView(it.activatedAt)
        ? `active today`
        : `active since ${fmtDay(it.activatedAt)}`;
    } else if (it.overdue) {
      timeLabel = `<s>${fmtTime(it.originalDue)}${sameDayAsView(it.originalDue) ? "" : " " + fmtDay(it.originalDue)}</s> → ${fmtTime(it.time)}`;
    } else {
      timeLabel = fmtTime(it.time);
    }
    const stagePrefix = it.kind === "stage" ? `<span class="stage-proj" style="color:${it.projectColor}">${esc(it.projectName)}</span> · ` : "";
    main.innerHTML = `<strong>${stagePrefix}${esc(it.title)}</strong><span class="sub">${timeLabel}${it.overdue ? ' <span class="badge">❗ overdue</span>' : ""}</span>`;
    row.append(main);

    if (it.kind === "task") {
      row.append(
        iconBtn("✎", "Edit this task", () => startTaskEdit(it.raw)),
        iconBtn("↳", "Add follow-up", () => followUpPrompt(it)),
        iconBtn("✕", "Delete", () => { if (confirm(`Delete "${it.title}"?`)) deleteTask(it.id); })
      );
    }
    if (it.kind === "stage") {
      row.append(iconBtn("📅", "Set/change this stage's hard due date", () => stageDuePrompt(it.projectId, it.stageIndex, it.title)));
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
    head.innerHTML = `<strong>${esc(p.name)}</strong><span class="sub">${fmtDay(p.startDate)} – ${fmtDay(p.endDate)}</span>`;
    head.append(
      iconBtn("✎", "Edit project (name, color, tier, dates)", () => startProjectEdit(p)),
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
    const activeIdx = stages.findIndex(s => !s.completedAt);
    const list = document.createElement("div");
    list.className = "stage-list";
    stages.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "stage-row"
        + (s.completedAt ? " stage-done" : "")
        + (i === activeIdx ? " stage-active" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!s.completedAt;
      cb.addEventListener("change", ev => onStageToggle(p.id, i, cb.checked, ev));
      row.append(cb);

      const label = document.createElement("span");
      label.className = "stage-name";
      label.textContent = s.name;
      row.append(label);

      if (s.phase === "before") row.append(badge(`B−${s.offsetDays}d`, "Activates before project start"));
      if (s.phase === "after") row.append(badge(`A+${s.offsetDays}d`, "Activates after project end"));
      if (s.dueAt) {
        const due = badge(`📅 ${fmtDay(s.dueAt)}`, "Hard due date — click to change/clear");
        due.classList.add("clickable");
        due.addEventListener("click", () => stageDuePrompt(p.id, i, s.name));
        row.append(due);
      } else if (!s.completedAt) {
        const setDue = iconBtn("📅", "Set a hard due date", () => stageDuePrompt(p.id, i, s.name));
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
  if (done && result) {
    celebrate(result.allDone ? 3 : 2, clickPoint(ev));
  }
}

function stageDuePrompt(projectId, stageIndex, stageName) {
  const input = prompt(
    `Hard due date for "${stageName}" (YYYY-MM-DD, optionally " HH:MM").\nLeave blank to clear.`,
    ""
  );
  if (input === null) return;
  if (input.trim() === "") { setStageDue(projectId, stageIndex, null); return; }
  const parts = input.trim().split(/\s+/);
  const ts = new Date(`${parts[0]}T${parts[1] || "09:00"}`).getTime();
  if (isNaN(ts)) { alert("Couldn't read that date. Try YYYY-MM-DD."); return; }
  setStageDue(projectId, stageIndex, ts);
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

// ---------- Task form (create + edit) ----------

function refreshTierSelects() {
  const taskOpts = S.tiers.filter(t => t.kind !== "anchor")
    .map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const keep1 = $("#task-tier").value, keep2 = $("#project-tier").value;
  $("#task-tier").innerHTML = taskOpts;
  $("#project-tier").innerHTML = taskOpts;
  if (keep1) $("#task-tier").value = keep1;
  if (keep2) $("#project-tier").value = keep2;
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
  if (S.editingTaskId) {
    updateTask(S.editingTaskId, payload).then(cancelTaskEdit);
  } else {
    addTask(payload).then(() => { $("#task-title").value = ""; });
  }
}

// ---------- Project form (create + edit) ----------

function startProjectEdit(p) {
  S.editingProjectId = p.id;
  $("#project-form-title").textContent = "✎ Edit project";
  $("#project-submit").textContent = "Save changes";
  $("#project-cancel").hidden = false;
  $("#project-name").value = p.name;
  $("#project-color").value = p.color;
  $("#project-tier").value = p.tierId;
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
  suggestProjectColor(true);
  $("#project-color-hint").textContent = "";
}

function onProjectFormSubmit(ev) {
  ev.preventDefault();
  const name = $("#project-name").value.trim();
  const color = $("#project-color").value;
  const tierId = $("#project-tier").value;
  const start = $("#project-start").value;
  const end = $("#project-end").value;
  if (!name || !tierId || !start || !end) return;
  const startDate = new Date(`${start}T00:00`).getTime();
  const endDate = new Date(`${end}T00:00`).getTime();
  if (endDate < startDate) { alert("Project can't end before it starts. (The octopus checked.)"); return; }
  const payload = { name, color, tierId, startDate, endDate };
  if (S.editingProjectId) {
    updateProject(S.editingProjectId, payload).then(cancelProjectEdit);
  } else {
    addProject(payload).then(() => { $("#project-name").value = ""; suggestProjectColor(true); });
  }
}

// ---------- Color conflict assistant ----------

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

/** Pick the pool color farthest from every existing project color. */
function bestFreeColor() {
  const used = S.projects
    .filter(p => p.id !== S.editingProjectId)
    .map(p => p.color);
  if (!used.length) return COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
  let best = COLOR_POOL[0], bestScore = -1;
  for (const c of COLOR_POOL) {
    const score = Math.min(...used.map(u => colorDistance(c, u)));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** Only auto-suggest while the field still holds our last suggestion —
 *  never stomp a color the human actually picked. */
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
  for (const s of S.stageTemplate) stageTemplateRow(s, false);
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
    <input class="t-rank" type="number" min="1" value="${t.rank ?? 1}" title="Priority rank: 1 sorts first in the to-do queue">
    <input class="t-name" type="text" value="${esc(t.name || "")}" placeholder="Tier name">
    <input class="t-color" type="color" value="${t.color || "#4dabf7"}" title="Tier color (chips in the queue)">
    <select class="t-kind" title="Tasks = checkable items you create here. Calendar = appointments pulled from a Google Calendar (they pin near their start time and never nag).">
      <option value="task" ${t.kind !== "anchor" ? "selected" : ""}>Tasks</option>
      <option value="anchor" ${t.kind === "anchor" ? "selected" : ""}>Calendar</option>
    </select>
    <label class="t-carry-label" title="If tasks in this tier are still unchecked at midnight, they get written onto tomorrow's Google Calendar with a ❗ at the carryover hour below. (Phase 3 feature.)"><input class="t-carry" type="checkbox" ${t.midnightCarryover ? "checked" : ""}> ❗ carryover</label>
    <button class="t-del" title="Delete tier">✕</button>
    <input class="t-cal" type="text" value="${esc(t.gcalCalendarId || "")}"
      placeholder="Google Calendar ID — GCal ⚙️ Settings → pick the calendar → 'Integrate calendar' → Calendar ID (looks like xyz@group.calendar.google.com)"
      title="Which Google Calendar feeds this tier. Find it: calendar.google.com → ⚙️ Settings → click the calendar in the left list → scroll to 'Integrate calendar' → copy Calendar ID. Your main personal calendar's ID is just your Gmail address."
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

function stageTemplateRow(s, isNew) {
  const box = $("#stage-template-editor");
  const row = document.createElement("div");
  row.className = "stage-tmpl-row";
  row.innerHTML = `
    <span class="st-move"><button class="st-up" title="Move up">▲</button><button class="st-down" title="Move down">▼</button></span>
    <input class="st-name" type="text" value="${esc(s.name || "")}" placeholder="Stage name">
    <select class="st-phase" title="Before start: activates N days before the project begins. During: activates N days after the project starts (0 = day one). After end: N days after the project ends. A stage never surfaces before its predecessors are checked.">
      <option value="before" ${s.phase === "before" ? "selected" : ""}>Before start</option>
      <option value="during" ${s.phase !== "before" && s.phase !== "after" ? "selected" : ""}>During</option>
      <option value="after" ${s.phase === "after" ? "selected" : ""}>After end</option>
    </select>
    <label class="st-off-label" title="Day offset for the phase chosen at left.">±<input class="st-off" type="number" min="0" value="${s.offsetDays || 0}">d</label>
    <button class="st-del" title="Remove stage">✕</button>`;
  row.querySelector(".st-up").addEventListener("click", () => {
    if (row.previousElementSibling) box.insertBefore(row, row.previousElementSibling);
  });
  row.querySelector(".st-down").addEventListener("click", () => {
    if (row.nextElementSibling) box.insertBefore(row.nextElementSibling, row);
  });
  row.querySelector(".st-del").addEventListener("click", () => row.remove());
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
  const stages = [...document.querySelectorAll(".stage-tmpl-row")].map(row => ({
    name: row.querySelector(".st-name").value.trim() || "Untitled stage",
    phase: row.querySelector(".st-phase").value,
    offsetDays: clampInt(row.querySelector(".st-off").value, 0, 365, 0)
  }));
  saveStageTemplate(stages);
  closeSettings();
}

function closeSettings() {
  $("#settings-modal").hidden = true;
}

function updatePollCostHint() {
  const raw = parseInt($("#cfg-poll").value, 10);
  const mins = clampInt($("#cfg-poll").value, 5, 1440, 60);
  const runs = Math.round((60 / mins) * 24 * 30.4); // 30.4 = avg days/month
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
