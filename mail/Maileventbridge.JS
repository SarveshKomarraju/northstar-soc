/* =========================================================
   NORTHSTAR SOC — MAIL EVENT BRIDGE
   File: mail/MailEventBridge.js

   Purpose:
   Connects the live simulation (EventEngine / AttackEngine)
   to MailStore, so phishing emails actually show up in the
   inbox when the attacker sends them — and so the inbox also
   receives a trickle of ordinary benign mail, independent of
   attacks, matching every scenario should have both.

   This mirrors the existing NetworkEventBridge pattern:
   constructed once in SimulationBootstrap, given the shared
   eventEngine + mailStore singletons.
   ========================================================= */

import { randomBenignEmail, createPhishingEmailFromAttackEvent } from "./data/emails.js";


/* =========================================================
   EVENT TYPES THIS BRIDGE REACTS TO
   ---------------------------------------------------------
   AttackEngine currently only emits PHISHING_EMAIL_SENT for
   its PHISHING attack type. If BEC/malware email attack
   types are added later, register their factories here too.
   ========================================================= */

const ATTACK_EVENT_HANDLERS = {

    PHISHING_EMAIL_SENT: createPhishingEmailFromAttackEvent

    /*
     * Example for future expansion:
     * BEC_EMAIL_SENT: createBECEmailFromAttackEvent,
     * MALWARE_EMAIL_SENT: createMalwareEmailFromAttackEvent,
     */
};


export class MailEventBridge {

    constructor(eventEngine, mailStore, options = {}) {

        this.eventEngine = eventEngine;

        this.mailStore = mailStore;

        this.running = false;

        this.unsubscribeEvents = null;

        this.trickleTimer = null;

        this.lastBenignKey = null;

        /*
         * Benign mail arrives roughly every 90-180s of real
         * time by default. Tune per difficulty later if
         * DifficultyEngine gets wired into bootstrap.
         */
        this.trickleRange =
            options.trickleRange || [90000, 180000];

        console.log("[MAIL EVENT BRIDGE] Ready.");
    }


    /* =====================================================
       START
       ===================================================== */

    start() {

        if (this.running) {
            return;
        }

        if (!this.eventEngine || !this.mailStore) {
            console.error("[MAIL EVENT BRIDGE] Missing eventEngine or mailStore.");
            return;
        }

        this.running = true;

        this.unsubscribeEvents = this.eventEngine.subscribe(event => {
            this.handleEvent(event);
        });

        this.scheduleNextBenignEmail();

        console.log("[MAIL EVENT BRIDGE] Online — listening for attack + benign mail.");
    }


    /* =====================================================
       STOP
       ===================================================== */

    stop() {

        this.running = false;

        if (this.unsubscribeEvents) {
            this.unsubscribeEvents();
            this.unsubscribeEvents = null;
        }

        if (this.trickleTimer) {
            clearTimeout(this.trickleTimer);
            this.trickleTimer = null;
        }

        console.log("[MAIL EVENT BRIDGE] Stopped.");
    }


    /* =====================================================
       ATTACK-DRIVEN MAIL
       ===================================================== */

    handleEvent(event) {

        if (!event || !event.eventType) {
            return;
        }

        const factory = ATTACK_EVENT_HANDLERS[event.eventType];

        if (!factory) {
            return;
        }

        const email = factory(event);

        if (!email) {
            return;
        }

        this.mailStore.receiveEmail(email);

        console.log(
            `[MAIL EVENT BRIDGE] Delivered ${event.eventType} → ${email.to[0]} (${email.id})`
        );
    }


    /* =====================================================
       BENIGN TRICKLE
       ===================================================== */

    scheduleNextBenignEmail() {

        if (!this.running) {
            return;
        }

        const [min, max] = this.trickleRange;

        const delay =
            Math.floor(Math.random() * (max - min + 1)) + min;

        this.trickleTimer = setTimeout(() => {

            this.trickleTimer = null;

            this.deliverBenignEmail();

            this.scheduleNextBenignEmail();

        }, delay);
    }

    deliverBenignEmail() {

        if (!this.running) {
            return;
        }

        const { email, key } = randomBenignEmail(this.lastBenignKey);

        this.lastBenignKey = key;

        this.mailStore.receiveEmail(email);

        console.log(`[MAIL EVENT BRIDGE] Delivered benign mail: ${email.subject}`);
    }
}