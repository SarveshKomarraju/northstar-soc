/* =========================================================
   NORTHSTAR SOC — CAPTURE STORE
   File: capture/CaptureStore.js

   In-memory store for screenshots and screen recordings taken
   with the Ctrl+Shift+S / Ctrl+Shift+R shortcuts (CaptureTool.js).

   Plain script (not a module) so it can sit alongside the
   other non-module globals (window.NorthstarPasswordTargets,
   window.NorthstarRealAttackers, etc.) and be read from both
   CaptureTool.js and Mail's compose flow without an import
   chain. Nothing here is persisted — captures live only for
   the current session, same as everything else in the game.
   ========================================================= */

(function () {

    const listeners = new Set();

    let captures = [];

    let counter = 0;


    function notify() {

        const snapshot = captures.slice();

        listeners.forEach(fn => {

            try {
                fn(snapshot);
            } catch (error) {
                console.error("[CaptureStore] listener error", error);
            }
        });
    }


    function addCapture(capture) {

        counter += 1;

        const record = Object.assign(
            {
                id: `CAP-${Date.now()}-${counter}`,
                timestamp: new Date().toISOString()
            },
            capture
        );

        captures = [record, ...captures];

        notify();

        return record;
    }


    function removeCapture(id) {

        captures = captures.filter(
            capture => capture.id !== id
        );

        notify();
    }


    function getCaptures() {
        return captures.slice();
    }


    function getCapture(id) {

        return captures.find(
            capture => capture.id === id
        ) || null;
    }


    function subscribe(fn) {

        if (typeof fn !== "function") {
            return () => {};
        }

        listeners.add(fn);

        return () => listeners.delete(fn);
    }


    window.NorthstarCaptureStore = {
        addCapture,
        removeCapture,
        getCaptures,
        getCapture,
        subscribe
    };

}());
