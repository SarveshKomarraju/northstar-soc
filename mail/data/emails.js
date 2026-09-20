/* =========================================================
   NORTHSTAR SOC — MAIL DATA
   File: mail/data/emails.js

   CHANGED:
   This file no longer exports one static "EMAILS" array that
   MailStore mutates in place. The inbox is now event-driven:

   - SEED_EMAILS: a small starting inbox (benign only).
   - BENIGN_TEMPLATES: pool used by MailEventBridge's trickle
     timer to occasionally deliver normal mail.
   - createPhishingEmailFromAttackEvent(): turns a live
     AttackEngine "PHISHING_EMAIL_SENT" event into a full
     email object.

   MailStore owns the actual mutable array (this.state.emails)
   and calls these helpers/factories. The functions below are
   pure — they take arrays in, return arrays/objects out, and
   never reach into module-level mutable state.

   Coworker sender identities below are drawn from the
   roster in ./company.js and kept in sync with it manually.
   ========================================================= */

import {
    hashString,
    getPhishingDomainForAttack
} from "../../data/phishingInfrastructure.js";


/* =========================================================
   FOLDER / CATEGORY / STATUS CONSTANTS
   ========================================================= */

export const MAIL_FOLDERS = {
    INBOX: "INBOX",
    SENT: "SENT",
    STARRED: "STARRED",
    DRAFTS: "DRAFTS",
    SPAM: "SPAM",
    QUARANTINE: "QUARANTINE",
    TRASH: "TRASH"
};

export const EMAIL_CATEGORIES = {
    NORMAL: "NORMAL",
    INTERNAL: "INTERNAL",
    PHISHING: "PHISHING",
    BEC: "BEC",
    SUSPICIOUS: "SUSPICIOUS",
    MALWARE: "MALWARE",
    REPORT: "REPORT"
};

export const EMAIL_IMPORTANCE = {
    LOW: "LOW",
    NORMAL: "NORMAL",
    HIGH: "HIGH"
};

export const AUTH_STATUS = {
    PASS: "PASS",
    FAIL: "FAIL",
    SOFTFAIL: "SOFTFAIL",
    NONE: "NONE"
};


/* =========================================================
   ID / TIME HELPERS
   ========================================================= */

let idCounter = 0;

function generateId(prefix = "MAIL") {

    idCounter += 1;

    return `${prefix}-${Date.now()}-${idCounter}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
}

function minutesAgoISO(minutes) {

    return new Date(
        Date.now() - minutes * 60 * 1000
    ).toISOString();
}


/* =========================================================
   EMAIL FACTORY
   (unchanged shape — everything downstream, MailRenderer /
   MailInvestigator, depends on this exact schema)
   ========================================================= */

export function createEmail(config) {

    return {
        id: config.id,

        folder: config.folder || MAIL_FOLDERS.INBOX,

        timestamp: config.timestamp,

        read: config.read ?? false,

        starred: config.starred ?? false,

        important: config.important ?? false,

        importance: config.importance || EMAIL_IMPORTANCE.NORMAL,

        category: config.category || EMAIL_CATEGORIES.NORMAL,

        from: {
            name: config.from?.name || "",
            address: config.from?.address || ""
        },

        to: Array.isArray(config.to) ? config.to : [],

        cc: Array.isArray(config.cc) ? config.cc : [],

        bcc: Array.isArray(config.bcc) ? config.bcc : [],

        replyTo: config.replyTo || "",

        subject: config.subject || "",

        preview: config.preview || "",

        body: {
            format: config.body?.format || "text",
            content: config.body?.content || ""
        },

        headers: {
            messageId: config.headers?.messageId || "",
            returnPath: config.headers?.returnPath || "",
            originatingIP: config.headers?.originatingIP || "",
            received: config.headers?.received || [],
            authenticationResults: config.headers?.authenticationResults || "",
            dkimSignature: config.headers?.dkimSignature || "",
            receivedSPF: config.headers?.receivedSPF || "",
            userAgent: config.headers?.userAgent || "",
            xMailer: config.headers?.xMailer || ""
        },

        authentication: {
            spf: config.authentication?.spf || AUTH_STATUS.NONE,
            dkim: config.authentication?.dkim || AUTH_STATUS.NONE,
            dmarc: config.authentication?.dmarc || AUTH_STATUS.NONE
        },

        links: Array.isArray(config.links) ? config.links : [],

        attachments: Array.isArray(config.attachments) ? config.attachments : [],

        classification: config.classification || EMAIL_CATEGORIES.NORMAL,

        indicators: Array.isArray(config.indicators) ? config.indicators : [],

        simulation: {
            malicious: config.simulation?.malicious ?? false,
            scenarioId: config.simulation?.scenarioId || null,
            eventType: config.simulation?.eventType || null,
            reviewRequest: config.simulation?.reviewRequest ?? false,
            followUpKey: config.simulation?.followUpKey || null
        }
    };
}


/* =========================================================
   BENIGN TEMPLATES
   ---------------------------------------------------------
   Used two ways:
   1. A handful become SEED_EMAILS (the inbox on game start).
   2. MailEventBridge's trickle timer randomly instantiates
      more of these over the course of a session so the
      inbox never becomes 100% malicious.
   ========================================================= */

const BENIGN_TEMPLATES = [

    {
        key: "handbook",
        category: EMAIL_CATEGORIES.INTERNAL,
        from: { name: "Northstar HR", address: "hr@northstar.local" },
        to: ["j.smith@northstar.local"],
        cc: ["people-ops@northstar.local"],
        subject: "Updated Employee Handbook — 2026 Policy Cycle",
        preview: "The 2026 employee handbook has been updated and is now available for review.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>The Northstar employee handbook has been updated for the 2026 policy cycle. Notable changes this year include an updated remote-work policy, revised PTO accrual rates, and a new section on acceptable use of company devices.</p><p>Please take a few minutes to review the updated handbook on the intranet before the end of the month. No signature is required, but your manager may follow up if the acknowledgment isn't completed.</p><p>Let us know if you have any questions.</p><p>Best,<br>Priya Nair<br>Northstar Human Resources</p>"
        },
        originatingIP: "10.20.4.15"
    },

    {
        key: "maintenance",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Facilities", address: "facilities@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: "Building Maintenance This Saturday — 2nd Floor",
        preview: "Scheduled maintenance will take place Saturday morning on the second floor.",
        body: {
            format: "html",
            content: "<p>Hello,</p><p>Facilities will be performing scheduled HVAC maintenance on the second floor this Saturday, beginning at 08:00 and expected to conclude before noon. Access to the east stairwell will be temporarily restricted during this window.</p><p>No badge access changes are required, and the building will remain open as usual. If you have equipment in the second-floor server closet that's sensitive to brief power fluctuations, please let us know by Friday so we can plan accordingly.</p><p>Thanks,<br>Northstar Facilities Team</p>"
        },
        originatingIP: "10.20.4.20"
    },

    {
        key: "vpn-maintenance",
        category: EMAIL_CATEGORIES.INTERNAL,
        from: { name: "IT Service Desk", address: "helpdesk@northstar.local" },
        to: ["j.smith@northstar.local"],
        cc: ["it-notifications@northstar.local"],
        subject: "Scheduled VPN Maintenance Tonight — Brief Interruption Expected",
        preview: "VPN access may be interrupted briefly during tonight's maintenance window.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>The Northstar VPN infrastructure will undergo scheduled maintenance tonight as part of our routine patching cycle. You may experience a brief interruption to VPN connectivity between 23:00 and 23:30 ET.</p><p>No action is required on your part — active sessions may drop and will need to be reconnected after the window closes. If you're working late and expect to need uninterrupted access, please let the Service Desk know and we can coordinate around your schedule.</p><p>Regards,<br>Northstar IT Service Desk</p>"
        },
        originatingIP: "10.20.7.11"
    },

    {
        key: "expense-report",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Northstar Finance", address: "finance@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: "Your Monthly Expense Report Is Ready for Review",
        preview: "Your monthly expense report is ready for review.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>Your expense report for last month has been compiled and is ready for your review in the finance portal. Total reimbursable expenses came to $412.18 across 6 line items.</p><p>Please review and approve by the 5th so it can be included in this cycle's reimbursement batch. If anything looks off, reply here or open a ticket with Finance directly.</p><p>Thanks,<br>Northstar Finance</p>"
        },
        originatingIP: "10.20.5.18"
    },

    {
        key: "security-brief",
        category: EMAIL_CATEGORIES.INTERNAL,
        from: { name: "Security Operations", address: "soc@northstar.local" },
        to: ["j.smith@northstar.local"],
        cc: ["engineering-leads@northstar.local"],
        subject: "Weekly Security Brief — Endpoint & Network Summary",
        preview: "Summary of security activity observed during the previous week.",
        body: {
            format: "html",
            content: "<p>Hi team,</p><p>Here's the weekly security briefing covering endpoint, network, and authentication activity across Northstar systems.</p><p>Overall activity was within normal ranges this week. A small number of failed login attempts were observed from expected IP ranges, consistent with employees mistyping credentials. No critical alerts were generated. As always, please continue reporting anything that looks unusual through the standard channel rather than investigating suspicious emails or links yourself.</p><p>— Northstar Security Operations</p>"
        },
        originatingIP: "10.20.8.5"
    },

    {
        key: "enrollment",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Northstar Benefits", address: "benefits@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: "Open Enrollment Begins Monday — Action Needed by Month End",
        preview: "Open enrollment begins Monday. Review your benefits before the deadline.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>Open enrollment for 2027 benefits begins this coming Monday and runs through the end of the month. This is your annual opportunity to review and update your health, dental, and vision plan selections, as well as your FSA/HSA contribution elections.</p><p>If you don't make any changes, your current elections will roll over automatically — but we'd still encourage you to log in and confirm everything looks right, since a few plan rates have changed for next year.</p><p>Best,<br>Northstar Benefits Team</p>"
        },
        originatingIP: "10.20.5.30"
    },

    {
        key: "meeting-invite",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Calendar Service", address: "calendar@northstar.local" },
        to: ["j.smith@northstar.local"],
        cc: ["m.rivera@northstar.local", "a.chen@northstar.local"],
        subject: "Invitation: Weekly Engineering Sync — Mon 09:00",
        preview: "You have been invited to a team meeting.",
        body: {
            format: "html",
            content: "<p>You've been invited to the following recurring meeting:</p><p><strong>Weekly Engineering Sync</strong><br>Mondays at 09:00, 30 minutes<br>Location: Conference Room B / video link in calendar invite</p><p>Agenda: sprint status, blockers, and any cross-team dependencies. Come with updates on your current tickets if you have any.</p><p>— Calendar Service on behalf of M. Rivera</p>"
        },
        originatingIP: "10.20.4.42"
    },

    {
        key: "vendor-renewal",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Procurement", address: "procurement@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: "Vendor Renewal Schedule — Contracts Assigned to Your Team",
        preview: "Upcoming vendor contracts scheduled for renewal.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>Procurement has published the upcoming vendor renewal schedule for next quarter. Two contracts assigned to your team are coming up for renewal: the monitoring tool subscription (renews in 34 days) and the CI/CD platform license (renews in 61 days).</p><p>Please review usage and let us know by the end of the week whether you'd like to renew as-is, adjust seat counts, or explore alternatives before we begin renewal conversations with the vendors.</p><p>Thanks,<br>Northstar Procurement</p>"
        },
        originatingIP: "10.20.5.44"
    },

    /* -----------------------------------------------------
       LOOKS-ODD-BUT-ISN'T — legitimate third-party vendor
       mail. Real companies use benefits/billing platforms on
       their own domains all the time, so "unfamiliar domain
       with a link" is NOT by itself a reliable phishing tell.
       These exist so blindly checking every unfamiliar domain
       in Threat Intel doesn't always pay off — these come back
       with no record, same as most real lookups would.
       ----------------------------------------------------- */

    {
        key: "benefits-portal-decoy",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "NS Wellness Enrollment", address: "notifications@nswellness-enroll.com" },
        to: ["j.smith@northstar.local"],
        subject: "Your 2027 benefits summary is ready to view",
        preview: "Your annual benefits summary from Northstar's enrollment partner is now available.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>As part of Northstar's partnership with NS Wellness for benefits administration, your 2027 benefits summary is now available to view online. This includes your current plan selections, dependent coverage, and contribution rates.</p><p>You can view your summary any time — there's nothing you need to do unless you'd like to make changes ahead of the enrollment deadline.</p><p><a href=\"#\">View Benefits Summary</a></p><p>If you have questions about your coverage, reach out to Northstar Benefits directly.</p><p>NS Wellness Enrollment Team</p>"
        },
        originatingIP: "198.51.100.42",
        links: [
            { text: "View Benefits Summary", url: "https://nswellness-enroll.com/summary/2027" }
        ]
    },

    {
        key: "vendor-invoice-decoy",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Bright Ledger Billing", address: "billing@brightledger-invoices.com" },
        to: ["j.smith@northstar.local"],
        subject: "Invoice #BL-88214 available for the monitoring tool renewal",
        preview: "Your invoice for this quarter's monitoring tool subscription is ready.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>This is a notice from Bright Ledger, the billing platform used by your monitoring tool vendor. Invoice #BL-88214 for this quarter's subscription renewal is now available.</p><p>You can view and download the invoice for your records using the secure link below. No payment action is needed on your end — this goes through Procurement's existing PO.</p><p><a href=\"#\">View Invoice</a></p><p>Questions about billing can go to Bright Ledger support directly.</p><p>Bright Ledger Billing Team</p>"
        },
        originatingIP: "198.51.100.77",
        links: [
            { text: "View Invoice", url: "https://brightledger-invoices.com/invoice/BL-88214" }
        ]
    },

    /* -----------------------------------------------------
       COWORKER-AUTHORED — only 2 named people, matching the
       reduced roster in company.js:
         - Jordan Lee: sends something PDF-related to review
         - Priya Nair: just asks a regular work question
       Both are reply-able threads (see FOLLOW_UP_TEMPLATES).
       ----------------------------------------------------- */

    {
        key: "coworker-design-feedback",
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Jordan Lee", address: "j.lee@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: "Mockups for the new alert dashboard",
        preview: "Put together some early mockups for the alert dashboard redesign.",
        body: {
            format: "html",
            content: "<p>Hey John,</p><p>Put together some early mockups for the alert dashboard redesign — mostly focused on making severity easier to scan at a glance. Attached a PDF walkthrough of the layout and reasoning. Would love your take on whether it actually matches how you'd want to triage things day to day.</p><p>Nothing's final yet, just want to make sure I'm not designing something that looks nice but doesn't match the real workflow.</p><p>Jordan</p>"
        },
        originatingIP: "10.20.6.15",
        reviewRequest: true,
        followUpKey: "jordan-design-thanks",
        attachments: [
            {
                id: "ATT-DESIGN-01",
                name: "Alert_Dashboard_Mockups.pdf",
                type: "application/pdf",
                size: 214000,
                hash: "SIMULATED_HASH_DESIGN01",
                passwordProtected: false,
                risk: "LOW",
                pdfContent: {
                    title: "Alert Dashboard Redesign",
                    subtitle: "Early mockup walkthrough — prepared by Jordan Lee, Product Design",
                    sections: [
                        {
                            heading: "1. Goals",
                            body: "The current alert dashboard requires too much scanning to identify severity at a glance. This redesign concentrates on three goals: surfacing severity through color and position rather than text alone, reducing the number of clicks needed to reach a full investigation view, and keeping the layout usable at a glance during a live incident."
                        },
                        {
                            heading: "2. Layout Overview",
                            body: "The new layout places a severity-sorted queue on the left third of the screen, with the highest-severity unresolved alerts pinned to the top regardless of arrival time. The center panel shows the selected alert's summary, and the right rail surfaces related host, user, and network context without requiring a page navigation."
                        },
                        {
                            heading: "3. Open Questions",
                            body: "Does severity-based sorting match how you actually triage day to day, or do you generally work chronologically and only jump to severity when things back up? Also open: should acknowledged-but-unresolved alerts visually fade, or stay full-strength until fully closed? Feedback on either would directly shape the next iteration."
                        },
                        {
                            heading: "4. Next Steps",
                            body: "Once feedback is incorporated, the plan is to move to a clickable prototype for a short usability pass with two or three analysts before implementation begins. No engineering work has started yet, so now is the right time for structural feedback."
                        }
                    ]
                }
            }
        ]
    },

    {
        key: "coworker-onboarding-question",
        category: EMAIL_CATEGORIES.INTERNAL,
        from: { name: "Priya Nair", address: "p.nair@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: "New hire security training — quick question",
        preview: "Wanted to check the timeline for the new analyst's security onboarding.",
        body: {
            format: "html",
            content: "<p>Hi John,</p><p>We have a new hire starting on the security team in two weeks, and I wanted to check what the typical timeline looks like for their security onboarding and system access provisioning.</p><p>Is that something you handle directly, or should I loop in someone else on your team? Just trying to get it on the calendar early.</p><p>Thanks,<br>Priya</p>"
        },
        originatingIP: "10.20.3.31",
        reviewRequest: true,
        followUpKey: "priya-question-thanks"
    }

];


/**
 * Build one real email object out of a benign template.
 */
function instantiateBenignEmail(template, { id, timestamp } = {}) {

    return createEmail({
        id: id || generateId("MAIL"),
        timestamp: timestamp || new Date().toISOString(),
        folder: MAIL_FOLDERS.INBOX,
        read: false,
        category: template.category,
        from: template.from,
        to: template.to,
        cc: template.cc || [],
        subject: template.subject,
        preview: template.preview,
        body: template.body,
        attachments: template.attachments || [],
        links: template.links || [],
        headers: {
            messageId: `<${generateId("msg")}@northstar.local>`,
            returnPath: `<${template.from.address}>`,
            originatingIP: template.originatingIP,
            authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
            dkimSignature: "v=1; a=rsa-sha256; d=northstar.local",
            receivedSPF: "pass",
            userAgent: "Northstar Mail Server"
        },
        authentication: {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.PASS,
            dmarc: AUTH_STATUS.PASS
        },
        classification: template.category,
        simulation: {
            reviewRequest: template.reviewRequest || false,
            followUpKey: template.followUpKey || null
        }
    });
}


/**
 * A random benign template, for the trickle timer.
 * Optionally excludes a key so the same message doesn't
 * repeat back-to-back.
 */
export function randomBenignEmail(excludeKey = null) {

    const pool =
        excludeKey
            ? BENIGN_TEMPLATES.filter(t => t.key !== excludeKey)
            : BENIGN_TEMPLATES;

    const template =
        pool[Math.floor(Math.random() * pool.length)];

    return {
        email: instantiateBenignEmail(template),
        key: template.key
    };
}


/**
 * Starting inbox — a handful of benign messages with
 * staggered "already there" timestamps, nothing malicious.
 */
export function buildSeedEmails() {

    const seedKeys = ["handbook", "coworker-onboarding-question", "vpn-maintenance", "coworker-design-feedback", "security-brief"];

    console.log("[EMAILS.JS] buildSeedEmails() running with seedKeys:", seedKeys);

    return seedKeys.map((key, index) => {

        const template =
            BENIGN_TEMPLATES.find(t => t.key === key);

        if (!template) {
            console.error(`[EMAILS.JS] No BENIGN_TEMPLATES entry found for seed key "${key}" — check for a typo.`);
        }

        return instantiateBenignEmail(template, {
            id: `MAIL-SEED-${index + 1}`,
            timestamp: minutesAgoISO((seedKeys.length - index) * 37)
        });
    });
}


/* =========================================================
   COWORKER FOLLOW-UPS
   ---------------------------------------------------------
   These are NOT part of the random trickle pool — they only
   ever get sent as a direct reaction to the player replying
   to that coworker's original review-request email. See
   MailStore.sendEmail()'s follow-up check.
   ========================================================= */

const FOLLOW_UP_TEMPLATES = {

    "jordan-design-thanks": {

        from: { name: "Jordan Lee", address: "j.lee@northstar.local" },
        subject: "Re: Mockups for the new alert dashboard",
        originatingIP: "10.20.6.15",

        /*
         * Words that would actually appear if the player gave
         * real feedback on the mockups. Used to tell "detailed,
         * on-topic feedback" apart from "long but random text."
         */
        topicalKeywords: [
            "layout", "design", "severity", "dashboard", "mockup",
            "sort", "sorting", "triage", "color", "queue", "panel",
            "chronological", "rail", "context", "click", "prototype"
        ],

        casual: {
            preview: "No problem, thanks for taking a look!",
            body: {
                format: "html",
                content: "<p>No problem, thanks for taking a look!</p><p>Jordan</p>"
            }
        },

        detailed: {
            preview: "Thanks for taking a look — this is exactly the kind of feedback I needed.",
            body: {
                format: "html",
                content: "<p>This is really helpful, thank you.</p><p>I'll fold your notes into the next pass and probably lean toward severity-based sorting as the default with a toggle back to chronological, since it sounds like that covers most of what you need day to day.</p><p>I'll ping you again once there's a clickable version to poke at.</p><p>Jordan</p>"
            }
        },

        unclear: {
            preview: "Thanks for the reply — not sure I followed all of that.",
            body: {
                format: "html",
                content: "<p>Thanks for getting back to me — not totally sure I followed all of that, though.</p><p>Want to grab a few minutes to talk it through instead of going back and forth over email?</p><p>Jordan</p>"
            }
        }
    },

    "priya-question-thanks": {

        from: { name: "Priya Nair", address: "p.nair@northstar.local" },
        subject: "Re: New hire security training — quick question",
        originatingIP: "10.20.3.31",

        topicalKeywords: [
            "onboarding", "training", "timeline", "hire", "access",
            "provisioning", "week", "schedule", "account", "system",
            "security team", "handle", "loop", "directly", "myself",
            "manage", "coordinate", "point of contact", "start date",
            "provision"
        ],

        casual: {
            preview: "Perfect, thank you!",
            body: {
                format: "html",
                content: "<p>Perfect, thank you!</p><p>Priya</p>"
            }
        },

        detailed: {
            preview: "That's really helpful, thanks for the details.",
            body: {
                format: "html",
                content: "<p>That's really helpful, thank you for laying that out.</p><p>I'll get it on the calendar for their start date and loop you in once it's scheduled.</p><p>Priya</p>"
            }
        },

        unclear: {
            preview: "Thanks for the reply — could you clarify a bit?",
            body: {
                format: "html",
                content: "<p>Thanks for getting back to me — I don't think I quite followed, though.</p><p>Could you clarify, or would it be easier to just hop on a quick call?</p><p>Priya</p>"
            }
        }
    }

};

/*
 * Three buckets, not two:
 *   - "casual": a short, recognizable acknowledgment
 *     ("np", "thanks!", "sounds good") — matches AND is short.
 *   - "detailed": actually mentions something relevant to what
 *     was being discussed — regardless of length. A short,
 *     direct answer ("that's something I handle directly")
 *     is still a real, on-topic response and shouldn't be
 *     penalized just for being brief.
 *   - "unclear": doesn't match a known acknowledgment AND
 *     doesn't mention anything relevant — genuinely random or
 *     off-topic text. This is the honest fallback instead of
 *     guessing "thanks for taking a look" at content that has
 *     nothing to do with the original email.
 */
function classifyReply(replyBody, topicalKeywords = []) {

    const text =
        String(replyBody || "").trim();

    if (!text) {
        return "casual";
    }

    const wordCount =
        text.split(/\s+/).filter(Boolean).length;

    const casualPattern =
        /^(np|nps|thanks?( you)?!?|thank you!?|thx|sounds good|looks good|great|awesome|will do|sure|ok(ay)?|got it|cool)\b/i;

    if (casualPattern.test(text) && wordCount <= 8) {
        return "casual";
    }

    const lower =
        text.toLowerCase();

    const mentionsTopic =
        topicalKeywords.some(keyword => lower.includes(keyword));

    if (mentionsTopic) {
        return "detailed";
    }

    return "unclear";
}

/**
 * Build the coworker's follow-up email. Picks casual / detailed
 * / unclear depending on what the player actually wrote — it no
 * longer assumes a short reply is a casual "thanks" (random
 * short text now correctly lands in "unclear" instead). Returns
 * null if the key isn't recognized.
 */
export function buildFollowUpEmail(followUpKey, { id, timestamp, replyBody } = {}) {

    const template =
        FOLLOW_UP_TEMPLATES[followUpKey];

    if (!template) {
        return null;
    }

    const bucket =
        classifyReply(replyBody, template.topicalKeywords);

    const variant =
        template[bucket] || template.unclear;

    return createEmail({
        id: id || generateId("MAIL"),
        timestamp: timestamp || new Date().toISOString(),
        folder: MAIL_FOLDERS.INBOX,
        read: false,
        category: EMAIL_CATEGORIES.NORMAL,
        from: template.from,
        to: ["j.smith@northstar.local"],
        subject: template.subject,
        preview: variant.preview,
        body: variant.body,
        headers: {
            messageId: `<${generateId("msg")}@northstar.local>`,
            returnPath: `<${template.from.address}>`,
            originatingIP: template.originatingIP,
            authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
            dkimSignature: "v=1; a=rsa-sha256; d=northstar.local",
            receivedSPF: "pass",
            userAgent: "Northstar Mail Server"
        },
        authentication: {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.PASS,
            dmarc: AUTH_STATUS.PASS
        },
        classification: EMAIL_CATEGORIES.NORMAL
    });
}


/**
 * Map a followUpKey to the persona id the AI backend expects
 * (see api/mail-reply.js's PERSONAS object).
 */
export const PERSONA_BY_FOLLOWUP_KEY = {
    "jordan-design-thanks": "jordan-lee",
    "priya-question-thanks": "priya-nair"
};

/**
 * Turn plain AI-generated text into the same paragraph-HTML
 * shape every other email body uses. Escapes the text first
 * since it's dynamic content from an external call.
 */
function textToHtmlBody(text) {

    const escaped =
        String(text || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");

    return escaped
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
        .join("");
}

/**
 * Same as buildFollowUpEmail, but wraps real AI-generated
 * text instead of picking a canned casual/detailed/unclear
 * variant. Used when AI_REPLY_CONFIG is enabled and the call
 * succeeded.
 */
export function buildFollowUpEmailFromAiText(followUpKey, aiText, { id, timestamp } = {}) {

    const template =
        FOLLOW_UP_TEMPLATES[followUpKey];

    if (!template || !aiText) {
        return null;
    }

    return createEmail({
        id: id || generateId("MAIL"),
        timestamp: timestamp || new Date().toISOString(),
        folder: MAIL_FOLDERS.INBOX,
        read: false,
        category: EMAIL_CATEGORIES.NORMAL,
        from: template.from,
        to: ["j.smith@northstar.local"],
        subject: template.subject,
        preview: String(aiText).slice(0, 140),
        body: { format: "html", content: textToHtmlBody(aiText) },
        headers: {
            messageId: `<${generateId("msg")}@northstar.local>`,
            returnPath: `<${template.from.address}>`,
            originatingIP: template.originatingIP,
            authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
            dkimSignature: "v=1; a=rsa-sha256; d=northstar.local",
            receivedSPF: "pass",
            userAgent: "Northstar Mail Server"
        },
        authentication: {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.PASS,
            dmarc: AUTH_STATUS.PASS
        },
        classification: EMAIL_CATEGORIES.NORMAL
    });
}


/* =========================================================
   MARCUS (BOSS) AUTO-RESPONSE
   ---------------------------------------------------------
   For now: only the "that wasn't a real report" warning is
   implemented. Actual grading of a properly-subjected
   incident report is intentionally left for later — see
   MailStore.sendReport().
   ========================================================= */

/**
 * Rough heuristic for "this looks like an actual incident
 * report" vs. random chatter sent to the boss. Deliberately
 * generous — a real grading pass comes later.
 */
export function isLikelyIncidentReport(subject) {

    const normalized =
        String(subject || "").trim().toLowerCase();

    return (
        normalized.includes("incident") ||
        normalized.includes("report")
    );
}

/**
 * Marcus's warning reply when the player sends him something
 * that doesn't look like an incident report.
 */
export function buildBossWarningEmail({ id, timestamp, originalSubject } = {}) {

    return createEmail({
        id: id || generateId("MAIL"),
        timestamp: timestamp || new Date().toISOString(),
        folder: MAIL_FOLDERS.INBOX,
        read: false,
        important: true,
        importance: EMAIL_IMPORTANCE.HIGH,
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Marcus Webb", address: "ciso@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: `Re: ${originalSubject || "your message"}`,
        preview: "This doesn't look like an incident report — let me know if I'm missing something.",
        body: {
            format: "html",
            content: "<p>John,</p><p>I got your message, but it doesn't look like an incident report — no summary of what happened, no evidence, nothing I can act on.</p><p>If you're actively working something, send it over properly: what happened, what you found, and what you're recommending. If this was something else entirely, let me know and we'll sort it out.</p><p>Marcus</p>"
        },
        headers: {
            messageId: `<${generateId("msg")}@northstar.local>`,
            returnPath: "<ciso@northstar.local>",
            originatingIP: "10.20.2.5",
            authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
            dkimSignature: "v=1; a=rsa-sha256; d=northstar.local",
            receivedSPF: "pass",
            userAgent: "Northstar Mail Server"
        },
        authentication: {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.PASS,
            dmarc: AUTH_STATUS.PASS
        },
        classification: EMAIL_CATEGORIES.NORMAL
    });
}

/**
 * Same as buildBossWarningEmail, but wraps real AI-generated
 * text. Used when AI_REPLY_CONFIG is enabled and the call
 * succeeded.
 */
export function buildBossWarningEmailFromAiText(aiText, { id, timestamp, originalSubject } = {}) {

    if (!aiText) {
        return null;
    }

    return createEmail({
        id: id || generateId("MAIL"),
        timestamp: timestamp || new Date().toISOString(),
        folder: MAIL_FOLDERS.INBOX,
        read: false,
        important: true,
        importance: EMAIL_IMPORTANCE.HIGH,
        category: EMAIL_CATEGORIES.NORMAL,
        from: { name: "Marcus Webb", address: "ciso@northstar.local" },
        to: ["j.smith@northstar.local"],
        subject: `Re: ${originalSubject || "your message"}`,
        preview: String(aiText).slice(0, 140),
        body: { format: "html", content: textToHtmlBody(aiText) },
        headers: {
            messageId: `<${generateId("msg")}@northstar.local>`,
            returnPath: "<ciso@northstar.local>",
            originatingIP: "10.20.2.5",
            authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
            dkimSignature: "v=1; a=rsa-sha256; d=northstar.local",
            receivedSPF: "pass",
            userAgent: "Northstar Mail Server"
        },
        authentication: {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.PASS,
            dmarc: AUTH_STATUS.PASS
        },
        classification: EMAIL_CATEGORIES.NORMAL
    });
}


/* =========================================================
   PHISHING SUBJECT / LURE VARIANTS
   ---------------------------------------------------------
   AttackEngine gives us the sender address, target, attacker
   identity, and country — but not email copy. We fill that
   in here so the same attack doesn't always look identical.
   ========================================================= */

const PHISHING_LURES = [

    /* ---------------------------------------------------
       LOW SOPHISTICATION — obvious, high-pressure, generic
       --------------------------------------------------- */

    {
        sophistication: "LOW",
        displayName: "IT Security",
        subject: "Urgent: Account Verification Required",
        preview: "Unusual sign-in activity was detected on your account.",
        bodyHtml: "<p>Hello,</p><p>Our automated monitoring systems detected an unusual sign-in attempt on your account from a location that doesn't match your normal activity. As a precaution, your account access has been temporarily flagged pending verification.</p><p>To avoid interruption to your account, please verify your identity within the next 24 hours using the secure link below. If you don't recognize this activity, verifying your account also helps us secure it against further attempts.</p><p><a href=\"#\">Verify Your Account</a></p><p>If you believe this notice was sent in error, no further action is needed and access will restore automatically after 24 hours.</p><p>Thank you,<br>IT Security Team</p>",
        linkPath: "/verify",
        linkLabel: "Verify Your Account"
    },

    {
        sophistication: "LOW",
        displayName: "Password Reset Service",
        subject: "Action Required: Password Expiring Today",
        preview: "Your password expires today. Reset it now to avoid losing access.",
        bodyHtml: "<p>Hello,</p><p>This is an automated reminder that your account password is set to expire today as part of our standard 90-day rotation policy. To avoid being locked out of your account and losing access to email, calendar, and shared drives, please reset your password before end of day.</p><p><a href=\"#\">Reset Password</a></p><p>Once reset, you won't need to take any further action until your next scheduled rotation. If you've already changed your password recently, you can disregard this message.</p><p>Regards,<br>Password Reset Service</p>",
        linkPath: "/reset",
        linkLabel: "Reset Password"
    },

    {
        sophistication: "LOW",
        displayName: "Prize Notification",
        subject: "Congratulations — You've Been Selected",
        preview: "You've been randomly selected for an employee recognition reward.",
        bodyHtml: "<p>Hello,</p><p>Congratulations! You have been randomly selected to receive an employee recognition reward of $250 as part of this quarter's engagement program.</p><p>To claim your reward before it expires, please confirm your employee details using the link below within 48 hours.</p><p><a href=\"#\">Claim Your Reward</a></p><p>We look forward to celebrating your contribution!</p><p>Employee Engagement Team</p>",
        linkPath: "/claim",
        linkLabel: "Claim Your Reward"
    },

    /* ---------------------------------------------------
       MEDIUM SOPHISTICATION — calmer tone, partial auth
       pass, doesn't self-flag as urgent/important
       --------------------------------------------------- */

    {
        sophistication: "MEDIUM",
        displayName: "Document Delivery",
        subject: "A document has been shared with you",
        preview: "A colleague shared a document that requires your review.",
        bodyHtml: "<p>Hello,</p><p>A document has been shared with you and is awaiting your review. The sender has marked this as time-sensitive and requested feedback before end of day.</p><p><strong>Q3_Budget_Review.xlsx</strong></p><p><a href=\"#\">Open Document</a></p><p>This link will expire in 48 hours for security purposes. If you weren't expecting this document, you can safely ignore this message.</p><p>Thanks,<br>Document Delivery Service</p>",
        linkPath: "/document",
        linkLabel: "Open Document"
    },

    {
        sophistication: "MEDIUM",
        displayName: "Payroll Services",
        subject: "Payroll Profile Verification Needed",
        preview: "Please confirm your payroll profile information.",
        bodyHtml: "<p>Hello,</p><p>As part of our routine payroll audit ahead of the next pay cycle, we need you to verify that your direct deposit and personal information on file are current. Unverified profiles may experience a delay in their next payment.</p><p><a href=\"#\">Review Payroll Profile</a></p><p>This should only take a couple of minutes. If your information is already up to date, simply confirming it will clear the flag on your account.</p><p>Thank you for your prompt attention to this,<br>Payroll Services</p>",
        linkPath: "/payroll",
        linkLabel: "Review Payroll Profile"
    },

    {
        sophistication: "MEDIUM",
        displayName: "Northstar IT",
        subject: "Mailbox storage nearing limit",
        preview: "Your mailbox is approaching its storage limit.",
        bodyHtml: "<p>Hi,</p><p>Your mailbox is currently at 94% of its storage quota. Once it reaches capacity, you may stop receiving new messages until space is freed up or your quota is increased.</p><p>You can review your storage usage and request a quota increase through the link below.</p><p><a href=\"#\">Review Mailbox Storage</a></p><p>This is a routine notification sent automatically when a mailbox crosses the 90% threshold — no immediate action is required unless you'd like to avoid future disruption.</p><p>Northstar IT</p>",
        linkPath: "/storage",
        linkLabel: "Review Mailbox Storage"
    },

    /* ---------------------------------------------------
       HIGH SOPHISTICATION — natural tone, no urgency
       language at all, mimics routine internal process
       --------------------------------------------------- */

    {
        sophistication: "HIGH",
        displayName: "Northstar Single Sign-On",
        subject: "Your SSO session needs re-authentication",
        preview: "For continued access, please re-authenticate your single sign-on session.",
        bodyHtml: "<p>Hi,</p><p>As part of our periodic session refresh, your single sign-on session is due for re-authentication. This happens automatically every 30 days for all employees and doesn't indicate any issue with your account.</p><p>You can re-authenticate at your convenience using the link below — there's no deadline, but some connected apps may prompt you to log in again until it's completed.</p><p><a href=\"#\">Re-authenticate Session</a></p><p>Let the helpdesk know if you run into any trouble.</p><p>Northstar SSO</p>",
        linkPath: "/sso/reauth",
        linkLabel: "Re-authenticate Session"
    },

    {
        sophistication: "HIGH",
        displayName: "Northstar Facilities",
        subject: "Updated parking registration for next quarter",
        preview: "Please confirm your vehicle details for next quarter's parking registration.",
        bodyHtml: "<p>Hi,</p><p>As we prepare next quarter's parking registration, we're asking everyone to confirm their vehicle details are still current in the system. This helps us keep the garage access list accurate and avoid issues with automatic gate entry.</p><p>You can review and confirm your details whenever it's convenient this month.</p><p><a href=\"#\">Confirm Parking Details</a></p><p>Thanks for helping us keep this up to date.</p><p>Northstar Facilities</p>",
        linkPath: "/parking",
        linkLabel: "Confirm Parking Details"
    }

];


/**
 * Build a full phishing email from a live AttackEngine
 * "PHISHING_EMAIL_SENT" event (see AttackEngine.sendPhishing).
 *
 * Expected event shape (from EventEngine.createEvent):
 *   id, timestamp, eventType, severity, actor, actorType,
 *   sourceIP, destinationIP, hostname, username,
 *   sourceCountry, attackId,
 *   metadata: { sender, target, campaign }
 */
export function createPhishingEmailFromAttackEvent(event) {

    if (!event || !event.metadata) {
        return null;
    }

    /*
     * CRITICAL: do NOT use event.metadata.sender directly.
     * AttackEngine builds it as
     * `security-alert@${attacker.name...}.example` — which
     * means the sender address literally spells out the real
     * attacker's codename (e.g. "red-raven.example",
     * "ghost-lantern.example"). That's visible the instant a
     * phishing email lands, no investigation required at all —
     * a far worse leak than anything on the Attack Map, since
     * reading mail isn't optional. Generate a domain that has
     * nothing to do with the attacker's identity instead.
     *
     * This comes from data/phishingInfrastructure.js so that
     * Network's PacketEngine can generate DNS/HTTP/TLS traffic
     * to this EXACT SAME domain for this EXACT SAME attackId —
     * see that file for why.
     */
    const senderDomain =
        getPhishingDomainForAttack(event.attackId);

    const senderAddress =
        `security-alert@${senderDomain}`;

    const targetAddress =
        event.metadata.target ||
        event.username ||
        "";

    if (!targetAddress) {
        return null;
    }

    /*
     * Deterministic-ish pick so the same attackId always
     * gets the same lure (useful if this ever fires twice
     * for the same campaign), otherwise random.
     */
    const lureIndex =
        event.attackId
            ? Math.abs(hashString(event.attackId)) % PHISHING_LURES.length
            : Math.floor(Math.random() * PHISHING_LURES.length);

    const lure =
        PHISHING_LURES[lureIndex];

    const linkUrl =
        `https://${senderDomain}${lure.linkPath}`;

    const jitter =
        Math.abs(hashString(senderDomain + (event.attackId || "")));

    /*
     * Sophistication controls how many real "tells" the
     * message has. LOW is a blatant scam; HIGH is meant to
     * genuinely require reading headers/links carefully —
     * it authenticates almost cleanly and never sounds
     * urgent, with a reply-to mismatch as its only real
     * technical giveaway.
     */
    let authentication;
    let reputation;
    let threatScore;
    let domainAgeDays;
    let important;
    let importance;
    let indicators;
    let replyTo;

    if (lure.sophistication === "HIGH") {

        authentication = {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.PASS,
            dmarc: AUTH_STATUS.FAIL
        };

        reputation = "SUSPICIOUS";
        threatScore = 38 + (jitter % 18);
        domainAgeDays = 210 + (jitter % 180);
        important = false;
        importance = EMAIL_IMPORTANCE.NORMAL;

        replyTo = `no-reply@${senderDomain.replace(/^[^.]+\./, "mail.")}`;

        indicators = [
            "DMARC_FAILURE",
            "REPLY_TO_DOMAIN_MISMATCH",
            "SUSPICIOUS_LINK"
        ];

    } else if (lure.sophistication === "MEDIUM") {

        authentication = {
            spf: AUTH_STATUS.PASS,
            dkim: AUTH_STATUS.FAIL,
            dmarc: AUTH_STATUS.FAIL
        };

        reputation = "SUSPICIOUS";
        threatScore = 55 + (jitter % 20);
        domainAgeDays = 60 + (jitter % 90);
        important = false;
        importance = EMAIL_IMPORTANCE.NORMAL;

        replyTo = senderAddress;

        indicators = [
            "DKIM_FAILURE",
            "DMARC_FAILURE",
            "SUSPICIOUS_LINK",
            "CREDENTIAL_HARVESTING"
        ];

    } else {

        /*
         * Still the "easy" tier, but no longer a perfect
         * 3-for-3 auth failure + flagged-important combo —
         * that was a mechanical tell on its own, answerable
         * without reading a word of the message. One check
         * softfails instead of failing outright, and it no
         * longer self-flags as important.
         */

        authentication = {
            spf: AUTH_STATUS.FAIL,
            dkim: AUTH_STATUS.FAIL,
            dmarc: AUTH_STATUS.SOFTFAIL
        };

        reputation = "MALICIOUS";
        threatScore = 85 + (jitter % 15);
        domainAgeDays = 3 + (jitter % 25);
        important = false;
        importance = EMAIL_IMPORTANCE.NORMAL;

        replyTo = senderAddress;

        indicators = [
            "DOMAIN_IMPERSONATION",
            "SPF_FAILURE",
            "DKIM_FAILURE",
            "DMARC_FAILURE",
            "MALICIOUS_LINK",
            "URGENT_LANGUAGE",
            "CREDENTIAL_HARVESTING"
        ];
    }

    return createEmail({
        id: `MAIL-${event.attackId || generateId("PHISH")}`,

        folder: MAIL_FOLDERS.INBOX,

        timestamp: event.timestamp || new Date().toISOString(),

        read: false,

        important,

        importance,

        category: EMAIL_CATEGORIES.NORMAL,

        from: {
            name: lure.displayName,
            address: senderAddress
        },

        /*
         * Mail only has ONE inbox — the player's. Whichever
         * real employee AttackEngine actually targeted
         * (targetAddress) is still used above to validate the
         * event and could matter for future investigation
         * context, but the visible To: line always shows the
         * player's own address, since seeing "To: dcohen@..."
         * in an inbox that isn't Dana Cohen's is just confusing,
         * not informative.
         */
        to: ["j.smith@northstar.local"],

        replyTo,

        subject: lure.subject,

        /*
         * Framed as routed to the analyst, not sent to them
         * personally — this mailbox isn't the actual phishing
         * target (see the note on targetAddress above), it's
         * where flagged mail lands for investigation. Matches
         * how a real "report phishing" pipeline works.
         */
        preview:
            `Flagged by an employee and routed to Security for review — ${lure.preview}`,

        body: {
            format: "html",
            content:
                `<p>[Routed via Security Awareness] An employee flagged this message as suspicious and it was automatically routed to your queue for review. Original message follows.</p>${lure.bodyHtml}`
        },

        headers: {
            messageId: `<${generateId("phish")}@${senderDomain}>`,
            returnPath: `<bounce@${senderDomain}>`,
            originatingIP: event.sourceIP || "",
            authenticationResults: `spf=${authentication.spf.toLowerCase()}; dkim=${authentication.dkim.toLowerCase()}; dmarc=${authentication.dmarc.toLowerCase()}`,
            dkimSignature: `v=1; a=rsa-sha256; d=${senderDomain}`,
            receivedSPF: authentication.spf === AUTH_STATUS.PASS
                ? `pass (domain ${senderDomain} designates ${event.sourceIP || "unknown"} as permitted sender)`
                : `fail (domain does not designate ${event.sourceIP || "unknown"})`,
            userAgent: "Mozilla/5.0"
        },

        authentication,

        links: [
            {
                id: `LINK-${event.attackId || generateId("LINK")}-01`,
                text: lure.linkLabel,
                url: linkUrl,
                visibleUrl: `https://northstar.local${lure.linkPath}`,
                domain: senderDomain,
                reputation,
                threatScore,
                country: event.sourceCountry || "Unknown",
                domainAgeDays,
                https: true,
                knownPhishing: reputation === "MALICIOUS"
            }
        ],

        classification: EMAIL_CATEGORIES.NORMAL,

        indicators,

        simulation: {
            malicious: true,
            scenarioId: event.attackId || null,
            eventType: event.eventType || "PHISHING_EMAIL_DETECTED"
        }
    });
}

/* =========================================================
   PURE ARRAY HELPERS
   ---------------------------------------------------------
   MailStore owns the actual mutable emails array; these just
   operate on whatever array they're given.
   ========================================================= */

export function findEmailById(emails, id) {

    return (emails || []).find(email => email.id === id) || null;
}

export function filterEmailsByFolder(emails, folder) {

    if (folder === MAIL_FOLDERS.STARRED) {
        return (emails || []).filter(email => email.starred);
    }

    return (emails || []).filter(email => email.folder === folder);
}

export function searchEmailsIn(emails, query) {

    if (!query || !query.trim()) {
        return emails || [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    return (emails || []).filter(email => {

        const searchableFields = [
            email.from.name,
            email.from.address,
            email.subject,
            email.preview,
            email.replyTo,
            ...email.to,
            ...email.cc,
            email.category,
            ...email.links.map(link => link.domain),
            ...email.links.map(link => link.url),
            ...email.attachments.map(attachment => attachment.name)
        ];

        return searchableFields.some(value =>
            String(value || "").toLowerCase().includes(normalizedQuery)
        );
    });
}