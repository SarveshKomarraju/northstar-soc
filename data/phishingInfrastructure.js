/* =========================================================
   NORTHSTAR SOC — SHARED PHISHING INFRASTRUCTURE
   File: data/phishingInfrastructure.js

   Single source of truth for a phishing campaign's external
   "identity" — the domain the lure email links to.

   WHY THIS EXISTS:
   Mail (mail/data/emails.js) derives a sender/landing domain
   from an attack's id so different campaigns don't all look
   identical. Network (network/PacketEngine.js) needs the
   EXACT SAME domain for that EXACT SAME attackId, so a player
   who reads the sender domain in a phishing email can then
   confirm it by filtering Packet Capture for
   `dns.qry.name == <domain>`, `http.host == <domain>`, or the
   TLS SNI, and see matching traffic from the compromised host.

   Without a shared module, Mail and Network would each pick
   their own domain independently and never agree — breaking
   the "same evidence everywhere" promise the rest of NORTHSTAR
   already keeps (see data/threatSources.js for the same idea
   applied to attacker IP geolocation).

   ThreatIntelData.js is a plain script (not an ES module) and
   can't `import` this file directly — script.js exposes this
   same pool as window.NorthstarPhishingDomains, the same
   pattern already used for window.NorthstarRealAttackers and
   window.USERS.
   ========================================================= */

import { C2_DOMAIN as BLACKFROST_C2_DOMAIN } from "../ransomware/data/ransomwareConfig.js";

export const SENDER_DOMAIN_POOL = [
    "secure-mail-alert.example",
    "account-verify-service.example",
    "it-support-notice.example",
    "helpdesk-security.example",
    "corporate-alerts.example",
    "system-notification.example"
];


/**
 * Cheap, deterministic 32-bit string hash. Same input always
 * produces the same output — used to pick a stable-per-campaign
 * domain/lure without needing to persist any extra state.
 */
export function hashString(value) {

    let hash = 0;

    const str = String(value);

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return hash;
}


/**
 * The one real phishing domain this campaign actually uses,
 * anywhere it's needed (Mail's lure email, Network's DNS/HTTP/
 * TLS traffic, Threat Intel's lookup). Same attackId always
 * resolves to the same domain.
 */
export function getPhishingDomainForAttack(attackId) {

    /*
     * BLACKFROST ransomware always uses its own fixed,
     * documented C2 domain (ransomware/data/ransomwareConfig.js)
     * rather than a hash-picked one from the generic pool — the
     * ransom note, Incident Response, and Threat Intel all
     * reference "blackfrost-c2.example" by name, so Network's
     * DNS/HTTP/TLS traffic for this attackId has to match it
     * exactly rather than picking a different-looking domain.
     */
    if (String(attackId || "").startsWith("RANSOM-")) {
        return BLACKFROST_C2_DOMAIN;
    }

    return SENDER_DOMAIN_POOL[
        Math.abs(
            hashString(
                attackId ||
                String(Math.random())
            )
        ) % SENDER_DOMAIN_POOL.length
    ];
}
