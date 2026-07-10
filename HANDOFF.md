# HANDOFF.md — Tentacalendar
**Document version: 0.7.2** | Last updated: 2026-07-10 | Last session: D50 — undated stages (fixed the everything-is-69-days-overdue disaster)

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
| D6 | ~~Priority = tier ordering~~ **SUPERSEDED BY D43** (v0.6.0). | |
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
| D33 | **(NEW v0.3.0) Calendar IDs live ON anchor tiers** (`gcalCalendarId` field, shown in tier editor when kind=Calendar), replacing the separate homeCalendarId/businessCalendarId config fields (REMOVED from settings/config and UI). Phase 3 pollCalendars iterates anchor tiers with non-empty gcalCalendarId. | Jake's setup feedback: the tier IS the calendar mapping; separate section created an ordering/linkage gap. |
| D34 | **(NEW v0.3.0) "During" stage offset = N days AFTER project start** (0 = day one), still gated on predecessors. Previously the offset was silently ignored for during-phase. | Jake: "what does during do if I set it for 7?" — now it does the obvious thing. |
| D35 | **(NEW v0.3.0) CSS must contain `[hidden] { display: none !important; }`** — the hidden attribute is UA-stylesheet priority and ANY author display rule silently overrides it. This caused the first-deploy failure (settings modal permanently rendered over the sign-in screen; all Firestore writes fired unauthenticated → permission errors). NEVER remove this rule; when an element with hidden won't hide, check for a display rule on it. | First-deploy post-mortem. |
| D36 | **(REVISED v0.4.0) Recommended browser: Microsoft Edge** (Mac+PC, Chromium, no OAuth-eating shields) — Chrome is county-managed on Jake's machines. Safari confirmed working. Firefox still banned (popup-loop history). Personal Google accounts only. | |
| D37 | **(NEW v0.4.0) NEVER apply CSS transform to <body> or any ancestor of position:fixed elements** — a transformed ancestor becomes the containing block for fixed descendants (this made the settings modal center against full PAGE height, appearing far below the fold once Katie had 6 projects). The pixel drift lives on #drift-wrap; the settings modal and the celebrate.js canvas MUST stay outside it. Second CSS-platform landmine after D35. | Found by Jake changing a tier color. |
| D38 | **(NEW v0.4.0 — Katie) Everything is editable.** ✎ on queue tasks loads the task form in edit mode (title/tier/due/escalation, Save/Cancel); ✎ on project cards loads the project form in edit mode (name/color/tier/dates); ✎ on waiting follow-ups edits title/offset via prompts. Editing project dates reflows stage activations automatically (computed, D3-style). Stage hard dues already editable via 📅 (blank clears). | "Us humans make mistakes — we need to be able to make changes to everything." |
| D39 | **(NEW v0.4.0 — Katie) Queue progress wash:** stage rows' backgrounds fill left-to-right with a translucent tint (16%) of the project color by pipeline completion %, so today's list shows step AND depth per project at a glance. | Her at-a-glance request, queue edition of D30a. |
| D40 | **(NEW v0.4.0 — Katie) Color conflict assistant:** project form pre-suggests the pool color maximally distant from existing project colors (never stomps a human-picked value); live warning when chosen color is within RGB distance 25 ("same as") or 60 ("very close to") of another project, naming that project and its date range, plus a suggestion. | Several of her 6 projects currently share colors. |
| D42 | **(v0.5.0) Per-project stage surgery:** "✎⋮" on each project card opens an editor to rename/reorder/add/remove stages on a LIVE project; completedAt + dueAt survive via original-index carry. Template stays a template (new projects only). | Katie: "Not all projects are standard." |
| D43 | **(v0.6.0) PRIORITY ENGINE v2 — the queue sort is now:** 1) EXPIRED first (missed = top, oldest deadline first); 2) CHRONOLOGICAL by honest due/deadline — tier does NOT matter here (a low-tier 9 AM beats a high-tier noon); 3) tie → remaining-pipeline-fraction × WORKLOAD, higher first (tasks/events score 0); 4) tie → tier rank; 5) tie → alphabetical. Tasks sort on ORIGINAL due (escalation theater is display-only). Computed date-only deadlines are "by 5 PM" that day so 9 AM tasks outrank them and midnight doesn't turn things red. | Katie + Jake's workflow analysis. She sees WHAT; this gives ORDER. |
| D44 | **(v0.6.0) Workload on projects:** 1 light / 2 standard / 3 heavy (default 2). Multiplies remaining pipeline in D43 level 3. Also: stage timing is now direction(before/after) × anchor(start/end) × offsetDays, replacing phase before/during/after — supports "peer review 2wd before END", "loss processing Nwd after START". Legacy phase data migrates lazily via normalizeStage() everywhere it's read; writes upgrade on next save. Each stage's computed date (scheduledAt) IS its deadline; a manual dueAt overrides it. Project queue item shows/sorts on nextDeadline = earliest effective date among incomplete stages ("next: Peer review — Wed, Jul 29"), replacing the useless "active since". | |
| D45 | **(v0.6.0) WEEKDAY math everywhere:** stage offsets count weekdays only (addWeekdays skips Sat/Sun). Project start/end dates are intercepted if they land on a weekend: modal offers Yes / No—Friday X / No—Monday Y / Go back (checked start then end). Stage-level dates need no modal — they're computed and weekend-proof by construction. | Katie works weekdays. |
| D46 | **(v0.6.0) Overdue decision modal:** items ≥2 days past deadline (visible tiers only) trigger ONE grouped modal, at most once per calendar day per device (localStorage key), each row offering ✓ done and ↷ reschedule-to-next-weekday-9AM; dismissible. Hidden tiers are excluded, so unhiding never avalanches (that day's shot is already spent). | The final escalation step. |
| D47 | **(v0.6.0) Tier filter chips** above the queue: tap to hide/show a tier on THIS DEVICE (localStorage 'tc-hidden-tiers'). Hiding a rank ≤4 tier requires confirm(). Hidden tiers vanish from queue, pinned, done-today, and the decision modal; project cards remain visible. | "Ignore the taiko stuff rather than ignore the app entirely." |
| D48 | **(v0.6.0) Pipeline windows gate visibility:** a project appears in the queue only from its EARLIEST effective stage date (e.g., engagement letter at start−14wd) through its last; before that window it's invisible (future projects don't flood today); past it, it lives on "today" as expired until dealt with. | Jake's finally⁴: a December project must not appear in July. |
| D50 | **(v0.6.2) UNDATED STAGES ARE FIRST-CLASS — most pipeline steps are weight, not deadlines.** Stage timing = No date | Before | After (direction:"none" in schema). Undated stages: no scheduledAt, never overdue, never a queue deadline — they matter through remaining-pipeline × workload (they are "the number of them before the next step"). Project deadline = next DATED commitment (hard due or dated offset); fallback = project end at 5 PM. **Legacy phase "during" migrates to UNDATED** — this instantly un-overdued Katie's data with zero DB writes (the previous mapping to after-start+0 stamped every stage with the project start date → "69 days overdue" apocalypse). Anchor/offset controls hide when No date is selected. CAVEAT: any stage saved through the 0.6.0/0.6.1 editors was written as after/start/0 (dated at start) — flip those to No date via ✎⋮ if they misbehave; probably none exist. | Jake: "it's about the number of them before the next step, not each one individually." My model was wrong; his is canonical. |
| D49 | **(v0.6.1) ES module imports MUST carry version queries.** `?v=` on `<script>`/`<link>` tags does NOT cache-bust `import` statements inside modules — a stale cached config.js (predating CONFIG_VERSION) made the whole module graph fail with `SyntaxError: Importing binding name not found` and a dead sign-in button. All internal imports now use `./file.js?v=x.y.z`, kept IDENTICAL across importers (differing queries = duplicate module instances). **Bump ritual now includes: when bumping a module, update its ?v= string in every importer** (config.js ← app.js + store.js; store/queue/celebrate ← app.js; app.js ← index.html). Third platform landmine (D35 hidden/display, D37 transform/fixed, D49 module cache). | |
| D41 | **(v0.4.0) Per-file versioning:** only files that actually changed get bumps; versions drift apart by design. Every JS module self-declares (APP_VERSION in app.js — moved OUT of config.js; STORE_VERSION; QUEUE_VERSION; CELEBRATE_VERSION), CSS declares --tc-version, index.html declares body[data-html-version]. Header badge = app.js version; hovering it and the settings-modal footer show the full per-file report. Fix-dominant releases bump z; feature releases bump y. | Jake's correction of my blanket-bump habit. |

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

**Files: app.js 0.6.2 · store.js 0.6.2 · queue.js 0.6.0 · index.html 0.5.2 · css 0.5.1 · config.js 0.4.0 (REAL Firebase values baked in — safe: web config is an identifier, not a secret; deploy wholesale, never revert to placeholders) · celebrate.js 0.1.1 · firestore.rules 0.1.0 · SETUP.md 0.2.1.**

**MIGRATION NOTE (live data):** Katie's projects predate v0.6.0 — old stage docs use `phase`, lack `workload`. Everything reads through normalizeStage()/`workload||2`; docs upgrade lazily on their next save. Do NOT write a migration script; do NOT remove the legacy fallbacks.

**Known display fix:** "9:00 AM on AFICC Bonnie" confusion = future due times showed without a date; whenLabel() now appends the date whenever it isn't the viewed day.

**Deploy status: LIVE AND IN USE.** v0.3.0 deployed successfully; Katie onboarded herself from her phone: 6 projects created, stages ticked to reality, tasks + a follow-up created, confetti approved ("she liked her little confetti"). Verified working: sign-in both accounts, seeding, overdue red styling, day-nav placement of future tasks, follow-up waiting state, phone layout, Safari layout. v0.4.0 awaiting Jake's deploy. NOTE: v0.4.0 removes nothing from the DB; config's old homeCalendarId/businessCalendarId fields (if seeded pre-0.3.0 — they were NOT, seeding happened on 0.3.0) are moot.

**Expectation set with Katie:** phase 1 has NO notifications — a due task simply becomes due, then escalates/glows. Real phone notifications arrive in phase 3 via the GCal mirror.

**Additional smoke tests for v0.2.0 (after SETUP.md Part 6):**
7. ⚙️ → confirm the 13-stage template is seeded; reorder something with ▲▼, save, reopen, verify.
8. Create project "Alabama Farmers", starting ~2 weeks out. Engagement letter should appear in TODAY's queue (before-phase, −14d); Data request should NOT.
9. Check Engagement letter off (celebration level 2 should fire). Data request should NOT enter the queue until project start date (during-phase gating).
10. In the project card, check a LATE stage (e.g. Data input) early — queue item should not change; when the pipeline reaches it later, it skips.
11. 📅 a stage with a past-due date → it floats/escalates with ❗ + red glow.
12. Complete every stage of a throwaway project → fireworks + wave (level 3).
13. Add a task due 3+ days ago → verify the glow is meaningfully stronger than a task due 1 hour ago.

## 5. Open Questions

1. ~~Katie's Gmail~~ RESOLVED: katie.wilson.bynac@gmail.com is in firestore.rules (deployed) and config.js v0.3.0.
2. Kiosk PC/Chromebook, Chrome (D36). Sleep-mode implementation at phase 4.
3. Year view: bar-lane packing + label threshold + drag/resize interaction details — phase 2 build. **PHASE 2 IS THE NEXT SESSION** (Jake asked "is it calendar view time?" — answer: yes, next session; v0.4.0 was the editing/polish release).
4. Months-unit escalation clamping (Jan 31→Feb 28) — confirm in real use.
5. Un-completing a parent doesn't rewind materialized follow-ups — watch in use.
6. Per-project stage editing is currently: check/uncheck, set/clear hard due date. Renaming/reordering/adding stages WITHIN an existing project = not yet built; template edits don't retrofit. Revisit when Katie hits it.
7. Stage items use the project's `tierId` for queue ranking. Confirm Katie wants Work tier or a dedicated "Projects" tier.
8. Renaming/reordering/adding stages WITHIN an existing project still not built (template edits don't retrofit). Katie hasn't hit it yet.
9. Tooltips are native title attributes (hover-only, no touch). If Katie does setup from her phone and misses them, build ⓘ tap-popovers.
10. Tier color changes could get the same conflict assistant as projects (D40) — not yet wired.

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
| 2026-07-09 | Claude Fable 5 | FIRST DEPLOY BUG + SETUP FEEDBACK. Diagnosis: settings modal rendered over sign-in screen because author `display:flex` overrides the `hidden` attribute (D35); unauthenticated Save clicks caused all the permission errors — rules were correct. Fixed with `[hidden]{display:none!important}` (also latently fixed #auth-screen). Jake's feedback shipped: calendar IDs moved onto anchor tiers w/ where-to-find ⓘ (D33), during-offset semantics (D34), smart new-tier defaults (rank max+1, unused random color), clamp-honest poll hint (his "8,755 mystery" = silent clamp of 1→5 min), 24-hr clock labels, tooltips throughout, Chrome recommendation (D36), Katie's email into config.js. All app files → 0.3.0; SETUP.md → 0.2.0. HANDOFF 0.5.0.
| 2026-07-10 | Claude Fable 5 | v0.5.x mid-flight (folded into 0.6.0): due-date dialog w/ native pickers (prompt() and the July-17 📅 emoji removed — Apple renders that emoji as a fixed July 17, which Katie read as data), per-project stage surgery (D42), tap ⓘ popovers, numbered project-tier dropdown defaulting to Work, config.js baked with real Firebase values + CONFIG_VERSION in runtime report.
| 2026-07-10 | Claude Fable 5 | D50 HOTFIX: 0.6.0's legacy migration dated every "during" stage at project start → all projects 8–69 days "overdue" + decision-modal wall. Root cause conceptual: I assumed all stages dated; Katie's model = only some stages have dates, the rest are pipeline WEIGHT. Fixed in normalizeStage (during→none) — zero data repair. Added "No date" timing option (default for new stages), project-end fallback deadline, project-card header wrap fix (title was rendering one letter per line). queue 0.6.0, app 0.6.2, store 0.6.2, html 0.5.2, css 0.5.1.
| 2026-07-10 | Claude Fable 5 | HOTFIX D49: first deploy of 0.6.0 died on a stale cached config.js module (SyntaxError on CONFIG_VERSION import → no listeners → dead sign-in). Versioned all internal import specifiers (app 0.6.1, store 0.6.1, html 0.5.1); SETUP 0.2.2 troubleshooting entry; bump ritual extended to importer query strings. One hard refresh needed on already-poisoned browsers.
| 2026-07-10 | Claude Fable 5 | PRIORITY ENGINE v2 (D43–D48) from Katie+Jake workflow session: new 5-level sort, workload, direction×anchor×weekday stage timing w/ lazy legacy migration, next-deadline labels, weekend interception modal, grouped overdue decision modal, tier filter chips, pipeline-window visibility. queue.js rewritten 0.5.0; app.js rewritten 0.6.0; store 0.6.0; html/css 0.5.0. HANDOFF 0.7.0.
| 2026-07-10 | Claude Fable 5 | v0.4.0 "THE KATIE RELEASE." App is live + in daily use (6 real projects). Shipped her feedback: edit-everything (D38), queue progress wash (D39), color conflict assistant (D40). Fixed her modal bug — transform-on-body broke position:fixed → #drift-wrap (D37). Jake's process correction adopted: per-file versioning w/ full version report in header tooltip + settings footer (D41); APP_VERSION moved out of config.js. Browser dart re-thrown: Edge (D36 rev — county manages Chrome). Set Katie's expectation: no notifications until phase 3. NEXT SESSION = PHASE 2 YEAR VIEW (D11/D27/D30a/D31/D32). HANDOFF 0.6.0.
