/* =========================================================
   NORTHSTAR SOC — AI REPORT GRADER (client side)
   File: engine/ReportGrader.js

   Gathers the real facts of the current playthrough — the
   report the player actually sent Marcus, the true identity of
   the affected user/host/attacker, the real isolate/terminate/
   quarantine action log (already scored by EndpointStore/
   MailStore), and evidence completion — and asks the local
   grading server (ai-server/grade-report.js) to have a real AI
   grade it out of 100 in Marcus's voice.

   This is a plain script, not an ES module (matches
   NightfallEnding.js/ScenarioBriefing.js's convention), so it
   reads all its ground truth through the same window.* globals
   every other plain script in this game already uses —
   window.mailStore, window.endpointStore, window.eventEngine,
   window.playbookStore. Nothing here is invented; if a store
   isn't ready yet, that shows up as missing facts rather than
   guessed ones.

   The actual grading call only ever happens on YOUR machine:
   this posts to http://localhost:8787/grade, a tiny local
   server you run yourself (see ai-server/grade-report.js). If
   that server isn't running, or the AI call fails for any
   reason, gradeReport() resolves to { ok: false, error } — it
   never fabricates a score. Callers (NightfallEnding.js) are
   expected to show that failure plainly rather than pretend.

   Exposes: window.NorthstarReportGrader.gradeReport()
   → Promise<{ ok: true, grade } | { ok: false, error }>
   ========================================================= */

(function () {

    "use strict";

    const GRADER_URL = "http://localhost:8787/grade";
    const REQUEST_TIMEOUT_MS = 130000;

    /*
     * Grade once per session and reuse the result — the report
     * being graded is already sent and final by the time this
     * is ever called (gated on getReportsSent().length > 0 by
     * MalwareSandboxApp.js), so there's no reason to re-spend an
     * API call if the ending sequence gets launched more than
     * once.
     */
    let cachedPromise = null;


    /* =====================================================
       GROUND TRUTH
       ===================================================== */

    function getMostRecentReport() {

        const reports =
            window.mailStore?.getReportsSent?.() || [];

        if (!reports.length) {
            return null;
        }

        return reports[reports.length - 1];

    }

    function getCompromisedHostFacts() {

        const hosts =
            window.endpointStore?.getHosts?.() || [];

        const host =
            hosts.find(item => item.compromised) || null;

        if (!host) {

            return {
                hostname: null,
                hostIp: null,
                hostMac: null,
                userName: null,
                username: null,
                userEmail: null
            };

        }

        const user =
            window.endpointStore?.getUser?.(host.assignedUser) || null;

        return {
            hostname: host.hostname || null,
            hostIp: host.ip || null,
            hostMac: host.mac || null,
            userName: user?.displayName || null,
            username: user?.username || host.assignedUser || null,
            userEmail: user?.email || null
        };

    }

    /*
     * The attacker's identity/IP/country never lives on a
     * persistent object the way host.compromised does — it's
     * only ever attached to the events AttackEngine emits
     * (sourceIP/sourceCountry/actor on any ATTACKER-authored
     * event). Those events live in EventEngine's real log
     * (window.eventEngine), same source Playbook already
     * trusts for its own incident facts — so the first
     * ATTACKER-authored event tells us who this campaign
     * actually was.
     */
    function getAttackerFacts() {

        const events =
            window.eventEngine?.getAllEvents?.() || [];

        const attackerEvent =
            events.find(event => event.actorType === "ATTACKER");

        if (!attackerEvent) {

            return {
                attackerName: null,
                attackerIp: null,
                attackerCountry: null
            };

        }

        return {
            attackerName: attackerEvent.actor || null,
            attackerIp: attackerEvent.sourceIP || null,
            attackerCountry: attackerEvent.sourceCountry || null
        };

    }

    function getActionLog() {

        return {

            endpointScore:
                window.endpointStore?.getScore?.() ?? 0,

            endpointLog:
                window.endpointStore?.getScoreLog?.() || [],

            mailScore:
                window.mailStore?.getScore?.() ?? 0,

            mailLog:
                window.mailStore?.getScoreLog?.() || []

        };

    }

    function getEvidenceFacts() {

        const nightfallStatus =
            window.playbookStore?.getNightfallEvidenceStatus?.() || [];

        const lockedStatus =
            window.playbookStore?.getLockedEvidenceStatus?.() || [];

        return {

            nightfallCaptured:
                nightfallStatus.filter(item => item.captured).length,

            nightfallTotal:
                nightfallStatus.length,

            lockedUnlocked:
                lockedStatus.filter(item => item.unlocked).length,

            lockedTotal:
                lockedStatus.length

        };

    }

    function buildPayload() {

        const report = getMostRecentReport();

        if (!report) {
            return null;
        }

        return {

            report: {
                to: report.to,
                subject: report.subject,
                body: report.body
            },

            groundTruth: {
                ...getCompromisedHostFacts(),
                ...getAttackerFacts()
            },

            actionLog: getActionLog(),

            evidence: getEvidenceFacts()

        };

    }


    /* =====================================================
       GRADE
       ===================================================== */

    function gradeReport() {

        if (cachedPromise) {
            return cachedPromise;
        }

        cachedPromise = performGrade();

        return cachedPromise;

    }

    async function performGrade() {

        const payload = buildPayload();

        if (!payload) {

            return {
                ok: false,
                error: "No incident report found on record to grade."
            };

        }

        const controller = new AbortController();

        const timeout =
            setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {

            const response =
                await fetch(GRADER_URL, {

                    method: "POST",
                    signal: controller.signal,

                    headers: {
                        "content-type": "application/json"
                    },

                    body: JSON.stringify(payload)

                });

            const data =
                await response.json().catch(() => null);

            if (!response.ok || !data) {

                return {
                    ok: false,
                    error:
                        data?.error ||
                        `Grading server returned HTTP ${response.status}.`
                };

            }

            if (data.error) {

                return { ok: false, error: data.error };

            }

            return { ok: true, grade: data };

        } catch (error) {

            const isAbort =
                error.name === "AbortError";

            return {

                ok: false,

                error:
                    isAbort
                        ? "Grading timed out. Is ai-server/grade-report.js running? (A local Ollama model can take a while on a slower machine — try again, or see ai-server/README.md.)"
                        : "Couldn't reach the grading server on localhost:8787. Is ai-server/grade-report.js running? (See ai-server/README.md.)"

            };

        } finally {

            clearTimeout(timeout);

        }

    }


    window.NorthstarReportGrader = { gradeReport };

})();
