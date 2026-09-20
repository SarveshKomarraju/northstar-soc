/* =========================================================
   NORTHSTAR SOC — EXPERIENCE OTHER ATTACKS
   Scenario Data (v3 — animation timelines)
   ---------------------------------------------------------
   Pure data module. Defines the 10 educational attack
   experiences played by AttackExperienceEngine.js /
   AttackExperienceRenderer.js. Nothing in this file executes
   any real network, credential, or exploitation logic — every
   IP address, domain, hash, credential, and session token
   below is fictional/synthetic and exists only to illustrate
   the concept on screen.

   Fictional IPs/domains are drawn from IANA documentation
   ranges and reserved example domains (RFC 5737 / RFC 1918 /
   *.example) so nothing here resolves to a real host.

   ---------------------------------------------------------
   TIMELINES (v3 — replaces the old per-step scene model)
   ---------------------------------------------------------
   Each attack is one ordered `timeline` array of small ACTIONS
   played back-to-back by AttackExperienceEngine.js. Every
   action can carry a `wait` (ms to pause after it fires before
   the next one starts) and, where relevant, a `side`
   ("attacker" | "victim") saying which panel it targets. There
   is no separate "attacker clock" and "victim clock" — both
   panels are driven off the exact same ordered list, which is
   what keeps the two POVs synchronized to one shared timeline.

   Because every action just APPENDS to or mutates something
   already on screen (see AttackExperienceRenderer.js), the
   result reads as one continuous, real-feeling animation —
   a cursor actually moves and clicks, fields actually get
   typed into character by character, a hash table actually
   sweeps and reveals — rather than a series of static
   snapshots. Nothing is ever absolutely positioned on top of
   anything else, so unrelated things (like a Wi-Fi "connected"
   message and a later SOC alert) simply stack in order instead
   of visually overlapping.

   Global actions (no `side`):
     "stage"   { stage }                    — advance the shared timeline bar
     "caption" { text }                     — update the shared "WHAT'S HAPPENING" line
     "wait"    { }                          — a pure pause, no visual change

   Per-side actions ({ side: "attacker" | "victim", ... }):
     "line"          { text, icon?, tone? }         — append a plain event/alert card. tone: "normal"|"alert"|"good"
     "wifiInit"      { networks: [{id,name,bars,tone}] }
     "wifiAdd"       { network: {id,name,bars,tone} }
     "clickNetwork"  { id, result }                 — animated cursor click on a Wi-Fi row; result: "connecting"|"connected"
     "browserOpen"   { url, secure, page }          — open a fake browser window. page.kind: "login"|"search"|"account"
     "browserUrl"    { url, secure }                — update just the address bar (redirects)
     "pageSwap"      { page }                       — swap the page inside an already-open browser
     "typeField"     { field, text }                — typewriter-type plain text into a login field (by key)
     "typeMasked"    { field, text }                — typewriter-type a password field (dots only)
     "pressButton"   { }                             — animated click on the browser page's primary button
     "browserStatus" { text, tone? }                — set a status line under a login form (e.g. "✓ Connected")
     "searchType"    { text }                        — type into a search-page query bar
     "searchResult"  { results?, banner?, leaked? }  — update a search page's results/error banner
     "captureInit"   { mode: "capture"|"attempts" }
     "captureAdd"    { entry: {primary, secondary, status} }   — status: "captured"|"success"|"fail"
     "hashInit"      { rows: [{hash}] }              — a masked hash→password table (use plenty of rows, not just 2!)
     "hashScan"      { on }                          — toggle the scanning sweep animation
     "hashReveal"    { index, password }             — flip one row from masked to revealed
     "diagramInit"   { nodes: [{id,label,icon,tone}], edges: [{from,to,animated?,label?}] }
     "diagramEdge"   { from, to, animated?, label? }  — update/animate one existing edge
     "usbInit"       { }
     "usbState"      { state, fileName? }            — state: "idle"|"connected"|"file-visible"|"opened"|"running"
     "clickUsbFile"  { }                              — animated cursor click on the drive's file

   Adding an 11th experience means adding one more object (with
   its own timeline[]) to this array — no new engine or renderer
   code required.

   ---------------------------------------------------------
   MITRE ATT&CK METADATA
   ---------------------------------------------------------
   Each attack also carries a small `mitre` object mapping it to
   its real-world MITRE ATT&CK (Enterprise) technique:

     mitre: { id: "T1557.004", name: "Adversary-in-the-Middle: Evil Twin" }

   Purely informational — shown as a small reference pill on the
   picker card, the experience screen, and the Compare Attacks
   table. Lets a curious user go look up the real technique.

   ---------------------------------------------------------
   COMPARE METADATA (used by AttackCompareApp.js)
   ---------------------------------------------------------
   Each attack also carries a small `compare` object, read by the
   "COMPARE ATTACKS" screen so it can explain, generically, how
   any two attacks differ — no per-pair content is required for
   this to work:

     compare: {
         vector,                 // one-line "how the attacker gets in"
         targetLayer,            // e.g. "Network (Wi-Fi)", "Identity / Credentials"
         requiresVictimAction,   // does a human have to click/type/plug something in?
         automated,              // does this typically run unattended at scale?
         primarySignal,          // the single clearest thing a defender would notice
         goal,                   // what the attacker is ultimately after
         distinguishFrom: {      // OPTIONAL, curated notes for genuinely confusable pairs
             "<other-attack-id>": "plain-language explanation of the key difference"
         }
     }

   distinguishFrom only needs to be authored for pairs that are
   actually easy to mix up (e.g. Evil Twin / ARP Spoofing / MITM
   all involve traffic interception; Rainbow Table / Credential
   Stuffing are both credential attacks) — AttackCompareApp.js
   checks BOTH attacks' distinguishFrom maps and falls back to an
   auto-generated comparison from the structured fields above when
   neither side has a curated note for that pair. Keep curated
   pairs symmetric (author the note on both attacks, even if the
   wording differs slightly) so the explanation reads naturally
   regardless of which attack the user picks first.
   ========================================================= */

(function () {

    "use strict";

    const STAGES = [
        "RECON",
        "INITIAL ACTION",
        "EXPLOITATION",
        "ACCESS",
        "ACTIVITY",
        "DETECTION"
    ];

    const ATTACK_EXPERIENCES = [

        /* =================================================
           01 — EVIL TWIN
           ================================================= */
        {
            id: "evil-twin",
            number: 1,
            title: "Evil Twin",
            category: "Network Attack",
            difficulty: "Intermediate",
            accent: "#6fb2e0",
            description: "Watch how a malicious wireless access point can deceive a victim device.",
            mitre: { id: "T1557.004", name: "Adversary-in-the-Middle: Evil Twin" },
            compare: {
                vector: "Fake wireless access point broadcasting a trusted network's name",
                targetLayer: "Network (Wi-Fi)",
                requiresVictimAction: true,
                automated: false,
                primarySignal: "Duplicate SSID broadcasting from an unrecognized access point",
                goal: "Intercept traffic and harvest credentials by getting the victim to connect to, and log into, a fake network",
                distinguishFrom: {
                    "arp-spoofing": "Evil Twin gets the attacker positioned by tricking the victim's device into joining a brand-new fake Wi-Fi network. ARP Spoofing never introduces a new network at all — the victim is already on the legitimate LAN, and the attacker instead forges local ARP replies to redirect traffic without the victim ever seeing anything new to connect to.",
                    "man-in-the-middle": "Evil Twin is a specific technique for getting into a man-in-the-middle position — the fake access point IS the mechanism. \"Man-in-the-Middle\" more broadly describes the resulting position (and what an attacker does once there, like tampering with data), which can also be reached other ways, such as ARP spoofing or a forged certificate."
                }
            },
            attackerLabel: "ROGUE AP CONSOLE",
            victimLabel: "EMPLOYEE LAPTOP",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "The attacker scans nearby Wi-Fi networks to find one worth cloning.", wait: 1400 },
                { type: "line", side: "attacker", icon: "🛰", text: "Nearby network identified: CorpNet-Guest (WPA2)", wait: 1200 },
                { type: "wifiInit", side: "victim", networks: [ { id: "real", name: "CorpNet-Guest", bars: 3, tone: "legit" } ], wait: 1400 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "A fake access point is stood up with the exact same name — and a stronger signal.", wait: 1400 },
                { type: "line", side: "attacker", icon: "📡", text: "Rogue access point broadcasting as \"CorpNet-Guest\"", wait: 1100 },
                { type: "line", side: "attacker", icon: "📶", text: "Signal boosted to outcompete the real access point", wait: 1300 },
                { type: "wifiAdd", side: "victim", network: { id: "rogue", name: "CorpNet-Guest", bars: 4, tone: "rogue" }, wait: 1700 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "Most devices auto-reconnect to a remembered network name without checking it's the same physical access point.", wait: 1500 },
                { type: "line", side: "attacker", icon: "🔗", text: "Client device probing rogue AP…", wait: 1000 },
                { type: "clickNetwork", side: "victim", id: "rogue", result: "connected", wait: 1700 },
                { type: "line", side: "victim", icon: "✓", text: "Connected to Wi-Fi", tone: "good", wait: 1400 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "Once connected, all of the victim's traffic passes through the attacker's machine before reaching the internet.", wait: 1500 },
                { type: "line", side: "attacker", icon: "🕸", text: "Traffic now relayed through the attacker's machine", wait: 1200 },
                { type: "browserOpen", side: "victim", url: "corplogin.northstar-corp.example", secure: false, page: { kind: "login", heading: "CorpNet Wi-Fi Sign-In", fields: [ { key: "user", label: "Employee ID" }, { key: "pass", label: "Password" } ], buttonLabel: "Sign In" }, wait: 1300 },
                { type: "typeField", side: "victim", field: "user", text: "jsmith", wait: 1300 },
                { type: "typeMasked", side: "victim", field: "pass", text: "Sunshine!42", wait: 1600 },
                { type: "pressButton", side: "victim", wait: 1100 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "The submitted credentials land on the attacker's screen the moment they're sent.", wait: 1400 },
                { type: "captureInit", side: "attacker", mode: "capture", wait: 600 },
                { type: "captureAdd", side: "attacker", entry: { primary: "jsmith", secondary: "Sunshine!42 (synthetic)", status: "captured" }, wait: 1400 },
                { type: "browserStatus", side: "victim", text: "✓ Connected to Wi-Fi", tone: "good", wait: 1700 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Defenders can catch Evil Twin attacks by watching for duplicate SSIDs and gateway identity changes.", wait: 1400 },
                { type: "line", side: "victim", icon: "⚠", text: "SOC ALERT — Rogue access point suspected (duplicate SSID)", tone: "alert", wait: 1700 },
                { type: "line", side: "attacker", icon: "🏁", text: "Attack complete — one set of credentials captured", wait: 2200 }
            ],
            summary: {
                whatHappened: "An attacker broadcast a fake wireless network using the same name as a trusted corporate network. The victim's device automatically connected to the stronger, malicious signal, and the employee unknowingly typed their real credentials into a fake sign-in page.",
                whatAttackerWanted: "To intercept network traffic and harvest credentials without the victim noticing anything was wrong.",
                evidence: [
                    "Duplicate SSID broadcasting from an unrecognized access point",
                    "Sudden change in gateway/router MAC address",
                    "Unusually strong signal compared to the known access point",
                    "A Wi-Fi sign-in page appearing where one normally wouldn't",
                    "Endpoint anomaly score increase tied to a network change"
                ],
                defenses: [
                    "Use WPA2/WPA3-Enterprise with certificate-based authentication so devices verify the network, not just its name",
                    "Disable auto-connect to open or previously-seen SSIDs on corporate devices",
                    "Deploy wireless intrusion detection (WIDS) to flag rogue/duplicate access points",
                    "Train users to verify network names and be suspicious of unexpected Wi-Fi login pages",
                    "Monitor for unexpected gateway/MAC changes on managed endpoints"
                ]
            }
        },

        /* =================================================
           02 — RAINBOW TABLE
           ================================================= */
        {
            id: "rainbow-table",
            number: 2,
            title: "Rainbow Table",
            category: "Credential Attack",
            difficulty: "Intermediate",
            accent: "#8a7fe0",
            description: "See how precomputed hash tables can instantly reverse weak, unsalted password hashes.",
            mitre: { id: "T1110.002", name: "Brute Force: Password Cracking" },
            compare: {
                vector: "Precomputed hash-to-password lookup table applied to an already-leaked hash database",
                targetLayer: "Identity / Credentials",
                requiresVictimAction: false,
                automated: true,
                primarySignal: "A successful login immediately following a credential-exposure alert, with no failed attempts beforehand",
                goal: "Convert stolen password hashes into working plaintext passwords without guessing",
                distinguishFrom: {
                    "credential-stuffing": "Rainbow Table starts from a database of password HASHES the attacker already has (stolen from this system) and cracks them offline with a precomputed table — no login attempts happen until after cracking. Credential Stuffing never touches a hash at all: it takes plaintext username/password pairs leaked from an UNRELATED service and tries them directly against the login form, online, at scale, betting on password reuse."
                }
            },
            attackerLabel: "CRACKING WORKSTATION",
            victimLabel: "IDENTITY / SOC CONSOLE",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "A database of password hashes has leaked online.", wait: 1400 },
                { type: "line", side: "attacker", icon: "🗄", text: "Leaked hash database located (500 entries, synthetic)", wait: 1300 },
                { type: "line", side: "victim", icon: "🪪", text: "Authentication volume: normal", wait: 1400 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "A rainbow table is a precomputed lookup of hash-to-password pairs, built once and reused against any similarly-hashed database.", wait: 1700 },
                { type: "hashInit", side: "attacker", rows: [
                    { hash: "9f2c…a01e" }, { hash: "5b71…c4f2" }, { hash: "d834…7b19" }, { hash: "1e6a…c0f5" },
                    { hash: "77b2…9ad4" }, { hash: "c410…3e88" }, { hash: "2f9d…b6a1" }, { hash: "a08e…44c7" }
                ], wait: 1300 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "Because these hashes are unsalted, identical passwords always produce identical hashes — making them vulnerable to precomputed tables.", wait: 1700 },
                { type: "hashScan", side: "attacker", on: true, wait: 1900 },
                { type: "line", side: "victim", icon: "🔎", text: "Internal-looking credential hashes detected outside the network", tone: "alert", wait: 1500 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "Once a hash is matched, the attacker has recovered a working (fictional) password for that account.", wait: 1600 },
                { type: "hashReveal", side: "attacker", index: 1, password: "Summer2024!", wait: 900 },
                { type: "hashReveal", side: "attacker", index: 4, password: "Blue$Sky19", wait: 900 },
                { type: "hashReveal", side: "attacker", index: 7, password: "Winter2023", wait: 1200 },
                { type: "hashScan", side: "attacker", on: false, wait: 900 },
                { type: "line", side: "victim", icon: "🪪", text: "Authentication volume: normal", wait: 1300 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "A precomputed table turned a stolen hash into a working password in seconds because the passwords were not salted.", wait: 1700 },
                { type: "browserOpen", side: "attacker", url: "corplogin.northstar-corp.example", secure: true, page: { kind: "login", heading: "NorthStar Corp Login", fields: [ { key: "user", label: "Username" }, { key: "pass", label: "Password" } ], buttonLabel: "Log In" }, wait: 1200 },
                { type: "typeField", side: "attacker", field: "user", text: "jsmith", wait: 1200 },
                { type: "typeMasked", side: "attacker", field: "pass", text: "Summer2024!", wait: 1500 },
                { type: "pressButton", side: "attacker", wait: 1000 },
                { type: "browserStatus", side: "attacker", text: "✓ Logged in", tone: "good", wait: 1400 },
                { type: "line", side: "victim", icon: "📍", text: "jsmith authenticated from a new, unusual location", tone: "alert", wait: 1700 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Salting each password before hashing means identical passwords produce different hashes, making precomputed tables far less useful.", wait: 1600 },
                { type: "line", side: "victim", icon: "🚫", text: "Account flagged for review, password reset forced", tone: "alert", wait: 1700 },
                { type: "line", side: "attacker", icon: "🏁", text: "Session ended — one working password recovered from the leak", wait: 2200 }
            ],
            summary: {
                whatHappened: "A fictional database of unsalted password hashes was exposed. The attacker used a precomputed rainbow table to instantly reverse several users' hashes back into plaintext passwords and logged in with one.",
                whatAttackerWanted: "To convert stolen hashes into usable passwords without brute-force guessing.",
                evidence: [
                    "Internal-formatted credential hashes discovered outside the network",
                    "Successful login immediately following a credential-exposure alert",
                    "Login originating from an unfamiliar geographic location",
                    "No corresponding failed-login attempts before the successful one",
                    "Account activity inconsistent with the user's normal pattern"
                ],
                defenses: [
                    "Hash passwords with a strong, salted algorithm (bcrypt, scrypt, or Argon2) instead of unsalted MD5/SHA1",
                    "Enforce unique per-user salts so identical passwords never produce identical hashes",
                    "Require multi-factor authentication so a recovered password alone isn't enough",
                    "Monitor for logins from new locations or devices immediately after a data exposure",
                    "Rotate credentials immediately when a hash database is known to be exposed"
                ]
            }
        },

        /* =================================================
           03 — CREDENTIAL STUFFING
           ================================================= */
        {
            id: "credential-stuffing",
            number: 3,
            title: "Credential Stuffing",
            category: "Credential Attack",
            difficulty: "Beginner",
            accent: "#e7b86a",
            description: "See how passwords reused from an unrelated breach can be tried automatically at scale.",
            mitre: { id: "T1110.004", name: "Brute Force: Credential Stuffing" },
            compare: {
                vector: "Automated bulk login attempts using username/password pairs leaked from an unrelated breach",
                targetLayer: "Identity / Credentials",
                requiresVictimAction: false,
                automated: true,
                primarySignal: "A large spike in failed logins spread across many different accounts, from many rotating IP addresses",
                goal: "Find accounts where a password was reused elsewhere, without guessing or cracking anything",
                distinguishFrom: {
                    "rainbow-table": "Credential Stuffing never touches a password hash — it fires plaintext credentials from an unrelated breach straight at the login form. Rainbow Table instead starts from hashes stolen FROM this system and cracks them offline before any login is attempted.",
                    "session-hijacking": "Credential Stuffing is trying to establish brand-new access by guessing a valid password. Session Hijacking skips the password step entirely — it reuses an already-authenticated session token stolen from a live session, so no login attempt (successful or failed) ever occurs."
                }
            },
            attackerLabel: "AUTOMATION CONSOLE",
            victimLabel: "IDENTITY / SOC CONSOLE",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "A list of usernames and passwords from an unrelated (fictional) breach is loaded.", wait: 1500 },
                { type: "line", side: "attacker", icon: "📋", text: "12,000 fictional email:password pairs loaded", wait: 1300 },
                { type: "line", side: "victim", icon: "🪪", text: "Login volume: ~40/min (baseline)", wait: 1300 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "Unlike brute force (many passwords, one account), credential stuffing tries one password per account across thousands of accounts.", wait: 1800 },
                { type: "line", side: "attacker", icon: "🤖", text: "Automated login attempts beginning against corplogin.northstar-corp.example", wait: 1300 },
                { type: "line", side: "victim", icon: "📈", text: "Login attempt rate climbing — 400/min from rotating IPs", tone: "alert", wait: 1600 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "A high failure rate spread across many different accounts, from many IPs, is a strong signal of automated credential stuffing.", wait: 1800 },
                { type: "captureInit", side: "attacker", mode: "attempts", wait: 600 },
                { type: "captureAdd", side: "attacker", entry: { primary: "alee@northstar-corp.example", status: "fail" }, wait: 450 },
                { type: "captureAdd", side: "attacker", entry: { primary: "bpatel@northstar-corp.example", status: "fail" }, wait: 450 },
                { type: "captureAdd", side: "attacker", entry: { primary: "mwong@northstar-corp.example", status: "fail" }, wait: 450 },
                { type: "captureAdd", side: "attacker", entry: { primary: "tnguyen@northstar-corp.example", status: "fail" }, wait: 800 },
                { type: "line", side: "victim", icon: "📈", text: "1,180 failed logins across 900+ accounts in 3 minutes", tone: "alert", wait: 1500 },
                { type: "line", side: "victim", icon: "🌐", text: "Traffic from 214 distinct IP addresses", wait: 1400 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "The attacker doesn't need every password to work — out of thousands of attempts, even a low success rate yields compromised accounts.", wait: 1800 },
                { type: "captureAdd", side: "attacker", entry: { primary: "jsmith@northstar-corp.example", secondary: "reused password", status: "success" }, wait: 1500 },
                { type: "line", side: "victim", icon: "✅", text: "jsmith@northstar-corp.example authenticated after 3 prior failures", wait: 1700 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "Successful stuffing attempts often look like a normal login unless defenders check the surrounding pattern of failures.", wait: 1800 },
                { type: "browserOpen", side: "attacker", url: "corplogin.northstar-corp.example/account", secure: true, page: { kind: "account", heading: "My Account", rows: [ { label: "Signed in as", value: "jsmith" }, { label: "Session", value: "Active (synthetic)" } ] }, wait: 1400 },
                { type: "line", side: "victim", icon: "📍", text: "New device and unusual location for jsmith", tone: "alert", wait: 1700 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Detecting the pattern across the whole login system — not just one account — is what reveals credential stuffing.", wait: 1700 },
                { type: "line", side: "victim", icon: "🚫", text: "Session revoked, password reset forced", tone: "alert", wait: 1700 },
                { type: "line", side: "attacker", icon: "🏁", text: "Run complete — 1 of 12,000 attempts succeeded", wait: 2200 }
            ],
            summary: {
                whatHappened: "An attacker used a list of usernames and passwords from an unrelated (fictional) data breach and tried them against the corporate login portal in bulk. Most failed, but one account reused a password and was compromised.",
                whatAttackerWanted: "To find accounts where employees reused passwords from other services, gaining access without guessing anything.",
                evidence: [
                    "Large spike in failed logins across many different accounts",
                    "Login attempts arriving from many rotating IP addresses",
                    "A successful login immediately following a batch of failures",
                    "New device or location associated with the successful login",
                    "Login pattern matching known automation timing (very even intervals)"
                ],
                defenses: [
                    "Require multi-factor authentication so a correct password alone isn't sufficient",
                    "Rate-limit and CAPTCHA logins after repeated failures from an IP or across accounts",
                    "Check user passwords against known-breach password lists at signup and login",
                    "Monitor for distributed low-and-slow login patterns, not just single-account brute force",
                    "Encourage or enforce unique passwords via a password manager"
                ]
            }
        },

        /* =================================================
           04 — SQL INJECTION
           ================================================= */
        {
            id: "sql-injection",
            number: 4,
            title: "SQL Injection",
            category: "Web Application Attack",
            difficulty: "Intermediate",
            accent: "#d4917a",
            description: "See how unvalidated input can change what a web application's database query returns.",
            mitre: { id: "T1190", name: "Exploit Public-Facing Application" },
            compare: {
                vector: "Malicious input inserted into a web application's database query",
                targetLayer: "Application / Database",
                requiresVictimAction: false,
                automated: false,
                primarySignal: "SQL keywords or abnormal syntax appearing inside ordinary input fields or query strings",
                goal: "Read or manipulate database contents the application was never meant to expose",
                distinguishFrom: {
                    "dns-tunneling": "SQL Injection manipulates a web application's OWN database query using a form field or URL parameter — the target is the application's database. DNS Tunneling has nothing to do with databases or web forms; it smuggles data out through DNS lookups, a completely different, network-layer covert channel.",
                    "watering-hole": "SQL Injection attacks the target organization's OWN web application directly. Watering Hole instead compromises a DIFFERENT, third-party site that the target's employees happen to visit, then uses that trusted site as a delivery mechanism — the target's own application is never touched."
                }
            },
            attackerLabel: "ATTACKER BROWSER",
            victimLabel: "APPLICATION / SOC CONSOLE",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "The attacker starts by testing whether the product search box is vulnerable.", wait: 1500 },
                { type: "browserOpen", side: "attacker", url: "shop.northstar-corp.example/products?id=17", secure: true, page: { kind: "search", query: "id=17", results: [ { title: "Standing Desk", meta: "$249.00" } ] }, wait: 1300 },
                { type: "line", side: "victim", icon: "🌐", text: "/products?id=17 → 200 OK", wait: 1300 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "Adding a single quote breaks the page — an error like this suggests the input is inserted directly into a database query.", wait: 1900 },
                { type: "searchType", side: "attacker", text: "id=17'", wait: 1300 },
                { type: "searchResult", side: "attacker", banner: "500 Internal Server Error", results: [], wait: 1400 },
                { type: "line", side: "victim", icon: "🌐", text: "Query string length spikes — 118 chars (baseline ~12)", wait: 1600 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "The crafted input attempts to append an extra query that pulls data from a different, unrelated table.", wait: 1900 },
                { type: "searchType", side: "attacker", text: "17 UNION SELECT username, password FROM fictional_users--", wait: 1700 },
                { type: "searchResult", side: "attacker", banner: "", results: [], wait: 1200 },
                { type: "line", side: "victim", icon: "🛡", text: "WAF: SQL keywords detected in query string (\"UNION\", \"SELECT\")", tone: "alert", wait: 1700 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "Successful injection can silently expose entire tables that a normal user should never be able to reach through this page.", wait: 1900 },
                { type: "searchResult", side: "attacker", results: [ { title: "alee", meta: "$synthetic_hash_1" }, { title: "bpatel", meta: "$synthetic_hash_2" }, { title: "jsmith", meta: "$synthetic_hash_3" } ], leaked: true, wait: 1700 },
                { type: "line", side: "victim", icon: "🗄", text: "Query executed against fictional_users table — unexpected for this page", wait: 1700 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "Attackers often continue mapping the database structure once the first injection succeeds.", wait: 1800 },
                { type: "searchType", side: "attacker", text: "UNION SELECT table_name, NULL FROM information_schema.tables--", wait: 1700 },
                { type: "searchResult", side: "attacker", results: [ { title: "fictional_users", meta: "table" }, { title: "fictional_orders", meta: "table" } ], leaked: false, wait: 1500 },
                { type: "line", side: "victim", icon: "📊", text: "6 anomalous queries from the same session in 90 seconds", tone: "alert", wait: 1800 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Combining web-layer and database-layer monitoring makes injection attempts far easier to catch than either alone.", wait: 1800 },
                { type: "line", side: "victim", icon: "🚫", text: "Session blocked, endpoint under review", tone: "alert", wait: 1700 },
                { type: "line", side: "attacker", icon: "⛔", text: "Session blocked by WAF — extraction attempt logged (synthetic data only)", wait: 2200 }
            ],
            summary: {
                whatHappened: "A fictional web application inserted user input directly into a database query. By crafting special input, the attacker changed what the query returned, exposing data from an unrelated table.",
                whatAttackerWanted: "To read or manipulate database contents the application was never meant to expose, such as user credentials.",
                evidence: [
                    "Database errors triggered by special characters in input fields",
                    "Abnormally long or SQL-keyword-containing query strings",
                    "Response size or structure that doesn't match the requested page",
                    "Repeated schema-probing queries from the same session",
                    "WAF/database alerts correlating to the same source session"
                ],
                defenses: [
                    "Use parameterized queries / prepared statements instead of building SQL from raw input",
                    "Apply strict input validation and allow-lists for expected input formats",
                    "Run the application's database account with least-privilege access",
                    "Deploy a web application firewall (WAF) to catch known injection patterns",
                    "Log and alert on abnormal query structure or volume per session"
                ]
            }
        },

        /* =================================================
           05 — DNS TUNNELING
           ================================================= */
        {
            id: "dns-tunneling",
            number: 5,
            title: "DNS Tunneling",
            category: "Network Attack",
            difficulty: "Advanced",
            accent: "#6fd0c9",
            description: "See how DNS lookups can be abused as a covert channel to move data out of a network.",
            mitre: { id: "T1071.004", name: "Application Layer Protocol: DNS" },
            compare: {
                vector: "Data encoded into DNS queries/subdomains, using DNS as a covert channel",
                targetLayer: "Network (DNS)",
                requiresVictimAction: false,
                automated: true,
                primarySignal: "A high volume of long, random-looking subdomains queried against one unfamiliar domain",
                goal: "Exfiltrate data or maintain command-and-control while blending in with normal, rarely-blocked DNS traffic",
                distinguishFrom: {
                    "sql-injection": "DNS Tunneling is a covert network channel with no relationship to a database or a web form — it works even against systems with no web application at all. SQL Injection specifically abuses a vulnerable database query inside a web application."
                }
            },
            attackerLabel: "EXFIL CONTROL SERVER",
            victimLabel: "NETWORK / SOC CONSOLE",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "DNS is almost always allowed through firewalls, making it an attractive covert channel when other ports are blocked.", wait: 1700 },
                { type: "line", side: "attacker", icon: "🧭", text: "Other ports blocked — DNS (port 53) is wide open", wait: 1300 },
                { type: "line", side: "victim", icon: "📡", text: "DNS query volume: ~200/min (baseline)", wait: 1300 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "Data is broken into small chunks and encoded so it can be smuggled inside what looks like normal domain-name lookups.", wait: 1900 },
                { type: "line", side: "attacker", icon: "🧩", text: "240 data chunks prepared for smuggling", wait: 1500 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "Each query's subdomain secretly carries a chunk of stolen (fictional) data to the attacker's DNS server.", wait: 1900 },
                { type: "diagramInit", side: "attacker", nodes: [ { id: "host", label: "Compromised Host", icon: "💻", tone: "attacker" }, { id: "dns", label: "Attacker DNS Server", icon: "🗄", tone: "attacker" } ], edges: [ { from: "host", to: "dns" } ], wait: 1000 },
                { type: "diagramEdge", side: "attacker", from: "host", to: "dns", animated: true, label: "chunk001.fictional-c2.example", wait: 1600 },
                { type: "line", side: "victim", icon: "📡", text: "Long, random-looking subdomains appearing in DNS queries", tone: "alert", wait: 1700 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "A sudden, high-frequency stream of queries to one unfamiliar domain is a strong tunneling indicator.", wait: 1900 },
                { type: "diagramEdge", side: "attacker", from: "host", to: "dns", animated: true, label: "chunk118 received", wait: 1300 },
                { type: "diagramEdge", side: "attacker", from: "host", to: "dns", animated: true, label: "chunk219 received", wait: 1300 },
                { type: "line", side: "victim", icon: "📈", text: "240 queries to one domain in 4 minutes (baseline: 0)", tone: "alert", wait: 1700 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "Random-looking, high-entropy subdomains are unusual for legitimate DNS traffic and a common tunneling fingerprint.", wait: 2000 },
                { type: "diagramEdge", side: "attacker", from: "host", to: "dns", animated: false, label: "240/240 chunks received", wait: 1300 },
                { type: "line", side: "attacker", icon: "✅", text: "4.1MB fictional dataset reassembled from 240 DNS queries", wait: 1500 },
                { type: "line", side: "victim", icon: "📊", text: "Subdomain randomness score: 0.91 (baseline < 0.4)", tone: "alert", wait: 1800 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Defenders combine query-volume, subdomain randomness, and domain reputation to catch DNS tunneling that would otherwise blend into normal traffic.", wait: 2100 },
                { type: "line", side: "victim", icon: "⛔", text: "Domain blocked at resolver, host under investigation", tone: "alert", wait: 1800 },
                { type: "line", side: "attacker", icon: "🏁", text: "DNS tunneling session complete (synthetic data only)", wait: 2200 }
            ],
            summary: {
                whatHappened: "An attacker hid stolen (fictional) data inside a stream of DNS lookups, since DNS traffic is rarely blocked, smuggling the data out one small encoded chunk at a time.",
                whatAttackerWanted: "To exfiltrate data or maintain covert command-and-control without triggering typical firewall or proxy alerts.",
                evidence: [
                    "Long, random-looking subdomains in DNS queries",
                    "Very high query volume directed at one uncommon domain",
                    "High entropy (randomness) score in DNS query analytics",
                    "Queries to a domain with no legitimate business purpose",
                    "Steady, repetitive query timing consistent with automated tooling"
                ],
                defenses: [
                    "Monitor DNS logs for query volume, entropy, and domain reputation, not just allow/block",
                    "Restrict which internal hosts can query external DNS directly (force use of an internal resolver)",
                    "Use DNS filtering/threat-intel feeds to block known tunneling and C2 domains",
                    "Alert on abnormally long subdomains or unusual record types (e.g., excessive TXT queries)",
                    "Apply data-loss-prevention controls that inspect outbound traffic, not just perimeter ports"
                ]
            }
        },

        /* =================================================
           06 — ARP SPOOFING
           ================================================= */
        {
            id: "arp-spoofing",
            number: 6,
            title: "ARP Spoofing",
            category: "Network Attack",
            difficulty: "Intermediate",
            accent: "#7fa8c9",
            description: "See how forged ARP replies let an attacker impersonate another device on the local network.",
            mitre: { id: "T1557.002", name: "Adversary-in-the-Middle: ARP Cache Poisoning" },
            compare: {
                vector: "Forged ARP replies that make the attacker's MAC address appear to be the gateway's",
                targetLayer: "Network (Local LAN)",
                requiresVictimAction: false,
                automated: true,
                primarySignal: "The gateway's IP suddenly resolving to an unfamiliar MAC address, or one IP claimed by two MACs at once",
                goal: "Get positioned between a victim and the gateway so traffic can be intercepted or altered, using only the existing local network",
                distinguishFrom: {
                    "evil-twin": "ARP Spoofing works entirely on a network the victim is ALREADY connected to — no new Wi-Fi network ever appears. Evil Twin is the opposite: it introduces a brand-new fake access point and relies on the victim's device joining it.",
                    "man-in-the-middle": "ARP Spoofing is one specific technique for reaching a man-in-the-middle position on a local network. \"Man-in-the-Middle\" is the broader outcome/category — the same position could also be reached via a rogue Wi-Fi access point (Evil Twin) or a forged certificate, not only ARP."
                }
            },
            attackerLabel: "LAN ATTACK CONSOLE",
            victimLabel: "NETWORK / SOC CONSOLE",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "ARP maps IP addresses to hardware (MAC) addresses on a local network, and by default nothing verifies these announcements.", wait: 1900 },
                { type: "diagramInit", side: "attacker", nodes: [ { id: "victim", label: "Victim Laptop", icon: "💻", tone: "victim" }, { id: "gateway", label: "Gateway", icon: "🌐", tone: "legit" } ], edges: [ { from: "victim", to: "gateway" } ], wait: 1200 },
                { type: "line", side: "victim", icon: "🗺", text: "ARP table: gateway → known MAC (stable)", wait: 1300 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "The attacker sends fake ARP messages claiming their own machine's MAC address belongs to the gateway's IP.", wait: 2000 },
                { type: "line", side: "attacker", icon: "🎭", text: "Crafting forged ARP replies impersonating the gateway", wait: 1600 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "Because ARP has no built-in authentication, devices generally trust the most recent reply without question.", wait: 1900 },
                { type: "line", side: "attacker", icon: "✅", text: "Victim's ARP table updated with our MAC address", wait: 1500 },
                { type: "line", side: "victim", icon: "⚠", text: "Gateway's MAC address changed unexpectedly", tone: "alert", wait: 1700 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "By also spoofing the victim's ARP entry on the gateway, the attacker can sit invisibly in the middle of all traffic.", wait: 2000 },
                { type: "diagramInit", side: "attacker", nodes: [ { id: "victim", label: "Victim", icon: "💻", tone: "victim" }, { id: "attacker", label: "Attacker", icon: "🕵", tone: "attacker" }, { id: "gateway", label: "Gateway", icon: "🌐", tone: "legit" } ], edges: [ { from: "victim", to: "attacker" }, { from: "attacker", to: "gateway" } ], wait: 1200 },
                { type: "diagramEdge", side: "attacker", from: "victim", to: "attacker", animated: true, wait: 700 },
                { type: "diagramEdge", side: "attacker", from: "attacker", to: "gateway", animated: true, wait: 1300 },
                { type: "line", side: "victim", icon: "🔀", text: "Traffic path now includes an extra hop", wait: 1600 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "Seeing one IP address claimed by two different MAC addresses in a short window is a hallmark of ARP spoofing.", wait: 2000 },
                { type: "diagramEdge", side: "attacker", from: "victim", to: "attacker", animated: true, label: "220 packets captured", wait: 1600 },
                { type: "line", side: "victim", icon: "🔁", text: "One IP address now claimed by two different MAC addresses", tone: "alert", wait: 1800 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Static ARP entries, port security, and dedicated ARP-monitoring tools all help defenders catch spoofing quickly.", wait: 2000 },
                { type: "line", side: "victim", icon: "🚫", text: "Port security triggered, attacker MAC quarantined", tone: "alert", wait: 1800 },
                { type: "line", side: "attacker", icon: "🏁", text: "ARP spoofing session complete (synthetic data only)", wait: 2200 }
            ],
            summary: {
                whatHappened: "An attacker on the same local network sent forged ARP messages claiming to be the gateway, tricking the victim's device into sending its traffic through the attacker's machine.",
                whatAttackerWanted: "To position themselves between the victim and the network so they could intercept or manipulate traffic.",
                evidence: [
                    "Gateway IP suddenly mapped to an unfamiliar MAC address",
                    "One IP address claimed by two different MAC addresses at once",
                    "Unsolicited ARP replies not matching any prior request",
                    "Unexpected latency or routing path changes for affected hosts",
                    "ARP-watch or IDS alerts on the same network segment"
                ],
                defenses: [
                    "Enable dynamic ARP inspection (DAI) on managed network switches",
                    "Use static ARP entries for critical infrastructure like gateways",
                    "Deploy port security to limit which MAC addresses can appear on a switch port",
                    "Segment networks (VLANs) to limit the blast radius of local spoofing",
                    "Monitor for duplicate IP-to-MAC bindings with ARP-watch style tooling"
                ]
            }
        },

        /* =================================================
           07 — SESSION HIJACKING
           ================================================= */
        {
            id: "session-hijacking",
            number: 7,
            title: "Session Hijacking",
            category: "Web Application Attack",
            difficulty: "Intermediate",
            accent: "#c98fd0",
            description: "See how a captured session token can let an attacker impersonate a logged-in user.",
            mitre: { id: "T1539", name: "Steal Web Session Cookie" },
            compare: {
                vector: "A captured, already-authenticated session token reused from a different device",
                targetLayer: "Application / Identity",
                requiresVictimAction: false,
                automated: false,
                primarySignal: "The same session token or ID active from two different devices, fingerprints, or locations at once",
                goal: "Impersonate an already-logged-in user without ever needing their password",
                distinguishFrom: {
                    "credential-stuffing": "Session Hijacking needs no password at all — it reuses a token from a session that's already logged in. Credential Stuffing is entirely about finding a working PASSWORD by trying many leaked ones against the login form."
                }
            },
            attackerLabel: "ATTACKER BROWSER",
            victimLabel: "APPLICATION / SOC CONSOLE",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "Session tokens sent over unencrypted connections, or otherwise exposed, can be captured by anyone positioned to observe the traffic.", wait: 2000 },
                { type: "line", side: "attacker", icon: "👀", text: "Unencrypted session cookie observed in traffic", wait: 1400 },
                { type: "line", side: "victim", icon: "🪪", text: "jsmith has an active session (normal)", wait: 1300 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "The attacker doesn't need the password at all — a valid captured session token is often enough to impersonate the user.", wait: 2100 },
                { type: "captureInit", side: "attacker", mode: "capture", wait: 600 },
                { type: "captureAdd", side: "attacker", entry: { primary: "Session Token", secondary: "fictional-9f8a2c", status: "captured" }, wait: 1600 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "A well-designed application should notice the same session suddenly being used from a different browser or device.", wait: 2100 },
                { type: "browserOpen", side: "attacker", url: "portal.northstar-corp.example/account", secure: true, page: { kind: "account", heading: "My Account", rows: [ { label: "Signed in as", value: "jsmith" }, { label: "Session", value: "fictional-9f8a2c (reused)" } ] }, wait: 1400 },
                { type: "line", side: "victim", icon: "⚠", text: "Same session now active from a second device", tone: "alert", wait: 1800 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "Because the token itself was valid, the application has no reason to prompt for a password again.", wait: 1900 },
                { type: "pageSwap", side: "attacker", page: { kind: "account", heading: "My Account", rows: [ { label: "Signed in as", value: "jsmith" }, { label: "Session", value: "fictional-9f8a2c (reused)" }, { label: "Access", value: "Full account access granted" } ] }, wait: 1400 },
                { type: "line", side: "victim", icon: "📍", text: "Request from an unfamiliar location", tone: "alert", wait: 1700 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "Impossible travel — the same session active in two distant places within an impossibly short window — is a reliable hijacking signal.", wait: 2200 },
                { type: "browserUrl", side: "attacker", url: "portal.northstar-corp.example/account/billing", secure: true, wait: 900 },
                { type: "pageSwap", side: "attacker", page: { kind: "account", heading: "Billing", rows: [ { label: "Signed in as", value: "jsmith" }, { label: "Viewing", value: "Settings, Billing" } ] }, wait: 1400 },
                { type: "line", side: "victim", icon: "🌍", text: "Same session active in two locations at once — impossible travel", tone: "alert", wait: 1800 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Short-lived tokens, device binding, and impossible-travel detection all limit how much damage a hijacked session can do.", wait: 2000 },
                { type: "line", side: "victim", icon: "🚫", text: "Session revoked, jsmith asked to reauthenticate", tone: "alert", wait: 1800 },
                { type: "line", side: "attacker", icon: "🏁", text: "Session activity logged; simulation ends here", wait: 2200 }
            ],
            summary: {
                whatHappened: "A user's session token was exposed and captured. The attacker reused that token from a different device to impersonate the user without needing their password.",
                whatAttackerWanted: "To gain authenticated access to the victim's account by reusing a valid session rather than stealing credentials.",
                evidence: [
                    "Same session token active from two different devices or fingerprints",
                    "Impossible-travel pattern — same account active in distant locations within minutes",
                    "Session activity from an unfamiliar geolocation",
                    "Unencrypted transmission of session cookies observed on the network",
                    "Session persisting far longer than the application's expected token lifetime"
                ],
                defenses: [
                    "Always transmit session tokens over HTTPS with the Secure and HttpOnly cookie flags set",
                    "Bind sessions to device/browser fingerprints and re-authenticate on mismatch",
                    "Use short-lived tokens with refresh mechanisms instead of long-lived static session IDs",
                    "Detect and block impossible-travel and concurrent-session anomalies",
                    "Allow users to view and revoke active sessions from their account settings"
                ]
            }
        },

        /* =================================================
           08 — MALICIOUS USB / REMOVABLE MEDIA
           ================================================= */
        {
            id: "malicious-usb",
            number: 8,
            title: "Malicious USB",
            category: "Endpoint Attack",
            difficulty: "Beginner",
            accent: "#9fc97f",
            description: "See how an infected removable drive can give an attacker a foothold on an internal machine.",
            mitre: { id: "T1091", name: "Replication Through Removable Media" },
            compare: {
                vector: "A disguised malicious file on a removable drive, physically planted for someone to find and open",
                targetLayer: "Endpoint",
                requiresVictimAction: true,
                automated: false,
                primarySignal: "An unsigned executable launched directly from removable media, often paired with a new persistence entry",
                goal: "Get code running on an internal machine directly, bypassing network-based defenses entirely",
                distinguishFrom: {
                    "watering-hole": "Malicious USB requires physical proximity — a real drive has to be found and physically opened. Watering Hole is fully remote: the malicious content is delivered the moment a victim visits a compromised website, no physical media involved."
                }
            },
            attackerLabel: "ATTACKER PREP BENCH",
            victimLabel: "EMPLOYEE WORKSTATION",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "Attackers often target areas with high foot traffic, betting someone will plug in an unknown drive.", wait: 1900 },
                { type: "line", side: "attacker", icon: "🎯", text: "Target: reception-area workstation", wait: 1400 },
                { type: "usbInit", side: "victim", wait: 900 },
                { type: "usbState", side: "victim", state: "idle", wait: 1200 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "Disguising the file with an enticing name increases the chance an employee opens it out of curiosity.", wait: 2000 },
                { type: "line", side: "attacker", icon: "🎭", text: "Payload renamed: \"Employee_Bonuses_2026.exe\"", wait: 1700 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "Unknown removable media should never be trusted, even when found inside a secure building.", wait: 2000 },
                { type: "line", side: "attacker", icon: "📍", text: "Drive left in a common area", wait: 1300 },
                { type: "usbState", side: "victim", state: "connected", wait: 1700 },
                { type: "line", side: "victim", icon: "🔌", text: "DLP/endpoint policy flags unregistered removable media", tone: "alert", wait: 1800 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "A tempting filename is often all it takes to get an untrusted executable run on a real workstation.", wait: 2000 },
                { type: "usbState", side: "victim", state: "file-visible", fileName: "Employee_Bonuses_2026.exe", wait: 1300 },
                { type: "clickUsbFile", side: "victim", wait: 1300 },
                { type: "line", side: "attacker", icon: "⏳", text: "Awaiting execution…", wait: 1300 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "Endpoint tools can catch this stage by flagging unsigned code executed directly from removable storage.", wait: 2100 },
                { type: "usbState", side: "victim", state: "running", fileName: "Employee_Bonuses_2026.exe", wait: 1600 },
                { type: "line", side: "attacker", icon: "✅", text: "Payload running, persistence entry created (synthetic)", wait: 1600 },
                { type: "line", side: "victim", icon: "🚨", text: "EDR flags an unsigned executable launched from removable media", tone: "alert", wait: 1800 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Blocking autorun, restricting removable media, and monitoring for unsigned execution together reduce this risk significantly.", wait: 2100 },
                { type: "line", side: "victim", icon: "🚫", text: "Host isolated, USB device serial blocklisted", tone: "alert", wait: 1800 },
                { type: "line", side: "attacker", icon: "🏁", text: "Simulation ends — no real payload was ever executed", wait: 2200 }
            ],
            summary: {
                whatHappened: "A USB drive containing a disguised (fictional) malicious file was left where an employee would find it. Once connected and opened, it simulated establishing a foothold on the endpoint.",
                whatAttackerWanted: "To bypass network-based defenses entirely by getting malicious code run directly on an internal machine.",
                evidence: [
                    "Removable media connected with no prior registration or approval",
                    "Executable file run directly from removable storage",
                    "Unsigned binary flagged by endpoint protection",
                    "New persistence mechanism (autorun/registry entry) created unexpectedly",
                    "Enticing or mismatched file names designed to encourage opening"
                ],
                defenses: [
                    "Disable autorun/autoplay for removable media on all managed endpoints",
                    "Restrict or block USB storage devices via endpoint policy where feasible",
                    "Require endpoint protection to flag or block unsigned executables",
                    "Train employees to never plug in unknown or found removable media",
                    "Maintain an approved-device allow-list for removable storage"
                ]
            }
        },

        /* =================================================
           09 — WATERING HOLE
           ================================================= */
        {
            id: "watering-hole",
            number: 9,
            title: "Watering Hole",
            category: "Web Application Attack",
            difficulty: "Advanced",
            accent: "#c9a06f",
            description: "See how compromising a trusted, frequently visited website can silently reach a target group.",
            mitre: { id: "T1189", name: "Drive-by Compromise" },
            compare: {
                vector: "A trusted third-party website is quietly compromised and silently delivers content to its visitors",
                targetLayer: "Application / Endpoint (via the web)",
                requiresVictimAction: false,
                automated: false,
                primarySignal: "An unexpected outbound connection or new child process immediately following a visit to one specific external site",
                goal: "Reach a specific group of targets by compromising a site they already trust, instead of attacking them directly",
                distinguishFrom: {
                    "sql-injection": "Watering Hole compromises a site OTHER than the target's own application, then waits for the target's employees to visit it — an indirect approach. SQL Injection goes straight after the target organization's own application and database.",
                    "malicious-usb": "Watering Hole delivers its payload completely remotely, the instant a victim loads a compromised webpage. Malicious USB requires a physical drive to be found and opened — no network delivery involved at all."
                }
            },
            attackerLabel: "COMPROMISED SITE CONSOLE",
            victimLabel: "EMPLOYEE BROWSER",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "Rather than attacking a hardened corporate target directly, the attacker compromises a site the target group already trusts.", wait: 2100 },
                { type: "browserOpen", side: "victim", url: "industry-news.example", secure: true, page: { kind: "account", heading: "5 SOC Trends for 2026", rows: [ { label: "Status", value: "Reading normally" } ] }, wait: 1300 },
                { type: "line", side: "attacker", icon: "🎯", text: "Target site: industry-news.example (frequently visited, fictional)", wait: 1600 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "The injected script is small and hidden, so the compromised page looks completely normal to visitors.", wait: 2100 },
                { type: "line", side: "attacker", icon: "💉", text: "Malicious script injected into the page footer", wait: 1700 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "The victim did nothing unusual — visiting a familiar, legitimate-looking site is part of their normal routine.", wait: 2100 },
                { type: "browserUrl", side: "victim", url: "industry-news.example/article-104", secure: true, wait: 900 },
                { type: "pageSwap", side: "victim", page: { kind: "account", heading: "5 SOC Trends for 2026", rows: [ { label: "Status", value: "Reading during lunch break" } ] }, wait: 1500 },
                { type: "line", side: "attacker", icon: "👀", text: "Visit logged from an employee's browser", wait: 1600 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "Watering hole payloads often run silently, using the compromised site only as a delivery mechanism.", wait: 2100 },
                { type: "line", side: "attacker", icon: "⚙", text: "Script executed in the victim's browser context", wait: 1500 },
                { type: "line", side: "victim", icon: "🌐", text: "Unexpected outbound connection to a newly-seen domain", tone: "alert", wait: 1800 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "A legitimate news article should never cause the browser to launch new local processes — that mismatch is the tell.", wait: 2200 },
                { type: "line", side: "attacker", icon: "📦", text: "Serving fictional stage-2 payload to matching browsers", wait: 1700 },
                { type: "line", side: "victim", icon: "🧬", text: "Browser spawned an unexpected background process", tone: "alert", wait: 1900 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Because the compromised site is trusted, watering hole attacks are best caught by endpoint and network behavior, not by the site's reputation alone.", wait: 2200 },
                { type: "line", side: "victim", icon: "🚫", text: "Domain blocked, endpoint isolated for review", tone: "alert", wait: 1800 },
                { type: "line", side: "attacker", icon: "🏁", text: "Watering hole simulation complete (synthetic payload only)", wait: 2200 }
            ],
            summary: {
                whatHappened: "A website frequently visited by employees was quietly compromised. Visiting it silently delivered malicious content to visitors' browsers without any warning signs on the page itself.",
                whatAttackerWanted: "To compromise a specific group of targets by attacking a trusted third-party site they already visit, rather than attacking them directly.",
                evidence: [
                    "Unexpected outbound connection to a newly-seen third-party domain",
                    "Browser process spawning unrelated child processes",
                    "Multiple employees affected after visiting the same external site",
                    "Injected script hidden in page source that wasn't there before",
                    "Endpoint alerts clustered around visits to one specific website"
                ],
                defenses: [
                    "Use web proxies/DNS filtering with up-to-date threat intelligence on compromised sites",
                    "Deploy browser isolation or sandboxing for higher-risk browsing categories",
                    "Monitor for browsers spawning unexpected child processes (EDR behavioral rules)",
                    "Keep browsers and plugins patched to reduce exploitable surface",
                    "Apply content security policies (CSP) and subresource integrity checks on trusted sites where possible"
                ]
            }
        },

        /* =================================================
           10 — MAN-IN-THE-MIDDLE
           ================================================= */
        {
            id: "man-in-the-middle",
            number: 10,
            title: "Man-in-the-Middle",
            category: "Network Attack",
            difficulty: "Advanced",
            accent: "#d97b7b",
            description: "See how positioning between two trusted systems lets an attacker observe and alter their traffic.",
            mitre: { id: "T1557", name: "Adversary-in-the-Middle" },
            compare: {
                vector: "Attacker positions between two trusted systems and relays (and can alter) their traffic, often with a forged certificate",
                targetLayer: "Network",
                requiresVictimAction: false,
                automated: false,
                primarySignal: "Certificate validation warnings, or an unexpected extra hop/latency, on a connection that's normally trusted",
                goal: "Eavesdrop on — and optionally tamper with — traffic between two systems without either side noticing",
                distinguishFrom: {
                    "evil-twin": "Man-in-the-Middle describes the general POSITION of intercepting traffic between two parties. Evil Twin is one specific way to get there — by standing up a fake Wi-Fi access point the victim connects to.",
                    "arp-spoofing": "ARP Spoofing is one specific LAN-layer technique for reaching a man-in-the-middle position (forged ARP replies). \"Man-in-the-Middle\" here also covers reaching that position by other means, like presenting a forged certificate on an already-established path."
                }
            },
            attackerLabel: "MITM PROXY CONSOLE",
            victimLabel: "CLIENT APPLICATION",
            stages: STAGES,
            timeline: [
                { type: "stage", stage: "RECON" },
                { type: "caption", text: "The attacker first identifies two systems that trust each other and studies how they normally communicate.", wait: 2100 },
                { type: "diagramInit", side: "attacker", nodes: [ { id: "client", label: "Client App", icon: "💻", tone: "victim" }, { id: "server", label: "api.northstar-corp.example", icon: "🗄", tone: "legit" } ], edges: [ { from: "client", to: "server" } ], wait: 1200 },
                { type: "line", side: "victim", icon: "🔒", text: "TLS session established, certificate valid", wait: 1400 },

                { type: "stage", stage: "INITIAL ACTION" },
                { type: "caption", text: "Once positioned between the two endpoints, the attacker can see — and potentially alter — every message that passes.", wait: 2200 },
                { type: "diagramInit", side: "attacker", nodes: [ { id: "client", label: "Client App", icon: "💻", tone: "victim" }, { id: "attacker", label: "Attacker", icon: "🕵", tone: "attacker" }, { id: "server", label: "api.northstar-corp.example", icon: "🗄", tone: "legit" } ], edges: [ { from: "client", to: "attacker" }, { from: "attacker", to: "server" } ], wait: 1300 },

                { type: "stage", stage: "EXPLOITATION" },
                { type: "caption", text: "A forged certificate is one of the most reliable tells of a MITM attempt against encrypted traffic.", wait: 2200 },
                { type: "diagramEdge", side: "attacker", from: "client", to: "attacker", animated: true, wait: 700 },
                { type: "diagramEdge", side: "attacker", from: "attacker", to: "server", animated: true, wait: 1300 },
                { type: "browserOpen", side: "victim", url: "api.northstar-corp.example", secure: false, page: { kind: "account", heading: "Your connection is not private", rows: [ { label: "Warning", value: "Certificate issuer not trusted (synthetic)", tone: "alert" } ] }, wait: 1800 },

                { type: "stage", stage: "ACCESS" },
                { type: "caption", text: "Beyond just eavesdropping, an attacker positioned in the middle can also alter data before it reaches its destination.", wait: 2200 },
                { type: "diagramEdge", side: "attacker", from: "client", to: "attacker", animated: true, label: "balance: 500 → 50000", wait: 1600 },
                { type: "pageSwap", side: "victim", page: { kind: "account", heading: "Account Balance", rows: [ { label: "Balance", value: "$50,000", tone: "alert" }, { label: "Server actually sent", value: "$500 (synthetic tampering demo)" } ] }, wait: 1800 },

                { type: "stage", stage: "ACTIVITY" },
                { type: "caption", text: "An unexpected extra hop or added latency in a normally direct connection can reveal a MITM position.", wait: 2200 },
                { type: "diagramEdge", side: "attacker", from: "client", to: "attacker", animated: true, label: "340 requests relayed", wait: 1600 },
                { type: "line", side: "victim", icon: "🔀", text: "Unexpected extra hop detected in the network path", tone: "alert", wait: 1800 },

                { type: "stage", stage: "DETECTION" },
                { type: "caption", text: "Certificate pinning, strict TLS validation, and network path monitoring together make MITM attacks far harder to sustain unnoticed.", wait: 2200 },
                { type: "line", side: "victim", icon: "🚫", text: "Connection path restored, affected session terminated", tone: "alert", wait: 1800 },
                { type: "line", side: "attacker", icon: "🏁", text: "MITM simulation complete (synthetic traffic only)", wait: 2200 }
            ],
            summary: {
                whatHappened: "An attacker positioned themselves between two systems that trusted each other, relaying and quietly modifying their (fictional) traffic using a forged certificate.",
                whatAttackerWanted: "To eavesdrop on, and optionally tamper with, communications between two trusted systems without either side noticing.",
                evidence: [
                    "Certificate validation warnings on connections that are normally trusted",
                    "An unexpected additional hop or increased latency in the network path",
                    "Data received that doesn't match what the server actually sent",
                    "TLS sessions using unexpected or self-signed certificates",
                    "Traffic patterns showing a proxy relaying rather than a direct connection"
                ],
                defenses: [
                    "Enforce strict TLS certificate validation and use certificate pinning for critical connections",
                    "Use mutual TLS (mTLS) so both sides of a connection authenticate each other",
                    "Encrypt and authenticate all internal traffic, not just traffic leaving the network",
                    "Monitor network paths and latency for unexpected changes",
                    "Educate users and systems to never bypass or ignore certificate warnings"
                ]
            }
        }

    ];


    /* =====================================================
       LOOKUP HELPERS
       ===================================================== */

    function getExperience(id) {

        return ATTACK_EXPERIENCES.find(
            experience => experience.id === id
        ) || null;

    }


    window.ATTACK_EXPERIENCES = ATTACK_EXPERIENCES;
    window.getAttackExperience = getExperience;

})();
