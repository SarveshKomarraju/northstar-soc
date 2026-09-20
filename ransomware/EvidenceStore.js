/* =========================================================
   NORTHSTAR SOC — EVIDENCE STORE
   File: ransomware/EvidenceStore.js

   Small, reusable evidence registry (spec section 43).
   Evidence items reference other real objects (an event id,
   an alert id, a packet id, a file id, a process id) rather
   than duplicating their data — IncidentResponseRenderer
   resolves the reference back to EventEngine/AlertManager/
   FileExplorerStore/etc. when it needs to display it.

   Deliberately generic — not ransomware-specific — so a
   future Worm campaign can reuse the same store.
   ========================================================= */

export class EvidenceStore {

    constructor() {
        this.items = [];
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(listener => {
            try { listener(this.items); }
            catch (error) { console.error("[EVIDENCE STORE] Listener error:", error); }
        });
    }

    /**
     * kind: "PROCESS" | "PROCESS_TREE" | "C2_CONNECTION" |
     *       "RANSOM_NOTE" | "FILE_LIST" | "ALERT" |
     *       "DNS_QUERY" | "HOST_TIMELINE"
     */
    collect({ kind, label, refType, refId, description }) {

        const alreadyCollected =
            this.items.some(item => item.refType === refType && item.refId === refId);

        if (alreadyCollected) {
            return this.items.find(item => item.refType === refType && item.refId === refId);
        }

        const item = {
            id: `EVD-${String(this.items.length + 1).padStart(3, "0")}`,
            kind,
            label,
            refType,
            refId,
            description,
            collectedAt: new Date().toISOString()
        };

        this.items.push(item);
        this.notify();

        return item;
    }

    getAll() {
        return [...this.items];
    }

    hasCollected(refType, refId) {
        return this.items.some(item => item.refType === refType && item.refId === refId);
    }

    count() {
        return this.items.length;
    }

    clear() {
        this.items = [];
        this.notify();
    }
}
