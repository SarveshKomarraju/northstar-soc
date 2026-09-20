/* =========================================================
   NORTHSTAR SOC — FILE EXPLORER STORE
   File: files/FileExplorerStore.js

   Purpose:
   Builds an actual navigable folder tree for the analyst's
   own machine from real FILE_CREATED events (ambient, from
   FileExplorerEventBridge) — nothing here is invented data,
   and nothing is pre-labeled "suspicious." Risk is computed
   live from real correlated alerts, exactly like Endpoints/
   VpnStore.

   This is deliberately scoped to ONE machine (LOCAL_MACHINE,
   see ./data/localMachine.js) — the analyst's own desktop,
   not the monitored corporate fleet in data/hosts.js. There
   is no host switching here.
   ========================================================= */

import { LOCAL_MACHINE } from "./data/localMachine.js";
import { buildSharedFiles } from "./data/ambientFiles.js";
import { HOSTS } from "../data/hosts.js";
import { buildRansomNoteContents } from "../ransomware/data/ransomwareConfig.js";

export const FILE_STORE_EVENTS = {
    STATE_CHANGED: "files:state-changed"
};

function pathSeparator(path) {
    return path.includes("\\") ? "\\" : "/";
}

/**
 * Parses a real file path into a nested folder tree. Works
 * for both Windows ("C:\Users\analyst\Desktop\notes.txt") and
 * Unix ("/home/analyst/Documents/notes.md") paths automatically
 * — no OS-specific branching needed, it just follows
 * whatever separator the real path actually uses.
 */
function buildFileTree(rootLabel, files) {

    const root = {
        name: rootLabel,
        type: "folder",
        path: rootLabel,
        children: []
    };

    files.forEach(file => {

        const separator =
            pathSeparator(file.path);

        const parts =
            file.path.split(separator).filter(Boolean);

        if (!parts.length) {
            return;
        }

        let current = root;
        let builtPath = "";

        for (let i = 0; i < parts.length - 1; i++) {

            const part = parts[i];

            builtPath =
                builtPath ? `${builtPath}${separator}${part}` : part;

            let folder =
                current.children.find(child => child.type === "folder" && child.name === part);

            if (!folder) {

                folder = {
                    name: part,
                    type: "folder",
                    path: builtPath,
                    children: []
                };

                current.children.push(folder);
            }

            current = folder;
        }

        const fileName =
            parts[parts.length - 1];

        current.children.push({
            name: fileName,
            type: "file",
            path: file.path,
            size: file.size,
            hash: file.hash,
            timestamp: file.timestamp,
            eventId: file.eventId,
            actor: file.actor,
            actorType: file.actorType,
            attackId: file.attackId,

            /*
             * Only ever set for screenshots/recordings made
             * with the in-game capture tool (Ctrl+Shift+S/R,
             * or the on-screen buttons) — see CaptureTool.js.
             * Everything else leaves these undefined.
             */
            isCapture: file.isCapture || false,
            mimeType: file.mimeType || null,
            dataUrl: file.dataUrl || null,
            blobUrl: file.blobUrl || null,
            width: file.width || null,
            height: file.height || null,
            durationMs: file.durationMs || null,

            /*
             * Which Nightfall phishing domain (if any) was on
             * screen in Malware Sandbox when this capture was
             * taken — see CaptureTool.js. Only ever set on
             * isCapture files.
             */
            nightfallDomain: file.nightfallDomain || null,

            /*
             * RANSOMWARE (BLACKFROST) additions — only ever set
             * on files coming from getRansomwareFileTree() below.
             * Passed through here rather than given their own
             * tree builder, so the ransomware host view reuses
             * every bit of folder-nesting logic above unchanged.
             */
            ransomStatus: file.ransomStatus || null,
            isRansomFile: file.isRansomFile || false,
            isRansomNote: file.isRansomNote || false,
            ransomNoteContents: file.ransomNoteContents || null
        });
    });

    return root;
}


export class FileExplorerStore {

    constructor() {

        this.machine =
            LOCAL_MACHINE;

        this.state = {
            currentPath: [],
            selectedFilePath: null,

            /*
             * "LOCAL" (default, unchanged behavior) or
             * "RANSOMWARE_HOST" — an additive toggle, only ever
             * shown/usable while a ransomware campaign is
             * running. Everything below falls back to "LOCAL"
             * whenever no campaign is active, so File Explorer's
             * default behavior is byte-for-byte unchanged when
             * ransomware isn't part of the current scenario.
             */
            viewMode: "LOCAL"
        };

        this.listeners = new Set();

        /*
         * Real back/forward history, like an actual file
         * explorer — a linear stack of {path} snapshots with
         * a moving index. Only one machine exists, so there's
         * nothing to track besides the folder path.
         */
        this.history = [];
        this.historyIndex = -1;
        this.suppressHistoryPush = false;
    }


    /* =====================================================
       SUBSCRIPTIONS
       ===================================================== */

    subscribe(listener) {

        if (typeof listener !== "function") {
            throw new TypeError("FileExplorerStore.subscribe requires a function.");
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    notify(eventName, payload = {}) {

        const event = { type: eventName, payload };

        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error("[FILE EXPLORER STORE] Subscriber error:", error);
            }
        });
    }


    /* =====================================================
       LIVE ENGINE ACCESS
       ===================================================== */

    getAllEvents() {

        const engine = window.eventEngine;

        if (!engine || typeof engine.getAllEvents !== "function") {
            return [];
        }

        return engine.getAllEvents();
    }

    getAllAlerts() {

        const manager = window.alertManager;

        if (!manager || typeof manager.getAllAlerts !== "function") {
            return [];
        }

        return manager.getAllAlerts();
    }


    /* =====================================================
       THE LOCAL MACHINE
       ---------------------------------------------------
       Always this one machine — there's nothing to select.
       getSelectedHost() is kept (rather than renamed) so the
       renderer's existing "host" plumbing — breadcrumbs,
       tree building, properties — didn't need to change.
       ===================================================== */

    getLocalMachine() {
        return this.machine;
    }

    getSelectedHost() {
        return this.getActiveMachine();
    }


    /* =====================================================
       RANSOMWARE (BLACKFROST) HOST VIEW
       ---------------------------------------------------
       Additive: File Explorer is otherwise scoped to the
       analyst's own desktop (LOCAL_MACHINE, by design — see
       the file header). Ransomware needs to show real,
       corporate-fleet (data/hosts.js) encryption on the actual
       affected host, so this adds a second view rather than
       redesigning the module. Everything degrades to the
       original single-machine behavior when no ransomware
       campaign is running.
       ===================================================== */

    hasActiveRansomwareCampaign() {
        return !!window.ransomwareEngine?.getCampaign?.();
    }

    /**
     * A LOCAL_MACHINE-shaped object for the real HOSTS fleet
     * entry a ransomware campaign is running on, so the rest of
     * this store (getFileTreeForHost, breadcrumbs, header) can
     * keep treating "the active machine" generically.
     */
    getRansomwareHostMachine() {

        const campaign = window.ransomwareEngine?.getCampaign?.();

        if (!campaign?.affectedHostname) {
            return null;
        }

        const host =
            HOSTS.find(h => h.hostname === campaign.affectedHostname);

        if (!host) {
            return null;
        }

        return {
            id: host.id,
            hostname: host.hostname,
            operatingSystem: host.operatingSystem,
            assignedUser: host.assignedUser,
            isolated: host.isolated
        };
    }

    getViewMode() {

        /*
         * Falls back to LOCAL the instant there's no active
         * campaign to view — e.g. after an incident resolves —
         * rather than getting stuck pointed at a host with no
         * ransomware activity left to show.
         */
        if (this.state.viewMode === "RANSOMWARE_HOST" && !this.hasActiveRansomwareCampaign()) {
            return "LOCAL";
        }

        return this.state.viewMode;
    }

    setViewMode(mode) {

        if (mode !== "LOCAL" && mode !== "RANSOMWARE_HOST") {
            return;
        }

        this.state.viewMode = mode;
        this.state.currentPath = [];
        this.state.selectedFilePath = null;

        this.history = [];
        this.historyIndex = -1;
        this.pushHistory();

        this.notify(FILE_STORE_EVENTS.STATE_CHANGED);
    }

    getActiveMachine() {

        if (this.getViewMode() === "RANSOMWARE_HOST") {
            return this.getRansomwareHostMachine() || this.machine;
        }

        return this.machine;
    }

    /**
     * The single entry point every renderer call site should use
     * instead of calling getFileTreeForHost() directly — picks
     * the right tree builder for the current view mode so a
     * "This PC" file count, the Gallery, and "all files" helpers
     * all agree with the folder browser above.
     */
    getActiveFileTree() {

        if (this.getViewMode() === "RANSOMWARE_HOST") {
            return this.getRansomwareFileTree();
        }

        return this.getFileTreeForHost(this.machine);
    }

    /**
     * Builds the ransomware host's folder tree directly from
     * the live campaign's own file manifest (campaign.files) —
     * NOT from FILE_CREATED/FILE_DROPPED SIEM events, since
     * RansomwareEngine tracks encryption status on that manifest
     * directly rather than emitting one event per file. Reuses
     * the exact same buildFileTree() nesting logic as the local
     * machine view.
     */
    getRansomwareFileTree() {

        const campaign = window.ransomwareEngine?.getCampaign?.();
        const host = this.getRansomwareHostMachine();

        if (!campaign || !host) {
            return null;
        }

        const userRoot = `C:\\Users\\${campaign.affectedUsername}`;

        const files = campaign.files.map(file => ({
            path: `${userRoot}\\${file.folder}\\${file.name}`,
            size: file.size,
            hash: `bf-${file.id}`,
            timestamp: campaign.startedAt ? new Date(campaign.startedAt).toISOString() : null,
            eventId: null,
            actor: null,
            actorType: null,
            attackId: campaign.id,
            ransomStatus: file.status,
            isRansomFile: true
        }));

        if (campaign.ransomNoteCreated) {

            files.push({
                path: `${userRoot}\\Documents\\${campaign.ransomNoteFilename}`,
                size: 1400,
                hash: "bf-ransom-note",
                timestamp: new Date().toISOString(),
                eventId: null,
                actor: campaign.actor?.name || null,
                actorType: "ATTACKER",
                attackId: campaign.id,
                isRansomNote: true,
                ransomNoteContents: buildRansomNoteContents(campaign)
            });
        }

        return buildFileTree(host.hostname, files);
    }


    /* =====================================================
       FILE TREE
       ---------------------------------------------------
       Rebuilt fresh from real events every time — always
       exactly consistent with the live event stream, same
       discipline as EndpointStore/VpnStore.
       ===================================================== */

    getFileTreeForHost(machine) {

        if (!machine) {
            return null;
        }

        const fileEvents =
            this.getAllEvents().filter(event =>
                (event.eventType === "FILE_DROPPED" || event.eventType === "FILE_CREATED") &&
                event.hostname === machine.hostname
            );

        const files =
            fileEvents.map(event => ({
                path: event.metadata?.filePath,
                size: event.metadata?.fileSize,
                hash: event.metadata?.fileHash,
                timestamp: event.timestamp,
                eventId: event.id,
                actor: event.actor || null,
                actorType: event.actorType || null,
                attackId: event.attackId || null,

                isCapture: event.metadata?.isCapture || false,
                mimeType: event.metadata?.mimeType || null,
                dataUrl: event.metadata?.dataUrl || null,
                blobUrl: event.metadata?.blobUrl || null,
                width: event.metadata?.width || null,
                height: event.metadata?.height || null,
                durationMs: event.metadata?.durationMs || null,
                nightfallDomain: event.metadata?.nightfallDomain || null
            })).filter(file => !!file.path);

        return buildFileTree(machine.hostname, files);
    }

    /**
     * Every screenshot/recording taken with the in-game
     * capture tool, flattened out of the folder tree and
     * newest-first — what Mail's "Upload" picker (Compose /
     * Reply → Attach) shows. Nothing here is invented; each
     * one is a real FILE_CREATED event with isCapture: true,
     * same as any other file on this machine.
     */
    getCaptureFiles() {

        const tree =
            this.getFileTreeForHost(this.machine);

        const results = [];

        const walk = node => {

            if (!node) return;

            if (node.type === "file" && node.isCapture) {
                results.push(node);
            }

            (node.children || []).forEach(walk);
        };

        walk(tree);

        return results.sort(
            (a, b) =>
                new Date(b.timestamp || 0) -
                new Date(a.timestamp || 0)
        );
    }

    /**
     * The handful of deliberate investigation artifacts —
     * files that need to go through the Password Cracker (or
     * direct review, for the suspicious script) — living in a
     * shared evidence location rather than under any one
     * machine's personal folders.
     */
    getSharedFiles() {
        return buildSharedFiles();
    }

    /**
     * Walks the tree following the current breadcrumb path,
     * returning the folder node currently being viewed.
     */
    getCurrentFolder() {

        const tree =
            this.getActiveFileTree();

        let current = tree;

        for (const segment of this.state.currentPath) {

            const next =
                current?.children.find(child => child.type === "folder" && child.name === segment);

            if (!next) {
                /* Path no longer exists (files trickled in/out) — fall back to root. */
                this.state.currentPath = [];
                return tree;
            }

            current = next;
        }

        return current;
    }

    getBreadcrumb() {

        return [
            "This PC",
            ...this.state.currentPath.map(
                segment => segment === "C:" ? "Local Disk (C:)" : segment
            )
        ];
    }


    /* =====================================================
       FILE / ALERT CORRELATION
       ---------------------------------------------------
       A file is only ever "flagged" via a real correlated
       alert — never a static field baked onto the file
       itself. Same discipline as Endpoints/VpnStore.
       ===================================================== */

    getAlertsForFile(file) {

        if (!file) {
            return [];
        }

        return this.getAllAlerts().filter(alert => {

            const sourceEvent =
                alert.sourceEvent;

            if (!sourceEvent) {
                return false;
            }

            return sourceEvent.id === file.eventId;
        });
    }

    computeFileRisk(file) {

        if (!file || file.type !== "file") {
            return "LOW";
        }

        /*
         * BUGFIX (giveaway): this used to short-circuit to
         * CRITICAL whenever file.actorType === "ATTACKER" —
         * the raw ground-truth flag — which contradicted the
         * discipline documented right above getAlertsForFile()
         * ("a file is only ever flagged via a real correlated
         * alert — never a static field baked onto the file
         * itself"). A player only had to select an
         * attacker-dropped file to see it named CRITICAL
         * before investigating anything. Risk is now derived
         * purely from real correlated alerts, same as every
         * other file.
         */
        const unresolved =
            this.getAlertsForFile(file).filter(
                alert => alert.status !== "RESOLVED" && alert.status !== "FALSE_POSITIVE"
            );

        if (unresolved.some(a => a.severity === "CRITICAL")) return "CRITICAL";
        if (unresolved.some(a => a.severity === "HIGH")) return "HIGH";
        if (unresolved.some(a => a.severity === "MEDIUM")) return "MEDIUM";

        return "LOW";
    }

    getRelatedEvent(file) {

        if (!file) {
            return null;
        }

        return this.getAllEvents().find(event => event.id === file.eventId) || null;
    }


    /* =====================================================
       PASSWORD LOCK
       ---------------------------------------------------
       About 1 in 3 REAL malicious files are password-
       protected — deterministic from the file's own hash, so
       the same file is always locked (or not) consistently.
       Never applies to ambient/benign files; locking an
       ordinary spreadsheet wouldn't make sense.
       ===================================================== */

    isFileLocked(file) {

        if (!file || !file.hash) {
            return false;
        }

        /*
         * Deliberate shared investigation artifacts (see
         * getSharedFiles()) carry their own explicit lock
         * state instead of the live-event heuristic below —
         * they're static, not something AttackEngine dropped.
         */
        if (file.scenarioArtifact) {
            return file.locked === true;
        }

        if (file.actorType !== "ATTACKER") {
            return false;
        }

        const seed =
            parseInt(file.hash.slice(0, 4), 16) || 0;

        return seed % 3 === 0;
    }

    /**
     * Deterministic 8-digit password derived from the file's
     * hash — same file always has the same password.
     */
    getFileLockPassword(file) {

        if (!file?.hash) {
            return "00000000";
        }

        let password = "";

        for (let i = 0; i < 8; i++) {

            const char =
                file.hash[i % file.hash.length] || "0";

            password += String(char.charCodeAt(0) % 10);
        }

        return password;
    }

    /**
     * Registers a locked file as a real Password Cracker
     * target, tagging the given DOM element as the clickable
     * link point. Safe to call repeatedly — the registry
     * itself is keyed by id, so this just re-registers rather
     * than duplicating.
     */
    registerFileAsLockTarget(file, element) {

        if (
            !window.NorthstarPasswordTargets ||
            !this.isFileLocked(file) ||
            !element
        ) {
            return;
        }

        window.NorthstarPasswordTargets.register({
            id: file.hash,
            label: file.name,
            password: this.getFileLockPassword(file),
            element,

            /*
             * Fires once, at the moment the crack completes.
             * revealUnlockedFile() below is the actual reveal
             * logic — shared with double-clicking the file again
             * later, so re-opening it after the fact works too.
             */
            unlock: () => this.revealUnlockedFile(file)
        });
    }

    /**
     * Shows the investigation payoff for an already-unlocked
     * locked file — a credential table for the password-manager
     * backup, a generated financial report PDF for the archive,
     * or the old generic modal for anything without a dedicated
     * reveal. Called both by the crack-completion callback above
     * (registerFileAsLockTarget's unlock) and by the renderer
     * when the player double-clicks the file again later — before
     * this existed, double-clicking a file you'd already cracked
     * did nothing, because the reveal only ever fired once, at
     * crack time.
     */
    revealUnlockedFile(file) {

        if (file.id === "NS-LOCKED-CREDENTIALS" && window.showCredentialVaultModal) {

            window.showCredentialVaultModal(file.name);

        } else if (file.id === "NS-LOCKED-FINANCE" && window.showFinanceReportModal) {

            window.showFinanceReportModal(file.name);

        } else if (window.showDecryptedFileModal) {

            window.showDecryptedFileModal(
                file.name,
                `Decryption complete. ${file.name} is now unlocked and ready for detonation in the Malware Sandbox.`
            );

        }

    }

    isFileUnlocked(file) {

        if (!this.isFileLocked(file)) {
            return true;
        }

        const target =
            window.NorthstarPasswordTargets?.get?.(file.hash);

        return !!target?.cracked;
    }


    /* =====================================================
       NAVIGATION HISTORY
       ===================================================== */

    pushHistory() {

        if (this.suppressHistoryPush) {
            return;
        }

        this.history = this.history.slice(0, this.historyIndex + 1);

        this.history.push({
            path: [...this.state.currentPath]
        });

        this.historyIndex = this.history.length - 1;
    }

    canGoBack() {
        return this.historyIndex > 0;
    }

    canGoForward() {
        return this.historyIndex < this.history.length - 1;
    }

    goBack() {

        if (!this.canGoBack()) {
            return;
        }

        this.historyIndex -= 1;

        this.applyHistoryEntry(this.history[this.historyIndex]);
    }

    goForward() {

        if (!this.canGoForward()) {
            return;
        }

        this.historyIndex += 1;

        this.applyHistoryEntry(this.history[this.historyIndex]);
    }

    applyHistoryEntry(entry) {

        this.suppressHistoryPush = true;

        this.state.currentPath = [...entry.path];
        this.state.selectedFilePath = null;

        this.notify(FILE_STORE_EVENTS.STATE_CHANGED);

        this.suppressHistoryPush = false;
    }


    /* =====================================================
       SELECTION / NAVIGATION STATE
       ===================================================== */

    navigateInto(folderName) {

        this.state.currentPath = [...this.state.currentPath, folderName];
        this.state.selectedFilePath = null;

        this.pushHistory();

        this.notify(FILE_STORE_EVENTS.STATE_CHANGED);
    }

    navigateToBreadcrumb(index) {

        /*
         * index 0 = "This PC" itself (root), index 1 = first
         * folder level, etc. — matches getBreadcrumb()'s array.
         */
        this.state.currentPath = this.state.currentPath.slice(0, index);
        this.state.selectedFilePath = null;

        this.pushHistory();

        this.notify(FILE_STORE_EVENTS.STATE_CHANGED);
    }

    /**
     * Jumps straight to a real folder on the local machine —
     * what clicking a Quick access shortcut (Desktop,
     * Documents, Downloads, Pictures, Music, Videos) or the
     * Local Disk (C:) drive tile does.
     */
    navigateToPath(segments) {

        this.state.currentPath = [...segments];
        this.state.selectedFilePath = null;

        this.pushHistory();

        this.notify(FILE_STORE_EVENTS.STATE_CHANGED);
    }

    /**
     * Path segments for one of the standard user folders on
     * the local machine, e.g. ["C:", "Users", "analyst", "Desktop"].
     */
    getUserFolderPath(folderName) {
        return ["C:", "Users", this.machine.assignedUser, folderName];
    }

    getDriveRootPath() {
        return ["C:"];
    }

    navigateToUserFolder(folderName) {
        this.navigateToPath(this.getUserFolderPath(folderName));
    }

    navigateToDriveRoot() {
        this.navigateToPath(this.getDriveRootPath());
    }

    selectFile(filePath) {

        this.state.selectedFilePath = filePath;

        this.notify(FILE_STORE_EVENTS.STATE_CHANGED);
    }

    getSelectedFile() {

        if (!this.state.selectedFilePath) {
            return null;
        }

        /*
         * Shared investigation artifacts live outside the
         * local machine's folder tree, so they're checked
         * first.
         */
        const shared =
            this.getSharedFiles().find(
                file => file.path === this.state.selectedFilePath
            );

        if (shared) {
            return shared;
        }

        const folder =
            this.getCurrentFolder();

        return folder?.children.find(
            child => child.type === "file" && child.path === this.state.selectedFilePath
        ) || null;
    }
}
