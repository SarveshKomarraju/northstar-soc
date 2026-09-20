/* =========================================================
   NORTHSTAR SOC — VPN APPLICATION
   File: vpn/VpnApp.js
   ========================================================= */

import { VpnStore } from "./VpnStore.js";
import { VpnRenderer } from "./VpnRenderer.js";

export class VpnApp {

    constructor(container, options = {}) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("[VPN APP] Could not find container.");
        }

        this.options = options;

        this.store = null;
        this.renderer = null;
    }

    initialize() {

        this.store =
            this.options.store ||
            window.vpnStore ||
            new VpnStore();

        window.vpnStore = this.store;

        this.renderer =
            new VpnRenderer(this.container, this.store);

        this.renderer.mount();

        console.log("[VPN APP] Online.");

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


export function initializeVpn(container, options = {}) {

    const app = new VpnApp(container, options);

    return app.initialize();
}