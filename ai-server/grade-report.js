#!/usr/bin/env node
/* =========================================================
   NORTHSTAR SOC — INCIDENT REPORT GRADING SERVER
   File: ai-server/grade-report.js

   A small local HTTP server that grades the player's
   Credential Theft incident report with a real AI call, acting
   as Marcus Webb. Supports two providers — pick with the
   AI_PROVIDER env var:

     - "ollama"    (default) — a local model running on YOUR
                    machine via Ollama. Completely free, fully
                    offline, no API key or signup at all.
     - "anthropic" — Claude via Anthropic's API. Costs money per
                    call and needs an API key, but is generally
                    more reliable at following the grading format.

   WHY THIS FILE EXISTS AT ALL:
   NORTHSTAR is a static, no-build-step browser game (see
   project-overview.md) — there is no backend. A browser page
   cannot safely hold a real API key (anyone could open devtools
   and read it), and a cloud AI API does not allow being called
   directly from a page's origin (no CORS support for browser
   calls). So this tiny server runs on YOUR machine and is the
   only thing that ever talks to the model. The game (engine/
   ReportGrader.js) just calls http://localhost:8787/grade with
   the facts of your playthrough and gets a graded JSON result
   back.

   HOW TO RUN IT — OLLAMA (default, free, offline):
   1. Install Ollama if you haven't: https://ollama.com
   2. Pull a model that's good at following instructions and
      producing valid JSON, e.g.:
        ollama pull llama3.1
      (any reasonably capable instruct model works — see
      OLLAMA_MODEL below to use a different one you already have)
   3. Make sure Ollama itself is running (it usually starts on
      login; if not, just open the Ollama app once).
   4. From the SOC-Command-Center folder:
        node ai-server/grade-report.js
      Leave that terminal window open while you play.
   5. Play normally. When you reach the Nightfall ending sequence,
      the game calls this server in the background; the score
      shows up on the victory screen.

   HOW TO RUN IT — ANTHROPIC (paid, needs a key):
   1. Get an API key from https://console.anthropic.com/
   2. In the same terminal you'll run this from:
        PowerShell:   $env:AI_PROVIDER = "anthropic"; $env:ANTHROPIC_API_KEY = "sk-ant-..."
        cmd.exe:      set AI_PROVIDER=anthropic && set ANTHROPIC_API_KEY=sk-ant-...
   3. node ai-server/grade-report.js, same as above.

   Either way: if this server isn't running (or the AI call fails
   for any reason — bad key, model not pulled, no internet), the
   game does NOT fake a score. The victory screen says grading
   wasn't reachable and explains why, so you always know whether
   what you're looking at is a real AI grade or not.

   With the Ollama provider, nothing about your report or
   playthrough leaves your machine at all. With the Anthropic
   provider, it's sent only directly to Anthropic's API, from
   your own machine, using your own key. This file never writes
   any key anywhere.
   ========================================================= */

"use strict";

const http = require("http");

const PORT = Number(process.env.NORTHSTAR_GRADER_PORT) || 8787;

const PROVIDER =
    (process.env.AI_PROVIDER || "ollama").trim().toLowerCase();

/*
 * How long to wait on the model before giving up. Local models
 * (Ollama, especially on CPU-only machines) can be meaningfully
 * slower than a cloud API, so this defaults generously. The
 * game's own client-side timeout (engine/ReportGrader.js) is set
 * a bit longer than this, so a timeout here reaches the player
 * as a real "grading failed" message instead of the client
 * giving up first and racing this response.
 */
const REQUEST_TIMEOUT_MS =
    Number(process.env.GRADER_TIMEOUT_MS) || 120000;

/* --- Ollama config --- */
const OLLAMA_BASE_URL =
    (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL =
    process.env.OLLAMA_MODEL || "llama3.1";

/* --- Anthropic config --- */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";


/* =========================================================
   THE RUBRIC — single source of truth for how Marcus grades.
   Mirrors the same list shown to the player in the intro
   briefing and the Playbook's "What Marcus Needs" checklist
   (see main-menu/ScenarioBriefing.js and
   playbook/data/playbookContent.js) — this is that checklist,
   turned into actual grading instructions, plus how much each
   part is worth and what "wrong" costs versus "missing."
   ========================================================= */

const SYSTEM_PROMPT = `You are Marcus Webb, Chief Information Security Officer at Northstar, grading an incident report submitted by John Smith, a security analyst on your team, after a credential-phishing incident ("Operation Nightfall"). You will be given the ground truth of what actually happened in the simulation, a log of the real actions the analyst took (with the game's own scoring of each), how much of the required evidence they attached, and the literal subject line and body text they wrote and sent you.

Grade it like a real incident report a real CISO would review — not a quiz. The subject line matters (would you even open this at a glance?). A vague or generic write-up should score far worse than one that is specific, accurate, and reads like it was written by someone who actually did the work. Getting a fact wrong (stating the wrong IP, the wrong user, the wrong country) is worse than leaving it out — a confident wrong answer in a real incident report is actively dangerous. Likewise, an action that hurt an innocent user or system (isolating a host that wasn't compromised, quarantining a legitimate email) should weigh far more heavily against the score than simply not catching something — that already matches how this game's own tools score those actions internally (isolating/terminating correctly is worth +10, doing it to something innocent costs -15; the same asymmetry should show up in your grade). Small things matter: correct spelling of a hostname or IP, whether the report is addressed and signed like a real one, whether recommendations are concrete rather than generic advice.

Score out of exactly 100, split across these five categories (use the max for each as the ceiling, not a target — most reports should NOT score the max in every category):

1. Identification accuracy (max 30) — does the report correctly and specifically state: the affected user's full name, their IP address, their MAC address, the attacker's IP address, and the attacker's source country? Award partial credit per correct fact; a fact stated confidently WRONG should score worse than a fact simply omitted.
2. Investigation & actions taken (max 25) — judged primarily from the real action log you're given (host isolation/process termination/email quarantine, each already scored by the game itself as correct or wrongful). Correct, justified actions score well; wrongful actions against innocent hosts/emails should drag this category down hard, proportional to how much damage the log shows they did.
3. Evidence & documentation (max 15) — based on the real capture/evidence counts you're given (Nightfall phishing-page screenshots/recordings out of 6, locked files cracked out of 2).
4. Report quality & professionalism (max 15) — is the subject line clear and specific, is the body actually structured like an incident report (not a one-liner), is the tone professional, is it something you could forward to leadership as-is?
5. Root cause & recommendations (max 15) — does it correctly explain HOW the compromise happened, and propose concrete, specific remediation/prevention steps (not generic "use strong passwords" filler)?

Respond with ONLY a single JSON object, no markdown fences, no other text, matching exactly this shape:
{
  "score": <integer 0-100, the sum of your category points>,
  "categories": [
    { "name": "Identification accuracy", "points": <int>, "max": 30, "notes": "<1-2 sentences, specific to what they actually wrote>" },
    { "name": "Investigation & actions taken", "points": <int>, "max": 25, "notes": "<...>" },
    { "name": "Evidence & documentation", "points": <int>, "max": 15, "notes": "<...>" },
    { "name": "Report quality & professionalism", "points": <int>, "max": 15, "notes": "<...>" },
    { "name": "Root cause & recommendations", "points": <int>, "max": 15, "notes": "<...>" }
  ],
  "strengths": ["<specific thing they got right>", "..."],
  "issues": ["<specific thing they got wrong or missed>", "..."],
  "verdict": "<2-4 sentences, in Marcus's voice, speaking directly to John about this specific report — reference the actual subject line or specific facts, don't be generic>"
}`;


/* =========================================================
   HTTP SERVER
   ========================================================= */

function withCors(res) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

}

function sendJson(res, statusCode, body) {

    withCors(res);
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));

}

function readRequestBody(req) {

    return new Promise((resolve, reject) => {

        let raw = "";

        req.on("data", chunk => {

            raw += chunk;

            /* Refuse anything absurd — this only ever carries one report. */
            if (raw.length > 2_000_000) {
                reject(new Error("Request body too large."));
                req.destroy();
            }

        });

        req.on("end", () => resolve(raw));
        req.on("error", reject);

    });

}

/*
 * Turns the structured facts the game sends into the actual
 * grading prompt. Kept separate from SYSTEM_PROMPT so the
 * per-request facts are clearly distinguished from the
 * standing grading instructions.
 */
function buildUserPrompt(payload) {

    const report = payload?.report || {};
    const groundTruth = payload?.groundTruth || {};
    const actionLog = payload?.actionLog || {};
    const evidence = payload?.evidence || {};

    const lines = [];

    lines.push("=== THE REPORT AS SUBMITTED ===");
    lines.push(`To: ${report.to || "(unknown)"}`);
    lines.push(`Subject: ${report.subject || "(no subject)"}`);
    lines.push("Body:");
    lines.push(report.body || "(empty)");
    lines.push("");

    lines.push("=== GROUND TRUTH (what actually happened — do not reveal this verbatim, use it to check the report) ===");
    lines.push(`Affected user: ${groundTruth.userName || "unknown"} (username: ${groundTruth.username || "unknown"}, email: ${groundTruth.userEmail || "unknown"})`);
    lines.push(`Affected host: ${groundTruth.hostname || "unknown"}, IP ${groundTruth.hostIp || "unknown"}, MAC ${groundTruth.hostMac || "unknown"}`);
    lines.push(`Attacker: ${groundTruth.attackerName || "unknown"}, source IP ${groundTruth.attackerIp || "unknown"}, source country ${groundTruth.attackerCountry || "unknown"}`);
    lines.push("");

    lines.push("=== ACTIONS TAKEN (real, already scored by the game itself) ===");
    lines.push(`Endpoint actions (isolate/terminate) net score: ${actionLog.endpointScore ?? 0}`);
    (actionLog.endpointLog || []).forEach(entry => {
        lines.push(`  [${entry.delta > 0 ? "+" : ""}${entry.delta}] ${entry.reason}`);
    });
    lines.push(`Mail actions (quarantine) net score: ${actionLog.mailScore ?? 0}`);
    (actionLog.mailLog || []).forEach(entry => {
        lines.push(`  [${entry.delta > 0 ? "+" : ""}${entry.delta}] ${entry.reason}`);
    });
    lines.push("");

    lines.push("=== EVIDENCE ATTACHED ===");
    lines.push(`Nightfall phishing-page captures: ${evidence.nightfallCaptured ?? 0} / ${evidence.nightfallTotal ?? 6}`);
    lines.push(`Locked evidence files cracked: ${evidence.lockedUnlocked ?? 0} / ${evidence.lockedTotal ?? 2}`);
    lines.push("");

    lines.push("Grade this report now, per your instructions, and return only the JSON object.");

    return lines.join("\n");

}

function stripCodeFences(text) {

    const trimmed = String(text || "").trim();

    const fenced =
        trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

    return fenced ? fenced[1] : trimmed;

}

/*
 * Some local models wrap valid JSON in a little chit-chat even
 * when asked not to ("Sure, here's the grade: { ... }"). This
 * pulls out the first {...} block as a fallback once stripping
 * code fences alone doesn't parse — Anthropic rarely needs this,
 * but small local models often do.
 */
function extractJsonObject(text) {

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1 || end < start) {
        return text;
    }

    return text.slice(start, end + 1);

}

function clampScore(value, fallback = 0) {

    const num = Number(value);

    if (!Number.isFinite(num)) return fallback;

    return Math.max(0, Math.min(100, Math.round(num)));

}

/*
 * Validates and normalizes the model's JSON so a malformed or
 * partial response never reaches the game as-is. Recomputes the
 * total from the category points when they're present and sane,
 * so a model arithmetic slip doesn't silently misreport a score.
 */
function normalizeGrade(parsed) {

    if (!parsed || typeof parsed !== "object") {
        return null;
    }

    const categories =
        Array.isArray(parsed.categories)
            ? parsed.categories
                .filter(c => c && typeof c.name === "string")
                .map(c => ({
                    name: c.name,
                    points: clampScore(c.points, 0),
                    max: Number.isFinite(Number(c.max)) ? Number(c.max) : null,
                    notes: typeof c.notes === "string" ? c.notes : ""
                }))
            : [];

    const categoryTotal =
        categories.length
            ? categories.reduce((sum, c) => sum + c.points, 0)
            : null;

    const score =
        categoryTotal !== null
            ? clampScore(categoryTotal, clampScore(parsed.score, 0))
            : clampScore(parsed.score, 0);

    return {
        score,
        categories,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(s => typeof s === "string") : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues.filter(s => typeof s === "string") : [],
        verdict: typeof parsed.verdict === "string" ? parsed.verdict : ""
    };

}

/*
 * Shared by both providers: given the model's raw text reply,
 * get back a validated grade or throw a clear error.
 */
function parseGradeFromText(rawText, { lenient = false } = {}) {

    const stripped = stripCodeFences(rawText);
    const jsonText = lenient ? extractJsonObject(stripped) : stripped;

    let parsed;

    try {
        parsed = JSON.parse(jsonText);
    } catch (parseError) {
        throw new Error(
            `Marcus's review came back in a format I couldn't read (${parseError.message}). Raw response: ${String(rawText).slice(0, 400)}`
        );
    }

    const grade = normalizeGrade(parsed);

    if (!grade) {
        throw new Error("Marcus's review came back empty or malformed.");
    }

    return grade;

}

function withTimeout(signalUser) {

    const controller = new AbortController();

    const timeout =
        setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    return {
        signal: controller.signal,
        done: () => clearTimeout(timeout)
    };

}


/* =========================================================
   PROVIDER — OLLAMA (local, free)
   ========================================================= */

async function getOllamaInstalledModels() {

    try {

        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

        if (!response.ok) return [];

        const data = await response.json();

        return (data.models || []).map(model => model.name);

    } catch {

        return [];

    }

}

async function callOllama(userPrompt) {

    const { signal, done } = withTimeout();

    try {

        let response;

        try {

            response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {

                method: "POST",
                signal,

                headers: { "content-type": "application/json" },

                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    stream: false,
                    format: "json",
                    options: {
                        temperature: 0.3,
                        num_predict: 1500
                    },
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: userPrompt }
                    ]
                })

            });

        } catch (networkError) {

            if (networkError.name === "AbortError") throw networkError;

            throw new Error(
                `Couldn't reach Ollama at ${OLLAMA_BASE_URL}. Is Ollama running? (${networkError.message})`
            );

        }

        if (!response.ok) {

            const bodyText = await response.text().catch(() => "");

            if (response.status === 404 && /model.*not found/i.test(bodyText)) {

                const installed = await getOllamaInstalledModels();

                throw new Error(
                    `Model "${OLLAMA_MODEL}" isn't pulled in Ollama.` +
                    (installed.length
                        ? ` Installed models: ${installed.join(", ")}. Set OLLAMA_MODEL to one of these.`
                        : ` Pull it first: ollama pull ${OLLAMA_MODEL}`)
                );

            }

            throw new Error(`Ollama returned HTTP ${response.status}: ${bodyText.slice(0, 300)}`);

        }

        const data = await response.json();
        const text = data?.message?.content || "";

        return parseGradeFromText(text, { lenient: true });

    } finally {

        done();

    }

}


/* =========================================================
   PROVIDER — ANTHROPIC (cloud, paid, needs a key)
   ========================================================= */

async function callAnthropic(userPrompt) {

    if (!ANTHROPIC_API_KEY) {

        throw new Error(
            "ANTHROPIC_API_KEY isn't set in this server's environment. " +
            "Set it before starting grade-report.js, or switch AI_PROVIDER back to \"ollama\"."
        );

    }

    const { signal, done } = withTimeout();

    try {

        const response = await fetch(ANTHROPIC_URL, {

            method: "POST",
            signal,

            headers: {
                "content-type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": ANTHROPIC_VERSION
            },

            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 1500,
                temperature: 0.3,
                system: SYSTEM_PROMPT,
                messages: [
                    { role: "user", content: userPrompt }
                ]
            })

        });

        const data = await response.json();

        if (!response.ok) {

            const message =
                data?.error?.message || `Anthropic API returned HTTP ${response.status}.`;

            throw new Error(message);

        }

        const text =
            (data.content || [])
                .filter(block => block.type === "text")
                .map(block => block.text)
                .join("\n");

        return parseGradeFromText(text);

    } finally {

        done();

    }

}


/* =========================================================
   PROVIDER DISPATCH
   ========================================================= */

function callAI(userPrompt) {

    if (PROVIDER === "anthropic") {
        return callAnthropic(userPrompt);
    }

    return callOllama(userPrompt);

}

const server = http.createServer(async (req, res) => {

    if (req.method === "OPTIONS") {
        withCors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url !== "/grade" || req.method !== "POST") {

        sendJson(res, 404, {
            error: "Not found. POST a grading payload to /grade."
        });

        return;

    }

    try {

        const raw = await readRequestBody(req);
        const payload = raw ? JSON.parse(raw) : {};
        const userPrompt = buildUserPrompt(payload);

        console.log(`[GRADER] (${PROVIDER}) Grading report:`, payload?.report?.subject || "(no subject)");

        const grade = await callAI(userPrompt);

        console.log("[GRADER] Score:", grade.score, "/ 100");

        sendJson(res, 200, grade);

    } catch (error) {

        const isAbort = error.name === "AbortError";

        console.error("[GRADER] Grading failed:", error.message);

        sendJson(res, 502, {
            error:
                isAbort
                    ? "The AI grading request timed out."
                    : (error.message || "Grading failed for an unknown reason.")
        });

    }

});

server.listen(PORT, async () => {

    console.log(`[GRADER] NORTHSTAR report grading server listening on http://localhost:${PORT}`);
    console.log(`[GRADER] Provider: ${PROVIDER}`);

    if (PROVIDER === "anthropic") {

        console.log(`[GRADER] Model: ${ANTHROPIC_MODEL}`);

        if (!ANTHROPIC_API_KEY) {

            console.warn(
                "[GRADER] WARNING: ANTHROPIC_API_KEY is not set. Grading requests will fail until it is."
            );

        }

    } else {

        console.log(`[GRADER] Model: ${OLLAMA_MODEL} (via ${OLLAMA_BASE_URL})`);

        const installed = await getOllamaInstalledModels();

        if (!installed.length) {

            console.warn(
                `[GRADER] WARNING: couldn't reach Ollama at ${OLLAMA_BASE_URL}, or it has no models installed. ` +
                "Make sure Ollama is running and you've pulled a model (e.g. `ollama pull llama3.1`)."
            );

        } else if (!installed.some(name => name === OLLAMA_MODEL || name.startsWith(`${OLLAMA_MODEL}:`))) {

            console.warn(
                `[GRADER] WARNING: "${OLLAMA_MODEL}" isn't among your installed Ollama models (${installed.join(", ")}). ` +
                `Either run "ollama pull ${OLLAMA_MODEL}" or set OLLAMA_MODEL to one of the installed ones.`
            );

        }

    }

});
