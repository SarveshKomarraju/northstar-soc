/* =========================================================
   NORTHSTAR SOC — INCIDENT RESPONSE PLAYBOOK CONTENT
   File: playbook/data/playbookContent.js

   Real content for a real reference document, structured on
   the NIST SP 800-61 incident response lifecycle. Every
   phase names the specific NORTHSTAR app and action an
   analyst should actually take — this is meant to be read
   and followed, not just glanced at.
   ========================================================= */

export const PLAYBOOK_PAGES = [

    {
        id: "cover",
        kind: "cover",
        title: "Incident Response Playbook",
        subtitle: "NORTHSTAR Security Operations Center",
        body: [
            "This playbook walks you through a full incident from first alert to final report, using the tools already on your desktop. It follows the same five phases every real SOC uses: Preparation, Identification, Investigation, Containment, and Recovery — ending with the report you'll actually hand off.",
            "You don't need to read it front to back. Jump to whichever phase matches where you are right now."
        ]
    },

    {
        id: "toolkit",
        kind: "section",
        number: "1",
        title: "Preparation — Your Toolkit",
        body: [
            "Before an incident starts, know what each tool is actually for. They're built to hand off to each other — an IP you find in one almost always means something in another."
        ],
        tools: [
            { app: "SIEM", use: "The raw event feed. Every action in the simulation — logins, phishing sends, process starts, file drops — lands here first, before anything is triaged or scored." },
            { app: "Alerts", use: "The triaged queue. Detection rules turn raw SIEM events into scored alerts (LOW through CRITICAL) — this is where you'll usually start an investigation, not the SIEM." },
            { app: "Attack Map", use: "Shows where authentication traffic is coming from, worldwide. Real threats only reveal themselves here the moment they're actually active — it won't hand you the answer at a glance." },
            { app: "Mail", use: "The inbox you're investigating phishing from. Headers, sender domains, and links all carry real evidence — read them like an analyst would, not just the subject line." },
            { app: "Endpoints", use: "Host-level detail: processes, users, network activity, and the Isolate / Terminate actions that actually affect the live simulation." },
            { app: "VPN", use: "Every remote session across every user at once — the only place you can spot the same external IP being used by more than one account." },
            { app: "File Explorer", use: "The filesystem on a specific host. Dropped files, hashes, and paths — the physical evidence a compromise leaves behind." },
            { app: "Network", use: "Raw packet capture. When you need to see the actual traffic, not just a summary of it." }
        ]
    },

    {
        id: "identification",
        kind: "section",
        number: "2",
        title: "Identification",
        body: [
            "An incident starts with a signal, not a conclusion. Your job here is to notice something's worth investigating — not yet to know what it is."
        ],
        checklist: [
            "Open Alerts. Anything sitting at HIGH or CRITICAL that isn't already being worked?",
            "Check the SIEM for a sudden jump in event volume, or a cluster of events sharing the same attackId.",
            "If Mail shows a phishing email that's been opened, that's a live thread — follow it.",
            "A pulse on the Attack Map means something is happening right now, not in the past."
        ]
    },

    {
        id: "investigation",
        kind: "section",
        number: "3",
        title: "Investigation",
        body: [
            "This is where most of your time goes. The goal: turn a vague alert into concrete facts — which host, which account, which external IP, and what they actually did."
        ],
        checklist: [
            "Open the affected host in Endpoints. Check its Security tab for the alert that brought you here, then Processes and Timeline for what actually happened.",
            "If a process looks suspicious, check who or what started it before touching anything — the Terminate button has a real, permanent effect.",
            "Pull the source IP from wherever you found it and check VPN — has that same IP touched more than one account?",
            "Check File Explorer on the same host. A real compromise usually drops a real file — find it, and note its hash and path.",
            "Only once you have a concrete IP does the Attack Map become useful — go find that exact node and confirm what it's doing right now."
        ]
    },

    {
        id: "containment",
        kind: "section",
        number: "4",
        title: "Containment",
        body: [
            "Once you're confident a host or account is actually compromised — not just suspicious — stop it from getting worse. Both actions below are real: they change what the simulation does next, not just what you see."
        ],
        checklist: [
            "Isolate the host in Endpoints. This cuts it off from the network — it can no longer be used to spread to other machines.",
            "Terminate the malicious process, if you can positively identify it. This stops the attacker's post-compromise activity on that specific host.",
            "Acting on the wrong host or the wrong process has a real cost — don't isolate or terminate on a guess."
        ]
    },

    {
        id: "recovery",
        kind: "section",
        number: "5",
        title: "Eradication & Recovery",
        body: [
            "Once the immediate threat is contained, clean up and bring the host back online.",
        ],
        checklist: [
            "Confirm no further activity is occurring on the host — check its Timeline for anything after your containment action.",
            "Unisolate the host once you're confident it's clean. It returns to COMPROMISED status, not ONLINE, until the underlying issue is actually resolved.",
            "Note anything you'd want a future analyst to know before you move on — that's what the report on the next page is for."
        ]
    },

    {
        id: "report",
        kind: "report",

        /*
         * What Marcus actually wants in the report — same list
         * he opens the scenario with (main-menu/ScenarioBriefing.js's
         * "credential-theft" entry). Kept here as the single
         * source of truth for the Playbook; ScenarioBriefing.js
         * hardcodes its own copy since it's a plain script, not
         * an ES module — see the comment there.
         */
        checklist: [
            "Affected user's full name",
            "Affected user's IP address",
            "Affected user's MAC address",
            "Attacker's source IP address",
            "Attacker's source country",
            "A screenshot or recording of every Nightfall phishing page (Malware Sandbox → 📷/⏺ → attach from Mail's Upload picker)",
            "Both locked shared-evidence files cracked in Password Cracker and attached",
            "Whether the account was actually compromised, confirmed — not assumed",
            "What containment action was taken"
        ]
    }

];