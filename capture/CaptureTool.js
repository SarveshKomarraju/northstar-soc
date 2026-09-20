/* =========================================================
   NORTHSTAR SOC — CAPTURE TOOL
   File: capture/CaptureTool.js

   An in-game "Snip & Sketch" equivalent — captures only the
   NorthStar desktop itself (#desktop), never the OS, other
   apps, or other browser tabs/windows. That's the whole point
   of building this instead of just using the browser's own
   screen-share picker (getDisplayMedia): that picker lets the
   player choose ANY window/tab/screen, which is exactly what
   we don't want here.

   Two ways in — keep both hands on the keyboard, or use the
   on-screen buttons:

     Ctrl+Shift+S  /  📷 button — drag-select a region and
                       release to snip it (same gesture as
                       Windows' own Snip & Sketch).
     Ctrl+Shift+R  /  ⏺ button — start/stop a recording of
                       the whole desktop. No OS permission
                       prompt: it's rendered entirely from
                       this page's own DOM.

   Both save straight into File Explorer as real files —
   screenshots under Pictures\Screenshots, recordings under
   Videos\Captures — the same way any other file on this
   machine exists: a real FILE_CREATED event on window.eventEngine
   (see FileExplorerStore.getFileTreeForHost). The image/video
   data itself rides along in the event's metadata (dataUrl for
   images, blobUrl for videos) and FileExplorerStore threads it
   straight through onto the tree node, so File Explorer,
   Gallery, and Mail's Upload picker are all just reading the
   same event log — nothing is duplicated or kept in sync by
   hand.

   Plain script, self-initializing on load. Depends on the
   vendored html2canvas (capture/vendor/html2canvas.min.js),
   which must be loaded before this file.
   ========================================================= */

(function () {

    /*
     * Must match files/data/localMachine.js's LOCAL_MACHINE.
     * Hardcoded rather than imported since this is a plain
     * script (localMachine.js is an ES module) and the game
     * is deliberately scoped to this one fixed machine.
     */
    const LOCAL_HOSTNAME = "ANALYST-PC";
    const LOCAL_USER = "analyst";


    /* =====================================================
       STATE
       ===================================================== */

    let snipActive = false;

    let recording = false;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordCanvas = null;
    let recordCtx = null;
    let recordStartTime = null;
    let recordingIndicatorEl = null;
    let recordingTimerInterval = null;

    /*
     * Snapshotted once, when recording actually starts — see
     * saveScreenshotAsFile() for why this exists.
     */
    let recordingNightfallDomain = null;

    let toolbarEl = null;
    let toolbarRecordButton = null;


    /* =====================================================
       ENTRY POINTS
       ===================================================== */

    document.addEventListener("keydown", event => {

        if (event.repeat) return;
        if (!event.ctrlKey || !event.shiftKey) return;

        const key = String(event.key || "").toLowerCase();

        if (key === "s") {
            event.preventDefault();
            handleSnipRequest();
        } else if (key === "r") {
            event.preventDefault();
            toggleRecording();
        }

    }, true);


    function handleSnipRequest() {

        if (recording) {

            showToast(
                "Stop the recording first.",
                { tone: "error" }
            );

            return;
        }

        if (typeof html2canvas !== "function") {

            showToast(
                "Screenshot tool isn't available right now.",
                { tone: "error" }
            );

            return;
        }

        startSnip();
    }


    function getDesktopElement() {
        return document.getElementById("desktop") || document.body;
    }


    /* =====================================================
       ON-SCREEN TOOLBAR
       ===================================================== */

    function buildToolbar() {

        toolbarEl =
            document.createElement("div");

        toolbarEl.className = "ns-capture-toolbar";

        toolbarEl.innerHTML = `
            <button class="ns-capture-toolbar-btn" data-ns-capture="snip" title="Take a screenshot (Ctrl+Shift+S)">
                <span class="ns-capture-toolbar-icon">📷</span>
            </button>
            <button class="ns-capture-toolbar-btn" data-ns-capture="record" title="Record the desktop (Ctrl+Shift+R)">
                <span class="ns-capture-toolbar-icon">⏺</span>
            </button>
        `;

        toolbarEl.querySelector('[data-ns-capture="snip"]')
            .addEventListener("click", handleSnipRequest);

        toolbarRecordButton =
            toolbarEl.querySelector('[data-ns-capture="record"]');

        toolbarRecordButton.addEventListener("click", toggleRecording);

        document.body.appendChild(toolbarEl);
    }

    function updateToolbarRecordButton() {

        if (!toolbarRecordButton) return;

        toolbarRecordButton.classList.toggle("ns-capture-toolbar-btn-active", recording);

        toolbarRecordButton.title =
            recording
                ? "Stop recording (Ctrl+Shift+R)"
                : "Record the desktop (Ctrl+Shift+R)";

        toolbarRecordButton.querySelector(".ns-capture-toolbar-icon").textContent =
            recording ? "⏹" : "⏺";
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildToolbar, { once: true });
    } else {
        buildToolbar();
    }


    /* =====================================================
       SNIP (SCREENSHOT)
       ===================================================== */

    function startSnip() {

        if (snipActive) return;

        snipActive = true;

        const desktopEl =
            getDesktopElement();

        const bounds =
            desktopEl.getBoundingClientRect();

        const overlay =
            document.createElement("div");

        overlay.className = "ns-snip-overlay";

        Object.assign(overlay.style, {
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`
        });

        const selectionBox =
            document.createElement("div");

        selectionBox.className = "ns-snip-selection";
        selectionBox.hidden = true;

        const hint =
            document.createElement("div");

        hint.className = "ns-snip-hint";
        hint.textContent =
            "Drag to select an area  ·  Esc to cancel";

        overlay.appendChild(selectionBox);
        overlay.appendChild(hint);
        document.body.appendChild(overlay);

        let startX = 0;
        let startY = 0;
        let dragging = false;

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function updateBox(clientX, clientY) {

            const x = clamp(clientX, bounds.left, bounds.right);
            const y = clamp(clientY, bounds.top, bounds.bottom);

            const left = Math.min(startX, x);
            const top = Math.min(startY, y);
            const width = Math.abs(x - startX);
            const height = Math.abs(y - startY);

            Object.assign(selectionBox.style, {
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`
            });
        }

        function onMouseDown(event) {

            dragging = true;

            startX = clamp(event.clientX, bounds.left, bounds.right);
            startY = clamp(event.clientY, bounds.top, bounds.bottom);

            selectionBox.hidden = false;

            updateBox(event.clientX, event.clientY);
        }

        function onMouseMove(event) {

            if (!dragging) return;

            updateBox(event.clientX, event.clientY);
        }

        async function onMouseUp() {

            if (!dragging) return;

            dragging = false;

            const rect =
                selectionBox.getBoundingClientRect();

            cleanup();

            if (rect.width < 6 || rect.height < 6) {
                return;
            }

            await finishSnip(rect, desktopEl, bounds);
        }

        function onKeydown(event) {

            if (event.key === "Escape") {
                cleanup();
            }
        }

        function cleanup() {

            overlay.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("keydown", onKeydown, true);

            overlay.remove();

            snipActive = false;
        }

        overlay.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        document.addEventListener("keydown", onKeydown, true);
    }


    async function finishSnip(rect, desktopEl, desktopBounds) {

        /*
         * Two animation frames so the overlay's removal is
         * actually painted before html2canvas snapshots the
         * desktop — otherwise the dashed selection box and dim
         * backdrop end up baked into the screenshot.
         */
        await new Promise(resolve =>
            requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            )
        );

        try {

            /* Rect relative to the desktop element, not the viewport. */
            const relativeRect = {
                left: rect.left - desktopBounds.left,
                top: rect.top - desktopBounds.top,
                width: rect.width,
                height: rect.height
            };

            const dataUrl =
                await captureRegion(desktopEl, relativeRect);

            const now = new Date();

            saveScreenshotAsFile({
                dataUrl,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                timestamp: now
            });

            showToast(
                "Screenshot saved to Pictures — upload it from Mail",
                { thumbnail: dataUrl }
            );

        } catch (error) {

            console.error("[CaptureTool] snip failed", error);

            showToast(
                "Screenshot failed — try again",
                { tone: "error" }
            );
        }
    }


    async function captureRegion(desktopEl, relativeRect) {

        const fullCanvas =
            await html2canvas(desktopEl, {
                backgroundColor: null,
                useCORS: true,
                logging: false
            });

        const desktopWidth =
            desktopEl.getBoundingClientRect().width;

        const desktopHeight =
            desktopEl.getBoundingClientRect().height;

        const scaleX = fullCanvas.width / desktopWidth;
        const scaleY = fullCanvas.height / desktopHeight;

        const cropCanvas =
            document.createElement("canvas");

        cropCanvas.width =
            Math.max(1, Math.round(relativeRect.width * scaleX));

        cropCanvas.height =
            Math.max(1, Math.round(relativeRect.height * scaleY));

        const ctx =
            cropCanvas.getContext("2d");

        ctx.drawImage(
            fullCanvas,
            relativeRect.left * scaleX,
            relativeRect.top * scaleY,
            relativeRect.width * scaleX,
            relativeRect.height * scaleY,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height
        );

        return cropCanvas.toDataURL("image/png");
    }


    /* =====================================================
       NIGHTFALL AUTO-TAG
       ---------------------------------------------------
       window.NorthstarActiveNightfallCapture (set by
       MalwareSandboxApp.js while a Nightfall page is being
       shown) isn't trusted on its own — the player could
       switch to another app while Sandbox sits open behind
       it, or minimize it, and a screenshot of something else
       entirely would still get tagged. Only counts if the
       Sandbox window is actually the focused, non-minimized
       window right now (window.SOCCommandCenter's own z-index
       convention — see script.js's focusWindow()).
       ===================================================== */

    function getActiveNightfallDomain() {

        const tracker =
            window.NorthstarActiveNightfallCapture;

        if (!tracker?.domain) {
            return null;
        }

        const soc =
            window.SOCCommandCenter;

        if (!soc || typeof soc.getWindowForApp !== "function") {
            return tracker.domain;
        }

        const sandboxWindow =
            soc.getWindowForApp("sandbox");

        if (!sandboxWindow) {
            return null;
        }

        const minimized =
            sandboxWindow.classList.contains("window-minimized");

        const focused =
            Number(sandboxWindow.style.zIndex) ===
            soc.state?.highestZIndex;

        return (!minimized && focused) ? tracker.domain : null;
    }


    function saveScreenshotAsFile({ dataUrl, width, height, timestamp }) {

        const name =
            `Screenshot_${formatFilenameDate(timestamp)}.png`;

        const filePath =
            `C:\\Users\\${LOCAL_USER}\\Pictures\\Screenshots\\${name}`;

        emitCaptureFile({
            fileName: name,
            filePath,
            fileSize: estimateDataUrlBytes(dataUrl),
            mimeType: "image/png",
            dataUrl,
            width,
            height,

            /*
             * Malware Sandbox sets this global while a Nightfall
             * phishing page is actually on screen (see
             * MalwareSandboxApp.js's renderAnalysis()) so a
             * screenshot taken right now can be auto-tagged with
             * which of the 6 domains it's evidence of, instead of
             * relying on the player to label it themselves.
             * getActiveNightfallDomain() only trusts it while
             * Sandbox is actually the focused window.
             */
            nightfallDomain:
                getActiveNightfallDomain()
        });
    }


    /* =====================================================
       VIDEO RECORDING
       ---------------------------------------------------
       No getDisplayMedia — that hands the player an OS-level
       picker that can record ANY window/tab/screen, which is
       exactly what "just in game" rules out. Instead, a hidden
       canvas is redrawn from repeated html2canvas snapshots of
       #desktop and fed into MediaRecorder via canvas.captureStream() —
       so there is nothing to record but this page's own DOM,
       and no permission prompt at all.
       ===================================================== */

    async function toggleRecording() {

        if (snipActive) return;

        if (recording) {
            stopRecording();
            return;
        }

        if (typeof html2canvas !== "function") {

            showToast(
                "Screen recording isn't available right now.",
                { tone: "error" }
            );

            return;
        }

        const desktopEl =
            getDesktopElement();

        const bounds =
            desktopEl.getBoundingClientRect();

        recordCanvas =
            document.createElement("canvas");

        recordCanvas.width = Math.max(1, Math.round(bounds.width));
        recordCanvas.height = Math.max(1, Math.round(bounds.height));

        recordCtx = recordCanvas.getContext("2d");

        let stream;

        try {
            stream = recordCanvas.captureStream(8);
        } catch (error) {

            showToast(
                "Screen recording isn't supported in this browser.",
                { tone: "error" }
            );

            return;
        }

        recordedChunks = [];

        const mimeType =
            pickSupportedMimeType();

        try {

            mediaRecorder =
                mimeType
                    ? new MediaRecorder(stream, { mimeType })
                    : new MediaRecorder(stream);

        } catch (error) {

            showToast(
                "Screen recording isn't supported in this browser.",
                { tone: "error" }
            );

            return;
        }

        mediaRecorder.addEventListener("dataavailable", event => {

            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        });

        mediaRecorder.addEventListener("stop", finishRecording);

        mediaRecorder.start();

        recording = true;
        recordStartTime = Date.now();

        recordingNightfallDomain =
            getActiveNightfallDomain();

        updateToolbarRecordButton();
        showRecordingIndicator();

        runRecordLoop(desktopEl);
    }


    function stopRecording() {

        if (!recording) return;

        recording = false;

        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }

        updateToolbarRecordButton();
    }


    async function runRecordLoop(desktopEl) {

        while (recording) {

            try {

                const frame =
                    await html2canvas(desktopEl, {
                        backgroundColor: null,
                        useCORS: true,
                        logging: false
                    });

                if (!recording || !recordCtx) break;

                recordCtx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);

                recordCtx.drawImage(
                    frame,
                    0, 0, frame.width, frame.height,
                    0, 0, recordCanvas.width, recordCanvas.height
                );

            } catch (error) {
                console.error("[CaptureTool] recording frame failed", error);
            }

            await sleep(280);
        }
    }


    function finishRecording() {

        hideRecordingIndicator();

        recordCanvas = null;
        recordCtx = null;

        if (!recordedChunks.length) {
            mediaRecorder = null;
            return;
        }

        const blob =
            new Blob(recordedChunks, {
                type: mediaRecorder.mimeType || "video/webm"
            });

        const blobUrl =
            URL.createObjectURL(blob);

        const durationMs =
            Date.now() - recordStartTime;

        const now = new Date();

        const extension =
            blob.type.includes("mp4") ? "mp4" : "webm";

        const name =
            `Recording_${formatFilenameDate(now)}.${extension}`;

        const filePath =
            `C:\\Users\\${LOCAL_USER}\\Videos\\Captures\\${name}`;

        emitCaptureFile({
            fileName: name,
            filePath,
            fileSize: blob.size,
            mimeType: blob.type,
            blobUrl,
            durationMs,

            /*
             * Snapshotted when the recording STARTED, not now —
             * by the time it stops the player may have already
             * cleared the sandbox or moved on.
             */
            nightfallDomain: recordingNightfallDomain
        });

        showToast(
            `Recording saved to Videos (${formatDuration(durationMs)}) — upload it from Mail`
        );

        mediaRecorder = null;
        recordedChunks = [];
        recordingNightfallDomain = null;
    }


    function pickSupportedMimeType() {

        if (
            typeof MediaRecorder === "undefined" ||
            typeof MediaRecorder.isTypeSupported !== "function"
        ) {
            return null;
        }

        const candidates = [
            "video/webm;codecs=vp9",
            "video/webm;codecs=vp8",
            "video/webm",
            "video/mp4"
        ];

        return candidates.find(
            type => MediaRecorder.isTypeSupported(type)
        ) || null;
    }


    function showRecordingIndicator() {

        hideRecordingIndicator();

        recordingIndicatorEl =
            document.createElement("div");

        recordingIndicatorEl.className = "ns-recording-indicator";

        recordingIndicatorEl.innerHTML = `
            <span class="ns-recording-dot"></span>
            <span class="ns-recording-time">0:00</span>
            <button class="ns-recording-stop" type="button">Stop</button>
        `;

        recordingIndicatorEl.querySelector(".ns-recording-stop")
            .addEventListener("click", stopRecording);

        document.body.appendChild(recordingIndicatorEl);

        const timeEl =
            recordingIndicatorEl.querySelector(".ns-recording-time");

        recordingTimerInterval = setInterval(() => {

            if (!recordStartTime || !timeEl) return;

            timeEl.textContent =
                formatDuration(Date.now() - recordStartTime);

        }, 500);
    }


    function hideRecordingIndicator() {

        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
        }

        if (recordingIndicatorEl) {
            recordingIndicatorEl.remove();
            recordingIndicatorEl = null;
        }
    }


    /* =====================================================
       FILE EXPLORER INTEGRATION
       ---------------------------------------------------
       Saving a capture is nothing more than emitting a real
       FILE_CREATED event, same as any other file on this
       machine (see FileExplorerEventBridge.js's ambient
       trickle) — File Explorer, Gallery, and Mail's Upload
       picker all just read the same event log, so there's
       nothing else to wire up.
       ===================================================== */

    function emitCaptureFile({ fileName, filePath, fileSize, mimeType, dataUrl, blobUrl, width, height, durationMs, nightfallDomain }) {

        if (!window.eventEngine || typeof window.eventEngine.createEvent !== "function") {

            console.error("[CaptureTool] window.eventEngine isn't ready — capture not saved.");

            return;
        }

        window.eventEngine.createEvent({
            eventType: "FILE_CREATED",
            severity: "INFO",
            hostname: LOCAL_HOSTNAME,
            username: LOCAL_USER,
            message: `${fileName} was captured on ${LOCAL_HOSTNAME}.`,
            metadata: {
                fileName,
                filePath,
                fileHash: pseudoHash(`${filePath}:${Date.now()}`),
                fileSize,
                simulated: true,
                benign: true,

                isCapture: true,
                mimeType,
                dataUrl: dataUrl || null,
                blobUrl: blobUrl || null,
                width: width || null,
                height: height || null,
                durationMs: durationMs || null,

                /*
                 * Which of the 6 Nightfall phishing domains was
                 * actually on screen in Malware Sandbox at the
                 * moment this was captured, if any — see
                 * MalwareSandboxApp.js. Threaded through
                 * FileExplorerStore onto the file node, and from
                 * there into Mail's attachment object, so the
                 * incident-report flow can check it without
                 * asking the player to self-report which page
                 * each screenshot is of.
                 */
                nightfallDomain: nightfallDomain || null
            }
        });
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showToast(message, { tone = "success", thumbnail = null } = {}) {

        const toast =
            document.createElement("div");

        toast.className = `ns-capture-toast ns-capture-toast-${tone}`;

        toast.innerHTML = `
            ${thumbnail
                ? `<img class="ns-capture-toast-thumb" src="${thumbnail}" alt="">`
                : `<span class="ns-capture-toast-icon">${tone === "error" ? "⚠" : "📸"}</span>`
            }
            <span class="ns-capture-toast-text"></span>
        `;

        toast.querySelector(".ns-capture-toast-text").textContent = message;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("ns-capture-toast-visible");
        });

        setTimeout(() => {

            toast.classList.remove("ns-capture-toast-visible");

            setTimeout(() => toast.remove(), 250);

        }, 4000);
    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function formatFilenameDate(date) {

        const pad = n => String(n).padStart(2, "0");

        return (
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
            `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
        );
    }

    function formatDuration(ms) {

        const totalSeconds = Math.floor(ms / 1000);

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function estimateDataUrlBytes(dataUrl) {

        const base64 =
            String(dataUrl).split(",")[1] || "";

        return Math.round(base64.length * 0.75);
    }

    /**
     * Small deterministic-ish hash — not cryptographic, just
     * enough to give each capture a real-looking, stable
     * fileHash the same way ambientFiles.js's stableHash()
     * does for shared investigation artifacts.
     */
    function pseudoHash(seed) {

        let hash = 0;

        const text = String(seed);

        for (let i = 0; i < text.length; i++) {
            hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
        }

        return (hash >>> 0).toString(16).padStart(8, "0").repeat(4);
    }

}());
