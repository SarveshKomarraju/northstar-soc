# NORTHSTAR — AI Report Grading Server

Grades your Credential Theft incident report with a real AI model, in
Marcus Webb's voice, out of 100. Runs locally on your own machine —
NORTHSTAR itself has no backend (see `project-overview.md`), so this
tiny server is the only thing that ever talks to an AI model, and (if
you use the paid option below) the only place an API key would live.

By default this uses **Ollama** — a free, local AI model that runs
entirely on your own machine. No API key, no account, no cost, no
internet connection required once the model is downloaded.

## Setup (one-time)

1. Install Ollama: https://ollama.com/download
2. Pull a model (this downloads it once, a few GB):
   ```
   ollama pull llama3.1
   ```
3. Make sure you have Node.js installed (you do — the game's dev tools
   already require it).

That's it — no API key needed for the default setup.

## Every time you want a graded ending

1. Make sure Ollama is running (it usually starts automatically after
   install, and stays running in the background/system tray).
2. Open a terminal in the `SOC-Command-Center` folder.
3. Start the grading server: `node ai-server/grade-report.js`
   - Leave this window open. It just listens on
     `http://localhost:8787` and waits.
   - On startup it checks that Ollama is reachable and that the model
     you configured is actually installed, and tells you plainly if
     either isn't true.
4. Play the game as normal, in your browser, same as always.
5. When you reach the Nightfall ending sequence (re-detonate
   `invoice_viewer.ps1` after Marcus accepts your report), the game
   calls this server in the background and your score appears on the
   victory screen once it's done grading. A local model can take
   30–90 seconds depending on your machine — that's normal.

If the server isn't running, or the grading call fails for any reason
(Ollama not running, model not pulled, bad response), the ending says
so plainly instead of making up a score — you'll always know whether a
score you're looking at is real.

## Configuration (optional)

Environment variables, set in the same terminal before starting the
server (PowerShell: `$env:NAME = "value"`, cmd.exe: `set NAME=value`):

- `OLLAMA_MODEL` — which local model to grade with. Defaults to
  `llama3.1`. Must match a model you've actually pulled (`ollama list`
  shows what's installed; `ollama pull <name>` to get another one).
  Bigger/newer models (e.g. `llama3.1:70b`, `qwen2.5:14b`) generally
  grade more carefully but run slower.
- `OLLAMA_BASE_URL` — where Ollama is listening. Defaults to
  `http://localhost:11434`, which is Ollama's own default — you
  shouldn't need to change this unless you've reconfigured Ollama
  itself.
- `GRADER_TIMEOUT_MS` — how long the server waits for the model before
  giving up. Defaults to `120000` (2 minutes). Raise this if you're
  running a large model on a slow machine and grading keeps timing
  out.
- `NORTHSTAR_GRADER_PORT` — which port to listen on. Defaults to
  `8787`. Only change this if something else on your machine is
  already using that port (and if you do, `engine/ReportGrader.js`
  needs the same port — see the constant near the top of that file).

## Optional: use Anthropic's Claude instead

Ollama is free but grades with a smaller model than a hosted frontier
model — if you'd rather pay for sharper, more consistent grading, you
can switch providers:

1. Get an API key at https://console.anthropic.com/
2. Set two environment variables before starting the server:
   - PowerShell: `$env:AI_PROVIDER = "anthropic"` and
     `$env:ANTHROPIC_API_KEY = "sk-ant-..."`
   - cmd.exe: `set AI_PROVIDER=anthropic` and
     `set ANTHROPIC_API_KEY=sk-ant-...`
3. Start the server the same way: `node ai-server/grade-report.js`

Optional with this provider: `ANTHROPIC_MODEL` — which Claude model to
grade with. Defaults to `claude-sonnet-4-5-20250929`. If grading starts
failing with a model error, check
https://docs.claude.com/en/docs/about-claude/models for current model
IDs and set this instead of editing the script.

## What actually gets sent to the model

Only what's needed to grade one report: the subject/body you wrote, the
real facts of that playthrough (affected user/host/attacker identity),
a log of the isolate/terminate/quarantine actions you took, and your
evidence-completion counts. With the default Ollama setup this never
leaves your machine at all. Nothing about your machine, your account,
or any other file is ever sent.
