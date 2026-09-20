/* =========================================================
   NORTHSTAR SOC — MAIL INVESTIGATOR
   File: mail/MailInvestigator.js

   Purpose:
   Email-forensics and investigation engine.

   Responsibilities:
   - Analyze email headers
   - Evaluate SPF / DKIM / DMARC
   - Detect sender / reply-to mismatches
   - Detect domain impersonation
   - Analyze URLs
   - Analyze simulated attachments
   - Extract IOCs
   - Detect suspicious email indicators
   - Calculate investigation risk
   - Generate an analyst-readable investigation summary

   IMPORTANT:
   This module DOES NOT generate SIEM alerts.

   It only produces evidence/findings.

   The simulation architecture decides whether an
   investigation should result in an event or alert.
   ========================================================= */


/* =========================================================
   CONSTANTS
   ========================================================= */

const AUTH_STATUS = {
    PASS: "PASS",
    FAIL: "FAIL",
    SOFTFAIL: "SOFTFAIL",
    NEUTRAL: "NEUTRAL",
    NONE: "NONE",
    TEMPERROR: "TEMPERROR",
    PERMERROR: "PERMERROR",
    UNKNOWN: "UNKNOWN"
};


const RISK_LEVEL = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
};


const EMAIL_CATEGORIES = {
    NORMAL: "NORMAL",
    INTERNAL: "INTERNAL",
    PHISHING: "PHISHING",
    BEC: "BEC",
    SUSPICIOUS: "SUSPICIOUS",
    MALWARE: "MALWARE"
};


/* =========================================================
   UTILITY FUNCTIONS
   ========================================================= */

/**
 * Safely convert a value to a string.
 */
function safeString(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value);
}


/**
 * Normalize an email address.
 */
function normalizeEmail(address) {

    return safeString(address)
        .trim()
        .toLowerCase();
}


/**
 * Extract the domain from an email address.
 */
function extractDomain(address) {

    const normalized =
        normalizeEmail(address);

    const atIndex =
        normalized.lastIndexOf("@");

    if (atIndex === -1) {
        return "";
    }

    return normalized
        .slice(atIndex + 1)
        .trim();
}


/**
 * Extract hostname/domain from a URL.
 *
 * This handles simulated URLs as well as normal URLs.
 */
function extractUrlDomain(url) {

    try {

        const parsed =
            new URL(url);

        return parsed.hostname
            .toLowerCase();

    } catch {

        /*
         * Fallback for intentionally simulated or
         * malformed URLs.
         */

        const match =
            safeString(url).match(
                /^(?:https?:\/\/)?([^\/?#]+)/i
            );

        return match
            ? match[1].toLowerCase()
            : "";
    }
}


/**
 * Determine whether a domain looks like an IP address.
 */
function isIPAddress(domain) {

    return /^(?:\d{1,3}\.){3}\d{1,3}$/
        .test(domain);
}


/**
 * Get the registered-looking portion of a hostname.
 *
 * This is intentionally simplified because NORTHSTAR
 * uses simulated domains.
 */
function getBaseDomain(domain) {

    const parts =
        safeString(domain)
            .toLowerCase()
            .split(".")
            .filter(Boolean);

    if (parts.length <= 2) {
        return parts.join(".");
    }

    return parts
        .slice(-2)
        .join(".");
}


/**
 * Compare two domains.
 */
function domainsMatch(
    domainA,
    domainB
) {

    if (!domainA || !domainB) {
        return false;
    }

    return (
        domainA === domainB ||
        domainA.endsWith(`.${domainB}`) ||
        domainB.endsWith(`.${domainA}`)
    );
}


/**
 * Determine whether two domains are suspiciously similar.
 *
 * Examples:
 * microsoft.com
 * m1crosoft-login.example
 * micr0soft.example
 */
function detectDomainSimilarity(
    domainA,
    domainB
) {

    if (!domainA || !domainB) {
        return {
            suspicious: false,
            reason: null,
            similarity: 0
        };
    }

    if (domainsMatch(domainA, domainB)) {

        return {
            suspicious: false,
            reason: null,
            similarity: 100
        };
    }

    const normalizeDomain = domain =>
        domain
            .replace(/0/g, "o")
            .replace(/1/g, "l")
            .replace(/3/g, "e")
            .replace(/5/g, "s")
            .replace(/7/g, "t")
            .replace(/-/g, "")
            .replace(/\./g, "")
            .toLowerCase();

    const a =
        normalizeDomain(domainA);

    const b =
        normalizeDomain(domainB);

    /*
     * Basic similarity calculation.
     */
    const maxLength =
        Math.max(a.length, b.length);

    if (!maxLength) {
        return {
            suspicious: false,
            reason: null,
            similarity: 0
        };
    }

    let matches = 0;

    const shorter =
        Math.min(a.length, b.length);

    for (
        let i = 0;
        i < shorter;
        i++
    ) {

        if (a[i] === b[i]) {
            matches++;
        }
    }

    const similarity =
        Math.round(
            (matches / maxLength) * 100
        );

    const suspicious =
        similarity >= 65;

    return {
        suspicious,
        similarity,
        reason: suspicious
            ? "DOMAIN_SIMILARITY"
            : null
    };
}


/**
 * Normalize authentication result.
 */
function normalizeAuthStatus(status) {

    const normalized =
        safeString(status)
            .trim()
            .toUpperCase();

    if (
        Object.values(AUTH_STATUS)
            .includes(normalized)
    ) {
        return normalized;
    }

    return AUTH_STATUS.UNKNOWN;
}


/* =========================================================
   MAIL INVESTIGATOR
   ========================================================= */

export class MailInvestigator {

    constructor(store = null) {

        this.store = store;

        this.initialized = true;

        console.log(
            "[MAIL INVESTIGATOR] ONLINE"
        );
    }


    /* =====================================================
       BASIC EMAIL VALIDATION
       ===================================================== */

    validateEmail(email) {

        const findings = [];

        if (!email) {

            return {
                valid: false,
                findings: [
                    {
                        code: "EMAIL_MISSING",
                        severity: RISK_LEVEL.CRITICAL,
                        message:
                            "No email object was provided."
                    }
                ]
            };
        }


        if (!email.from?.address) {

            findings.push({
                code: "MISSING_SENDER",
                severity: RISK_LEVEL.HIGH,
                message:
                    "Sender address is missing."
            });
        }


        if (
            !Array.isArray(email.to) ||
            email.to.length === 0
        ) {

            findings.push({
                code: "MISSING_RECIPIENT",
                severity: RISK_LEVEL.MEDIUM,
                message:
                    "No recipient address was provided."
            });
        }


        if (!email.subject) {

            findings.push({
                code: "MISSING_SUBJECT",
                severity: RISK_LEVEL.LOW,
                message:
                    "Email does not contain a subject."
            });
        }


        return {
            valid: findings.length === 0,
            findings
        };
    }


    /* =====================================================
       HEADER ANALYSIS
       ===================================================== */

    /**
     * Analyze visible and technical headers.
     */
    analyzeHeaders(email) {

        if (!email) {
            return null;
        }

        const headers =
            email.headers || {};

        const findings = [];

        const senderAddress =
            normalizeEmail(
                email.from?.address
            );

        const senderDomain =
            extractDomain(
                senderAddress
            );

        const replyTo =
            normalizeEmail(
                email.replyTo
            );

        const replyToDomain =
            extractDomain(
                replyTo
            );

        const returnPath =
            normalizeEmail(
                headers.returnPath
            );

        const returnPathDomain =
            extractDomain(
                returnPath
            );


        /* ---------------------------------------------
           Reply-To mismatch
           --------------------------------------------- */

        if (
            replyTo &&
            senderAddress &&
            replyTo !== senderAddress
        ) {

            findings.push({
                code: "REPLY_TO_MISMATCH",
                severity: RISK_LEVEL.HIGH,

                message:
                    "Reply-To address differs from the visible sender.",

                evidence: {
                    from:
                        senderAddress,

                    replyTo:
                        replyTo
                }
            });
        }


        /* ---------------------------------------------
           Reply-To domain mismatch
           --------------------------------------------- */

        if (
            replyToDomain &&
            senderDomain &&
            !domainsMatch(
                replyToDomain,
                senderDomain
            )
        ) {

            findings.push({
                code: "REPLY_TO_DOMAIN_MISMATCH",
                severity: RISK_LEVEL.HIGH,

                message:
                    "Reply-To domain does not match the sender domain.",

                evidence: {
                    senderDomain,
                    replyToDomain
                }
            });
        }


        /* ---------------------------------------------
           Return-Path mismatch
           --------------------------------------------- */

        if (
            returnPathDomain &&
            senderDomain &&
            !domainsMatch(
                returnPathDomain,
                senderDomain
            )
        ) {

            findings.push({
                code: "RETURN_PATH_MISMATCH",
                severity: RISK_LEVEL.MEDIUM,

                message:
                    "Return-Path domain differs from sender domain.",

                evidence: {
                    senderDomain,
                    returnPathDomain
                }
            });
        }


        /* ---------------------------------------------
           Message-ID domain mismatch
           --------------------------------------------- */

        const messageId =
            safeString(
                headers.messageId
            );

        const messageIdMatch =
            messageId.match(
                /@([^>\s]+)/
            );

        if (
            messageIdMatch &&
            senderDomain
        ) {

            const messageIdDomain =
                messageIdMatch[1]
                    .toLowerCase();

            if (
                !domainsMatch(
                    messageIdDomain,
                    senderDomain
                )
            ) {

                findings.push({
                    code: "MESSAGE_ID_DOMAIN_MISMATCH",
                    severity: RISK_LEVEL.MEDIUM,

                    message:
                        "Message-ID domain does not match the sender domain.",

                    evidence: {
                        senderDomain,
                        messageIdDomain
                    }
                });
            }
        }


        /* ---------------------------------------------
           Originating IP
           --------------------------------------------- */

        const originatingIP =
            headers.originatingIP ||
            headers.xOriginatingIP ||
            null;

        if (originatingIP) {

            findings.push({
                code: "ORIGINATING_IP_IDENTIFIED",
                severity: RISK_LEVEL.LOW,

                message:
                    "Originating IP address identified.",

                evidence: {
                    ip:
                        originatingIP
                }
            });

        }


        return {

            sender: {
                name:
                    email.from?.name || "",

                address:
                    senderAddress,

                domain:
                    senderDomain
            },

            replyTo: {
                address:
                    replyTo,

                domain:
                    replyToDomain
            },

            returnPath: {
                address:
                    returnPath,

                domain:
                    returnPathDomain
            },

            messageId,

            originatingIP,

            findings,

            risk:
                this.calculateRiskFromFindings(
                    findings
                )
        };
    }


    /* =====================================================
       FULL RAW HEADER ANALYSIS
       ===================================================== */

    analyzeFullHeaders(email) {

        if (!email) {
            return null;
        }

        const headers =
            email.headers || {};

        const standardHeaders = {

            received:
                headers.received ||
                [],

            returnPath:
                headers.returnPath ||
                "",

            messageId:
                headers.messageId ||
                "",

            authenticationResults:
                headers.authenticationResults ||
                "",

            dkimSignature:
                headers.dkimSignature ||
                "",

            receivedSPF:
                headers.receivedSPF ||
                "",

            originatingIP:
                headers.originatingIP ||
                "",

            userAgent:
                headers.userAgent ||
                ""
        };


        /*
         * Convert a single Received value into an array.
         */
        if (
            typeof standardHeaders.received ===
            "string"
        ) {

            standardHeaders.received = [
                standardHeaders.received
            ];
        }


        const headerAnalysis =
            this.analyzeHeaders(email);


        return {

            raw: standardHeaders,

            parsed: headerAnalysis,

            suspicious:
                headerAnalysis
                    ?.findings
                    ?.filter(
                        finding =>
                            finding.severity ===
                            RISK_LEVEL.HIGH ||
                            finding.severity ===
                            RISK_LEVEL.CRITICAL
                    ) || []
        };
    }


    /* =====================================================
       SPF / DKIM / DMARC
       ===================================================== */

    checkAuthentication(email) {

        if (!email) {
            return null;
        }

        /*
         * REMOVED as a source of findings/score: SPF/DKIM/DMARC
         * pass-fail is a mechanical checklist a player could
         * read off in one glance — with it counting toward the
         * score, it made checking a link's actual reputation in
         * Threat Intel unnecessary. Real destination-domain
         * legitimacy is Threat Intel's job now, not a header
         * checklist's. The raw spf/dkim/dmarc values are still
         * returned in case something downstream wants the raw
         * data, but they no longer generate findings, count
         * toward "failures", or move the risk score.
         */

        const headers =
            email.headers || {};

        const spf =
            normalizeAuthStatus(
                headers.spf
            );

        const dkim =
            normalizeAuthStatus(
                headers.dkim
            );

        const dmarc =
            normalizeAuthStatus(
                headers.dmarc
            );

        return {

            spf,
            dkim,
            dmarc,

            passed: true,

            failures: 0,

            risk: RISK_LEVEL.LOW,

            findings: []
        };
    }


    /* =====================================================
       SENDER ANALYSIS
       ===================================================== */

    analyzeSender(email) {

        if (!email) {
            return null;
        }

        const sender =
            email.from || {};

        const address =
            normalizeEmail(
                sender.address
            );

        const domain =
            extractDomain(address);

        const displayName =
            safeString(
                sender.name
            );


        const findings = [];


        /* ---------------------------------------------
           Display name spoofing
           --------------------------------------------- */

        const highValueBrands = [
            "microsoft",
            "google",
            "apple",
            "amazon",
            "paypal",
            "northstar",
            "security",
            "administrator",
            "it support",
            "human resources",
            "finance",
            "ceo"
        ];


        const displayNameLower =
            displayName.toLowerCase();


        const impersonatedBrand =
            highValueBrands.find(
                brand =>
                    displayNameLower.includes(
                        brand
                    )
            );


        if (
            impersonatedBrand &&
            domain
        ) {

            /*
             * This is a heuristic. A legitimate corporate
             * domain can still contain these names, so we
             * only raise this when the domain doesn't look
             * obviously associated with the brand.
             */

            const domainLooksRelated =
                domain.includes(
                    impersonatedBrand
                        .replace(/\s+/g, "")
                );


            if (!domainLooksRelated) {

                findings.push({
                    code:
                        "DISPLAY_NAME_IMPERSONATION",

                    severity:
                        RISK_LEVEL.MEDIUM,

                    message:
                        `Display name may impersonate ${impersonatedBrand}.`,

                    evidence: {
                        displayName,
                        domain
                    }
                });
            }
        }


        /* ---------------------------------------------
           Suspicious domain patterns
           --------------------------------------------- */

        const suspiciousPatterns = [

            {
                regex: /login/i,
                code: "LOGIN_DOMAIN"
            },

            {
                regex: /verify/i,
                code: "VERIFY_DOMAIN"
            },

            {
                regex: /secure/i,
                code: "SECURE_DOMAIN"
            },

            {
                regex: /account/i,
                code: "ACCOUNT_DOMAIN"
            },

            {
                regex: /support/i,
                code: "SUPPORT_DOMAIN"
            },

            {
                regex: /update/i,
                code: "UPDATE_DOMAIN"
            }
        ];


        const matchingPattern =
            suspiciousPatterns.find(
                item =>
                    item.regex.test(domain)
            );


        if (matchingPattern) {

            findings.push({
                code:
                    matchingPattern.code,

                severity:
                    RISK_LEVEL.LOW,

                message:
                    "Sender domain contains a commonly abused authentication-related keyword.",

                evidence: {
                    domain
                }
            });
        }


        return {

            name:
                displayName,

            address,

            domain,

            findings,

            risk:
                this.calculateRiskFromFindings(
                    findings
                )
        };
    }


    /* =====================================================
       SUBJECT / BODY ANALYSIS
       ===================================================== */

    analyzeContent(email) {

        if (!email) {
            return null;
        }

        const subject =
            safeString(
                email.subject
            );

        let body = "";

        if (
            typeof email.body?.content ===
            "string"
        ) {

            body =
                email.body.content;
        }


        /*
         * Strip basic HTML.
         */
        const text =
            `${subject} ${body}`
                .replace(
                    /<[^>]*>/g,
                    " "
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        const lower =
            text.toLowerCase();

        const findings = [];


        /* ---------------------------------------------
           Urgency
           --------------------------------------------- */

        const urgencyTerms = [
            "urgent",
            "immediately",
            "act now",
            "within 24 hours",
            "final warning",
            "account will be suspended",
            "verify now",
            "action required",
            "critical",
            "as soon as possible"
        ];


        const urgencyMatches =
            urgencyTerms.filter(
                term =>
                    lower.includes(term)
            );


        if (
            urgencyMatches.length >= 1
        ) {

            findings.push({
                code:
                    "URGENT_LANGUAGE",

                severity:
                    urgencyMatches.length >= 2
                        ? RISK_LEVEL.HIGH
                        : RISK_LEVEL.MEDIUM,

                message:
                    "Message contains urgency or pressure language.",

                evidence: {
                    matches:
                        urgencyMatches
                }
            });
        }


        /* ---------------------------------------------
           Credential harvesting
           --------------------------------------------- */

        const credentialTerms = [
            "password",
            "login",
            "sign in",
            "credentials",
            "verify your account",
            "authentication",
            "security code",
            "mfa",
            "multi-factor",
            "one-time code"
        ];


        const credentialMatches =
            credentialTerms.filter(
                term =>
                    lower.includes(term)
            );


        if (
            credentialMatches.length >= 2
        ) {

            findings.push({
                code:
                    "CREDENTIAL_HARVESTING_LANGUAGE",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Message contains multiple credential or authentication-related terms.",

                evidence: {
                    matches:
                        credentialMatches
                }
            });
        }


        /* ---------------------------------------------
           Financial request
           --------------------------------------------- */

        const financialTerms = [
            "wire transfer",
            "bank transfer",
            "invoice",
            "payment",
            "account number",
            "routing number",
            "gift card",
            "purchase",
            "payment request",
            "send funds"
        ];


        const financialMatches =
            financialTerms.filter(
                term =>
                    lower.includes(term)
            );


        if (
            financialMatches.length >= 1
        ) {

            findings.push({
                code:
                    "FINANCIAL_REQUEST_LANGUAGE",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Message contains financial transaction language.",

                evidence: {
                    matches:
                        financialMatches
                }
            });
        }


        /* ---------------------------------------------
           Password reset
           --------------------------------------------- */

        if (
            lower.includes("password reset") ||
            lower.includes("reset your password")
        ) {

            findings.push({
                code:
                    "PASSWORD_RESET_THEME",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Message uses a password-reset theme."
            });
        }


        /* ---------------------------------------------
           Attachment bait
           --------------------------------------------- */

        const attachmentTerms = [
            "invoice",
            "document",
            "statement",
            "report",
            "payment",
            "resume",
            "purchase order",
            "purchase order",
            "shared file"
        ];


        const attachmentBait =
            attachmentTerms.filter(
                term =>
                    lower.includes(term)
            );


        if (
            email.attachments?.length &&
            attachmentBait.length
        ) {

            findings.push({
                code:
                    "ATTACHMENT_BAIT",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Message combines an attachment with document/payment-related language.",

                evidence: {
                    matches:
                        attachmentBait
                }
            });
        }


        return {

            subject,

            text,

            urgencyMatches,

            credentialMatches,

            financialMatches,

            findings,

            risk:
                this.calculateRiskFromFindings(
                    findings
                )
        };
    }


    /* =====================================================
       LINK ANALYSIS
       ===================================================== */

    analyzeLink(
        email,
        link
    ) {

        if (!link) {
            return null;
        }

        const url =
            safeString(
                link.url
            );

        const visibleText =
            safeString(
                link.text
            );

        const domain =
            extractUrlDomain(url);

        const findings = [];

        /*
         * NOTE: this deliberately does NOT look at
         * link.reputation / link.threatScore. Those are
         * ground-truth flags the simulation uses for its own
         * scoring, not something a real analyst could see by
         * looking at a link — surfacing them here would hand
         * the player the verdict directly instead of making
         * them cross-check the domain in Threat Intel. Every
         * finding below is something actually observable from
         * the link itself.
         */


        /* ---------------------------------------------
           Visible URL vs actual URL
           ---------------------------------------------
           BUGFIX: this used to test visibleText (the
           button/anchor LABEL, e.g. "Verify Your Account")
           against /^https?:\/\//i — labels are almost never
           URL-shaped, so this could never match and the
           mismatch check was permanently dead. The actual
           "what does this link appear to point to" field is
           link.visibleUrl (what the email visually presents,
           e.g. a northstar.local-looking path) versus the
           real href in link.url/domain. Fall back to
           visibleText only for the case where the anchor
           text itself happens to be written out as a URL.
           --------------------------------------------- */

        const visibleUrl =
            safeString(
                link.visibleUrl
            );

        const visibleUrlSource =
            visibleUrl ||
            (
                visibleText
                    .match(
                        /^https?:\/\//i
                    )
                    ? visibleText
                    : ""
            );

        let visibleDomain =
            null;


        if (visibleUrlSource) {

            visibleDomain =
                extractUrlDomain(
                    visibleUrlSource
                );
        }


        if (
            visibleDomain &&
            domain &&
            !domainsMatch(
                visibleDomain,
                domain
            )
        ) {

            findings.push({
                code:
                    "URL_DISPLAY_MISMATCH",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Visible URL does not match the actual destination.",

                evidence: {
                    visibleDomain,
                    actualDomain:
                        domain
                }
            });
        }


        /* ---------------------------------------------
           IP-based URL
           --------------------------------------------- */

        if (
            isIPAddress(domain)
        ) {

            findings.push({
                code:
                    "IP_BASED_URL",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Link destination uses an IP address instead of a domain.",

                evidence: {
                    domain
                }
            });
        }


        /* ---------------------------------------------
           Suspicious domain keywords
           --------------------------------------------- */

        const suspiciousKeywords = [
            "login",
            "verify",
            "secure",
            "account",
            "password",
            "update",
            "authenticate",
            "microsoft-login",
            "google-login"
        ];


        const keywordMatches =
            suspiciousKeywords.filter(
                keyword =>
                    domain
                        .toLowerCase()
                        .includes(keyword)
            );


        if (
            keywordMatches.length
        ) {

            findings.push({
                code:
                    "SUSPICIOUS_DOMAIN_KEYWORD",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Destination domain contains authentication-related keywords.",

                evidence: {
                    keywordMatches
                }
            });
        }


        /* ---------------------------------------------
           HTTPS
           --------------------------------------------- */

        let https = false;

        try {

            https =
                new URL(url)
                    .protocol === "https:";

        } catch {

            https = false;

        }


        if (!https) {

            findings.push({
                code:
                    "NO_HTTPS",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Link does not use HTTPS."
            });
        }


        /* ---------------------------------------------
           Calculate risk
           --------------------------------------------- */

        const risk =
            this.calculateRiskFromFindings(
                findings
            );


        return {

            url,

            visibleText,

            visibleUrl:
                visibleUrl ||
                null,

            domain,

            https,

            visibleDomain,

            findings,

            risk
        };
    }


    /* =====================================================
       ALL LINK ANALYSIS
       ===================================================== */

    analyzeLinks(email) {

        if (!email) {
            return [];
        }

        const links =
            Array.isArray(email.links)
                ? email.links
                : [];


        return links.map(
            (link, index) => {

                return {
                    id:
                        link.id ||
                        `LINK-${index + 1}`,

                    ...this.analyzeLink(
                        email,
                        link
                    )
                };

            }
        );
    }


    /* =====================================================
       ATTACHMENT ANALYSIS
       ===================================================== */

    analyzeAttachment(
        email,
        attachment
    ) {

        if (!attachment) {
            return null;
        }

        const findings = [];


        const fileName =
            safeString(
                attachment.name
            );


        const extension =
            fileName
                .split(".")
                .pop()
                .toLowerCase();


        /* ---------------------------------------------
           Password protection
           --------------------------------------------- */

        if (
            attachment.passwordProtected
        ) {

            findings.push({
                code:
                    "PASSWORD_PROTECTED_ARCHIVE",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Attachment is password protected."
            });
        }


        /* ---------------------------------------------
           Dangerous archive
           --------------------------------------------- */

        const archiveExtensions = [
            "zip",
            "rar",
            "7z",
            "iso"
        ];


        if (
            archiveExtensions.includes(
                extension
            )
        ) {

            findings.push({
                code:
                    "ARCHIVE_ATTACHMENT",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Attachment is an archive file."
            });
        }


        /* ---------------------------------------------
           Executable
           --------------------------------------------- */

        const executableExtensions = [
            "exe",
            "scr",
            "msi",
            "bat",
            "cmd",
            "com",
            "ps1",
            "vbs",
            "js"
        ];


        if (
            executableExtensions.includes(
                extension
            )
        ) {

            findings.push({
                code:
                    "EXECUTABLE_ATTACHMENT",

                severity:
                    RISK_LEVEL.CRITICAL,

                message:
                    "Attachment has an executable or script extension."
            });
        }


        /* ---------------------------------------------
           Double extension
           --------------------------------------------- */

        const dangerousExtensions =
            executableExtensions.join("|");


        const doubleExtensionPattern =
            new RegExp(
                `\\.${dangerousExtensions}\\.`,
                "i"
            );


        if (
            doubleExtensionPattern.test(
                fileName
            )
        ) {

            findings.push({
                code:
                    "DOUBLE_EXTENSION",

                severity:
                    RISK_LEVEL.CRITICAL,

                message:
                    "Attachment uses a suspicious double-extension pattern."
            });
        }


        /*
         * NOTE: deliberately not looking at attachment.risk
         * (a ground-truth simulation flag) here — same
         * reasoning as analyzeLink(). "malicious" below is
         * computed purely from the structural findings above,
         * never from a declared/simulated risk label.
         */


        /* ---------------------------------------------
           Hash
           --------------------------------------------- */

        const hash =
            safeString(
                attachment.hash
            );


        if (!hash) {

            findings.push({
                code:
                    "MISSING_HASH",

                severity:
                    RISK_LEVEL.LOW,

                message:
                    "Attachment does not contain a simulated SHA-256 hash."
            });
        }


        return {

            id:
                attachment.id ||
                fileName,

            name:
                fileName,

            extension,

            type:
                attachment.type ||
                "unknown",

            size:
                Number(
                    attachment.size
                ) || 0,

            hash,

            passwordProtected:
                Boolean(
                    attachment.passwordProtected
                ),

            findings,

            risk:
                this.calculateRiskFromFindings(
                    findings
                ),

            malicious:
                findings.some(
                    finding =>
                        finding.severity ===
                        RISK_LEVEL.CRITICAL
                )
        };
    }


    /* =====================================================
       ALL ATTACHMENT ANALYSIS
       ===================================================== */

    analyzeAttachments(email) {

        if (!email) {
            return [];
        }

        const attachments =
            Array.isArray(
                email.attachments
            )
                ? email.attachments
                : [];


        return attachments.map(
            (attachment, index) => {

                return this.analyzeAttachment(
                    email,
                    {
                        ...attachment,

                        id:
                            attachment.id ||
                            `ATTACHMENT-${index + 1}`
                    }
                );

            }
        );
    }


    /* =====================================================
       DOMAIN ANALYSIS
       ===================================================== */

    analyzeDomain(domain) {

        const normalized =
            safeString(domain)
                .trim()
                .toLowerCase();


        if (!normalized) {

            return {
                domain: "",
                risk: RISK_LEVEL.LOW,
                findings: []
            };
        }


        const findings = [];


        /* IP address */

        if (
            isIPAddress(normalized)
        ) {

            findings.push({
                code:
                    "IP_ADDRESS_DOMAIN",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Indicator is an IP address rather than a hostname."
            });
        }


        /* Suspicious TLDs */

        const suspiciousTLDs = [
            ".zip",
            ".mov",
            ".top",
            ".click",
            ".buzz",
            ".xyz",
            ".support",
            ".download"
        ];


        const matchingTLD =
            suspiciousTLDs.find(
                tld =>
                    normalized.endsWith(
                        tld
                    )
            );


        if (matchingTLD) {

            findings.push({
                code:
                    "SUSPICIOUS_TLD",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Domain uses a TLD commonly associated with suspicious infrastructure.",

                evidence: {
                    tld:
                        matchingTLD
                }
            });
        }


        /* Authentication-related keywords */

        const keywords = [
            "login",
            "verify",
            "secure",
            "account",
            "password",
            "authenticate",
            "update",
            "support"
        ];


        const keywordMatches =
            keywords.filter(
                keyword =>
                    normalized.includes(
                        keyword
                    )
            );


        if (
            keywordMatches.length >= 2
        ) {

            findings.push({
                code:
                    "MULTIPLE_SUSPICIOUS_DOMAIN_KEYWORDS",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Domain contains multiple authentication-related keywords.",

                evidence: {
                    keywordMatches
                }
            });
        }


        return {

            domain:
                normalized,

            baseDomain:
                getBaseDomain(
                    normalized
                ),

            risk:
                this.calculateRiskFromFindings(
                    findings
                ),

            findings
        };
    }


    /* =====================================================
       IOC EXTRACTION
       ===================================================== */

    extractIOCs(email) {

        if (!email) {
            return null;
        }

        const domains = new Set();

        const ips = new Set();

        const urls = new Set();

        const hashes = new Set();


        /* Sender domain */

        const senderDomain =
            extractDomain(
                email.from?.address
            );


        if (senderDomain) {
            domains.add(
                senderDomain
            );
        }


        /* Reply-To */

        const replyDomain =
            extractDomain(
                email.replyTo
            );


        if (replyDomain) {
            domains.add(
                replyDomain
            );
        }


        /* Originating IP */

        if (
            email.headers?.originatingIP
        ) {

            ips.add(
                email.headers.originatingIP
            );
        }


        /* Links */

        const links =
            Array.isArray(email.links)
                ? email.links
                : [];


        links.forEach(link => {

            if (link.url) {

                urls.add(
                    link.url
                );

                const domain =
                    extractUrlDomain(
                        link.url
                    );

                if (domain) {
                    domains.add(
                        domain
                    );
                }

                if (
                    isIPAddress(domain)
                ) {
                    ips.add(domain);
                }
            }

        });


        /* Attachments */

        const attachments =
            Array.isArray(
                email.attachments
            )
                ? email.attachments
                : [];


        attachments.forEach(
            attachment => {

                if (attachment.hash) {

                    hashes.add(
                        attachment.hash
                    );
                }

            }
        );


        return {

            domains:
                Array.from(domains),

            ips:
                Array.from(ips),

            urls:
                Array.from(urls),

            hashes:
                Array.from(hashes)
        };
    }


    /* =====================================================
       INDICATOR ANALYSIS
       ===================================================== */

    analyzeIndicators(email) {

        if (!email) {
            return [];
        }

        const findings = [];


        const headerAnalysis =
            this.analyzeHeaders(email);

        const authentication =
            this.checkAuthentication(email);

        const sender =
            this.analyzeSender(email);

        const content =
            this.analyzeContent(email);

        const links =
            this.analyzeLinks(email);

        const attachments =
            this.analyzeAttachments(email);


        findings.push(
            ...(headerAnalysis?.findings || [])
        );

        findings.push(
            ...(authentication?.findings || [])
        );

        findings.push(
            ...(sender?.findings || [])
        );

        findings.push(
            ...(content?.findings || [])
        );


        links.forEach(link => {

            findings.push(
                ...(link.findings || [])
            );

        });


        attachments.forEach(
            attachment => {

                findings.push(
                    ...(attachment.findings || [])
                );

            }
        );


        /*
         * Remove duplicate finding codes.
         */
        const unique =
            new Map();


        findings.forEach(
            finding => {

                if (
                    !unique.has(
                        finding.code
                    )
                ) {

                    unique.set(
                        finding.code,
                        finding
                    );
                }

            }
        );


        return Array.from(
            unique.values()
        );
    }


    /* =====================================================
       BEC ANALYSIS
       ===================================================== */

    analyzeBEC(email) {

        if (!email) {
            return null;
        }

        const findings = [];

        const sender =
            this.analyzeSender(email);

        const headers =
            this.analyzeHeaders(email);

        const content =
            this.analyzeContent(email);


        /* Reply-To mismatch */

        if (
            headers?.findings?.some(
                finding =>
                    finding.code ===
                    "REPLY_TO_MISMATCH" ||
                    finding.code ===
                    "REPLY_TO_DOMAIN_MISMATCH"
            )
        ) {

            findings.push({
                code:
                    "BEC_REPLY_CHANNEL_ANOMALY",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Reply path differs from the apparent sender."
            });
        }


        /* Financial request */

        if (
            content?.financialMatches?.length
        ) {

            findings.push({
                code:
                    "BEC_FINANCIAL_REQUEST",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Message contains a financial transaction request."
            });
        }


        /* Urgency */

        if (
            content?.urgencyMatches?.length
        ) {

            findings.push({
                code:
                    "BEC_URGENCY",

                severity:
                    RISK_LEVEL.MEDIUM,

                message:
                    "Message uses urgency or pressure tactics."
            });
        }


        /*
         * REMOVED: "Authentication failures" (BEC_AUTHENTICATION_ANOMALY).
         * checkAuthentication() no longer surfaces SPF/DKIM/DMARC
         * failures as findings — a header pass/fail checklist made
         * checking the sender/link in Threat Intel unnecessary.
         */


        /* Display name impersonation */

        if (
            sender?.findings?.some(
                finding =>
                    finding.code ===
                    "DISPLAY_NAME_IMPERSONATION"
            )
        ) {

            findings.push({
                code:
                    "BEC_EXECUTIVE_IMPERSONATION",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Display name may impersonate a trusted organization member."
            });
        }


        const score =
            this.calculateScore(
                findings
            );


        return {

            likelyBEC:
                score >= 55,

            score,

            findings,

            risk:
                this.scoreToRisk(
                    score
                )
        };
    }


    /* =====================================================
       PHISHING ANALYSIS
       ===================================================== */

    analyzePhishing(email) {

        if (!email) {
            return null;
        }

        const findings = [];


        const links =
            this.analyzeLinks(email);

        const content =
            this.analyzeContent(email);

        const sender =
            this.analyzeSender(email);


        /*
         * Suspicious link structure — driven by analyzeLink()'s
         * own structural findings (display/URL mismatch,
         * IP-literal destination, etc.), never by a raw
         * reputation/threat-score flag. Confirming a link is
         * actually malicious is Threat Intel's job, not Mail's.
         */

        if (
            links.some(
                link =>
                    link.risk === RISK_LEVEL.HIGH
            )
        ) {

            findings.push({
                code:
                    "PHISHING_SUSPICIOUS_LINK_STRUCTURE",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Message contains a link with suspicious structural indicators."
            });
        }


        /* Credential harvesting */

        if (
            content?.credentialMatches
                ?.length >= 2
        ) {

            findings.push({
                code:
                    "PHISHING_CREDENTIAL_HARVESTING",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Message contains credential-harvesting language."
            });
        }


        /*
         * REMOVED: "Authentication failures" (PHISHING_AUTH_FAILURE).
         * Same reasoning as analyzeBEC() above — SPF/DKIM/DMARC
         * pass-fail is no longer a scored finding. Threat Intel is
         * the intended way to confirm a sender/link is malicious.
         */


        /* Domain impersonation */

        if (
            sender?.findings?.some(
                finding =>
                    finding.code ===
                    "DISPLAY_NAME_IMPERSONATION"
            )
        ) {

            findings.push({
                code:
                    "PHISHING_BRAND_IMPERSONATION",

                severity:
                    RISK_LEVEL.HIGH,

                message:
                    "Sender may be impersonating a trusted brand."
            });
        }


        const score =
            this.calculateScore(
                findings
            );


        return {

            likelyPhishing:
                score >= 50,

            score,

            findings,

            risk:
                this.scoreToRisk(
                    score
                )
        };
    }


    /* =====================================================
       MALWARE ANALYSIS
       ===================================================== */

    analyzeMalware(email) {

        if (!email) {
            return null;
        }

        const findings = [];


        const attachments =
            this.analyzeAttachments(
                email
            );


        const maliciousAttachments =
            attachments.filter(
                attachment =>
                    attachment.malicious
            );


        if (
            maliciousAttachments.length
        ) {

            findings.push({
                code:
                    "MALWARE_ATTACHMENT",

                severity:
                    RISK_LEVEL.CRITICAL,

                message:
                    "One or more attachments have high-risk or executable characteristics.",

                evidence: {
                    attachments:
                        maliciousAttachments
                            .map(
                                attachment =>
                                    attachment.name
                            )
                }
            });
        }


        const executableAttachments =
            attachments.filter(
                attachment =>
                    attachment.findings
                        ?.some(
                            finding =>
                                finding.code ===
                                "EXECUTABLE_ATTACHMENT"
                        )
            );


        if (
            executableAttachments.length
        ) {

            findings.push({
                code:
                    "EXECUTABLE_DELIVERY",

                severity:
                    RISK_LEVEL.CRITICAL,

                message:
                    "Message attempts to deliver an executable or script."
            });
        }


        const score =
            this.calculateScore(
                findings
            );


        return {

            likelyMalware:
                score >= 50,

            score,

            findings,

            risk:
                this.scoreToRisk(
                    score
                )
        };
    }


    /* =====================================================
       OVERALL INVESTIGATION
       ===================================================== */

    investigate(email) {

        if (!email) {
            return null;
        }


        const validation =
            this.validateEmail(
                email
            );


        const headers =
            this.analyzeHeaders(
                email
            );


        const fullHeaders =
            this.analyzeFullHeaders(
                email
            );


        const authentication =
            this.checkAuthentication(
                email
            );


        const sender =
            this.analyzeSender(
                email
            );


        const content =
            this.analyzeContent(
                email
            );


        const links =
            this.analyzeLinks(
                email
            );


        const attachments =
            this.analyzeAttachments(
                email
            );


        const iocs =
            this.extractIOCs(
                email
            );


        const indicators =
            this.analyzeIndicators(
                email
            );


        const bec =
            this.analyzeBEC(
                email
            );


        const phishing =
            this.analyzePhishing(
                email
            );


        const malware =
            this.analyzeMalware(
                email
            );


        /* ---------------------------------------------
           Combine findings
           --------------------------------------------- */

        const allFindings = [

            ...(validation.findings || []),

            ...(headers?.findings || []),

            ...(authentication?.findings || []),

            ...(sender?.findings || []),

            ...(content?.findings || []),

            ...(indicators || []),

            ...(bec?.findings || []),

            ...(phishing?.findings || []),

            ...(malware?.findings || [])

        ];


        links.forEach(link => {

            allFindings.push(
                ...(link.findings || [])
            );

        });


        attachments.forEach(
            attachment => {

                allFindings.push(
                    ...(attachment.findings || [])
                );

            }
        );


        /*
         * Deduplicate findings.
         */
        const uniqueFindings =
            new Map();


        allFindings.forEach(
            finding => {

                if (
                    !uniqueFindings.has(
                        finding.code
                    )
                ) {

                    uniqueFindings.set(
                        finding.code,
                        finding
                    );
                }

            }
        );


        const finalFindings =
            Array.from(
                uniqueFindings.values()
            );


        /* ---------------------------------------------
           Overall score
           --------------------------------------------- */

        const score =
            this.calculateScore(
                finalFindings
            );


        const risk =
            this.scoreToRisk(
                score
            );


        /* ---------------------------------------------
           Determine likely classification
           --------------------------------------------- */

        let likelyClassification =
            EMAIL_CATEGORIES.NORMAL;


        if (
            malware?.likelyMalware
        ) {

            likelyClassification =
                EMAIL_CATEGORIES.MALWARE;

        } else if (
            bec?.likelyBEC
        ) {

            likelyClassification =
                EMAIL_CATEGORIES.BEC;

        } else if (
            phishing?.likelyPhishing
        ) {

            likelyClassification =
                EMAIL_CATEGORIES.PHISHING;

        } else if (
            score >= 35
        ) {

            likelyClassification =
                EMAIL_CATEGORIES.SUSPICIOUS;

        } else if (
            email.category ===
            EMAIL_CATEGORIES.INTERNAL
        ) {

            likelyClassification =
                EMAIL_CATEGORIES.INTERNAL;
        }


        return {

            emailId:
                email.id,

            timestamp:
                Date.now(),

            originalClassification:
                email.classification ||
                email.category ||
                EMAIL_CATEGORIES.NORMAL,

            likelyClassification,

            score,

            risk,

            confidence:
                this.calculateConfidence(
                    score,
                    finalFindings.length
                ),

            headers,

            fullHeaders,

            authentication,

            sender,

            content,

            links,

            attachments,

            iocs,

            bec,

            phishing,

            malware,

            indicators:
                finalFindings,

            summary:
                this.generateSummary({
                    email,
                    score,
                    risk,
                    likelyClassification,
                    finalFindings,
                    authentication,
                    links,
                    attachments,
                    bec,
                    phishing,
                    malware
                })
        };
    }


    /* =====================================================
       RISK CALCULATION
       ===================================================== */

    calculateRiskFromFindings(
        findings = []
    ) {

        if (!findings.length) {
            return RISK_LEVEL.LOW;
        }

        const score =
            this.calculateScore(
                findings
            );

        return this.scoreToRisk(
            score
        );
    }


    /**
     * Convert findings into a numeric investigation score.
     */
    calculateScore(findings = []) {

        let score = 0;


        findings.forEach(
            finding => {

                switch (
                finding.severity
                ) {

                    case RISK_LEVEL.CRITICAL:
                        score += 30;
                        break;

                    case RISK_LEVEL.HIGH:
                        score += 20;
                        break;

                    case RISK_LEVEL.MEDIUM:
                        score += 10;
                        break;

                    case RISK_LEVEL.LOW:
                        score += 3;
                        break;

                    default:
                        break;
                }

            }
        );


        /*
         * Cap score at 100.
         */
        return Math.min(
            100,
            score
        );
    }


    /**
     * Convert score to risk label.
     */
    scoreToRisk(score) {

        if (score >= 80) {
            return RISK_LEVEL.CRITICAL;
        }

        if (score >= 55) {
            return RISK_LEVEL.HIGH;
        }

        if (score >= 30) {
            return RISK_LEVEL.MEDIUM;
        }

        return RISK_LEVEL.LOW;
    }


    /**
     * Estimate confidence based on number of
     * independent indicators.
     */
    calculateConfidence(
        score,
        findingCount
    ) {

        let confidence = 20;

        confidence +=
            Math.min(
                50,
                findingCount * 7
            );

        if (score >= 70) {
            confidence += 20;
        } else if (score >= 50) {
            confidence += 10;
        }

        return Math.min(
            100,
            confidence
        );
    }


    /* =====================================================
       SUMMARY
       ===================================================== */

    generateSummary({
        email,
        score,
        risk,
        likelyClassification,
        finalFindings,
        authentication,
        links,
        attachments,
        bec,
        phishing,
        malware
    }) {

        const parts = [];


        /* Opening */

        parts.push(
            `${likelyClassification} classification with a simulated investigation score of ${score}/100.`
        );


        /* Authentication */

        if (
            authentication?.failures
        ) {

            parts.push(
                `${authentication.failures} email authentication check(s) failed.`
            );
        }


        /* Links */

        const riskyLinks =
            links.filter(
                link =>
                    link.risk === RISK_LEVEL.HIGH
            );


        if (
            riskyLinks.length
        ) {

            parts.push(
                `${riskyLinks.length} link(s) with suspicious structural indicators were identified.`
            );
        }


        /* Attachments */

        const riskyAttachments =
            attachments.filter(
                attachment =>
                    attachment.malicious
            );


        if (
            riskyAttachments.length
        ) {

            parts.push(
                `${riskyAttachments.length} high-risk attachment(s) were identified.`
            );
        }


        /* BEC */

        if (
            bec?.likelyBEC
        ) {

            parts.push(
                "The message contains multiple indicators consistent with a business email compromise scenario."
            );
        }


        /* Phishing */

        if (
            phishing?.likelyPhishing
        ) {

            parts.push(
                "The message contains indicators consistent with a phishing attempt."
            );
        }


        /* Malware */

        if (
            malware?.likelyMalware
        ) {

            parts.push(
                "The message contains indicators consistent with simulated malware delivery."
            );
        }


        /* No major findings */

        if (
            !finalFindings.length
        ) {

            parts.push(
                "No significant simulated indicators were identified."
            );
        }


        return parts.join(" ");
    }


    /* =====================================================
       THREAT INTELLIGENCE INDICATORS
       ===================================================== */

    /**
     * Return indicators in a format that can later be
     * passed directly to the NORTHSTAR Threat Intel app.
     */
    getThreatIntelIndicators(
        email
    ) {

        const iocs =
            this.extractIOCs(
                email
            );


        if (!iocs) {
            return [];
        }


        const indicators = [];


        iocs.domains.forEach(
            domain => {

                indicators.push({
                    type: "DOMAIN",
                    value: domain,
                    source: "MAIL"
                });

            }
        );


        iocs.ips.forEach(
            ip => {

                indicators.push({
                    type: "IP",
                    value: ip,
                    source: "MAIL"
                });

            }
        );


        iocs.urls.forEach(
            url => {

                indicators.push({
                    type: "URL",
                    value: url,
                    source: "MAIL"
                });

            }
        );


        iocs.hashes.forEach(
            hash => {

                indicators.push({
                    type: "SHA256",
                    value: hash,
                    source: "MAIL"
                });

            }
        );


        return indicators;
    }


    /* =====================================================
       FILE EXPLORER HANDOFF
       ===================================================== */

    /**
     * Build a simulated File Explorer request.
     *
     * File Explorer can consume this later.
     */
    buildAttachmentExplorerRequest(
        email,
        attachment
    ) {

        if (
            !email ||
            !attachment
        ) {
            return null;
        }


        return {

            source:
                "MAIL",

            sourceEmailId:
                email.id,

            attachmentId:
                attachment.id ||
                attachment.name,

            fileName:
                attachment.name,

            simulatedPath:
                `Downloads/${attachment.name}`,

            hash:
                attachment.hash ||
                null,

            passwordProtected:
                Boolean(
                    attachment.passwordProtected
                ),

            risk:
                attachment.risk ||
                "UNKNOWN"
        };
    }


    /* =====================================================
       PASSWORD CRACKER HANDOFF
       ===================================================== */

    /**
     * Build a simulated Password Cracker request.
     *
     * This does NOT perform real password cracking.
     */
    buildPasswordCrackerRequest(
        email,
        attachment
    ) {

        if (
            !email ||
            !attachment
        ) {
            return null;
        }


        if (
            !attachment.passwordProtected
        ) {

            return {
                supported: false,
                reason:
                    "Attachment is not password protected."
            };
        }


        return {

            supported: true,

            source:
                "MAIL",

            sourceEmailId:
                email.id,

            attachmentId:
                attachment.id ||
                attachment.name,

            fileName:
                attachment.name,

            hash:
                attachment.hash ||
                null,

            simulated:
                true
        };
    }
}


/* =========================================================
   SINGLETON
   ========================================================= */

export const mailInvestigator =
    new MailInvestigator();


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default mailInvestigator;