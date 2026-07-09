// ============================================================
// Tentacalendar — app.js
// Version 0.2.0
// UI wiring only. New in 0.2.0: project pipeline panel, stage
// template editor, celebrations, staleness glow.
// Logic lives in queue.js; Firebase lives in store.js.
// ============================================================

import { APP_VERSION } from "./config.js";
import {
  watchAuth, signIn, signOutUser,
  subscribeTiers, subscribeTasks, subscribeEvents, subscribeConfig,
  subscribeProjects, subscribeStageTemplate,
  addTask, addFollowUp, setTaskDone, deleteTask,
  addProject, deleteProject, setStageDone, setStageDue,
  saveTier, deleteTier, saveConfig, saveStageTemplate
} from "./store.js";
import { buildQueue, projectProgress, stageActivation, fmtTime, fmtDay } from "./queue.js";
import { celebrate } from "./celebrate.js";

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
  unsubs: []
};

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  $("#version").textContent = "v" + APP_VERSION;
  $("#signin-btn").addEventListener("click", () => signIn().catch(err => alert(err.message)));
  $("#signout-btn").addEventListener("click", () => signOutUser());
  $("#settings-btn").addEventListener("click", openSettings);
  $("#settings-close").addEventListener("click", closeSettings);
  $("#day-prev").addEventListener("click", () => shiftDay(-1));
  $("#day-next").addEventListener("click", () => shiftDay(1));
  $("#day-today").addEventListener("click", () => { S.viewDay = Date.now(); render(); });
  $("#task-form").addEventListener("submit", onAddTask);
  $("#project-form").addEventListener("submit", onAddProject);
  $("#tier-add").addEventListener("click", () => tierEditorRow({}, true));
  $("#stage-add").addEventListener("click", () => stageTemplateRow({ name: "", phase: "during", offsetDays: 0 }, true));
  $("#settings-save").addEventListener("click", onSaveSettings);
  $("#cfg-poll").addEventListener("input", updatePollCostHint);

  watchAuth(onSignedIn, onSignedOut);
  setInterval(tick, 60 * 1000);       // D22: 1-minute tick
  setInterval(drift, 5 * 1000);       // D21: slow sinusoidal pixel drift
});

function onSignedIn(user) {
  S.user = user;
  $("#auth-screen").hidden = true;
  $("#app-screen").hidden = false;
  $("#user-label").textContent = user.email;
  S.unsubs.push(subscribeTiers(t => { S.tiers = t; refreshTierSelects(); render(); }));
  S.unsubs.push(subscribeTasks(t => { S.tasks = t; render(); }));
  S.unsubs.push(subscribeEvents(e => { S.events = e; render(); }));
  S.unsubs.push(subscribeProjects(p => { S.projects = p; render(); }));
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

let driftT = 0;
function drift() {
  driftT += 0.03;
  const x = Math.sin(driftT) * 2;
  const y = Math.cos(driftT * 0.7) * 2;
  document.body.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
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
    if (it.kind === "stage") row.style.borderLeft = `4px solid ${it.projectColor || "#4dd0c4"}`;
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
      // D3 reschedule theater: original struck through, current escalation slot shown
      timeLabel = `<s>${fmtTime(it.originalDue)}${sameDayAsView(it.originalDue) ? "" : " " + fmtDay(it.originalDue)}</s> → ${fmtTime(it.time)}`;
    } else {
      timeLabel = fmtTime(it.time);
    }
    const stagePrefix = it.kind === "stage" ? `<span class="stage-proj" style="color:${it.projectColor}">${esc(it.projectName)}</span> · ` : "";
    main.innerHTML = `<strong>${stagePrefix}${esc(it.title)}</strong><span class="sub">${timeLabel}${it.overdue ? ' <span class="badge">❗ overdue</span>' : ""}</span>`;
    row.append(main);

    if (it.kind === "task") {
      const fu = iconBtn("↳", "Add follow-up", () => followUpPrompt(it));
      const del = iconBtn("✕", "Delete", () => { if (confirm(`Delete "${it.title}"?`)) deleteTask(it.id); });
      row.append(fu, del);
    }
    if (it.kind === "stage") {
      row.append(iconBtn("📅", "Set a hard due date for this stage", () => stageDuePrompt(it.projectId, it.stageIndex, it.title)));
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
    row.append(iconBtn("✕", "Delete", () => deleteTask(t.id)));
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
    const del = iconBtn("✕", "Delete project", () => {
      if (confirm(`Delete project "${p.name}" and its pipeline?`)) deleteProject(p.id);
    });
    head.append(del);
    card.append(head);

    // Progress fill — the gradient idea, made legible (D28)
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

    // Stage checklist
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

// ---------- Add task form ----------

function refreshTierSelects() {
  const taskOpts = S.tiers.filter(t => t.kind !== "anchor")
    .map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  $("#task-tier").innerHTML = taskOpts;
  $("#project-tier").innerHTML = taskOpts;
}

function onAddTask(ev) {
  ev.preventDefault();
  const title = $("#task-title").value.trim();
  const tierId = $("#task-tier").value;
  const date = $("#task-date").value;
  const time = $("#task-time").value || "09:00";
  const every = parseInt($("#task-esc-n").value, 10) || 1;
  const unit = $("#task-esc-unit").value;
  if (!title || !tierId || !date) return;
  const dueAt = new Date(`${date}T${time}`).getTime();
  addTask({ title, tierId, dueAt, escalation: { every, unit } })
    .then(() => { $("#task-title").value = ""; });
}

function onAddProject(ev) {
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
  addProject({ name, color, startDate, endDate, tierId })
    .then(() => { $("#project-name").value = ""; });
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
  $("#cfg-home-cal").value = c.homeCalendarId ?? "";
  $("#cfg-biz-cal").value = c.businessCalendarId ?? "";
  const box = $("#tier-editor");
  box.innerHTML = "";
  for (const t of S.tiers) tierEditorRow(t, false);
  const stBox = $("#stage-template-editor");
  stBox.innerHTML = "";
  for (const s of S.stageTemplate) stageTemplateRow(s, false);
}

function tierEditorRow(t, isNew) {
  const box = $("#tier-editor");
  const row = document.createElement("div");
  row.className = "tier-row";
  row.dataset.id = t.id || "";
  row.innerHTML = `
    <input class="t-rank" type="number" min="1" value="${t.rank ?? S.tiers.length + 1}" title="Rank (1 = highest)">
    <input class="t-name" type="text" value="${esc(t.name || "")}" placeholder="Tier name">
    <input class="t-color" type="color" value="${t.color || "#4dabf7"}">
    <select class="t-kind">
      <option value="task" ${t.kind !== "anchor" ? "selected" : ""}>Tasks</option>
      <option value="anchor" ${t.kind === "anchor" ? "selected" : ""}>Calendar</option>
    </select>
    <label class="t-carry-label"><input class="t-carry" type="checkbox" ${t.midnightCarryover ? "checked" : ""}> ❗ carryover</label>
    <button class="t-del" title="Delete tier">✕</button>`;
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
    <select class="st-phase" title="When can this stage activate?">
      <option value="before" ${s.phase === "before" ? "selected" : ""}>Before start</option>
      <option value="during" ${s.phase !== "before" && s.phase !== "after" ? "selected" : ""}>During</option>
      <option value="after" ${s.phase === "after" ? "selected" : ""}>After end</option>
    </select>
    <label class="st-off-label">±<input class="st-off" type="number" min="0" value="${s.offsetDays || 0}">d</label>
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
    sleepEnd: clampInt($("#cfg-sleep-end").value, 0, 23, 6),
    homeCalendarId: $("#cfg-home-cal").value.trim(),
    businessCalendarId: $("#cfg-biz-cal").value.trim()
  });
  for (const row of document.querySelectorAll(".tier-row")) {
    const data = {
      rank: clampInt(row.querySelector(".t-rank").value, 1, 99, 99),
      name: row.querySelector(".t-name").value.trim() || "Untitled",
      color: row.querySelector(".t-color").value,
      kind: row.querySelector(".t-kind").value,
      midnightCarryover: row.querySelector(".t-carry").checked
    };
    if (data.kind === "anchor") data.defaultLeadWindowMinutes = 30;
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
  const mins = clampInt($("#cfg-poll").value, 5, 1440, 60);
  const runs = Math.round((60 / mins) * 24 * 30.4);
  $("#poll-cost-hint").textContent =
    `≈ ${runs.toLocaleString()} calendar checks/month. Free tier covers 2,000,000. ` +
    `Realistic cost at this setting: $0.00. (Phase 3 feature — has no effect yet.)`;
}

// ---------- Utils ----------

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
