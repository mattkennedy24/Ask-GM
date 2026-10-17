---
name: dev
description: >-
  Build and run Ask GM locally in development. Checks Node, installs dependencies, creates .env, starts the Vite
  and Express dev servers, confirms both answer, and reports the URLs. Use when asked to build, run, start or set
  up the project locally, to see the app, or to try a change by hand. Pass "prod" to build the production bundle
  and serve it on one port instead (what Railway runs, and the way to reach it from a phone).
argument-hint: "[prod]"
---

# Run Ask GM locally

Leave the app running and reachable, and say exactly where. Work through the steps in order, stop at the first real
problem and report it, and never invent, print or ask for a secret.

Argument: `$ARGUMENTS`. Empty means development (hot reload). `prod` means build, then serve the built app and the API
together, as Railway does (see the end).

## 0. Where is this running?

`echo "${CLAUDE_CODE_REMOTE:-}"`. If it prints anything, this is a Claude Code cloud session: the servers run in a
container the user's browser cannot reach, so a `localhost` link is useless to them. Do every step to prove the app
works (step 6 includes a screenshot), then give them the commands from "On the user's own machine" at the end.
If it prints nothing, this is the user's machine: run from the repo root and hand them the URL when it is up.

## 1. Node

`node -v` must be 20.19 or newer (Vite 7 needs it; `package.json` has `engines`). If older, stop and say so
(`nvm install 22` fixes it).

## 2. Dependencies

Run `npm install --no-audit --no-fund` only when `node_modules` is missing or `package-lock.json` is newer than
`node_modules/.package-lock.json` (`[ package-lock.json -nt node_modules/.package-lock.json ]`). Otherwise skip it.

## 3. Environment file

- No `.env` yet: `cp .env.example .env`.
- Report what the server will make of it, without showing any value. This reads `.env` the way the server does:

  ```bash
  node -e 'import("dotenv").then((m)=>{m.default.config({quiet:true});return import("./server/config.js")}).then(({loadConfig})=>{const c=loadConfig();console.log("chat key:",c.hasApiKey?"set":"NOT set","| beta gate:",c.betaPasscode?"on":"off","| model:",c.model)})'
  ```

  If the key is not set, say plainly that the app runs but every chat answers "The grandmasters are not available
  right now" until the user pastes a key into `.env` themselves. Never ask for it in the conversation.
- Leave `BETA_PASSCODE=` empty: the access-code gate is off locally. To try the gate, set `BETA_PASSCODE=letmein`,
  restart, and use a private window (an accepted code is remembered in the browser).
- The server reads `.env` once at start and `node --watch` does not notice edits to it, so restart after changing it.

## 4. Free the ports

The API uses 3001 (`PORT`) and the dev page 5173. See what is listening:

`lsof -nP -iTCP:3001 -iTCP:5173 -sTCP:LISTEN`

A dev server left over from earlier is the usual cause, and a **stale API server silently serves old server code**.
If it is a `node` process from this repo (`ps -o pid,command -p <pid>`, `lsof -a -p <pid> -d cwd`), stop that PID:
`kill $(lsof -ti tcp:3001 -sTCP:LISTEN)`. If you are not sure whose it is, ask first.
Always include `-sTCP:LISTEN`: without it `lsof` also lists clients, such as the user's browser, and killing those is a
mistake. **Never use `pkill -f`**: in this environment it can kill the shell you are running in.

## 5. Start (development)

Start it in the background so the session is not blocked, logging to a temp file (the scratchpad directory in a cloud
session). With the Bash tool use `run_in_background: true`:

`npm run dev > "${TMPDIR:-/tmp}/ask-gm-dev.log" 2>&1`

That runs `node --watch server/index.js` (the API) and `vite` (the page) together. Wait with a bounded loop, never a
bare sleep:

```bash
for i in $(seq 1 60); do curl -fsS -m 1 http://localhost:3001/api/health >/dev/null 2>&1 && curl -fsS -m 1 http://localhost:5173/ >/dev/null 2>&1 && break; sleep 0.5; done
```

If Vite found 5173 busy it moved to the next free port: read the `Local:` line in the log and use that URL everywhere
below. If the loop times out, show the last lines of the log.

## 6. Prove it

- `curl -fsS http://localhost:3001/api/health` gives `{"status":"ok"}`.
- `curl -fsS http://localhost:5173/api/health` gives the same: the page proxies `/api` to the server.
- `curl -fsS http://localhost:5173/api/auth/status` gives `{"betaRequired":false}` unless a passcode is set.
- `curl -sI http://localhost:5173/engine/stockfish-16-single.wasm` gives `200` and `content-type: application/wasm`:
  the engine the board analyses with. If that fails, `npm install` has not provided the `stockfish` package.

In a cloud session, look at it for real (the browser is preinstalled; do not run `playwright install`):

`npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=4000 http://localhost:5173 <scratchpad>/ask-gm-dev.png`

Read the image. The eval bar filling in is the sign that Stockfish loaded.

## 7. Report

In a few plain lines: the URL(s); what is running (API :3001, page :5173); whether chat will answer (key set or not);
that the gate is off; the log path; and how to stop it: stop the background task, or
`kill $(lsof -ti tcp:3001 -sTCP:LISTEN) $(lsof -ti tcp:5173 -sTCP:LISTEN)`. Then confirm both ports are free again.

## `prod`: the Railway-style build

Railway builds with `npm run build` and serves with `npm start`, on one port. It is also the only way to try the app
from a phone, because the dev page listens on localhost only. Same steps as above, except:

1. `npm run build`. This is `tsc -b && vite build`, so a type error here is a failed deploy. Stop and show the error if
   it fails.
2. `npm start > "${TMPDIR:-/tmp}/ask-gm-prod.log" 2>&1` in the background: one port, **3001**, page and API together.
   Check `curl -fsS http://localhost:3001/api/health` and `curl -sI http://localhost:3001/`.
3. For a phone on the same Wi-Fi give `http://<this machine's address>:3001`. macOS: `ipconfig getifaddr en0`
   (Wi-Fi). Linux: `hostname -I`. The Mac may ask whether `node` may accept incoming connections: yes. Over plain http
   Safari cannot copy to the clipboard, so "Copy game" and "Copy position" show "Could not copy": expected, not a bug.
4. Nothing hot-reloads here: a code change needs a new `npm run build` and a restart.

## On the user's own machine

Give a cloud-session user these, filling in the branch:

```bash
git fetch origin && git checkout <branch>
npm install
cp .env.example .env      # then paste your Anthropic key into .env
npm run dev               # open http://localhost:5173
```

## If something is off

| Symptom | Cause and fix |
| --- | --- |
| Vite refuses to start, or syntax errors from a dependency | Node is older than 20.19: step 1 |
| `EADDRINUSE` on 3001 or 5173 | something is already listening: step 4 |
| Chat says "The grandmasters are not available right now" | no usable `ANTHROPIC_API_KEY` in `.env`: step 3 |
| Board shows but no eval bar or engine lines | the engine file is not served: `npm install`, restart, redo step 6 |
| An access-code box appears locally | `BETA_PASSCODE` is set in `.env` or the shell: clear it and restart |
| A server change does not show up | a stale API server is still running: step 4 |
