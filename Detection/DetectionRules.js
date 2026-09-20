/* =========================================================
   SOC COMMAND CENTER
   DETECTION RULES

   Detection rules analyze correlated SIEM telemetry.

   They DO NOT generate raw events.
   They determine whether existing events represent
   suspicious behavior.
   ========================================================= */


/* =========================================================
   HELPERS
   ========================================================= */

function withinWindow(
    events,
    seconds
) {

    if (!events.length) {
        return false;
    }


    const timestamps =
        events.map(
            event =>
                new Date(
                    event.timestamp
                ).getTime()
        );


    const earliest =
        Math.min(...timestamps);

    const latest =
        Math.max(...timestamps);


    return (
        latest - earliest
    ) <= seconds * 1000;
}


function sameValue(
    events,
    field
) {

    const values =
        events
            .map(event => event[field])
            .filter(Boolean);


    if (!values.length) {
        return true;
    }


    return values.every(
        value =>
            value === values[0]
    );
}


/* =========================================================
   RULE: BRUTE FORCE
   ========================================================= */

export function detectBruteForce(events) {

    const failures =
        events.filter(
            event =>
                event.eventType ===
                "AUTH_FAILURE"
        );


    if (failures.length < 3) {
        return null;
    }


    const recent =
        failures.slice(-5);


    if (
        !withinWindow(
            recent,
            90
        )
    ) {

        return null;

    }


    if (
        !sameValue(
            recent,
            "username"
        )
    ) {

        return null;

    }


    if (
        !sameValue(
            recent,
            "sourceIP"
        )
    ) {

        return null;

    }


    return {

        ruleId:
            "DET-BRUTE-001",

        title:
            "Possible Brute-Force Attack",

        description:
            "Multiple failed authentication attempts were observed against the same account from the same source.",

        severity:
            "HIGH",

        evidence:
            recent

    };
}


/* =========================================================
   RULE: SUSPICIOUS LOGIN
   ========================================================= */

export function detectSuspiciousLogin(events) {

    const successes =
        events.filter(
            event =>
                event.eventType ===
                "AUTH_SUCCESS"
        );


    if (!successes.length) {
        return null;
    }


    const success =
        successes[
        successes.length - 1
        ];


    const failures =
        events.filter(
            event =>

                event.eventType ===
                "AUTH_FAILURE" &&

                event.username ===
                success.username &&

                event.sourceIP ===
                success.sourceIP

        );


    if (failures.length < 2) {
        return null;
    }


    const evidence = [
        ...failures.slice(-3),
        success
    ];


    if (
        !withinWindow(
            evidence,
            120
        )
    ) {

        return null;

    }


    return {

        ruleId:
            "DET-AUTH-001",

        title:
            "Suspicious Authentication Sequence",

        description:
            "A successful authentication followed multiple failed authentication attempts from the same source.",

        severity:
            "HIGH",

        evidence

    };
}


/* =========================================================
   RULE: PHISHING CHAIN
   ========================================================= */

export function detectPhishingChain(events) {

    const delivered =
        events.filter(
            event =>
                event.eventType ===
                "EMAIL_RECEIVED"
        );


    if (!delivered.length) {
        return null;
    }


    const email =
        delivered[
        delivered.length - 1
        ];


    const opened =
        events.find(
            event =>

                event.eventType ===
                "EMAIL_OPENED" &&

                event.username ===
                email.username

        );


    if (!opened) {
        return null;
    }


    const link =
        events.find(
            event =>

                event.eventType ===
                "SUSPICIOUS_LINK" &&

                event.username ===
                email.username

        );


    if (!link) {
        return null;
    }


    const evidence = [
        email,
        opened,
        link
    ];


    if (
        !withinWindow(
            evidence,
            180
        )
    ) {

        return null;

    }


    return {

        ruleId:
            "DET-PHISH-001",

        title:
            "Possible Phishing Activity",

        description:
            "A suspicious email was received, opened, and followed by interaction with a suspicious link.",

        severity:
            "HIGH",

        evidence

    };
}


/* =========================================================
   RULE: POST-AUTH PROCESS ACTIVITY
   ========================================================= */

export function detectPostAuthExecution(events) {

    const processEvents =
        events.filter(
            event =>
                event.eventType ===
                "PROCESS_START"
        );


    if (!processEvents.length) {
        return null;
    }


    const process =
        processEvents[
        processEvents.length - 1
        ];


    const authentication =
        events.find(
            event =>

                (
                    event.eventType ===
                    "AUTH_SUCCESS" ||

                    event.eventType ===
                    "AUTH_ANOMALY"
                ) &&

                event.username ===
                process.username

        );


    if (!authentication) {
        return null;
    }


    const evidence = [
        authentication,
        process
    ];


    if (
        !withinWindow(
            evidence,
            180
        )
    ) {

        return null;

    }


    return {

        ruleId:
            "DET-EXEC-001",

        title:
            "Suspicious Post-Authentication Process",

        description:
            "Process execution occurred shortly after suspicious authentication activity.",

        severity:
            "HIGH",

        evidence

    };
}


/* =========================================================
   RULE: POSSIBLE ACCOUNT COMPROMISE
   ========================================================= */

export function detectAccountCompromise(events) {

    const authAnomaly =
        events.find(
            event =>
                event.eventType ===
                "AUTH_ANOMALY"
        );


    const process =
        events.find(
            event =>
                event.eventType ===
                "PROCESS_START"
        );


    const dns =
        events.find(
            event =>
                event.eventType ===
                "DNS_QUERY"
        );


    if (
        !authAnomaly ||
        !process ||
        !dns
    ) {

        return null;

    }


    const evidence = [
        authAnomaly,
        process,
        dns
    ];


    if (
        !withinWindow(
            evidence,
            300
        )
    ) {

        return null;

    }


    return {

        ruleId:
            "DET-COMP-001",

        title:
            "Possible Account Compromise",

        description:
            "Suspicious authentication, process execution, and endpoint network activity were correlated on the same host.",

        severity:
            "CRITICAL",

        evidence

    };
}


/* =========================================================
   ALL RULES
   ========================================================= */

export const DETECTION_RULES = [

    detectBruteForce,

    detectSuspiciousLogin,

    detectPhishingChain,

    detectPostAuthExecution,

    detectAccountCompromise

];