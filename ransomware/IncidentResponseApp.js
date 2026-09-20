/* =========================================================
   NORTHSTAR SOC — INCIDENT RESPONSE APPLICATION
   File: ransomware/IncidentResponseApp.js

   Same registration/singleton pattern as EndpointApp.js /
   ProcessTreeApp.js.
   ========================================================= */

import { IncidentResponseStore } from "./IncidentResponseStore.js";
import { IncidentResponseRenderer } from "./IncidentResponseRenderer.js";

export class IncidentResponseApp {

    constructor(container, options = {}) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("[INCIDENT RESPONSE APP] Could not find container.");
        }

        this.options = options;

        this.store = null;
        this.renderer = null;
    }

    initialize() {

        this.store =
            this.options.store ||
            window.incidentResponseStore ||
            new IncidentResponseStore();

        window.incidentResponseStore = this.store;

        this.renderer =
            new IncidentResponseRenderer(this.container, this.store);

        this.renderer.mount();

        console.log("[INCIDENT RESPONSE APP] Online.");

        return this;
    }

    destroy() {

        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }

        this.store = null;
    }
}


export function initializeIncidentResponse(container, options = {}) {

    const app = new IncidentResponseApp(container, options);

    return app.initialize();
}
