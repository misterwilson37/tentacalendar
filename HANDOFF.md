# HANDOFF.md — Tentacalendar
**Document version: 0.4.0** | Last updated: 2026-07-09 | Last session: v0.2.0 shipped (Katie's pipeline + celebrations); STILL NOT DEPLOYED

> **Purpose:** Project continuity document, updated at the END of every session, no exceptions (same ritual status as version bumps). Any Claude — Fable, Opus, or otherwise — reading this cold should be able to continue mid-feature. New Claude: read this entire file before writing code.

---

## 1. What Tentacalendar Is

Accountability + planning calendar for Katie's business (and household): a to-do list that *refuses to let things silently disappear*. Named for her octopus brain. tentacalendar.misterwilson.org (CNAME + repo exist; first deploy pending — Jake follows SETUP.md).

Faces: (1) 60"+ 4K big screen — annual calendar left, week top-right, agenda + to-do queue bottom-right (a projects pipeline column now also exists in the phase-1 layout); (2) same responsive app on phones, queue-first. Katie is now an active stakeholder with her own requirements (see D28–D32) — treat her requests as first-class.

Interim displays: home-theater 60" 4K TV and possibly a 1080p projector (see D27).

## 2. Locked Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Split source of truth: GCal owns EVENTS (Home + Business calendars, native editing, native recurrence). Firestore owns TASKS, PROJECTS (incl. pipeline stages), TIERS, overlays. | |
| D2 | Mirror stable truth, not churn: outbound mirror = project bars + tasks at ORIGINAL due time only. | |
| D3 | Escalation = render-time computation. `{dueAt, completedAt, escalation:{every,unit}}`; displayed slot = next step ≥ now, "reschedule theater" struck-through original. Default 1h, per-task dropdown. | |
| D4 | Relative follow-ups materialize on parent completion (`parentTaskId`+`offsetDays`); shown under "Waiting on…". Un-completing parent does NOT rewind children. | |
| D5 | Entity types: Projects (now with embedded stage pipelines), Events (GCal anchors), Tasks. | |
| D6 | Priority = tier ordering; overdue floats within ITS tier (effective due = now). | |
| D7 | Anchors pin above all tiers within lead window (default 30 min); never escalate. `requireAcknowledge` reserved v1.1. | |
| D8 | No collision-aware auto-scheduling v1. | |
| D9 | GitHub Pages + Firebase. NOT PLEXBEAST. | |
| D10 | Firebase Auth, Google provider, two-email allowlist (config.js + firestore.rules MUST match). | |
| D11 | Year view = 12-month grid; REVISED by D31 (quarter-aligned + 3 anchor modes). Gantt toggle deferred. | |
| D12 | Workspace in schema; v1 builds only `primary`. | |
| D13 | Name: Tentacalendar. | 🐙 |
| D14 | Midnight carryover fn: incomplete tasks in `midnightCarryover` tiers → next-morning GCal events, "❗" prefix, tomato (colorId 11), landing at `carryoverWriteHour` (default 9, in settings). Phase 3. | |
| D15 | Inbound events: scheduled poll → eventsCache; default 60 min, settable (5–1440) w/ cost readout; manual "refresh now" button in phase 3; poll MUST diff-write. | |
| D16 | Event tiers via per-calendar defaults + sparse eventMeta overlay. | |
| D17 | Outbound mirror trigger: Firestore onWrite. | |
| D18 | Month zoom v1; custom zoom levels v2. | |
| D19 | Offline/PWA deferred indefinitely. | |
| D20 | Recurring EVENTS via GCal (free); recurring TASKS v2; no improvised recurrence engines. | |
| D21 | Burn-in: near-black theme + 2px sinusoidal drift (shipped) + scheduled sleep (settings shipped; dim mode ships w/ kiosk phase). | |
| D22 | 1-min tick, midnight rollover, day nav arrows + back-to-today (shipped). | |
| D23 | Standalone Firebase project under jacob.v.wilson@gmail.com; billing movable per-project later. | |
| D24 | Phase 1 = FREE SPARK PLAN, no card. Blaze only at phase 3; realistic bill ≈ $0.00. | |
| D25 | Completed mirrored tasks get "✓" prefix on GCal, kept for the record (phase 3). | |
| D26 | Modular files: config.js (only hand-edited file), store.js (Firebase), queue.js (pure logic), app.js (UI), celebrate.js (dopamine), index.html, tentacalendar.css, firestore.rules. | |
| D27 | 1080p/projector compact mode for year view: labels hide below width threshold; legend + hover tooltips ship with year view day one. | |
| D28 | **(NEW — Katie #1) Project pipelines.** Universal stage TEMPLATE in settings (name, phase before/during/after, ± day offset, reorderable); each NEW project snapshots the template into an independently editable `stages` array. Queue surfaces exactly ONE item per project: the EARLIEST unchecked stage, and only once its activation date arrives (before: start−offset; during: start; after: end+offset). Stages checked early in the project panel are simply skipped when the pipeline reaches them. Optional per-stage hard `dueAt` (📅) makes that stage escalate/float like a task. SHIPPED v0.2.0. Seed template = Katie's 13 stages: Engagement letter (before −14d), Data request, Excel setup, Word setup, Graphic setup, Loss data processing, Non-loss data processing, Data input, Selections, Proofing, Peer review, Publication, Client follow-up (after +14d). | Katie's core workflow. |
| D29 | **(NEW — Katie #2) Celebration engine** (celebrate.js): level 1 task = randomized confetti pop at the checkbox; level 2 stage = double burst + streamers; level 3 project complete = fireworks + Katie's wave sweeping the screen (CSS `celebration-wave`). Variants randomized against habituation. SHIPPED v0.2.0. | Dopamine is a feature, not a gimmick. |
| D30 | **(NEW — Katie #3, split) Gradient feedback:** (a) Year-view project bars render as pale "ghost" of project color with saturated fill left-to-right by pipeline % (`projectProgress()` already in queue.js) — clearer than brightness-only; ships with year view. Progress bar version SHIPPED in project panel v0.2.0. (b) Queue staleness glow: overdue rows grow an intensifying red glow with days ignored (whisper day 1 → searchlight day 4+). SHIPPED v0.2.0. Tier chip colors stay stable (D6 predictability). | Katie's eye-drawing request, made legible. |
| D31 | **(NEW — Katie #4) Year view spec (phase 2):** quarter-aligned 4 rows × 3 months; THREE anchor modes — Calendar (Jan–Dec), Quarter-first (current fiscal quarter top-left, rolling 12), Month-first (current month top-left, rolling 12). Rolling modes may reallocate panel proportions. | Her clients work on quarters. |
| D32 | **(NEW — Katie #5) Year view interactivity (phase 2):** project bars support drag-to-move and edge-drag to extend/shorten (pointer events over the grid). Whole-year planning that filters down to hourly tasks is the point. | |

## 3. Firestore Schema (implemented v0.2.0)

Under `workspaces/primary`:
- workspace doc: `name`, `memberEmails[]`, `createdAt`, `createdBy`
- `tiers/{id}`: `name`, `rank`, `color`, `kind`("anchor"|"task"), `midnightCarryover`, `defaultLeadWindowMinutes?`
- `tasks/{id}`: `title`, `tierId`, `projectId?`, `dueAt`(null=awaiting parent), `completedAt`, `escalation:{every,unit}`, `parentTaskId?`, `offsetDays?`, `mirroredGcalEventId?`, `createdBy`, `createdAt`
- `projects/{id}`: `name`, `color`, `startDate`, `endDate`, `tierId` (tier its stage items use in the queue), `stages: [{name, phase, offsetDays, completedAt, dueAt}]` (ordered array = pipeline order), `stretchUntilDone`, `completedAt` (auto-set when all stages done), `createdBy`, `createdAt`
- `eventsCache/{gcalEventId}` (phase 3 writes; client sub live): `title`, `start`, `end`, `sourceCalendar`, `recurring`
- `eventMeta/{gcalEventId}` (phase 3): sparse overrides
- `settings/config`: `homeCalendarId`, `businessCalendarId`, `carryoverWriteHour`(9), `pollIntervalMinutes`(60), `sleepStart`(22), `sleepEnd`(6)
- `settings/stageTemplate`: `{stages:[{name, phase, offsetDays}]}` — Katie's 13-stage seed; editable in ⚙️; applies to NEW projects only

Seeded tiers: 1 Home anchor #ff6b6b · 2 Business anchor #ffa94d · 3 Work #ffd43b ❗ · 4 Family #69db7c ❗ · 5 Personal #4dabf7 · 6 Taiko #b197fc.

Cloud Functions (phase 3, none exist): `mirrorTask`, `pollCalendars` (+manual trigger), `midnightCarryover`.

## 4. Build Order & Current State

(1) ✅ accountability core; **(1.5) ✅ Katie's pipeline + celebrations (v0.2.0)**; (2) year view: quarter-aligned grid, 3 anchor modes (D31), project bars w/ progress ghost-fill (D30a), drag/resize (D32), legend/compact (D27), month zoom (D18); (3) Cloud Functions; (4) week view + kiosk polish.

**ALL FILES AT v0.2.0 except celebrate.js (v0.1.0) and firestore.rules (v0.1.0). NOT YET DEPLOYED — Jake is setting up Firebase/GitHub Pages per SETUP.md concurrently.**

Files: config.js 0.2.0 · store.js 0.2.0 · queue.js 0.2.0 · app.js 0.2.0 · index.html 0.2.0 · tentacalendar.css 0.2.0 · celebrate.js 0.1.0 · firestore.rules 0.1.0 · SETUP.md 0.1.0 (still accurate — nothing in v0.2.0 changes setup steps; smoke test now has extra items below).

**Additional smoke tests for v0.2.0 (after SETUP.md Part 6):**
7. ⚙️ → confirm the 13-stage template is seeded; reorder something with ▲▼, save, reopen, verify.
8. Create project "Alabama Farmers", starting ~2 weeks out. Engagement letter should appear in TODAY's queue (before-phase, −14d); Data request should NOT.
9. Check Engagement letter off (celebration level 2 should fire). Data request should NOT enter the queue until project start date (during-phase gating).
10. In the project card, check a LATE stage (e.g. Data input) early — queue item should not change; when the pipeline reaches it later, it skips.
11. 📅 a stage with a past-due date → it floats/escalates with ❗ + red glow.
12. Complete every stage of a throwaway project → fireworks + wave (level 3).
13. Add a task due 3+ days ago → verify the glow is meaningfully stronger than a task due 1 hour ago.

## 5. Open Questions

1. Katie's Gmail into config.js + firestore.rules before deploy.
2. Kiosk PC/Chromebook, Chromium browser (NOT Firefox). Sleep-mode implementation at phase 4.
3. Year view: bar-lane packing + label threshold + drag/resize interaction details — phase 2 build.
4. Months-unit escalation clamping (Jan 31→Feb 28) — confirm in real use.
5. Un-completing a parent doesn't rewind materialized follow-ups — watch in use.
6. Per-project stage editing is currently: check/uncheck, set/clear hard due date. Renaming/reordering/adding stages WITHIN an existing project = not yet built; template edits don't retrofit. Revisit when Katie hits it.
7. Stage items use the project's `tierId` for queue ranking (defaults selectable at creation). Confirm Katie wants them in Work tier or wants a dedicated "Projects" tier.

## 6. Standing Meta-Rules (ALL sessions)

1. One clarifying question before chasing any bug theory; never speculate past 1–2 files without a clean explanation.
2. Version bumps on EVERY shipped file, non-negotiable (patch/minor/major); bump ?v= query strings in index.html alongside.
3. Complete replacement files only.
4. Incremental disk-based builds in /home/claude; syntax-check between major edits; present at session end.
5. Never store student-identifying data.
6. Update THIS FILE at end of every session.

## 7. Session Log

| Date | Model | Summary |
|------|-------|---------|
| 2026-07-09 | Claude Fable 5 | Inception: architecture, escalation, tiers, anchors, scope, naming. HANDOFF 0.1.0. |
| 2026-07-09 | Claude Fable 5 | Split source of truth (GCal events / Firestore tasks), carryover, poll, overlays, schema. HANDOFF 0.2.0. |
| 2026-07-09 | Claude Fable 5 | PHASE 1 BUILD: 8 files @ v0.1.0 incl. SETUP.md. Spark-first, adjustable poll. HANDOFF 0.3.0. |
| 2026-07-09 | Claude Fable 5 | KATIE'S REQUESTS (pre-deploy, so no migration): D28 pipelines (13-stage template, before/during/after activation, early-completion skipping, per-stage hard dues), D29 celebration engine + wave, D30 gradient split (progress fills + staleness glow, both partly shipped), D31 quarter-aligned year view spec, D32 drag/resize spec. Shipped v0.2.0 across all app files + new celebrate.js. Smoke tests 7–13 added. HANDOFF 0.4.0. |
