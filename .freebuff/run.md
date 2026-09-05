# Run doc — Freebuff Voice local preview

Two processes: FastAPI backend (:8000) and Vite dev server (:5173, proxies `/api` → :8000).
Local `mongod` on :27017 must be running (it is a system service on this machine; no Docker).

## Reproduce the artifacts (fresh checkout)

1. **Env file**: copy `.env.example` → `.env` in the project root and adapt:
   - `MONGODB_URI=mongodb://localhost:27017` (local mongod, not the compose hostname)
   - `STT_BACKEND=mock`, `TTS_BACKEND=mock` (no model downloads; real models per README)
   - paste your `OPENROUTER_API_KEY` if you want live conversation
   - `VITE_API_URL=http://localhost:8000`
2. **Backend deps**: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
3. **Dashboard deps**: `cd dashboard && npm install`
4. **Mongo**: `mongod` listening on 27017 (already a launchd service here).

## Run the servers (detached) — what works on this machine

Plain `nohup … &` from the command runner gets reaped, and `launchctl submit`
jobs hit `Operation not permitted` (macOS TCC) on `backend/.venv` under
`~/Desktop`, so use these two recipes instead. Both keep the shell's file
access while outliving the conversation:

**Backend** (double-fork daemonize via the venv python, keeps TCC grants):

```bash
cd backend && .venv/bin/python -c "
import os, sys
if os.fork() > 0: sys.exit(0)
os.setsid()
if os.fork() > 0: sys.exit(0)
os.dup2(os.open('/dev/null', os.O_RDONLY), 0)
log = os.open('../.freebuff/backend-preview.log', os.O_WRONLY|os.O_CREAT|os.O_APPEND, 0o644)
os.dup2(log, 1); os.dup2(log, 2)
os.execv('.venv/bin/uvicorn', ['.venv/bin/uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'])
"
```

**Dashboard** (node `spawn` with `detached: true` — resolves the vite.js path
directly, no npx/PATH dependency):

```bash
cd dashboard && /usr/local/bin/node -e "
const {spawn} = require('child_process');
const out = require('fs').openSync('../.freebuff/preview.log','a');
const child = spawn('/usr/local/bin/node', ['node_modules/vite/bin/vite.js','--port','5173','--strictPort'], {cwd: process.cwd(), detached: true, stdio: ['ignore', out, out]});
child.unref(); console.log('vite pid=' + child.pid);
"
```

- Verify: `curl -s localhost:8000/health` returns JSON; `curl -s localhost:5173` returns the app HTML.
- Register the **vite** pid (port 5173) as the preview; backend log: `.freebuff/backend-preview.log`.
- Tests: `cd backend && .venv/bin/python -m pytest` (31 tests).

## Notes

- Dashboard dev URL: http://localhost:5173 · API docs: http://localhost:8000/docs
- The Voice Lab tab talks to the agent in-browser; with mock TTS it shows the
  transcript loop but stays silent until real STT/TTS backends are configured.
- Campaigns with 0 leads complete instantly when started — upload a leads CSV
  (docs/sample-leads.csv) first, then Start.
