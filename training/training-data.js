/* =========================================================
   NORTHSTAR SOC — TRAINING DATA
   ---------------------------------------------------------
   Plain script (not a module) — same convention as
   ThreatIntelData.js / IAMData.js / MalwareSandboxData.js —
   so it can be loaded with a bare <script> tag ahead of
   TrainingApp.js and read off window.NorthstarTrainingData.

   Every app on the desktop gets one entry here: a short
   "what is this / why does it matter" overview, a
   `knowledgeCheck` (2 questions gating hands-on practice —
   the player has to show they actually absorbed the overview
   before Start Hands-On Practice unlocks), and a small
   self-contained hands-on `scenario` the player works through
   step by step.

   Every scenario ends with one "ingame" step — a small, static
   replica of the REAL in-game app, built out of that app's
   actual CSS classes (already loaded globally by index.html,
   so it renders with the real styling) and real button/column
   labels pulled directly from the app's own source. It's a
   non-interactive preview (pointer-events: none throughout)
   that bridges "here's the simplified practice version" to
   "here's exactly what you'll actually see on the desktop."

   Everything else (the practice steps themselves) runs on
   small, invented sample data rather than the live simulation
   stores — this runs from the Main Menu, before any real
   operation exists, and never touches eventEngine /
   networkStore / mailStore / etc.

   STEP SCHEMA
   ---------------------------------------------------------
   Every step has a `type` and a `title`. TrainingApp.js's
   runner knows five step types:

   "info"   — a short briefing. { body: [paragraphs], bullets? }
              Rendered with a single "Continue" button.

   "spot"   — a small table/list of rows; the player clicks the
              one row that answers `prompt`. { prompt, columns,
              rows: [{ id, cells, note? }], correctId, hint,
              successText, failText }
              `note` (optional, per row) is revealed only after
              that row is picked, right or wrong — used for a
              short "here's why" explanation.

   "quiz"   — multiple choice. { prompt, choices: [{id,text}],
              correctId, hint, successText, failText }

   "type"   — a free-text input checked against one or more
              accepted answers. { prompt, placeholder, accepted:
              [...], hint, successText, failText }

   "ingame" — the closing "here's the real thing" step. { intro,
              mockup (trusted, hand-authored HTML using the real
              app's own CSS classes), notes: [short bullets
              explaining what's what], outro }. Single
              "Continue" button, no right/wrong.

   Every non-"info"/"ingame" step may also carry `note` and
   `hint` text. Getting a "spot"/"quiz"/"type" step wrong never
   blocks progress — it shows the hint and lets the player try
   again, this is training, not a graded exam.

   KNOWLEDGE CHECK
   ---------------------------------------------------------
   `knowledgeCheck` is a short array of quiz-shaped questions
   ({ id, prompt, choices, correctId }) rendered in the Detail
   view, under the overview/skills text, before "Start Hands-On
   Practice" is reachable — the player has to answer every
   question correctly (retries allowed, same non-punitive
   pattern as the practice steps) at least once to unlock
   practice. Passing is remembered per app in
   localStorage["northstar-training-progress"].
   ========================================================= */

(function () {

    "use strict";


    const TIER_LABELS = {
        quick: "QUICK START",
        standard: "STANDARD",
        deep: "IN-DEPTH"
    };


    const APPS = {

        /* =================================================
           SIEM
           ================================================= */
        siem: {
            id: "siem",
            title: "SIEM",
            icon: "▤",
            accent: "#6fb2e0",
            tagline: "The correlated timeline every shift starts at",
            tier: "quick",
            estMinutes: 3,
            overview: [
                "SIEM stands for Security Information and Event Management. It's the one screen that pulls events from every other tool — mail, network, endpoints, VPN, IAM — into a single, time-ordered feed, so an analyst doesn't have to open ten apps just to see what happened first.",
                "Most real investigations don't start in Network or Mail. They start here: something in the correlated feed looks off, and the SIEM is what points you at which tool to open next."
            ],
            keySkills: [
                "Reading a correlated, multi-source timeline at a glance",
                "Recognizing which events are routine noise vs. worth a closer look",
                "Deciding what to investigate first when several things fire close together",
                "Knowing which tool to jump into once you've spotted something"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What's the main point of the SIEM, compared to opening Network, Mail, Endpoints, etc. one at a time?",
                    choices: [
                        { id: "a", text: "It replaces the other tools entirely" },
                        { id: "b", text: "It correlates events from every tool into one timeline, so you know where to look first" },
                        { id: "c", text: "It's just a backup copy of the Alerts queue" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "A real investigation most often starts in...",
                    choices: [
                        { id: "a", text: "The SIEM — something in the feed looks off, and it points you at what to open next" },
                        { id: "b", text: "The Password Cracker" },
                        { id: "c", text: "Whatever app you happen to click first" }
                    ],
                    correctId: "a"
                }
            ],
            scenario: {
                title: "First Look at the Timeline",
                briefing: "It's the start of a shift. Six events landed in the SIEM in the last ten minutes. Only one of them is worth chasing right now.",
                steps: [
                    {
                        type: "info",
                        title: "Reading the feed",
                        body: [
                            "Every row in the SIEM has a timestamp, a source app, and a short description — newest at the top, exactly like the real one on your desktop.",
                            "Most rows are completely normal: routine logins, scheduled scans, software updates. Your job is to find the row that doesn't fit that pattern."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Pick the priority event",
                        prompt: "Which of these six events deserves attention first?",
                        columns: ["TIME", "SOURCE", "EVENT"],
                        correctId: "e4",
                        hint: "Ignore anything that's clearly scheduled or automatic — look for a pattern that suggests someone was trying repeatedly, then got in.",
                        successText: "Right one. Five failed logins followed immediately by a success, from a login source that's never been seen for this account, is a classic sign of a guessed or sprayed password.",
                        failText: "That one's routine. Look again for a run of failures immediately followed by a success — that pattern is what stands out.",
                        rows: [
                            { id: "e1", cells: ["03:12:01", "Endpoints", "Antivirus definitions updated — WKS-14"], note: "Routine — scheduled AV updates happen automatically every few hours." },
                            { id: "e2", cells: ["03:14:22", "VPN", "Scheduled session heartbeat — 4 active tunnels"], note: "Routine — this is just the VPN reporting its normal keep-alive." },
                            { id: "e3", cells: ["03:15:47", "Mail", "Newsletter delivered to 12 recipients"], note: "Routine — internal mailing list, no attachments or links flagged." },
                            { id: "e4", cells: ["03:16:03", "IAM", "5 failed logins, then 1 success — user jrossi, new source"], note: "This is the one. Repeated failures then a success from a location this account has never logged in from is a strong compromise signal." },
                            { id: "e5", cells: ["03:17:10", "Endpoints", "Disk cleanup task completed — WKS-09"], note: "Routine — a normal scheduled maintenance task." },
                            { id: "e6", cells: ["03:19:55", "SIEM", "Nightly log rotation completed"], note: "Routine — housekeeping, not a security event." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "What now?",
                        prompt: "You've flagged the jrossi login pattern. What's the right next move?",
                        hint: "The SIEM tells you something is worth investigating — it isn't itself the place you dig into that specific account's access.",
                        successText: "Exactly — pivot into IAM (and Alerts, if one fired) to see what jrossi's account actually did after that login.",
                        failText: "Not quite — a pattern like this is worth chasing down, not dismissed or handled by rebooting anything.",
                        choices: [
                            { id: "a", text: "Note it and move on — it's probably nothing" },
                            { id: "b", text: "Open IAM to check the account, and watch for follow-on activity" },
                            { id: "c", text: "Reboot the SIEM server" }
                        ],
                        correctId: "b"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "Same idea, real desktop app: a live stat row, then a scrolling table of every correlated event as it happens.",
                        mockup: `
                            <div class="siem-stats">
                                <div class="siem-stat"><span>EVENTS</span><strong>1,204</strong></div>
                                <div class="siem-stat"><span>HIGH / CRITICAL</span><strong>3</strong></div>
                                <div class="siem-stat"><span>INCIDENTS</span><strong>1</strong></div>
                                <div class="siem-stat"><span>ENGINE</span><strong class="online">ONLINE</strong></div>
                            </div>
                            <div class="siem-table">
                                <div class="siem-table-header">
                                    <span>TIME</span><span>EVENT</span><span>SEVERITY</span><span>HOST</span><span>SOURCE</span><span>DESCRIPTION</span>
                                </div>
                                <div class="siem-events">
                                    <div class="siem-event-row">
                                        <span class="event-time">03:16:03</span>
                                        <span class="event-type">AUTH_FAILURE_THEN_SUCCESS</span>
                                        <span><b class="severity severity-HIGH">HIGH</b></span>
                                        <span class="event-host">WKS-14</span>
                                        <span class="event-ip">198.51.100.4</span>
                                        <span>5 failed logins then 1 success — user jrossi, new source</span>
                                    </div>
                                    <div class="siem-event-row">
                                        <span class="event-time">03:14:22</span>
                                        <span class="event-type">VPN_HEARTBEAT</span>
                                        <span><b class="severity severity-INFO">INFO</b></span>
                                        <span class="event-host">VPN-GW-01</span>
                                        <span class="event-ip">—</span>
                                        <span>Scheduled session heartbeat — 4 active tunnels</span>
                                    </div>
                                </div>
                            </div>
                        `,
                        notes: [
                            "The stat row up top (EVENTS / HIGH-CRITICAL / INCIDENTS) is the same \"how bad is it right now\" summary you'd check first each shift.",
                            "SEVERITY is color-coded — the HIGH badge on the jrossi row is exactly the kind of thing that should catch your eye scrolling through a live feed.",
                            "Use the search bar to filter by hostname, IP, username, or event type instead of scrolling — handy once the feed has hundreds of rows in it."
                        ],
                        outro: "That's the real SIEM — same correlated timeline you just practiced with, just live and constantly updating."
                    }
                ]
            }
        },


        /* =================================================
           ALERTS
           ================================================= */
        alerts: {
            id: "alerts",
            title: "Alerts",
            icon: "!",
            accent: "#e2555a",
            tagline: "The triage queue — decide what's real, fast",
            tier: "quick",
            estMinutes: 3,
            overview: [
                "The Alerts queue holds every automated detection the environment's rules have fired — one row per suspicious thing a sensor noticed. It's noisier than the SIEM on purpose: better to over-flag and let an analyst sort it out than miss something.",
                "Triage is the core skill here: deciding, quickly, which alerts are true positives worth escalating and which are false positives you can close out — and doing it in the right order, because a critical one buried under routine noise still needs to be found."
            ],
            keySkills: [
                "Reading severity and confidence on an alert",
                "Telling a true positive from a false positive",
                "Prioritizing multiple open alerts correctly",
                "Escalating instead of silently dismissing something real"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "Why is the Alerts queue deliberately noisier than it needs to be?",
                    choices: [
                        { id: "a", text: "It's a bug the team hasn't fixed yet" },
                        { id: "b", text: "It's safer to over-flag and let an analyst sort it out than to risk missing something real" },
                        { id: "c", text: "Every alert is guaranteed to be a true positive" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "Should severity alone decide what you work on first?",
                    choices: [
                        { id: "a", text: "Yes, always work strictly High/Critical before anything else, no exceptions" },
                        { id: "b", text: "No — severity is a starting point, but a lower-severity alert that matches something you already suspect can matter more" },
                        { id: "c", text: "No, severity is meaningless and can be ignored entirely" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Triage the Queue",
                briefing: "Five alerts are sitting open. You can only work one first — which one?",
                steps: [
                    {
                        type: "info",
                        title: "Severity isn't the whole story",
                        body: [
                            "Every alert carries a severity tag (Low/Medium/High/Critical) and a short reason it fired. Severity is a starting point, not the final word — a Low severity alert that matches something you already know is bad can matter more than a routine High.",
                            "In the real Alerts app you'd also cross-check against Threat Intel; here, treat the description as the whole picture."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Which alert first?",
                        prompt: "Pick the alert that should be escalated first.",
                        columns: ["SEVERITY", "ALERT"],
                        correctId: "a2",
                        hint: "Look past the severity label — one of these describes exactly the kind of login anomaly a real attacker produces.",
                        successText: "Correct. \"Impossible travel\" — the same account logging in from two locations too far apart to be the same person in that time window — is one of the strongest automated signals there is, whatever severity got auto-assigned to it.",
                        failText: "Take another look — one alert describes a login from two places that can't both be true at once. That's the one that matters most here.",
                        rows: [
                            { id: "a1", cells: ["Low", "Printer offline — 2nd floor MFP"], note: "False positive territory — a hardware status message, not a security event." },
                            { id: "a2", cells: ["Medium", "Impossible travel: user dbryant logged in from New York, then Warsaw 6 minutes later"], note: "This is the real one. No one travels that distance in 6 minutes — the account is very likely compromised." },
                            { id: "a3", cells: ["Low", "Scheduled backup job exceeded normal runtime"], note: "Almost certainly benign — backups sometimes just run long." },
                            { id: "a4", cells: ["Medium", "New device enrolled — matches known company laptop"], note: "Routine — it matched the expected asset profile." },
                            { id: "a5", cells: ["Low", "Software update rescheduled by user"], note: "Routine — a normal, user-initiated action." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Closing out the noise",
                        prompt: "One of the other four alerts is safe to close as a false positive with no further action. Which kind of alert is that, generally?",
                        hint: "Think about which of the alerts above describes something that isn't a security-relevant action at all.",
                        successText: "Right — a printer status message isn't a security event no matter what severity got attached to it. Closing it frees you up to focus on what matters.",
                        failText: "Not quite — think about which alert wasn't describing user or account activity at all.",
                        choices: [
                            { id: "a", text: "The printer-offline alert" },
                            { id: "b", text: "The impossible-travel alert" },
                            { id: "c", text: "Every alert needs full investigation regardless of content" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real queue is a stack of alert cards, newest first, with a summary strip up top so you can see how bad things look before reading a single card.",
                        mockup: `
                            <div class="alerts-summary">
                                <div class="alert-summary-card"><span class="summary-label">ACTIVE</span><strong>5</strong></div>
                                <div class="alert-summary-card"><span class="summary-label">HIGH</span><strong>1</strong></div>
                                <div class="alert-summary-card critical-card"><span class="summary-label">CRITICAL</span><strong>0</strong></div>
                                <div class="alert-summary-card"><span class="summary-label">TOTAL</span><strong>5</strong></div>
                            </div>
                            <article class="security-alert-card alert-medium">
                                <div class="alert-card-accent"></div>
                                <div class="alert-card-content">
                                    <div class="alert-card-header">
                                        <div class="alert-severity-badge">MEDIUM</div>
                                        <div class="alert-time">9/8/2026, 2:15 PM</div>
                                    </div>
                                    <div class="alert-card-title">Impossible travel: dbryant</div>
                                    <div class="alert-card-description">Login from New York, then Warsaw 6 minutes later.</div>
                                </div>
                            </article>
                            <article class="security-alert-card alert-low">
                                <div class="alert-card-accent"></div>
                                <div class="alert-card-content">
                                    <div class="alert-card-header">
                                        <div class="alert-severity-badge">LOW</div>
                                        <div class="alert-time">9/8/2026, 2:11 PM</div>
                                    </div>
                                    <div class="alert-card-title">Printer offline — 2nd floor MFP</div>
                                    <div class="alert-card-description">Device stopped responding to status polling.</div>
                                </div>
                            </article>
                        `,
                        notes: [
                            "The ACTIVE / HIGH / CRITICAL / TOTAL strip is the same at-a-glance summary from the practice — it's the first thing to check each time you open Alerts.",
                            "Each card's colored left edge and severity badge match its priority — scanning down the stack by color is often faster than reading every description."
                        ],
                        outro: "That's the real queue — same triage instinct you just practiced, just with a live stack of cards instead of a table."
                    }
                ]
            }
        },


        /* =================================================
           NETWORK  (deep — the user's own example app)
           ================================================= */
        network: {
            id: "network",
            title: "Network",
            icon: "⌁",
            accent: "#5fd0d6",
            tagline: "Packet capture — watch traffic, not just logs",
            tier: "deep",
            estMinutes: 8,
            overview: [
                "The Network app captures raw traffic and lets you inspect it packet by packet: timestamp, source and destination address, protocol, size, and a short description of what's inside. It's the closest thing in the game to ground truth — logs can be incomplete or tampered with, but a packet capture shows exactly what actually crossed the wire.",
                "It's also the most involved tool in the kit, which is exactly why it's worth the extra practice here. You'll start a capture, filter out the noise, spot a pattern that looks like a command-and-control beacon, and then find the moment it turns into an actual data transfer — the same escalation a real analyst walks through."
            ],
            keySkills: [
                "Starting a capture and reading the packet list's columns",
                "Filtering by protocol, port, or IP to cut through normal traffic",
                "Recognizing protocols that don't belong on a given host",
                "Spotting beaconing — small, regular check-ins to an unfamiliar address",
                "Catching the moment beaconing turns into a real data transfer (exfiltration)"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "Why is a packet capture considered closer to \"ground truth\" than a log file?",
                    choices: [
                        { id: "a", text: "Packet captures are always smaller than logs" },
                        { id: "b", text: "Logs can be incomplete or tampered with; a capture shows exactly what crossed the wire" },
                        { id: "c", text: "Logs don't exist in NORTHSTAR" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "What is \"beaconing\"?",
                    choices: [
                        { id: "a", text: "A one-time large file download" },
                        { id: "b", text: "Small, regular check-ins from malware to an external address, confirming it's alive and waiting for instructions" },
                        { id: "c", text: "A normal DNS lookup" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Catch the Beacon",
                briefing: "A workstation has been quietly phoning home. Find the connection, confirm it's malicious, and catch the moment it starts pulling data out.",
                steps: [
                    {
                        type: "info",
                        title: "Reading the capture",
                        body: [
                            "Every packet has TIME, SRC (source), DST (destination), PROTOCOL, and LENGTH, plus a short INFO note. A live capture fills this list continuously — the filter bar is what makes it usable, letting you narrow to one protocol, one host, or one direction of traffic.",
                            "You're looking at a capture already pulled from WKS-22, a normal analyst workstation. Most of what's in it is completely ordinary business traffic."
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Filter out the noise",
                        prompt: "Which of these protocols would be the most unusual thing to see on a normal office workstation?",
                        hint: "Three of these are everyday business traffic. One of them is a decades-old chat protocol that attackers have historically repurposed for command-and-control.",
                        successText: "Right — IRC has essentially no legitimate business use on a modern workstation. Seeing it at all is worth a second look before you even open the packet.",
                        failText: "Think about which protocol has no normal business reason to appear here at all.",
                        choices: [
                            { id: "a", text: "HTTPS" },
                            { id: "b", text: "DNS" },
                            { id: "c", text: "IRC" },
                            { id: "d", text: "SMB" }
                        ],
                        correctId: "c"
                    },
                    {
                        type: "spot",
                        title: "Find the beacon",
                        prompt: "Eight packets from WKS-22 in the last two minutes. One destination keeps reappearing at a suspiciously regular interval. Click it.",
                        columns: ["TIME", "DST", "PROTO", "LEN", "INFO"],
                        correctId: "p3",
                        hint: "Look for the same external IP showing up more than once, at almost exactly the same spacing each time, with a tiny, near-identical payload size.",
                        successText: "That's it — 185.203.117.42 checking in every ~30 seconds with a near-identical tiny payload is textbook beaconing: malware confirming it's still alive and waiting for instructions.",
                        failText: "Not this one — keep scanning for the address that reappears at a steady interval with a suspiciously consistent, small size.",
                        rows: [
                            { id: "p1", cells: ["14:02:01", "13.107.42.14", "HTTPS", "1,240", "Office365 sync"], note: "Normal — Microsoft 365 traffic, common destination range." },
                            { id: "p2", cells: ["14:02:04", "8.8.8.8", "DNS", "72", "Standard lookup"], note: "Normal — routine DNS resolution." },
                            { id: "p3", cells: ["14:02:07", "185.203.117.42", "TCP", "64", "Keep-alive, port 6667"], note: "This is the beacon. Port 6667 is IRC's classic port, the payload is tiny and near-identical, and this address recurs on a steady ~30s clock — none of that is normal business traffic." },
                            { id: "p4", cells: ["14:02:15", "172.217.14.238", "HTTPS", "3,410", "Web browsing"], note: "Normal — ordinary web traffic." },
                            { id: "p5", cells: ["14:02:37", "185.203.117.42", "TCP", "64", "Keep-alive, port 6667"], note: "Same beacon reappearing — roughly 30 seconds after the last one." },
                            { id: "p6", cells: ["14:02:41", "10.0.0.1", "DHCP", "342", "Lease renewal"], note: "Normal — internal network housekeeping." },
                            { id: "p7", cells: ["14:03:07", "185.203.117.42", "TCP", "64", "Keep-alive, port 6667"], note: "The beacon again — same ~30s spacing, same tiny size." },
                            { id: "p8", cells: ["14:03:12", "204.79.197.203", "HTTPS", "890", "Search query"], note: "Normal — ordinary search traffic." }
                        ]
                    },
                    {
                        type: "spot",
                        title: "Catch the escalation",
                        prompt: "The beacon just changed behavior. Four more packets to 185.203.117.42 followed — one of them is very different from the rest. Click it.",
                        columns: ["TIME", "DST", "PROTO", "LEN", "INFO"],
                        correctId: "q3",
                        hint: "Compare the LEN column — three of these are the same tiny heartbeat as before. One is enormous by comparison.",
                        successText: "Found it — a 64-byte heartbeat suddenly followed by a 48,000-byte outbound transfer is the beacon receiving an instruction and pulling data out. This is no longer just \"suspicious,\" it's an active incident.",
                        failText: "Look at the LEN column again — three packets are the same small size as the earlier beacon. One is far larger than the others.",
                        rows: [
                            { id: "q1", cells: ["14:03:37", "185.203.117.42", "TCP", "64", "Keep-alive, port 6667"], note: "Same tiny heartbeat as before." },
                            { id: "q2", cells: ["14:04:07", "185.203.117.42", "TCP", "64", "Keep-alive, port 6667"], note: "Same tiny heartbeat as before." },
                            { id: "q3", cells: ["14:04:19", "185.203.117.42", "TCP", "48,220", "Outbound data transfer"], note: "This is it — nearly 50KB out to the same C2 address, right after two routine heartbeats. That's the malware exfiltrating data or downloading a second-stage payload." },
                            { id: "q4", cells: ["14:04:37", "185.203.117.42", "TCP", "64", "Keep-alive, port 6667"], note: "Back to the small heartbeat — confirms the transfer above was a one-off event, not normal traffic to this host." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "What do you do with this?",
                        prompt: "You've confirmed beaconing to a known-bad IP and a large outbound transfer. What's the right next step?",
                        hint: "This is confirmed, active malicious traffic on a live host — the response should match that.",
                        successText: "Exactly right. Block the IP, isolate WKS-22 from the network, and escalate — this is the point where a capture becomes a real incident, not just a lead.",
                        failText: "This is confirmed malicious traffic leaving a real host — it needs to be contained and escalated, not left alone or just logged for later.",
                        choices: [
                            { id: "a", text: "Block 185.203.117.42 at the firewall, isolate WKS-22, and escalate" },
                            { id: "b", text: "Delete the capture, it's just noise" },
                            { id: "c", text: "Wait and see if it happens again before doing anything" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real Network app has the same idea but two more columns (a packet NO. and a separate SOURCE column) and a live capture toolbar and filter bar above the table.",
                        mockup: `
                            <div class="network-toolbar">
                                <div class="network-capture-controls">
                                    <button class="network-control-button start">▶ START</button>
                                    <button class="network-control-button pause">Ⅱ PAUSE</button>
                                    <button class="network-control-button stop">■ STOP</button>
                                </div>
                                <div class="network-stat"><span>CAPTURED</span><strong>1,204</strong></div>
                                <div class="network-stat"><span>DISPLAYED</span><strong>8</strong></div>
                                <div class="network-stat"><span>DROPPED</span><strong>0</strong></div>
                            </div>
                            <div class="network-filter">
                                <span class="network-filter-label">DISPLAY FILTER</span>
                                <input type="text" value="ip.addr == 185.203.117.42" readonly>
                                <span class="network-filter-status">3 MATCHES</span>
                            </div>
                            <div class="network-packet-table">
                                <div class="network-packet-header">
                                    <span>NO.</span><span>TIME</span><span>SOURCE</span><span>DESTINATION</span><span>PROTOCOL</span><span>INFO</span><span>LEN</span>
                                </div>
                                <div class="network-packet-list">
                                    <div class="network-packet-row">
                                        <span class="packet-number">214</span>
                                        <span class="packet-time">14:02:07</span>
                                        <span class="packet-source">WKS-22</span>
                                        <span class="packet-destination">185.203.117.42</span>
                                        <span class="packet-protocol packet-protocol-tcp">TCP</span>
                                        <span class="packet-info">Keep-alive, port 6667</span>
                                        <span class="packet-length">64</span>
                                    </div>
                                    <div class="network-packet-row">
                                        <span class="packet-number">238</span>
                                        <span class="packet-time">14:04:19</span>
                                        <span class="packet-source">WKS-22</span>
                                        <span class="packet-destination">185.203.117.42</span>
                                        <span class="packet-protocol packet-protocol-tcp">TCP</span>
                                        <span class="packet-info">Outbound data transfer</span>
                                        <span class="packet-length">48,220</span>
                                    </div>
                                </div>
                            </div>
                        `,
                        notes: [
                            "▶ START / Ⅱ PAUSE / ■ STOP actually control a live capture — CAPTURED / DISPLAYED / DROPPED update in real time as packets arrive.",
                            "DISPLAY FILTER takes real filter syntax (like ip.addr == 185.203.117.42) — that's how you'd narrow straight to the beacon instead of scrolling through everything.",
                            "The real table has two more columns than the practice one (a packet NO. and a separate SOURCE column) — otherwise it's the exact same TIME / DESTINATION / PROTOCOL / INFO / LEN you just worked with.",
                            "Clicking a row opens a full packet inspector with the raw protocol tree — worth exploring once you're comfortable with the list view."
                        ],
                        outro: "That's the real capture — same beacon-then-transfer pattern you just caught, just live and with the full toolbar around it."
                    }
                ]
            }
        },


        /* =================================================
           ATTACK MAP
           ================================================= */
        map: {
            id: "map",
            title: "Attack Map",
            icon: "◎",
            accent: "#8a7fe0",
            tagline: "The big picture, at a glance",
            tier: "quick",
            estMinutes: 3,
            overview: [
                "The Attack Map plots every current login origin as a node on a world map. Here's the twist: every node looks exactly the same — there's no color-coding that tells you which one is malicious. That's deliberate, not a missing feature.",
                "The Map is where you go once you already have a suspect source IP from somewhere else (usually Network or Endpoints). You click through nodes to find that specific IP and see what country it's actually coming from — the geography is the confirmation, not the discovery."
            ],
            keySkills: [
                "Selecting a node to reveal its source IP and country",
                "Understanding why every node looks identical on purpose",
                "Cross-referencing a suspect IP from Network or Endpoints against the map's geography",
                "Recognizing when a login origin's country doesn't match the business's real footprint"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "Why do all the nodes on the Attack Map look exactly the same, even the malicious one?",
                    choices: [
                        { id: "a", text: "It's a bug the team hasn't fixed yet" },
                        { id: "b", text: "It's intentional — the map confirms geography once you already have a suspect IP, it doesn't hand you the attacker visually" },
                        { id: "c", text: "Only administrators can see the color differences" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "You already found a suspicious source IP while investigating Network. What's the Attack Map for at that point?",
                    choices: [
                        { id: "a", text: "Click through nodes to find that IP and see what country it's actually coming from" },
                        { id: "b", text: "It will automatically highlight the matching node in red for you" },
                        { id: "c", text: "It replaces the need to go back and check Network again" }
                    ],
                    correctId: "a"
                }
            ],
            scenario: {
                title: "Read the Map",
                briefing: "Five connection summaries just lit up. One doesn't belong.",
                steps: [
                    {
                        type: "info",
                        title: "What you're looking at",
                        body: [
                            "On the real map, every login origin looks identical — no colors give the attacker away. What you're practicing here is the judgment call you'd make once you already have reason to be suspicious: the table below is five connection summaries, already flagged for review. Which one doesn't belong?"
                        ]
                    },
                    {
                        type: "spot",
                        title: "Find the anomaly",
                        prompt: "Northstar Corp is a US-based company with a small EU sales office. Which connection stands out?",
                        columns: ["ORIGIN", "DESTINATION", "VOLUME"],
                        correctId: "m4",
                        hint: "Four of these connect regions where the company actually operates. One connects two places with no business relationship at all, at a size that dwarfs the rest.",
                        successText: "That's the one — a large, one-off transfer between two countries with no business connection to Northstar is exactly the kind of pattern the map is good for catching early.",
                        failText: "Look again at where the company actually operates (US and a small EU office) — one row connects two places outside that footprint entirely, and it's also by far the largest transfer.",
                        rows: [
                            { id: "m1", cells: ["New York, US", "Chicago, US", "12 MB"], note: "Normal — internal US office traffic." },
                            { id: "m2", cells: ["New York, US", "Frankfurt, DE", "8 MB"], note: "Normal — US HQ to the EU sales office." },
                            { id: "m3", cells: ["Frankfurt, DE", "New York, US", "6 MB"], note: "Normal — the same relationship, other direction." },
                            { id: "m4", cells: ["Kuala Lumpur, MY", "Bucharest, RO", "410 MB"], note: "This is it — neither location has any relationship to Northstar's business, and 410 MB dwarfs every other flow on the map." },
                            { id: "m5", cells: ["New York, US", "Ashburn, US", "20 MB"], note: "Normal — Ashburn is a major US cloud-hosting hub; routine SaaS traffic." }
                        ]
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real Attack Map is a live world map — but here's the twist: every node on it renders exactly the same. Selecting one is the only thing that reveals its IP and country.",
                        mockup: `
                            <div class="attack-map-canvas" style="height: 300px;">
                                <div class="map-grid"></div>
                                <div class="world-map"></div>
                                <div class="map-sources">
                                    <button type="button" class="map-node" style="left: 24%; top: 34%;"><span></span></button>
                                    <button type="button" class="map-node" style="left: 46%; top: 28%;"><span></span></button>
                                    <button type="button" class="map-node selected" style="left: 62%; top: 55%;"><span></span></button>
                                    <button type="button" class="map-node" style="left: 33%; top: 62%;"><span></span></button>
                                    <button type="button" class="map-node" style="left: 74%; top: 42%;"><span></span></button>
                                </div>
                                <div class="map-target" style="left: 27%; top: 30%;">
                                    <div class="target-ring"></div>
                                    <div class="target-core"></div>
                                </div>
                                <div class="map-overlay-top">
                                    <span>GLOBAL AUTHENTICATION TELEMETRY</span>
                                    <span>UTC</span>
                                </div>
                                <div class="map-overlay-bottom">
                                    <span>SOURCES <b>18</b></span>
                                    <span>ACTIVE <b>01</b></span>
                                    <span class="map-warning">SUSPICIOUS <b>01</b></span>
                                </div>
                            </div>
                            <div class="map-selected-source">
                                <div class="selected-source-label">SOURCE IP</div>
                                <div class="selected-source-ip">103.21.244.10</div>
                                <div class="selected-source-country">
                                    <span>COUNTRY</span>
                                    <strong>Malaysia</strong>
                                </div>
                                <div class="selected-source-status">
                                    <span></span>
                                    MATCHES FLAGGED NETWORK EVIDENCE
                                </div>
                            </div>
                        `,
                        notes: [
                            "Every node here — the 17 harmless ones and the one real attacker among them — renders identically. That's on purpose: the map isn't supposed to hand you the answer by color or shape.",
                            "Clicking a node is what populates the SOURCE IP / COUNTRY panel below the map — that's the only way to find out what a node actually is.",
                            "In practice you arrive here already holding a suspect IP from Network or Endpoints, then click through nodes to find that exact IP and confirm where it's really coming from."
                        ],
                        outro: "Same \"does this belong\" instinct you just practiced on the table — just applied to a live map where you have to click to find out, not just look."
                    }
                ]
            }
        },


        /* =================================================
           MAIL  (deep)
           ================================================= */
        email: {
            id: "email",
            title: "Mail",
            icon: "✉",
            accent: "#e7b86a",
            tagline: "Phishing investigation, header by header",
            tier: "deep",
            estMinutes: 6,
            overview: [
                "The Mail app is a full inbox — you can open messages, inspect the real sender address versus the display name, hover links to see where they actually go, and check attachments before anyone opens them. Most real intrusions still start with a phishing email, which makes this one of the highest-value tools to be genuinely comfortable with.",
                "The trick is that phishing emails are built to look almost right. The job isn't spotting an obviously fake email — it's noticing the one detail that's slightly off in something that otherwise looks completely legitimate."
            ],
            keySkills: [
                "Comparing the sender's real domain against the display name",
                "Checking where a link actually points before trusting it",
                "Recognizing urgency and authority pressure as manipulation tactics",
                "Treating unexpected attachments as guilty until proven innocent",
                "Reporting and quarantining instead of just deleting"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What's usually the actual giveaway in a well-made phishing email — not that it's obviously fake, but...?",
                    choices: [
                        { id: "a", text: "One small detail that's slightly off in something that otherwise looks legitimate" },
                        { id: "b", text: "It's always written in a foreign language" },
                        { id: "c", text: "It always comes at 3 AM" }
                    ],
                    correctId: "a"
                },
                {
                    id: "k2",
                    prompt: "What's the correct way to handle a confirmed phishing email?",
                    choices: [
                        { id: "a", text: "Just delete it and move on" },
                        { id: "b", text: "Report it through the security workflow and quarantine it — then check if anyone clicked anything" },
                        { id: "c", text: "Reply asking the sender to confirm if it's real" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Spot the Phish",
                briefing: "Five emails landed in an employee's inbox this morning. One of them is an attack.",
                steps: [
                    {
                        type: "info",
                        title: "Before you open anything",
                        body: [
                            "In the real Mail app, the inbox shows sender, subject, and a preview; opening a message reveals the full headers and any links or attachments. Below is the same inbox, condensed into a table for this walkthrough."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Which email is the phish?",
                        prompt: "Northstar's real IT domain is northstar-corp.com. Pick the phishing email.",
                        columns: ["FROM", "SUBJECT"],
                        correctId: "m2",
                        hint: "Compare every sender's domain, letter by letter, against northstar-corp.com. One is close enough to fool a fast reader.",
                        successText: "Correct — \"northstaar-corp.com\" has an extra letter. It's a lookalike domain built to pass a quick glance, paired with urgent password-reset language designed to get you to click without thinking.",
                        failText: "Look closely at each sender's domain — one of them isn't quite northstar-corp.com. It's off by a single letter.",
                        rows: [
                            { id: "m1", cells: ["it-support@northstar-corp.com", "Scheduled maintenance window — Saturday 10PM"], note: "Legitimate domain, routine notice." },
                            { id: "m2", cells: ["security@northstaar-corp.com", "URGENT: Your password expires in 1 hour — verify now"], note: "This is it — \"northstaar\" has a double A, a classic lookalike-domain trick, and the message pressures you to act immediately." },
                            { id: "m3", cells: ["hr@northstar-corp.com", "Reminder: benefits enrollment closes Friday"], note: "Legitimate domain, routine HR reminder." },
                            { id: "m4", cells: ["newsletter@northstar-corp.com", "This month in engineering"], note: "Legitimate domain, internal newsletter." },
                            { id: "m5", cells: ["facilities@northstar-corp.com", "Parking garage closed for repairs Monday"], note: "Legitimate domain, routine facilities notice." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Name the biggest red flag",
                        prompt: "Beyond the lookalike domain, what's the single most telling manipulation tactic in that email?",
                        hint: "Think about why the email gives you only one hour to act.",
                        successText: "Right — manufactured urgency is designed to short-circuit careful thinking. A legitimate password expiry rarely gives you a one-hour countdown.",
                        failText: "The subject line itself is doing a lot of work here — think about why it gives you such a tight deadline.",
                        choices: [
                            { id: "a", text: "Manufactured urgency (\"1 hour\" deadline) to rush you into acting" },
                            { id: "b", text: "The subject line is written in all caps" },
                            { id: "c", text: "It came from an @northstar-corp.com-looking address, which is inherently suspicious" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "quiz",
                        title: "Verify before you trust",
                        prompt: "The email contains a \"Reset Password\" button. The visible text reads northstar-corp.com/reset, but hovering shows it actually points to login-verify-secure.net/reset. What does that tell you?",
                        hint: "The displayed text and the real destination don't match — that mismatch is the whole point of a phishing link.",
                        successText: "Exactly — the link text is a disguise. Always check the real destination (hover, or in Mail, the link inspector) rather than trusting what's printed on the button.",
                        failText: "The visible text and the actual link go to two completely different places — that mismatch is itself the red flag, regardless of how either one looks on its own.",
                        choices: [
                            { id: "a", text: "It confirms the link is safe, since it mentions \"reset\"" },
                            { id: "b", text: "The displayed link text is a lie — the real destination is a different, unrelated domain" },
                            { id: "c", text: "It doesn't matter, since the email itself already looked fake" }
                        ],
                        correctId: "b"
                    },
                    {
                        type: "quiz",
                        title: "Closing it out",
                        prompt: "What's the correct way to handle this email now that you've confirmed it's phishing?",
                        hint: "The goal is to remove the threat and make sure it's tracked — not just make it disappear from one inbox.",
                        successText: "Right — report it (so it can be blocked org-wide and the employee's account can be checked) and quarantine it, rather than just deleting it and moving on.",
                        failText: "Simply deleting it clears your inbox but leaves the campaign untracked and the employee's account unchecked — think about what actually needs to happen next.",
                        choices: [
                            { id: "a", text: "Report it through the security workflow and quarantine it — then check if the user clicked anything" },
                            { id: "b", text: "Just delete it — it's out of the inbox, so it's handled" },
                            { id: "c", text: "Reply to security@northstaar-corp.com asking if it's legitimate" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real inbox row carries more than the practice table did — a star, a category tag, and a risk marker once Mail flags something.",
                        mockup: `
                            <div class="mail-message-list">
                                <article class="mail-row unread has-risk">
                                    <div class="mail-row-checkbox"><input type="checkbox"></div>
                                    <button class="mail-row-star">☆</button>
                                    <div class="mail-row-main">
                                        <div class="mail-row-top">
                                            <span class="mail-sender">IT Security</span>
                                            <span class="mail-time">8:14 AM</span>
                                        </div>
                                        <div class="mail-row-subject">
                                            <span class="mail-risk-marker phishing">!</span>
                                            <span>URGENT: Your password expires in 1 hour — verify now</span>
                                        </div>
                                        <div class="mail-row-preview">
                                            <span class="mail-address">security@northstaar-corp.com</span>
                                            <span class="mail-preview-separator">—</span>
                                            <span>Click below to keep your account active...</span>
                                        </div>
                                    </div>
                                    <div class="mail-row-category">
                                        <span class="mail-category phishing">Phishing</span>
                                    </div>
                                </article>
                                <article class="mail-row">
                                    <div class="mail-row-checkbox"><input type="checkbox"></div>
                                    <button class="mail-row-star">☆</button>
                                    <div class="mail-row-main">
                                        <div class="mail-row-top">
                                            <span class="mail-sender">HR</span>
                                            <span class="mail-time">7:40 AM</span>
                                        </div>
                                        <div class="mail-row-subject"><span>Reminder: benefits enrollment closes Friday</span></div>
                                        <div class="mail-row-preview">
                                            <span class="mail-address">hr@northstar-corp.com</span>
                                            <span class="mail-preview-separator">—</span>
                                            <span>Just a friendly reminder that...</span>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        `,
                        notes: [
                            "The sender/time/subject/preview layout is exactly what you worked with — Mail just adds a star to flag-for-later and a category tag once you (or the game) has classified a message.",
                            "Opening a message for real shows the full header block and a link inspector — that's where you'd actually see the hover-mismatch you just practiced spotting."
                        ],
                        outro: "That's the real inbox — same domain-and-link scrutiny you just practiced, just with the full row of controls around it."
                    }
                ]
            }
        },


        /* =================================================
           ENDPOINTS
           ================================================= */
        hosts: {
            id: "hosts",
            title: "Endpoints",
            icon: "▣",
            accent: "#6cc9a2",
            tagline: "Host-by-host risk, at a glance",
            tier: "standard",
            estMinutes: 4,
            overview: [
                "Endpoints shows every managed host as a status card — online, compromised, or isolated — with its assigned user, IP, and OS, plus a risk badge. It's how you go from \"something's wrong somewhere\" to \"this specific machine is why,\" before you ever have to dig into what's running on it.",
                "A host doesn't stay quiet when something's gone wrong. It flips from a calm ONLINE card to a flagged COMPROMISED one with a HIGH risk badge — that state change, not a wall of process names, is usually the first thing that tells you where to look."
            ],
            keySkills: [
                "Reading the host status grid — ONLINE / COMPROMISED / ISOLATED",
                "Spotting a risk badge that doesn't match the rest of the fleet",
                "Connecting a flagged host back to its assigned user",
                "Knowing isolation is the fast, safe first move"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What does the Endpoints app show you, at the top level?",
                    choices: [
                        { id: "a", text: "A live process list for every host, all the time" },
                        { id: "b", text: "A grid of host status cards — online, compromised, or isolated — with a risk badge on each" },
                        { id: "c", text: "Nothing until you type a command" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "What's the fast, safe first move once a host flips to COMPROMISED with a high risk badge?",
                    choices: [
                        { id: "a", text: "Isolate it from the network, then investigate" },
                        { id: "b", text: "Leave it connected until you're totally sure" },
                        { id: "c", text: "Rename the host" }
                    ],
                    correctId: "a"
                }
            ],
            scenario: {
                title: "Find the Compromised Host",
                briefing: "One workstation on the fleet is quietly behaving very differently from the rest.",
                steps: [
                    {
                        type: "info",
                        title: "What to look for",
                        body: [
                            "Every host on the grid shows its hostname, assigned user, OS, and a status — most of the fleet just sits at ONLINE with a LOW or unremarkable risk rating. The signal you're looking for is a host that's flipped to a worse status with a risk badge that stands out from the rest."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Spot the compromised host",
                        prompt: "Six hosts on the fleet. One of them doesn't look like the rest. Click it.",
                        columns: ["HOST", "USER", "STATUS", "RISK"],
                        correctId: "pr3",
                        hint: "Look for the one host that isn't sitting at ONLINE / LOW like the rest of the fleet.",
                        successText: "Correct — WKS-22 flipped to COMPROMISED with a HIGH risk badge while everything else on the fleet is calmly ONLINE. That state change is the whole signal.",
                        failText: "Compare the STATUS and RISK columns across all six rows — one host is very clearly not like the others.",
                        rows: [
                            { id: "pr1", cells: ["WKS-05", "T. Alvarez", "Online", "Low"], note: "Normal — nothing unusual about this host." },
                            { id: "pr2", cells: ["WKS-09", "M. Osei", "Online", "Low"], note: "Normal — nothing unusual about this host." },
                            { id: "pr3", cells: ["WKS-22", "D. Bryant", "Compromised", "High"], note: "This is it — the only host on the fleet flagged COMPROMISED with a HIGH risk badge." },
                            { id: "pr4", cells: ["WKS-14", "J. Rossi", "Online", "Medium"], note: "Elevated, but not flagged compromised — worth a glance later, not the priority right now." },
                            { id: "pr5", cells: ["WKS-31", "S. Nguyen", "Online", "Low"], note: "Normal — nothing unusual about this host." },
                            { id: "pr6", cells: ["WKS-02", "K. Reyes", "Online", "Low"], note: "Normal — nothing unusual about this host." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Contain it",
                        prompt: "WKS-22 is flagged COMPROMISED with a HIGH risk badge, assigned to D. Bryant. What's the right move for this endpoint?",
                        hint: "This looks like an active compromise on a live host — the response needs to stop it from spreading or exfiltrating further.",
                        successText: "Right — isolate the host from the network first, so it can't spread or send anything else out, then investigate and clean it.",
                        failText: "A host actively flagged compromised needs to be cut off from the network before anything else — leaving it connected risks it spreading or exfiltrating more data.",
                        choices: [
                            { id: "a", text: "Isolate WKS-22 from the network, then investigate" },
                            { id: "b", text: "Rename the host so it's less confusing" },
                            { id: "c", text: "Leave it running and see what it does next" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real app is a card grid, not a table — one card per host, with the fleet-wide status counts summarized up top.",
                        mockup: `
                            <div class="ep-counts">
                                <span class="ep-count online">5 ONLINE</span>
                                <span class="ep-count compromised">1 COMPROMISED</span>
                                <span class="ep-count isolated">0 ISOLATED</span>
                            </div>
                            <div class="ep-grid">
                                <article class="ep-card compromised">
                                    <div class="ep-card-top">
                                        <span class="ep-status-dot compromised"></span>
                                        <span class="ep-card-hostname">WKS-22</span>
                                        <span class="ep-risk-badge high">HIGH</span>
                                    </div>
                                    <div class="ep-card-row"><span>IP</span><strong>10.10.10.22</strong></div>
                                    <div class="ep-card-row"><span>User</span><strong>D. Bryant</strong></div>
                                    <div class="ep-card-row"><span>OS</span><strong>Windows 11</strong></div>
                                    <div class="ep-card-footer">
                                        <span class="ep-status-label compromised">COMPROMISED</span>
                                        <span class="ep-last-activity">2 min ago</span>
                                    </div>
                                </article>
                                <article class="ep-card">
                                    <div class="ep-card-top">
                                        <span class="ep-status-dot online"></span>
                                        <span class="ep-card-hostname">WKS-09</span>
                                        <span class="ep-risk-badge low">LOW</span>
                                    </div>
                                    <div class="ep-card-row"><span>IP</span><strong>10.10.10.09</strong></div>
                                    <div class="ep-card-row"><span>User</span><strong>M. Osei</strong></div>
                                    <div class="ep-card-row"><span>OS</span><strong>Windows 11</strong></div>
                                    <div class="ep-card-footer">
                                        <span class="ep-status-label online">ONLINE</span>
                                        <span class="ep-last-activity">just now</span>
                                    </div>
                                </article>
                            </div>
                        `,
                        notes: [
                            "This is genuinely how the real app looks — a grid of host cards, not a process table. The COMPROMISED / HIGH card is exactly the kind of standout you just practiced spotting.",
                            "The ONLINE / COMPROMISED / ISOLATED counts up top let you tell at a glance whether the fleet is calm before you even look at individual cards.",
                            "Clicking a card opens a full detail view for that host — worth exploring once you're comfortable scanning the grid."
                        ],
                        outro: "That's the real Endpoints grid — same \"which one doesn't belong\" instinct you just practiced, just as cards instead of a table."
                    }
                ]
            }
        },


        /* =================================================
           VPN
           ================================================= */
        vpn: {
            id: "vpn",
            title: "VPN",
            icon: "🔒",
            accent: "#4fa8d8",
            tagline: "Remote access logs — and impossible travel",
            tier: "standard",
            estMinutes: 4,
            overview: [
                "The VPN app shows connection history for every remote-access session: who connected, from where, and for how long. It's one of the most reliable places to catch a stolen credential in use, because stolen passwords usually get used from somewhere the real employee has never logged in from.",
                "The single most useful pattern to know here is \"impossible travel\": the same account logging in from two locations too far apart to have been the same person, too close together in time."
            ],
            keySkills: [
                "Reading connect times, source IP, and country in the log",
                "Spotting impossible travel between two sessions",
                "Noticing session durations or times of day that don't fit a user's normal pattern",
                "Knowing that impossible travel means \"reset now,\" not \"note and move on\""
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What is \"impossible travel\"?",
                    choices: [
                        { id: "a", text: "A VPN session that lasts too long" },
                        { id: "b", text: "The same account logging in from two locations too far apart to be the same person in that time window" },
                        { id: "c", text: "A user connecting from their usual city" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "Why is VPN log data especially good at catching a stolen credential in use?",
                    choices: [
                        { id: "a", text: "Stolen passwords usually get used from somewhere the real employee has never logged in from" },
                        { id: "b", text: "VPN logs are always more accurate than every other tool" },
                        { id: "c", text: "Attackers always announce themselves in the VPN log" }
                    ],
                    correctId: "a"
                }
            ],
            scenario: {
                title: "Spot Impossible Travel",
                briefing: "One user's VPN history for today has five sessions. Two of them can't both be true.",
                steps: [
                    {
                        type: "info",
                        title: "What the log shows",
                        body: [
                            "Each session lists the user, a rough location, and the connect time. On its own, any single login usually looks fine — the tell is comparing consecutive sessions against each other."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Find the impossible pair",
                        prompt: "User dbryant has five sessions today. Click the one that couldn't legitimately follow the session right before it.",
                        columns: ["TIME", "USER", "LOCATION"],
                        correctId: "v3",
                        hint: "Compare each row's location and time to the row right above it. One jump covers a distance no one can travel in that few minutes.",
                        successText: "Correct — a login from Warsaw six minutes after a login from New York isn't a travel schedule, it's two different people (or one attacker and the real user) using the same credentials.",
                        failText: "Compare each session's location to the one directly before it — one pair is geographically impossible in the time between them.",
                        rows: [
                            { id: "v1", cells: ["08:02", "dbryant", "New York, US"], note: "Normal — matches the user's usual home city." },
                            { id: "v2", cells: ["11:47", "dbryant", "New York, US"], note: "Normal — reconnect after a break, same city." },
                            { id: "v3", cells: ["14:15", "dbryant", "Warsaw, PL"], note: "This is it — six minutes after the New York session below, which is physically impossible to travel between." },
                            { id: "v4", cells: ["14:21", "dbryant", "New York, US"], note: "The prior New York session — only six minutes before the Warsaw login above. No flight covers that." },
                            { id: "v5", cells: ["17:30", "dbryant", "New York, US"], note: "Normal — back to the expected location later in the day." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "React to it",
                        prompt: "Impossible travel is confirmed on dbryant's account. What's the right response?",
                        hint: "The credential is clearly compromised — the response should assume the password itself is no longer trustworthy.",
                        successText: "Right — force-terminate the sessions, reset the password, and require MFA re-enrollment. Anything less leaves the same stolen credential usable.",
                        failText: "A confirmed impossible-travel case means the password itself is compromised — a lighter response than a reset leaves the attacker able to just log back in.",
                        choices: [
                            { id: "a", text: "Terminate the sessions, force a password reset, and verify/re-enroll MFA" },
                            { id: "b", text: "Send dbryant a reminder email about strong passwords" },
                            { id: "c", text: "Nothing — VPN locations aren't always accurate" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real log has two more columns than the practice table (TYPE and a real SOURCE IP), plus a FLAG column that lights up red when the game itself has already caught something.",
                        mockup: `
                            <div class="vpn-log-table">
                                <div class="vpn-log-row vpn-log-header">
                                    <span>TYPE</span><span>USER</span><span>SOURCE IP</span><span>COUNTRY</span><span>TIME</span><span>FLAG</span>
                                </div>
                                <div class="vpn-log-row flagged">
                                    <span>connect</span><span>dbryant</span><span class="vpn-mono">45.153.X.X</span><span>Poland</span><span>2:15 PM</span><span><span class="vpn-flag">ALERT</span></span>
                                </div>
                                <div class="vpn-log-row">
                                    <span>connect</span><span>dbryant</span><span class="vpn-mono">198.51.100.4</span><span>United States</span><span>2:21 PM</span><span>—</span>
                                </div>
                            </div>
                        `,
                        notes: [
                            "USER / COUNTRY / TIME are exactly what you compared row-to-row in the practice — SOURCE IP and TYPE just add more detail.",
                            "The FLAG column is the game doing some of the correlation for you — a red ALERT badge on a row is a strong hint you've found something before you even compare timestamps."
                        ],
                        outro: "That's the real log — same row-by-row comparison you just practiced, plus a flag column that helps confirm it."
                    }
                ]
            }
        },


        /* =================================================
           FILE EXPLORER
           ================================================= */
        files: {
            id: "files",
            title: "File Explorer",
            icon: "📁",
            accent: "#d4a574",
            tagline: "Digging through a compromised endpoint's disk",
            tier: "deep",
            estMinutes: 5,
            overview: [
                "File Explorer lets you browse a suspect endpoint's filesystem the same way you'd browse your own — folders, files, timestamps — except you're looking for evidence instead of your own documents. Attackers frequently drop tools or malware into unremarkable-looking folders, hoping no one looks closely.",
                "Two habits do most of the work: knowing which folders are worth suspicion in the first place (Temp, Downloads, AppData, Startup), and lining up file timestamps against the rest of your incident timeline to see what changed and when."
            ],
            keySkills: [
                "Recognizing suspicious file locations (Temp, AppData, Startup folders)",
                "Spotting disguised files, like double extensions",
                "Correlating a file's modified time against the rest of the incident",
                "Knowing when a file needs a hash lookup in Threat Intel"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What's a \"double extension\" trick, like Invoice_2024.pdf.exe?",
                    choices: [
                        { id: "a", text: "A file that's genuinely both a PDF and an executable" },
                        { id: "b", text: "A disguise — it looks like a harmless PDF but the real, executable file type is hiding after the fake one" },
                        { id: "c", text: "A Windows naming requirement for all downloads" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "Why does lining up a file's modified time against the rest of the incident timeline matter?",
                    choices: [
                        { id: "a", text: "It doesn't — timestamps can be ignored" },
                        { id: "b", text: "A file that appeared right after a phishing email arrived is strong evidence it's the payload from that email" },
                        { id: "c", text: "Only file size matters, never timing" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Find the Dropper",
                briefing: "An employee's Downloads folder has six files. One of them isn't what it looks like.",
                steps: [
                    {
                        type: "info",
                        title: "What's worth a second look",
                        body: [
                            "A file's name, extension, and last-modified time all matter. Windows hides file extensions by default in some views, which is exactly what attackers rely on for a trick like \"Invoice.pdf.exe\" — it displays as \"Invoice.pdf\" but is really an executable."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Spot the disguised file",
                        prompt: "Six files sit in this Downloads folder. Click the one that isn't what it appears to be.",
                        columns: ["FILE", "MODIFIED"],
                        correctId: "f4",
                        hint: "Look for a file with two extensions stacked together — the real, executable one is hiding after a fake, trustworthy-looking one.",
                        successText: "Correct — \"Invoice_2024.pdf.exe\" is a double extension. It displays as a harmless PDF at a glance, but the real file type is .exe — a classic disguised dropper.",
                        failText: "Look at each file's full name carefully — one of them has two extensions stacked together, which is the giveaway.",
                        rows: [
                            { id: "f1", cells: ["Q3_Report.xlsx", "Tue 9:14 AM"], note: "Normal — a real spreadsheet file." },
                            { id: "f2", cells: ["team_photo.jpg", "Mon 3:02 PM"], note: "Normal — a real image file." },
                            { id: "f3", cells: ["meeting_notes.docx", "Tue 9:20 AM"], note: "Normal — a real document file." },
                            { id: "f4", cells: ["Invoice_2024.pdf.exe", "Tue 9:16 AM"], note: "This is it — a double extension. The real file type is .exe, disguised behind a fake .pdf to look harmless at a glance." },
                            { id: "f5", cells: ["vacation_photos.zip", "Sun 6:40 PM"], note: "Normal — a real archive file." },
                            { id: "f6", cells: ["expense_form.pdf", "Tue 8:55 AM"], note: "Normal — a real PDF, single extension." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Line up the timeline",
                        prompt: "The phishing email with a malicious attachment arrived at 9:15 AM Tuesday. Which file's timestamp matches that closely enough to matter?",
                        hint: "Compare every Tuesday-morning timestamp against 9:15 AM — one is only a minute off.",
                        successText: "Right — Invoice_2024.pdf.exe landed at 9:16 AM, one minute after the phishing email arrived at 9:15. That correlation is what turns \"a weird file\" into \"the payload from that email.\"",
                        failText: "Compare each file's exact time against 9:15 AM Tuesday — one of them lines up almost to the minute.",
                        choices: [
                            { id: "a", text: "meeting_notes.docx (9:20 AM)" },
                            { id: "b", text: "Invoice_2024.pdf.exe (9:16 AM)" },
                            { id: "c", text: "Q3_Report.xlsx (9:14 AM)" }
                        ],
                        correctId: "b"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real File Explorer looks like a normal Windows file browser — the same Name / Date modified / Type / Size columns you'd expect.",
                        mockup: `
                            <div class="fx-list-header">
                                <span class="fx-col-name">Name</span>
                                <span class="fx-col-modified">Date modified</span>
                                <span class="fx-col-type">Type</span>
                                <span class="fx-col-size">Size</span>
                            </div>
                            <div class="fx-list-body">
                                <button class="fx-row fx-row-file fx-scenario-suspicious">
                                    <span class="fx-col-name"><span class="fx-row-icon">⚠</span><span class="fx-col-name-text">Invoice_2024.pdf.exe</span></span>
                                    <span class="fx-col-modified">9/8/2026 9:16 AM</span>
                                    <span class="fx-col-type">Application</span>
                                    <span class="fx-col-size">412 KB</span>
                                </button>
                                <button class="fx-row fx-row-file">
                                    <span class="fx-col-name"><span class="fx-row-icon">📄</span><span class="fx-col-name-text">expense_form.pdf</span></span>
                                    <span class="fx-col-modified">9/8/2026 8:55 AM</span>
                                    <span class="fx-col-type">PDF Document</span>
                                    <span class="fx-col-size">88 KB</span>
                                </button>
                            </div>
                        `,
                        notes: [
                            "Name / Date modified / Type / Size is exactly what you compared in the practice table, just laid out the way a real file browser does.",
                            "The Type column is a second confirmation of a disguise — \"Application\" on a file that looks like a PDF is as strong a tell as the double extension itself."
                        ],
                        outro: "That's the real File Explorer — same disguised-file, same timeline-correlation instincts you just practiced."
                    }
                ]
            }
        },


        /* =================================================
           IR PLAYBOOK
           ================================================= */
        playbook: {
            id: "playbook",
            title: "IR Playbook",
            icon: "📖",
            accent: "#8fb996",
            tagline: "The checklist for \"what do I do now?\"",
            tier: "standard",
            estMinutes: 4,
            overview: [
                "The Playbook is the reference every other tool feeds into — a page-by-page incident-response guide covering Identification, Containment, Eradication, Recovery, and Lessons Learned, each phase with its own checklist, plus a final report-writing step.",
                "Knowing the tools individually matters less than knowing which phase you're in and what belongs there. Doing a Recovery step before Containment is finished, for example, can hand the attacker a second chance."
            ],
            keySkills: [
                "The five IR phases and their order: Identify → Contain → Eradicate → Recover → Lessons Learned",
                "Matching a specific action to the phase it belongs in",
                "Understanding why order matters, not just checking boxes",
                "Writing findings clearly enough that someone else could follow them"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What's the correct order of the five IR phases?",
                    choices: [
                        { id: "a", text: "Identify → Contain → Eradicate → Recover → Lessons Learned" },
                        { id: "b", text: "Recover → Contain → Identify → Eradicate → Lessons Learned" },
                        { id: "c", text: "There's no set order — do whichever first" }
                    ],
                    correctId: "a"
                },
                {
                    id: "k2",
                    prompt: "Why can doing Recovery before Eradication is finished be dangerous?",
                    choices: [
                        { id: "a", text: "It isn't — order never matters" },
                        { id: "b", text: "You could restore a system while the threat is still present, handing the attacker a second chance" },
                        { id: "c", text: "Recovery always happens automatically" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Right Action, Right Phase",
                briefing: "You've confirmed the incident. Now put a few key actions in their correct phase.",
                steps: [
                    {
                        type: "info",
                        title: "The five phases",
                        body: [
                            "Identify: confirm something bad actually happened. Contain: stop it from getting worse. Eradicate: remove the actual threat. Recover: bring systems back safely. Lessons Learned: document what happened and improve for next time.",
                            "Skipping ahead — recovering a system before eradication is finished, say — risks restoring the very thing you were trying to remove."
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Where does this go?",
                        prompt: "\"Isolate the compromised workstation from the network\" belongs in which phase?",
                        hint: "This action stops the situation from getting worse — it doesn't yet remove the threat or bring anything back.",
                        successText: "Right — that's Containment: stop the bleeding before you try to clean anything up.",
                        failText: "This action is about stopping the spread, not yet removing the malware or restoring the machine — think about which phase that is.",
                        choices: [
                            { id: "a", text: "Containment" },
                            { id: "b", text: "Eradication" },
                            { id: "c", text: "Recovery" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "quiz",
                        title: "And this one?",
                        prompt: "\"Restore the workstation from a known-clean backup\" belongs in which phase?",
                        hint: "This happens after the threat is confirmed gone — it's about getting the system back into safe, working order.",
                        successText: "Correct — that's Recovery, and it should only happen after Eradication confirms the malware is actually gone.",
                        failText: "This is about bringing the system back to normal use, which only makes sense once the threat itself has already been removed.",
                        choices: [
                            { id: "a", text: "Identification" },
                            { id: "b", text: "Recovery" },
                            { id: "c", text: "Containment" }
                        ],
                        correctId: "b"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real Playbook reads like a book — a table of contents on the left, one phase per page on the right, with its checklist built right in.",
                        mockup: `
                            <div class="pb-page">
                                <article class="pb-section">
                                    <div class="pb-section-eyebrow">Phase 2</div>
                                    <h1 class="pb-section-title">Containment</h1>
                                    <p class="pb-body-text">Stop the incident from spreading before you try to clean anything up.</p>
                                    <ul class="pb-checklist">
                                        <li class="pb-checklist-item checked"><span class="pb-checkbox">✓</span><span class="pb-checklist-text">Isolate the compromised workstation from the network</span></li>
                                        <li class="pb-checklist-item"><span class="pb-checkbox"></span><span class="pb-checklist-text">Disable the affected account's active sessions</span></li>
                                    </ul>
                                </article>
                            </div>
                        `,
                        notes: [
                            "Each phase gets its own page — the table of contents on the left jumps straight to Identify / Contain / Eradicate / Recover / Lessons Learned.",
                            "Checklist items are real checkboxes tied to your actual progress — checking one off here is how the game tracks that you did it."
                        ],
                        outro: "That's the real Playbook — same five-phase structure you just practiced, laid out as a page you actually flip through."
                    }
                ]
            }
        },


        /* =================================================
           PASSWORD CRACKER
           ================================================= */
        cracker: {
            id: "cracker",
            title: "Password Cracker",
            icon: "🔓",
            accent: "#c97fd4",
            tagline: "Why some passwords fall in seconds",
            tier: "standard",
            estMinutes: 4,
            overview: [
                "The Password Cracker simulates recovering credentials the same way an attacker's tooling would — trying dictionary words and common patterns first, then brute-forcing what's left. In-game, it's used to recover a locked evidence file; conceptually, it teaches exactly what attackers rely on when they steal a password database.",
                "The gap between a weak and a strong password isn't small — it's the difference between instant and computationally impossible. Length and true randomness matter far more than swapping a letter for a number."
            ],
            keySkills: [
                "Why dictionary-based passwords fall almost instantly",
                "Why length matters more than complexity tricks like \"@\" for \"a\"",
                "Roughly how crack-time scales with password strength",
                "What actually defends against this: passphrases + MFA"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "Why does a password like \"password123\" get cracked almost instantly?",
                    choices: [
                        { id: "a", text: "It's one of the most common passwords in every leaked-password dictionary — no brute force needed" },
                        { id: "b", text: "It has a number in it, which is always weak" },
                        { id: "c", text: "It's actually not weak at all" }
                    ],
                    correctId: "a"
                },
                {
                    id: "k2",
                    prompt: "What actually defends best against password cracking?",
                    choices: [
                        { id: "a", text: "Swapping a few letters for symbols in a short common word" },
                        { id: "b", text: "A long, unique passphrase, plus multi-factor authentication" },
                        { id: "c", text: "Changing your password every single day" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Crack the Weak One",
                briefing: "Three candidate passwords, three very different outcomes.",
                steps: [
                    {
                        type: "info",
                        title: "How cracking actually works",
                        body: [
                            "Attackers don't guess randomly — they run dictionaries of real passwords and common patterns first (these get cracked in seconds), then fall back to brute force for anything left, which is where length starts to matter enormously."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Which falls first?",
                        prompt: "Three passwords, three estimated crack times. Click the one that would fall fastest.",
                        columns: ["PASSWORD", "ESTIMATED CRACK TIME"],
                        correctId: "c1",
                        hint: "One of these is a password that shows up in almost every leaked-password dictionary in existence.",
                        successText: "Right — \"password123\" is one of the most common passwords in every breach dataset. Cracking tools try it in the first fraction of a second, before any brute-force is even needed.",
                        failText: "Think about which of these three appears constantly in real leaked-password lists — dictionary attacks try those first, before any actual brute-forcing.",
                        rows: [
                            { id: "c1", cells: ["password123", "Instant"], note: "This is it — a top-of-the-list dictionary entry. No brute force needed at all." },
                            { id: "c2", cells: ["Tr0ub4dor&3", "~3 hours"], note: "Better — complexity tricks help a little, but it's still short enough for a determined brute-force run." },
                            { id: "c3", cells: ["correct-horse-battery-staple-42!", "Centuries+"], note: "Strongest — long and unpredictable enough that brute force isn't realistic with any current hardware." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "The real defense",
                        prompt: "Given the gap between those three, what actually protects an account best?",
                        hint: "One option addresses length and randomness directly; the other adds a second layer entirely independent of the password.",
                        successText: "Right — a long, random passphrase makes brute force impractical, and MFA means even a cracked password isn't enough on its own to get in.",
                        failText: "Small letter-for-symbol swaps (a→@, o→0) barely slow down modern cracking tools — think about what actually changes the math.",
                        choices: [
                            { id: "a", text: "A long, unique passphrase, plus multi-factor authentication" },
                            { id: "b", text: "Swapping a few letters for symbols in a short, common word" },
                            { id: "c", text: "Changing the password every day" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real tool has a Nightfall-branded terminal look — a target card, a live decrypt display, and a big CRACK PASSWORD button.",
                        mockup: `
                            <div class="npc-target-card">
                                <div class="npc-target-icon">🔒</div>
                                <div class="npc-target-info">
                                    <div class="npc-target-label">TARGET FILE</div>
                                    <div class="npc-target-name">evidence_locker.zip</div>
                                    <div class="npc-target-meta">AES-256 · dictionary attack recommended</div>
                                </div>
                                <div class="npc-target-state">LOCKED</div>
                            </div>
                            <div class="npc-display">
                                <div class="npc-display-heading">DECRYPTING</div>
                                <div class="npc-code">p4ssw0rd_2024</div>
                            </div>
                            <div class="npc-controls">
                                <button class="npc-button npc-crack-button"><span class="npc-button-symbol">▶</span> CRACK PASSWORD</button>
                                <button class="npc-button npc-clear-button">RESET</button>
                            </div>
                        `,
                        notes: [
                            "You register a target file, then hit CRACK PASSWORD — the display animates through candidate guesses the same way real cracking software does, dictionary words first.",
                            "The engine status sidebar shows ENGINE ONLINE and a running target count — a nice touch that reinforces this is a tool doing real (simulated) work, not a magic instant unlock."
                        ],
                        outro: "That's the real cracker — same dictionary-first, weak-password-falls-fast idea you just practiced, with a proper console around it."
                    }
                ]
            }
        },


        /* =================================================
           THREAT INTEL
           ================================================= */
        intel: {
            id: "intel",
            title: "Threat Intel",
            icon: "🔎",
            accent: "#5ec9d0",
            tagline: "Check indicators against what's already known",
            tier: "standard",
            estMinutes: 4,
            overview: [
                "Threat Intel lets you look up an indicator — an IP address, a domain, a file hash — and see whether it's already known to be associated with malicious activity, along with a confidence level and any context (which attacker group, first seen when, associated malware family).",
                "It's a corroboration tool, not a verdict machine on its own: a clean result doesn't prove something is safe (it might just be new), but a high-confidence malicious hit is strong support for whatever you already suspected from another tool."
            ],
            keySkills: [
                "What counts as an indicator of compromise (IOC)",
                "Reading a verdict and confidence level correctly",
                "Using intel to corroborate findings from other tools, not replace them",
                "Not over-trusting a \"no known reports\" result"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "Does a \"no known reports\" result mean an indicator is definitely safe?",
                    choices: [
                        { id: "a", text: "Yes, always" },
                        { id: "b", text: "No — it can just mean nobody's seen it before, not that it's confirmed clean" },
                        { id: "c", text: "It means the lookup failed" }
                    ],
                    correctId: "b"
                },
                {
                    id: "k2",
                    prompt: "How should a high-confidence malicious hit be used?",
                    choices: [
                        { id: "a", text: "As the sole proof, replacing the need to look at any other tool" },
                        { id: "b", text: "As strong corroboration alongside what you already found in other tools" },
                        { id: "c", text: "It should be ignored unless it's Critical severity" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Look It Up",
                briefing: "Four indicators pulled from today's investigation. Only one comes back with a strong, confirmed match.",
                steps: [
                    {
                        type: "info",
                        title: "Reading a lookup result",
                        body: [
                            "Each lookup returns a verdict (Malicious / Suspicious / Clean / No known reports) and a confidence level. \"No known reports\" isn't the same as \"safe\" — it can just mean nobody's seen it before."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Find the confirmed hit",
                        prompt: "Four IOCs from this investigation. Click the one with a confirmed, high-confidence malicious verdict.",
                        columns: ["INDICATOR", "TYPE", "VERDICT"],
                        correctId: "i2",
                        hint: "Three of these come back inconclusive or clean. One is a direct, high-confidence match to a known attacker infrastructure.",
                        successText: "Correct — 185.203.117.42 comes back as a confirmed, high-confidence match tied to known attacker infrastructure. That's strong corroboration for whatever you already saw in Network or the SIEM.",
                        failText: "Compare the verdicts and confidence levels across all four — one stands well apart from the rest as an actual confirmed match.",
                        rows: [
                            { id: "i1", cells: ["203.0.113.9", "IP", "No known reports"], note: "Inconclusive — absence of reports isn't proof of safety, just no prior sighting." },
                            { id: "i2", cells: ["185.203.117.42", "IP", "Malicious — High confidence"], note: "This is it — a confirmed match to known attacker infrastructure, high confidence." },
                            { id: "i3", cells: ["northstar-corp.com", "Domain", "Clean"], note: "Expected — the company's own legitimate domain." },
                            { id: "i4", cells: ["a1b2c3d4e5f6...", "File hash", "Suspicious — Low confidence"], note: "Worth watching, but low confidence alone isn't strong enough to act on by itself." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Using the result correctly",
                        prompt: "You already saw this same IP beaconing in a packet capture. What does the Threat Intel match add?",
                        hint: "Two independent tools now agree — think about what that agreement is worth, and what it isn't.",
                        successText: "Exactly — two independent sources now agree, which makes the case far stronger. It corroborates what Network already showed; it doesn't replace the need for that original evidence.",
                        failText: "The Threat Intel hit strengthens the case by agreeing with what you already found — it isn't a replacement for the packet-capture evidence you already have.",
                        choices: [
                            { id: "a", text: "Strong corroboration — two independent tools now agree" },
                            { id: "b", text: "Nothing — the packet capture is all the proof you need" },
                            { id: "c", text: "It replaces the need to look at Network at all going forward" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real app is a single search box — type an IP, domain, or hash, hit search, and a result panel with a verdict badge fills in.",
                        mockup: `
                            <div class="nti-query-row">
                                <div class="nti-input-wrapper"><span class="nti-input-prefix">IOC</span><input class="nti-query-input" value="185.203.117.42" readonly></div>
                                <button class="nti-query-button">SEARCH INTELLIGENCE</button>
                            </div>
                            <div class="nti-result-header">
                                <div>
                                    <div class="nti-section-label">INTELLIGENCE RESULT</div>
                                    <div class="nti-result-indicator">185.203.117.42</div>
                                </div>
                                <div class="nti-result-badge nti-malicious">MALICIOUS</div>
                            </div>
                        `,
                        notes: [
                            "You can search an IP, domain, or SHA-256 hash directly — the field even auto-detects which type you typed.",
                            "The verdict badge (MALICIOUS here) is the same color-coded verdict you compared across four indicators in the practice, just for one lookup at a time."
                        ],
                        outro: "That's the real lookup — same verdict-and-confidence reading you just practiced, one search at a time."
                    }
                ]
            }
        },


        /* =================================================
           IAM
           ================================================= */
        iam: {
            id: "iam",
            title: "IAM",
            icon: "🪪",
            accent: "#e0a75e",
            tagline: "Who has access, and whether they should",
            tier: "standard",
            estMinutes: 4,
            overview: [
                "IAM — Identity and Access Management — is where you review user accounts, their roles, and what those roles actually grant. A lot of real intrusions don't end at the initial compromise; the attacker's next move is quietly granting themselves more access than the account should ever have.",
                "The pattern to watch for is privilege that doesn't match the person: an account with a low-level job title suddenly holding admin rights, or a change that happened at an odd time with no ticket behind it."
            ],
            keySkills: [
                "Reading role and permission level against job title",
                "Spotting privilege escalation that doesn't match the account's normal scope",
                "Noticing access changes with no clear business reason",
                "Knowing that revoking and investigating beats \"wait and see\""
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "What's the pattern IAM review is really looking for?",
                    choices: [
                        { id: "a", text: "Privilege that doesn't match the person — e.g. a low-level title suddenly holding admin rights" },
                        { id: "b", text: "Whether every account has a profile picture" },
                        { id: "c", text: "How many total accounts exist" }
                    ],
                    correctId: "a"
                },
                {
                    id: "k2",
                    prompt: "Why does an attacker often escalate privileges after an initial compromise?",
                    choices: [
                        { id: "a", text: "It's not something attackers actually do" },
                        { id: "b", text: "To guarantee themselves a way back in even after the original access point is cleaned up" },
                        { id: "c", text: "Purely by accident" }
                    ],
                    correctId: "b"
                }
            ],
            scenario: {
                title: "Find the Escalation",
                briefing: "Five accounts, one recent change that shouldn't have happened.",
                steps: [
                    {
                        type: "info",
                        title: "What to compare",
                        body: [
                            "Each account lists a job title/role, current access level, and when that access was last changed. Most changes are unremarkable — role changes happen when people actually change jobs. The tell is a mismatch between title and access."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Spot the mismatched account",
                        prompt: "Five accounts. Click the one whose access doesn't match who they are.",
                        columns: ["USER", "ROLE", "ACCESS LEVEL", "LAST CHANGED"],
                        correctId: "u3",
                        hint: "Compare each person's job title against their access level — one combination makes no organizational sense at all.",
                        successText: "Correct — a marketing intern holding Domain Admin, granted just two days ago, is exactly the kind of quiet privilege escalation an attacker performs after an initial compromise to guarantee themselves a way back in.",
                        failText: "Look at each row's ROLE column next to its ACCESS LEVEL — one pairing doesn't make sense for any legitimate business reason.",
                        rows: [
                            { id: "u1", cells: ["j.chen", "IT Administrator", "Domain Admin", "8 months ago"], note: "Normal — matches the role, changed long ago." },
                            { id: "u2", cells: ["m.osei", "Sales Rep", "Standard User", "1 year ago"], note: "Normal — matches the role." },
                            { id: "u3", cells: ["k.reyes", "Marketing Intern", "Domain Admin", "2 days ago"], note: "This is it — an intern-level role with the highest possible access, granted only two days ago, with no plausible business reason." },
                            { id: "u4", cells: ["d.patel", "HR Manager", "HR System Access", "6 months ago"], note: "Normal — matches the role." },
                            { id: "u5", cells: ["s.nguyen", "Finance Analyst", "Finance System Access", "3 months ago"], note: "Normal — matches the role." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Respond correctly",
                        prompt: "What's the right response to k.reyes's unexplained Domain Admin grant?",
                        hint: "This looks like exactly the kind of access an attacker sets up for themselves — treat it that way.",
                        successText: "Right — revoke the elevated access immediately and investigate how it was granted. It could be how the attacker is planning to get back in even after the original compromise is cleaned up.",
                        failText: "An unexplained admin grant on an intern-level account needs to be pulled back right away — leaving it in place risks it being the attacker's way back in.",
                        choices: [
                            { id: "a", text: "Revoke the Domain Admin access and investigate how/why it was granted" },
                            { id: "b", text: "Leave it — the intern probably just needed it for a project" },
                            { id: "c", text: "Promote everyone else to Domain Admin too, for consistency" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real IAM app is a proper table — IDENTITY / TYPE / PRIVILEGE / STATUS / RISK / REVIEW — sortable and filterable, plus a detail panel when you click a row.",
                        mockup: `
                            <table class="iam-table">
                                <thead>
                                    <tr><th>IDENTITY</th><th>TYPE</th><th>PRIVILEGE</th><th>STATUS</th><th>RISK</th><th>REVIEW</th></tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><div class="iam-user-cell"><div class="iam-avatar">KR</div><div><strong>K. Reyes</strong><small>k.reyes</small></div></div></td>
                                        <td><span class="iam-type">Intern</span></td>
                                        <td><div class="iam-privilege-cell"><span class="iam-privilege iam-privilege-admin">Domain Admin</span></div></td>
                                        <td><span class="iam-account-status iam-status-active">Active</span></td>
                                        <td><span class="iam-risk iam-risk-high">High</span></td>
                                        <td><span class="iam-review-status">Flagged</span></td>
                                    </tr>
                                    <tr>
                                        <td><div class="iam-user-cell"><div class="iam-avatar">MO</div><div><strong>M. Osei</strong><small>m.osei</small></div></div></td>
                                        <td><span class="iam-type">Employee</span></td>
                                        <td><div class="iam-privilege-cell"><span class="iam-privilege iam-privilege-standard">Standard User</span></div></td>
                                        <td><span class="iam-account-status iam-status-active">Active</span></td>
                                        <td><span class="iam-risk iam-risk-low">Low</span></td>
                                        <td><span class="iam-review-status">Clear</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        `,
                        notes: [
                            "PRIVILEGE and RISK are color-coded — a high-privilege badge on an account that shouldn't have one is exactly what you scanned for in the practice table.",
                            "Clicking a row opens a detail panel with the account's full privilege list and history, so you can see exactly when and how an escalation like k.reyes's happened."
                        ],
                        outro: "That's the real IAM table — same title-vs-access mismatch you just practiced spotting, in the real column layout."
                    }
                ]
            }
        },


        /* =================================================
           MALWARE SANDBOX
           ================================================= */
        sandbox: {
            id: "sandbox",
            title: "Malware Sandbox",
            icon: "🧪",
            accent: "#d4917a",
            tagline: "Detonate it safely, see what it actually does",
            tier: "deep",
            estMinutes: 5,
            overview: [
                "The Malware Sandbox runs a suspicious file in an isolated environment and records exactly what it does — files it creates, registry keys it touches, network connections it makes — without any risk to the real network. It turns \"is this file bad?\" from a guess into an observed fact.",
                "Reading the report is the real skill: a file that quietly drops itself into a Startup folder and then reaches out to an external address on a schedule is describing two of the most common malware behaviors there are — persistence and command-and-control — in plain language, once you know what to look for."
            ],
            keySkills: [
                "Reading a detonation report's list of observed behaviors",
                "Recognizing persistence mechanisms (Startup folder, registry Run keys)",
                "Recognizing command-and-control indicators (repeated outbound calls)",
                "Turning a behavior report into a verdict and a response"
            ],
            knowledgeCheck: [
                {
                    id: "k1",
                    prompt: "Why detonate a suspicious file in a sandbox instead of just guessing whether it's bad?",
                    choices: [
                        { id: "a", text: "It turns \"is this bad?\" from a guess into an observed fact, with zero risk to the real network" },
                        { id: "b", text: "It's faster than any other method, always" },
                        { id: "c", text: "It automatically deletes the file either way" }
                    ],
                    correctId: "a"
                },
                {
                    id: "k2",
                    prompt: "A file that drops itself into Startup AND repeatedly contacts an external address describes which two behaviors?",
                    choices: [
                        { id: "a", text: "Persistence and command-and-control" },
                        { id: "b", text: "Two completely unrelated, benign actions" },
                        { id: "c", text: "Just a disk cleanup routine" }
                    ],
                    correctId: "a"
                }
            ],
            scenario: {
                title: "Detonate & Diagnose",
                briefing: "A suspicious attachment was detonated in the sandbox. Six actions were logged.",
                steps: [
                    {
                        type: "info",
                        title: "Reading the behavior log",
                        body: [
                            "Every logged action is something the sample did while running in isolation. Some actions are completely ordinary for any program (checking the time, reading available disk space); others are the specific signatures analysts look for."
                        ]
                    },
                    {
                        type: "spot",
                        title: "Find the C2 signal",
                        prompt: "Six behaviors were logged during detonation. Click the one that indicates command-and-control communication.",
                        columns: ["ACTION"],
                        correctId: "b4",
                        hint: "Most of these are mundane housekeeping any program might do. One involves reaching out to an external address on a repeating schedule.",
                        successText: "Correct — a repeating outbound connection to an external, unrecognized address on a fixed interval is the textbook signature of a malware sample checking in with its command-and-control server.",
                        failText: "Look for the one behavior that involves talking to something outside the sandboxed machine, on a repeating schedule.",
                        rows: [
                            { id: "b1", cells: ["Read system clock"], note: "Ordinary — nearly every program checks the time." },
                            { id: "b2", cells: ["Queried available disk space"], note: "Ordinary — common, unremarkable behavior." },
                            { id: "b3", cells: ["Opened a temporary file for writing"], note: "Common enough on its own, though worth noting alongside other behaviors." },
                            { id: "b4", cells: ["Connected to 185.203.117.42 every 60 seconds"], note: "This is it — a repeating outbound connection to an external, unrecognized address is a classic command-and-control check-in." },
                            { id: "b5", cells: ["Displayed a dialog box"], note: "Ordinary — plenty of legitimate software shows dialogs." },
                            { id: "b6", cells: ["Enumerated installed fonts"], note: "Ordinary — mundane, common system query." }
                        ]
                    },
                    {
                        type: "quiz",
                        title: "Read the full picture",
                        prompt: "The full report also shows the sample copied itself into the Windows Startup folder. Combined with the C2 beacon, what's the verdict?",
                        hint: "One behavior means \"it survives a reboot,\" the other means \"it's actively communicating with an attacker.\" Together, that's about as clear as a verdict gets.",
                        successText: "Exactly — persistence (Startup folder) plus active command-and-control (the repeating beacon) together are a clear, high-confidence malicious verdict, not just \"suspicious.\"",
                        failText: "Persistence plus an active C2 beacon together describe a fully functioning piece of malware — that combination is stronger than either behavior alone.",
                        choices: [
                            { id: "a", text: "Malicious, high confidence — persistence plus active C2 communication" },
                            { id: "b", text: "Inconclusive — need to see more behaviors" },
                            { id: "c", text: "Safe — dialog boxes and font checks are common in legitimate software" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "quiz",
                        title: "What happens to the real host?",
                        prompt: "This exact file was found on a real employee's machine, not just the sandbox. What's the right response for that host?",
                        hint: "The sandbox confirmed the file is genuinely malicious — anything less than a full response on the real machine leaves it compromised.",
                        successText: "Right — isolate the host immediately and run a full incident response: this isn't a maybe anymore, the sandbox confirmed exactly what the file does.",
                        failText: "The sandbox already confirmed this file is malicious with persistence and active C2 — the real host needs a full, immediate response, not a lighter touch.",
                        choices: [
                            { id: "a", text: "Isolate the host immediately and run the full incident-response process" },
                            { id: "b", text: "Just delete the file — the host is probably fine otherwise" },
                            { id: "c", text: "Nothing yet — wait for a second confirmation" }
                        ],
                        correctId: "a"
                    },
                    {
                        type: "ingame",
                        title: "What this looks like in NORTHSTAR",
                        intro: "The real report opens with a verdict and four summary stats, then a BEHAVIOR panel with the full timestamped log.",
                        mockup: `
                            <div class="sandbox-summary-grid">
                                <div class="sandbox-card"><span>FILE TYPE</span><strong>Windows Executable</strong></div>
                                <div class="sandbox-card"><span>SIZE</span><strong>412 KB</strong></div>
                                <div class="sandbox-card"><span>THREAT</span><strong>Trojan / Backdoor</strong></div>
                                <div class="sandbox-card"><span>CONFIDENCE</span><strong>96%</strong></div>
                            </div>
                            <div class="sandbox-panel">
                                <div class="sandbox-panel-header">BEHAVIOR</div>
                                <div class="sandbox-behavior">
                                    <div class="sandbox-behavior-row">
                                        <span class="sandbox-time">00:02</span>
                                        <span class="sandbox-event-type">Network Connection</span>
                                        <span class="sandbox-severity high">HIGH</span>
                                        <span class="sandbox-event-detail">Connected to 185.203.117.42 every 60 seconds</span>
                                    </div>
                                    <div class="sandbox-behavior-row">
                                        <span class="sandbox-time">00:00</span>
                                        <span class="sandbox-event-type">System Query</span>
                                        <span class="sandbox-severity low">LOW</span>
                                        <span class="sandbox-event-detail">Read system clock</span>
                                    </div>
                                </div>
                            </div>
                        `,
                        notes: [
                            "FILE TYPE / SIZE / THREAT / CONFIDENCE up top is the report's headline — the same verdict you built up to across the last two questions.",
                            "Each BEHAVIOR row has its own severity badge, exactly like the C2 connection you picked out of the six-action log — HIGH severity rows are where you'd focus first in a real report."
                        ],
                        outro: "That's the real report — same behavior-log reading you just practiced, with the full verdict and summary stats around it."
                    }
                ]
            }
        }

    };


    const ORDER = [
        "siem", "alerts", "network", "map", "email", "hosts",
        "vpn", "files", "playbook", "cracker", "intel", "iam",
        "sandbox"
    ];


    window.NorthstarTrainingData = {
        order: ORDER,
        apps: APPS,
        tierLabels: TIER_LABELS
    };

})();
