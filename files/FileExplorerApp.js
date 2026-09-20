/* =========================================================
   NORTHSTAR SOC — FILE EXPLORER APPLICATION
   File: files/FileExplorerApp.js
   ========================================================= */

import { FileExplorerStore } from "./FileExplorerStore.js";
import { FileExplorerRenderer } from "./FileExplorerRenderer.js";


export class FileExplorerApp {

    constructor(container, options = {}) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("[FILE EXPLORER APP] Could not find container.");
        }

        this.options = options;

        this.store = null;
        this.renderer = null;
    }

    initialize() {

        this.store =
            this.options.store ||
            window.fileExplorerStore ||
            new FileExplorerStore();

        this.renderer =
            new FileExplorerRenderer(this.container, this.store);

        this.renderer.mount();

        console.log("[FILE EXPLORER APP] Online.");

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


export function initializeFileExplorer(container, options = {}) {

    const app = new FileExplorerApp(container, options);

    return app.initialize();
}