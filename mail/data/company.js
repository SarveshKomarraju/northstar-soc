/* =========================================================
   NORTHSTAR SOC — COMPANY DIRECTORY
   File: mail/data/company.js

   Purpose:
   Single source of truth for "who works at Northstar" and
   "what counts as an internal address." Used by:
   - data/emails.js, to generate realistic coworker mail
   - MailStore.js, to validate outgoing recipients
   - MailRenderer.js, to prefill/label the compose & reply UI
   ========================================================= */

export const COMPANY_DOMAIN = "northstar.local";

/*
 * The player's own mailbox. Referenced by name so other
 * templates can address "you" correctly and avoid emailing
 * yourself in coworker threads.
 */
export const PLAYER = {
    name: "John Smith",
    address: "j.smith@northstar.local",
    title: "Security Analyst"
};

export const BOSS = {
    name: "Marcus Webb",
    address: "ciso@northstar.local",
    title: "Chief Information Security Officer"
};

export const COWORKERS = [

    BOSS,

    { name: "Jordan Lee", address: "j.lee@northstar.local", title: "Product Designer" },
    { name: "Priya Nair", address: "p.nair@northstar.local", title: "HR Business Partner" }

];

/**
 * True if the address belongs to the company domain.
 * This is the actual enforcement point for "you can only
 * message people at Northstar."
 */
export function isCompanyAddress(address) {

    const normalized =
        String(address || "")
            .trim()
            .toLowerCase();

    return normalized.endsWith(`@${COMPANY_DOMAIN}`);
}

/**
 * Look up a coworker by address, if they're a known person
 * (as opposed to a department alias like helpdesk@ or hr@).
 */
export function findCoworkerByAddress(address) {

    const normalized =
        String(address || "").trim().toLowerCase();

    return COWORKERS.find(
        person => person.address.toLowerCase() === normalized
    ) || null;
}

/**
 * A random coworker, optionally excluding one address
 * (e.g. so a thread doesn't accidentally pick the same
 * person twice in a row).
 */
export function randomCoworker(excludeAddress = null) {

    const pool =
        excludeAddress
            ? COWORKERS.filter(
                person => person.address !== excludeAddress
            )
            : COWORKERS;

    return pool[Math.floor(Math.random() * pool.length)];
}