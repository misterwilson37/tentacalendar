# 🐙 Tentacalendar

A household planning board for two people who plan differently.

**Live:** [tentacalendar.misterwilson.org](https://tentacalendar.misterwilson.org)

Katie runs long, stage-based professional projects with real deadlines and billable hours. Jake runs a lot of small things that have to happen on a particular day. Tentacalendar is one board that takes both seriously: a project pipeline that knows a stage isn't due until the stage before it is done, and a task queue that escalates until you deal with it — on the same screen, filtered by the same tier chips, on a TV on the wall.

It is a real, in-daily-use application, not a demo.

---

## What it does

**Today** — the live queue. Tasks and project stages that are due, sorted by urgency, escalating in colour and (since v1.19.0) in sound as they age. A NOW bar shows what's running. Calendar events pin in place at their real times.

**Week** — seven days at once, in three layouts (columns, tidal, or a clock grid that draws each task's actual runway). Past days show reflection cards: what got done, what got pushed.

**Year** — every project as a bar across twelve months, packed into lanes, filling from ghost to saturated as its stages complete. Drag a bar to move a project; drag its edge to stretch it.

**Have-tos / Want-tos** — two tabs. Have-tos are dated work. Want-tos are the timeless "someday" projects that have no deadline and shouldn't pretend to.

**Also:** billable session clock with CSV export, recurring tasks, chained follow-ups, undo/redo, offline-tolerant PWA install, Google Calendar two-way integration, and confetti when a project finishes.

---

## Stack

Deliberately small and dependency-free.

| Layer | Choice |
|---|---|
| Frontend | Vanilla ES modules. No framework, no build step, no bundler. |
| Data | Firebase Firestore (web SDK v11.6.1, loaded from CDN) |
| Auth | Firebase Auth, Google sign-in, allow-listed by email |
| Hosting | GitHub Pages, custom domain via `CNAME` |
| Calendar sync | Google Cloud Functions (Node), deployed separately |

**There is no `npm install` and no build.** The files you edit are the files that ship. This is a design choice: it means the app can be maintained from a browser on a locked-down school laptop, which is the environment it was built in.

---

## Files

| File | What it is |
|---|---|
| `index.html` | All markup. Every modal, every panel. Carries `data-html-version`. |
| `app.js` | UI, rendering, event wiring, state. The big one. |
| `store.js` | **Every** Firestore read and write. No other file talks to the database. |
| `queue.js` | Pure functions: what's due, what's overdue, week/year layout, reports. No DOM, no network. |
| `celebrate.js` | Confetti and fireworks. |
| `config.js` | Firebase project config + the allow-list. |
| `tentacalendar.css` | All styling. Carries `--tc-version`. |
| `functions/index.js` | Cloud Functions: calendar poll, task mirror, overnight carryover. |
| `firestore.rules` | Security rules. |
| `HANDOFF.md` | **Read this before changing anything.** See below. |

The separation between `queue.js` (pure) and `app.js` (impure) is load-bearing: it's what makes the scheduling logic testable without a browser, and most of this project's test suites run directly against `queue.js`.

---

## Running your own

You need a Google account and about 30 minutes. `SETUP.md` has the detailed version; this is the shape of it.

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com). Enable **Firestore** and **Authentication → Google**.
2. **Register a web app** in that project and copy its config object.
3. **Fork this repo.** Put your config into `config.js` and set `ALLOWED_EMAILS` to the accounts allowed in. *(The Firebase web config is an identifier, not a secret — it's safe in a public repo. Your `firestore.rules` are what actually protect the data.)*
4. **Publish `firestore.rules`** from the Firebase console.
5. **Enable GitHub Pages** on the repo (Settings → Pages → deploy from branch). Set `CNAME` if you have a domain, or delete it if you don't.
6. **Sign in.** The app seeds its own tiers and default pipeline on first run.

**Calendar integration (optional)** is a separate, larger setup — it needs the Blaze plan and a service account. See `SETUP-PHASE3.md`. Everything else works without it.

---

## Deploying changes

Changes are pushed through the GitHub web interface (no CLI required) and go live on Pages within a minute or two.

**Bump the version on every file you change.** This isn't ceremony — three separate mechanisms depend on it:

- `?v=` query strings on imports bust the browser's ES-module cache. Stale modules have caused real, hard-to-diagnose bugs here.
- The version banner in the UI is how you confirm you're testing the code you just shipped rather than a cache.
- **`data-html-version` is functional.** Every open tab re-fetches `index.html` hourly and offers to auto-refresh when it changes. Forget to bump it and running tabs never learn about the deploy.

Semver: patch for fixes, minor for features, major only deliberately.

---

## Contributing / picking this up

**Read `HANDOFF.md` first.** All of it.

It is not a changelog. It's a continuity document listing every architectural decision (~140 of them, numbered `D1`–`D140`) with the reasoning behind each — including the ones that were wrong, and why. Sections worth knowing:

- **§2** — the decisions themselves. Also a catalogue of platform landmines this project has actually hit (flexbox min-content, `position: fixed` inside a transformed ancestor, label click-forwarding, ES-module caching).
- **§5** — what's open, what's blocked, what's deliberately not being built.
- **§6** — standing rules for anyone working on it.
- **§7** — the session log.

Two rules that will save you the most time:

1. **When a bug report doesn't match what the code says, stop and ask for a repro.** This project has burned multiple rounds on tidy theories built from screenshots. The thing that solves it is almost always one sentence from the person seeing it.
2. **Never let a check silently match less than it claims.** A ship-check that reports OK because its regex missed the case is worse than no check at all. This has happened here twice.

---

## Development notes

Tests are plain Node scripts with no framework — they extract functions verbatim from the shipped source (never a reimplementation, which would only test the copy) and assert against them. Run with `node test-whatever.mjs`.

Before shipping, a mechanical ship-check verifies: every version banner matches its declaration, every `?v=` matches the real file, every `$("#id")` in JS exists in the markup, no duplicate function definitions, and `index.html`'s `<div>`s balance.

---

## Credits

Built by Jake Wilson, with a long line of Claude instances — each of which named itself once it understood the project, and wrote down what it learned for the next one. In order: *(unnamed)*, Inky, Otto, Rambo, Billye, Octavia, Heidi, Ivy, Athena, Truman.

The octopus is not decorative. Eight arms, one animal, each arm solving its own problem — which is roughly the architecture.
