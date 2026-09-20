/* =========================================================
   NORTHSTAR SOC — PLAYBOOK APPLICATION
   File: playbook/PlaybookApp.js
   ========================================================= */

import { PlaybookStore } from "./PlaybookStore.js";
import { PlaybookRenderer } from "./PlaybookRenderer.js";


export class PlaybookApp {

    constructor(container, options = {}) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("[PLAYBOOK APP] Could not find container.");
        }

        this.options = options;

        this.store = null;
        this.renderer = null;
    }

    initialize() {

        this.store =
            this.options.store ||
            window.playbookStore ||
            new PlaybookStore();

        this.renderer =
            new PlaybookRenderer(this.container, this.store);

        this.renderer.mount();

        console.log("[PLAYBOOK APP] Online.");

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


export function initializePlaybook(container, options = {}) {

    const app = new PlaybookApp(container, options);

    return app.initialize();
}