/* =========================================================
   NORTHSTAR SOC — ENDPOINTS APPLICATION
   File: endpoints/EndpointApp.js
   ========================================================= */

import { EndpointStore } from "./EndpointStore.js";
import { EndpointRenderer } from "./EndpointRenderer.js";


export class EndpointApp {

    constructor(container, options = {}) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("[ENDPOINT APP] Could not find container.");
        }

        this.options = options;

        this.store = null;
        this.renderer = null;
    }

    initialize() {

        /*
         * Same singleton pattern as Mail: prefer an
         * already-shared store so state survives the window
         * being closed and reopened, fall back to a local one
         * for standalone use.
         */
        this.store =
            this.options.store ||
            window.endpointStore ||
            new EndpointStore();

        this.renderer =
            new EndpointRenderer(this.container, this.store);

        this.renderer.mount();

        console.log("[ENDPOINT APP] Online.");

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


export function initializeEndpoints(container, options = {}) {

    const app = new EndpointApp(container, options);

    return app.initialize();
}