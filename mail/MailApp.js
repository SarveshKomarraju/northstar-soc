/* =========================================================
   NORTHSTAR SOC — MAIL APPLICATION
   File: mail/MailApp.js

   Purpose:
   - Initializes the Mail application
   - Connects MailStore
   - Connects MailInvestigator
   - Connects MailRenderer
   - Provides the public initializeMail() entry point
   - Handles lifecycle / cleanup
   - Does NOT generate alerts itself

   Architecture:

       MailApp
          │
          ├── MailStore
          │      └── Email state
          │
          ├── MailInvestigator
          │      └── Header / link / attachment analysis
          │
          └── MailRenderer
                 └── Outlook/Gmail-style interface
   ========================================================= */

import { MailStore } from "./MailStore.js";
import { MailInvestigator } from "./MailInvestigator.js";
import { MailRenderer } from "./MailRenderer.js";

/* =========================================================
   MAIL APPLICATION
   ========================================================= */

export class MailApp {

    constructor(container, options = {}) {

        this.container = this.resolveContainer(container);

        if (!this.container) {
            throw new Error(
                "[MAIL APP] Could not find Mail application container."
            );
        }

        this.options = {
            autoFocus: true,
            preserveState: true,
            ...options
        };

        this.store = null;
        this.investigator = null;
        this.renderer = null;

        this.initialized = false;

        this.lifecycle = {
            createdAt: Date.now(),
            initializedAt: null,
            destroyedAt: null
        };

        console.log("[MAIL APP] Created.");
    }

    /* =====================================================
       CONTAINER RESOLUTION
       ===================================================== */

    resolveContainer(container) {

        if (!container) {
            return null;
        }

        if (typeof container === "string") {
            return document.querySelector(container);
        }

        if (
            container instanceof HTMLElement ||
            container instanceof DocumentFragment
        ) {
            return container;
        }

        return null;
    }

    /* =====================================================
       INITIALIZE
       ===================================================== */

    initialize() {

        if (this.initialized) {
            console.warn(
                "[MAIL APP] Already initialized."
            );

            return this;
        }

        console.log(
            "[MAIL APP] Initializing NORTHSTAR Mail..."
        );

        try {

            /* ---------------------------------------------
               STORE
               --------------------------------------------- */

            this.store =
                this.options.store ||
                window.mailStore ||
                new MailStore();

            console.log(
                this.options.store || window.mailStore
                    ? "[MAIL APP] Using shared MailStore singleton."
                    : "[MAIL APP] No shared store found — created a local one (mail will reset when this window closes)."
            );

            /* ---------------------------------------------
               INVESTIGATOR
               --------------------------------------------- */

            this.investigator = new MailInvestigator(
                this.store
            );

            console.log(
                "[MAIL APP] MailInvestigator initialized."
            );


            /* ---------------------------------------------
               RENDERER
               --------------------------------------------- */

            this.renderer = new MailRenderer(
                this.container,
                this.store,
                this.investigator
            );

            this.renderer.mount();

            console.log(
                "[MAIL APP] MailRenderer mounted."
            );


            /* ---------------------------------------------
               COMPLETE
               --------------------------------------------- */

            this.initialized = true;

            this.lifecycle.initializedAt = Date.now();

            this.container.dataset.mailInitialized = "true";

            if (this.options.autoFocus) {
                this.focus();
            }

            console.log(
                "%c[MAIL APP] NORTHSTAR MAIL ONLINE",
                "font-weight: bold;"
            );

            return this;

        } catch (error) {

            console.error(
                "[MAIL APP] Initialization failed:",
                error
            );

            this.destroy();

            throw error;
        }
    }

    /* =====================================================
       FOCUS
       ===================================================== */

    focus() {

        if (!this.container) {
            return;
        }

        const focusTarget =
            this.container.querySelector(
                ".mail-search-input"
            ) ||
            this.container.querySelector(
                ".mail-message-list"
            ) ||
            this.container;

        try {
            focusTarget.focus();
        } catch {
            // Some containers cannot receive focus.
        }
    }

    /* =====================================================
       GETTERS
       ===================================================== */

    getStore() {
        return this.store;
    }

    getInvestigator() {
        return this.investigator;
    }

    getRenderer() {
        return this.renderer;
    }

    getSelectedEmail() {

        if (!this.store) {
            return null;
        }

        if (
            typeof this.store.getSelectedEmail ===
            "function"
        ) {
            return this.store.getSelectedEmail();
        }

        if (this.store.state) {
            return this.store.state.selectedEmail;
        }

        return null;
    }

    /* =====================================================
       EMAIL OPERATIONS
       ===================================================== */

    openEmail(emailId) {

        if (!this.initialized || !this.store) {
            console.warn(
                "[MAIL APP] Cannot open email before initialization."
            );

            return;
        }

        if (
            typeof this.store.selectEmail ===
            "function"
        ) {
            this.store.selectEmail(emailId);
            return;
        }

        if (
            typeof this.store.setSelectedEmail ===
            "function"
        ) {
            this.store.setSelectedEmail(emailId);
            return;
        }

        console.warn(
            "[MAIL APP] MailStore does not expose an email selection method."
        );
    }

    /* =====================================================
       FOLDER OPERATIONS
       ===================================================== */

    openFolder(folder) {

        if (!this.store) {
            return;
        }

        if (
            typeof this.store.setFolder ===
            "function"
        ) {
            this.store.setFolder(folder);
            return;
        }

        if (
            typeof this.store.selectFolder ===
            "function"
        ) {
            this.store.selectFolder(folder);
            return;
        }

        console.warn(
            "[MAIL APP] MailStore does not expose a folder selection method."
        );
    }

    /* =====================================================
       SEARCH
       ===================================================== */

    search(query) {

        if (!this.store) {
            return;
        }

        if (
            typeof this.store.search ===
            "function"
        ) {
            return this.store.search(query);
        }

        if (
            typeof this.store.setSearchQuery ===
            "function"
        ) {
            this.store.setSearchQuery(query);
            return;
        }

        console.warn(
            "[MAIL APP] MailStore does not expose a search method."
        );
    }

    /* =====================================================
       INVESTIGATION API
       ===================================================== */

    analyzeSelectedEmail() {

        const email = this.getSelectedEmail();

        if (!email || !this.investigator) {
            return null;
        }

        if (
            typeof this.investigator.investigateEmail ===
            "function"
        ) {
            return this.investigator.investigateEmail(email);
        }

        return {
            emailId: email.id,
            classification: email.classification || "UNKNOWN"
        };
    }

    analyzeHeaders(email = null) {

        const target =
            email ||
            this.getSelectedEmail();

        if (!target || !this.investigator) {
            return null;
        }

        if (
            typeof this.investigator.analyzeHeaders ===
            "function"
        ) {
            return this.investigator.analyzeHeaders(
                target
            );
        }

        return null;
    }

    analyzeLink(link, email = null) {

        const target =
            email ||
            this.getSelectedEmail();

        if (!target || !link || !this.investigator) {
            return null;
        }

        if (
            typeof this.investigator.analyzeLink ===
            "function"
        ) {
            return this.investigator.analyzeLink(
                target,
                link
            );
        }

        return null;
    }

    analyzeAttachment(
        attachment,
        email = null
    ) {

        const target =
            email ||
            this.getSelectedEmail();

        if (
            !target ||
            !attachment ||
            !this.investigator
        ) {
            return null;
        }

        if (
            typeof this.investigator.analyzeAttachment ===
            "function"
        ) {
            return this.investigator.analyzeAttachment(
                target,
                attachment
            );
        }

        return null;
    }

    /* =====================================================
       EVENT BRIDGE
       
       Mail itself does not create alerts.
       This bridge is intentionally passive.

       Other NORTHSTAR systems can listen for mail
       investigation events through the application's
       existing event architecture.
       ===================================================== */

    emitInvestigationEvent(
        eventName,
        payload = {}
    ) {

        const detail = {
            source: "MAIL",
            timestamp: new Date().toISOString(),
            ...payload
        };

        try {

            window.dispatchEvent(
                new CustomEvent(
                    `northstar:mail:${eventName}`,
                    {
                        detail
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[MAIL APP] Failed to dispatch investigation event:",
                error
            );
        }
    }

    /* =====================================================
       REFRESH
       ===================================================== */

    refresh() {

        if (!this.renderer) {
            return;
        }

        if (
            typeof this.renderer.render ===
            "function"
        ) {
            this.renderer.render();
        }
    }

    /* =====================================================
       RESET
       ===================================================== */

    reset() {

        if (!this.store) {
            return;
        }

        if (
            typeof this.store.reset ===
            "function"
        ) {
            this.store.reset();
            return;
        }

        console.warn(
            "[MAIL APP] MailStore does not expose reset()."
        );
    }

    /* =====================================================
       STATUS
       ===================================================== */

    getStatus() {

        return {
            application: "MAIL",
            initialized: this.initialized,
            container: !!this.container,
            store: !!this.store,
            investigator: !!this.investigator,
            renderer: !!this.renderer,
            selectedEmail: this.getSelectedEmail(),
            uptime:
                this.lifecycle.initializedAt
                    ? Date.now() -
                    this.lifecycle.initializedAt
                    : 0
        };
    }

    /* =====================================================
       DESTROY
       ===================================================== */

    destroy() {

        console.log(
            "[MAIL APP] Destroying Mail application..."
        );

        if (this.renderer) {

            if (
                typeof this.renderer.destroy ===
                "function"
            ) {
                this.renderer.destroy();
            }

            this.renderer = null;
        }

        if (this.investigator) {

            if (
                typeof this.investigator.destroy ===
                "function"
            ) {
                this.investigator.destroy();
            }

            this.investigator = null;
        }

        if (this.store) {

            if (
                typeof this.store.destroy ===
                "function"
            ) {
                this.store.destroy();
            }

            this.store = null;
        }

        if (this.container) {
            this.container.innerHTML = "";
            delete this.container.dataset.mailInitialized;
        }

        this.initialized = false;

        this.lifecycle.destroyedAt = Date.now();

        console.log(
            "[MAIL APP] Mail application destroyed."
        );
    }
}


/* =========================================================
   PUBLIC INITIALIZER
   ========================================================= */

export function initializeMail(
    container,
    options = {}
) {

    const app = new MailApp(
        container,
        options
    );

    return app.initialize();
}


/* =========================================================
   OPTIONAL GLOBAL ACCESS
   ---------------------------------------------------------
   Useful for debugging from the browser console.

   Example:

       window.NORTHSTAR_MAIL.getStatus()

   This does NOT replace the module system.
   ========================================================= */

if (typeof window !== "undefined") {

    window.NORTHSTAR_MAIL = {

        instance: null,

        initialize(
            container,
            options = {}
        ) {

            if (this.instance) {

                try {
                    this.instance.destroy();
                } catch {
                    // Ignore cleanup errors.
                }
            }

            this.instance =
                initializeMail(
                    container,
                    options
                );

            return this.instance;
        },

        getInstance() {
            return this.instance;
        },

        getStatus() {

            if (!this.instance) {

                return {
                    application: "MAIL",
                    initialized: false
                };
            }

            return this.instance.getStatus();
        }
    };
}