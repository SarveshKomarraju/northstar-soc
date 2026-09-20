/* =========================================================
   NORTHSTAR SOC — THREAT INTELLIGENCE DATA
   File: threat-intel/ThreatIntelData.js

   Every lookup here checks against something REAL in the
   live simulation — the actual 3 attacker IPs, the actual
   domains Mail's phishing generator uses, and (checked live,
   since these are generated per-session) actual dropped-file
   hashes a player found in File Explorer. Nothing here is a
   disconnected fictional database — if a player brings in an
   indicator they genuinely found elsewhere in NORTHSTAR, this
   will recognize it.

   Most queries should still come back empty — that's
   intentional and correct. Random/ambient IPs, one-off failed
   logins, ordinary business files: none of that is "known"
   intelligence, the same way a real intel database wouldn't
   have an entry for every IP on the internet.
   ========================================================= */

window.NorthstarThreatIntel = {

    /* =====================================================
       NORMALIZE / DETECT TYPE
       ===================================================== */

    normalize(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();

    },

    detectType(value) {

        const indicator =
            this.normalize(value);

        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(indicator)) {
            return "IP";
        }

        if (/^[a-f0-9]{64}$/.test(indicator)) {
            return "SHA256";
        }

        if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(indicator)) {
            return "DOMAIN";
        }

        return "UNKNOWN";
    },


    /* =====================================================
       KNOWN PHISHING INFRASTRUCTURE
       ---------------------------------------------------
       The exact domain pool Mail's phishing generator
       actually uses (see mail/data/emails.js) — fixed
       across every session, so it's legitimate to list
       these as pre-known intelligence, same as a real
       org's threat feed would carry known-bad sender
       domains from past campaigns.
       ===================================================== */

    KNOWN_PHISHING_DOMAINS: [
        "secure-mail-alert.example",
        "account-verify-service.example",
        "it-support-notice.example",
        "helpdesk-security.example",
        "corporate-alerts.example",
        "system-notification.example"
    ],

    getKnownDomainRecord(normalizedIndicator) {

        const match =
            this.KNOWN_PHISHING_DOMAINS.find(
                domain => this.normalize(domain) === normalizedIndicator
            );

        if (!match) {
            return null;
        }

        return {
            indicator: match,
            type: "DOMAIN",
            reputation: "MALICIOUS",
            confidence: "MEDIUM",
            firstSeen: "Recurring",
            lastSeen: "Ongoing",
            campaign: "Recurring phishing infrastructure",
            classification: "PHISHING",
            country: "Unknown",
            asn: "Unknown",
            infrastructure: ["PHISHING", "EMAIL DELIVERY"],
            tags: ["phishing", "email"],
            notes: "This domain has recurred as sender infrastructure across multiple phishing campaigns targeting NORTHSTAR personnel.",
            relatedIndicators: []
        };
    },


    /* =====================================================
       KNOWN THREAT ACTOR INFRASTRUCTURE
       ---------------------------------------------------
       Checked against the REAL attacker roster
       (window.NorthstarRealAttackers, exposed by script.js
       from AttackEngine's actual ATTACKERS export) — the
       same 3 IPs every session, not a disconnected fictional
       list. Country/campaign context is pulled from the live
       session if that attacker has actually done anything
       yet.
       ===================================================== */

    getKnownAttackerRecord(normalizedIndicator) {

        const attackers =
            window.NorthstarRealAttackers || [];

        const match =
            attackers.find(
                attacker => this.normalize(attacker.ip) === normalizedIndicator
            );

        if (!match) {
            return null;
        }

        const events =
            (window.eventEngine?.getAllEvents?.() || [])
                .filter(event => event.actor === match.name)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const firstEvent = events[0] || null;
        const lastEvent = events[events.length - 1] || null;

        const activeCampaign =
            [...events].reverse().find(event => !!event.attackId)?.attackId || null;

        return {
            indicator: match.ip,
            type: "IP",
            reputation: "MALICIOUS",
            confidence: "HIGH",
            firstSeen: firstEvent ? firstEvent.timestamp.slice(0, 10) : "No activity observed this session",
            lastSeen: lastEvent ? lastEvent.timestamp.slice(0, 10) : "No activity observed this session",
            campaign: activeCampaign || "No active campaign this session",
            classification: "COMMAND & CONTROL",
            country: match.country,
            asn: "AS-UNKNOWN",
            infrastructure: ["C2 SERVER", "REMOTE ACCESS"],
            tags: ["c2", "malware", "credential-access"],
            notes: `Known threat actor infrastructure — associated with ${match.name}.`,
            relatedIndicators: []
        };
    },


    /* =====================================================
       LIVE DROPPED-FILE HASHES
       ---------------------------------------------------
       Dropped-file hashes are generated per-session (see
       AttackEngine.postCompromise -> pseudoFileHash), so a
       static list could never match. This checks the live
       event stream instead — recognizes ANY real malicious
       file a player actually found in File Explorer this
       session, regardless of randomization.
       ===================================================== */

    getLiveFileHashRecord(normalizedIndicator) {

        const events =
            window.eventEngine?.getAllEvents?.() || [];

        const match =
            events.find(event =>
                event.eventType === "FILE_DROPPED" &&
                event.actorType === "ATTACKER" &&
                this.normalize(event.metadata?.fileHash) === normalizedIndicator
            );

        if (!match) {
            return null;
        }

        return {
            indicator: match.metadata.fileHash,
            type: "SHA256",
            reputation: "MALICIOUS",
            confidence: "HIGH",
            firstSeen: match.timestamp.slice(0, 10),
            lastSeen: match.timestamp.slice(0, 10),
            campaign: match.attackId || "Unknown",
            classification: "MALWARE",
            country: "N/A",
            asn: "N/A",
            infrastructure: ["MALWARE SAMPLE"],
            tags: ["malware", "dropped-file"],
            notes: `File observed dropped on ${match.hostname} during an active compromise.`,
            relatedIndicators: match.sourceIP ? [match.sourceIP] : []
        };
    },


    /* =====================================================
       KNOWN MALICIOUS FILE HASHES
       ---------------------------------------------------
       A small, fixed set of hashes that correspond to real
       investigation artifacts a player can actually find in
       File Explorer / Malware Sandbox — same discipline as
       KNOWN_PHISHING_DOMAINS above. Only the file that's
       genuinely malware (invoice_viewer.ps1) gets an entry
       here — the two locked files aren't malware samples, so
       a real threat feed wouldn't carry a "known-bad hash"
       for them either.
       ===================================================== */

    KNOWN_MALICIOUS_HASHES: [
        {
            sha256: "db2369a5db2369a5db2369a5db2369a5db2369a5db2369a5db2369a5db2369a5",
            classification: "MALWARE",
            threat: "Malicious Loader Script",
            campaign: "Recurring loader-script infrastructure",
            tags: ["malware", "loader", "powershell"],
            notes: "Matches a known malicious PowerShell loader — previously observed staging outbound C2 connections and scheduled-task persistence."
        }
    ],

    getKnownHashRecord(normalizedIndicator) {

        const match =
            this.KNOWN_MALICIOUS_HASHES.find(
                record => this.normalize(record.sha256) === normalizedIndicator
            );

        if (!match) {
            return null;
        }

        return {
            indicator: match.sha256,
            type: "SHA256",
            reputation: "MALICIOUS",
            confidence: "HIGH",
            firstSeen: "Recurring",
            lastSeen: "Ongoing",
            campaign: match.campaign,
            classification: match.classification,
            country: "N/A",
            asn: "N/A",
            infrastructure: ["MALWARE SAMPLE"],
            tags: match.tags,
            notes: match.notes,
            relatedIndicators: []
        };
    },


    /* =====================================================
       KNOWN BENIGN
       ---------------------------------------------------
       A couple of genuinely well-known, harmless entries —
       teaches that not everything queried here is bad, same
       as a real threat intel tool would have plenty of
       clean/known-good results too.
       ===================================================== */

    STATIC_BENIGN: [

        {
            indicator: "8.8.8.8",
            type: "IP",
            reputation: "BENIGN",
            confidence: "HIGH",
            firstSeen: "Long-standing",
            lastSeen: "Ongoing",
            campaign: "NONE",
            classification: "PUBLIC DNS",
            country: "United States",
            asn: "AS15169",
            infrastructure: ["DNS", "PUBLIC SERVICE"],
            tags: ["dns", "benign"],
            notes: "Known public DNS infrastructure. No campaign association.",
            relatedIndicators: []
        },

        {
            indicator: "1.1.1.1",
            type: "IP",
            reputation: "BENIGN",
            confidence: "HIGH",
            firstSeen: "Long-standing",
            lastSeen: "Ongoing",
            campaign: "NONE",
            classification: "PUBLIC DNS",
            country: "United States",
            asn: "AS13335",
            infrastructure: ["DNS", "PUBLIC SERVICE"],
            tags: ["dns", "benign"],
            notes: "Known public DNS infrastructure. No campaign association.",
            relatedIndicators: []
        }

    ],

    getStaticBenignRecord(normalizedIndicator) {

        return (
            this.STATIC_BENIGN.find(
                record => this.normalize(record.indicator) === normalizedIndicator
            ) || null
        );
    },


    /* =====================================================
       LOOKUP
       ---------------------------------------------------
       Checked in this order. First match wins. Anything
       that matches none of these — which is most queries,
       by design — correctly returns null ("no intelligence
       on record").
       ===================================================== */

    lookup(value) {

        const normalized =
            this.normalize(value);

        if (!normalized) {
            return null;
        }

        return (
            this.getKnownAttackerRecord(normalized) ||
            this.getKnownDomainRecord(normalized) ||
            this.getKnownHashRecord(normalized) ||
            this.getLiveFileHashRecord(normalized) ||
            this.getStaticBenignRecord(normalized) ||
            null
        );
    },

    /**
     * Used only for the sidebar's "RECORDS" counter — an
     * honest count of how many things this tool could
     * possibly recognize, not a browsable list.
     */
    getAll() {

        const attackers =
            window.NorthstarRealAttackers || [];

        return [
            ...attackers,
            ...this.KNOWN_PHISHING_DOMAINS,
            ...this.KNOWN_MALICIOUS_HASHES,
            ...this.STATIC_BENIGN
        ];
    }

};