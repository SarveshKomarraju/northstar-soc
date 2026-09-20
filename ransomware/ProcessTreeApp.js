/* =========================================================
   NORTHSTAR SOC — PROCESS TREE APPLICATION
   File: ransomware/ProcessTreeApp.js

   Same registration/singleton pattern as EndpointApp.js —
   prefers an already-shared window.processTreeStore so state
   (selected host/process, search query) survives the window
   being closed and reopened.
   ========================================================= */

import { ProcessTreeStore } from "./ProcessTreeStore.js";
import { ProcessTreeRenderer } from "./ProcessTreeRenderer.js";

export class ProcessTreeApp {

    constructor(container, options = {}) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("[PROCESS TREE APP] Could not find container.");
        }

        this.options = options;

        this.store = null;
        this.renderer = null;
    }

    initialize() {

        this.store =
            this.options.store ||
            window.processTreeStore ||
            new ProcessTreeStore();

        window.processTreeStore = this.store;

        this.renderer =
            new ProcessTreeRenderer(this.container, this.store);

        this.renderer.mount();

        console.log("[PROCESS TREE APP] Online.");

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


export function initializeProcessTree(container, options = {}) {

    const app = new ProcessTreeApp(container, options);

    return app.initialize();
}
