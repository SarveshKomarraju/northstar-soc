/* =========================================================
   NORTHSTAR SOC — THREAT INTELLIGENCE LOOKUP
   File: threat-intel/ThreatIntelApp.js

   SIMULATED SOC APPLICATION

   Purpose:
   Query an indicator already discovered during an
   investigation.

   Supported:
   - IPv4
   - Domain
   - SHA-256

   This application does NOT discover indicators for the
   analyst. It only provides intelligence about an
   indicator they already have.
   ========================================================= */


/* =========================================================
   PERSISTED STATE
   ---------------------------------------------------------
   Threat Intel is a self-contained initializeThreatIntel()
   closure with no backing store, so its lookup history,
   result, and query fields were resetting to empty every
   time the window was closed and reopened. These live at
   module scope instead, so a closed/reopened window picks
   up right where the analyst left it.
   ========================================================= */

let persistedResult = null;
let persistedHistory = [];
let persistedLookupCount = 0;
let persistedQueryValue = "";
let persistedTypeValue = "AUTO";


export function initializeThreatIntel(container) {

    if (!container) {

        console.error(
            "[THREAT INTEL] Container not found."
        );

        return;
    }


    /* =====================================================
       STATE
       ===================================================== */

    let currentResult = persistedResult;

    let lookupHistory = persistedHistory;

    let lookupCount = persistedLookupCount;


    /* =====================================================
       RENDER APPLICATION
       ===================================================== */

    container.innerHTML = `

        <div class="nti-app">

            <!-- =============================================
                 HEADER
            ============================================== -->

            <header class="nti-header">

                <div class="nti-header-left">

                    <div class="nti-brand-mark">
                        TI
                    </div>

                    <div>

                        <div class="nti-title">
                            THREAT INTELLIGENCE
                        </div>

                        <div class="nti-subtitle">
                            NORTHSTAR SECURITY OPERATIONS CENTER
                        </div>

                    </div>

                </div>


                <div class="nti-header-status">

                    <span class="nti-status-dot"></span>

                    <span>
                        INTELLIGENCE SERVICE ONLINE
                    </span>

                </div>

            </header>


            <!-- =============================================
                 QUERY BAR
            ============================================== -->

            <section class="nti-query-panel">

                <div class="nti-query-heading">

                    <div>

                        <div class="nti-section-label">
                            INDICATOR LOOKUP
                        </div>

                        <div class="nti-query-description">
                            Query an indicator already identified
                            during an investigation.
                        </div>

                    </div>


                    <div class="nti-query-counter">

                        LOOKUPS

                        <strong
                            data-nti-lookup-count
                        >
                            0
                        </strong>

                    </div>

                </div>


                <div class="nti-query-row">

                    <div class="nti-input-wrapper">

                        <span class="nti-input-prefix">
                            IOC
                        </span>

                        <input
                            type="text"
                            class="nti-query-input"
                            data-nti-query
                            placeholder="Enter IP, domain, or SHA-256 hash..."
                            autocomplete="off"
                            spellcheck="false"
                        />

                    </div>


                    <select
                        class="nti-type-select"
                        data-nti-type
                    >

                        <option value="AUTO">
                            AUTO DETECT
                        </option>

                        <option value="IP">
                            IPv4 ADDRESS
                        </option>

                        <option value="DOMAIN">
                            DOMAIN
                        </option>

                        <option value="SHA256">
                            SHA-256
                        </option>

                    </select>


                    <button
                        class="nti-query-button"
                        data-nti-action="lookup"
                        type="button"
                    >
                        SEARCH INTELLIGENCE
                    </button>

                </div>


                <div
                    class="nti-query-note"
                >
                    Intelligence is queried against the
                    NORTHSTAR simulation database.
                </div>

            </section>


            <!-- =============================================
                 MAIN CONTENT
            ============================================== -->

            <main class="nti-main">


                <!-- =========================================
                     RESULT AREA
                ========================================== -->

                <section class="nti-result-panel">

                    <div class="nti-result-header">

                        <div>

                            <div class="nti-section-label">
                                INTELLIGENCE RESULT
                            </div>

                            <div
                                class="nti-result-indicator"
                                data-nti-result-indicator
                            >
                                NO INDICATOR QUERIED
                            </div>

                        </div>


                        <div
                            class="nti-result-badge"
                            data-nti-result-badge
                        >
                            STANDBY
                        </div>

                    </div>


                    <!-- =====================================
                         EMPTY STATE
                    ====================================== -->

                    <div
                        class="nti-empty-state"
                        data-nti-empty
                    >

                        <div class="nti-empty-icon">
                            ◈
                        </div>

                        <div class="nti-empty-title">
                            NO INTELLIGENCE LOADED
                        </div>

                        <div class="nti-empty-text">
                            Enter an indicator discovered
                            during your investigation.
                        </div>

                    </div>


                    <!-- =====================================
                         RESULT
                    ====================================== -->

                    <div
                        class="nti-result-content"
                        data-nti-result-content
                    >

                        <div class="nti-overview-grid">


                            <div class="nti-overview-card">

                                <span>
                                    TYPE
                                </span>

                                <strong
                                    data-nti-result-type
                                >
                                    —
                                </strong>

                            </div>


                            <div class="nti-overview-card">

                                <span>
                                    REPUTATION
                                </span>

                                <strong
                                    data-nti-result-reputation
                                >
                                    —
                                </strong>

                            </div>


                            <div class="nti-overview-card">

                                <span>
                                    CONFIDENCE
                                </span>

                                <strong
                                    data-nti-result-confidence
                                >
                                    —
                                </strong>

                            </div>


                            <div class="nti-overview-card">

                                <span>
                                    CLASSIFICATION
                                </span>

                                <strong
                                    data-nti-result-classification
                                >
                                    —
                                </strong>

                            </div>

                        </div>


                        <div class="nti-detail-grid">


                            <div class="nti-detail-section">

                                <div class="nti-detail-heading">
                                    OBSERVATION
                                </div>


                                <div class="nti-detail-row">

                                    <span>
                                        FIRST SEEN
                                    </span>

                                    <strong
                                        data-nti-first-seen
                                    >
                                        —
                                    </strong>

                                </div>


                                <div class="nti-detail-row">

                                    <span>
                                        LAST SEEN
                                    </span>

                                    <strong
                                        data-nti-last-seen
                                    >
                                        —
                                    </strong>

                                </div>


                                <div class="nti-detail-row">

                                    <span>
                                        CAMPAIGN
                                    </span>

                                    <strong
                                        data-nti-campaign
                                    >
                                        —
                                    </strong>

                                </div>


                                <div class="nti-detail-row">

                                    <span>
                                        ASN
                                    </span>

                                    <strong
                                        data-nti-asn
                                    >
                                        —
                                    </strong>

                                </div>


                                <div class="nti-detail-row">

                                    <span>
                                        ORIGIN
                                    </span>

                                    <strong
                                        data-nti-country
                                    >
                                        —
                                    </strong>

                                </div>

                            </div>


                            <div class="nti-detail-section">

                                <div class="nti-detail-heading">
                                    INFRASTRUCTURE
                                </div>


                                <div
                                    class="nti-tag-list"
                                    data-nti-infrastructure
                                ></div>


                                <div class="nti-detail-heading nti-tags-heading">
                                    TAGS
                                </div>


                                <div
                                    class="nti-tag-list"
                                    data-nti-tags
                                ></div>

                            </div>

                        </div>


                        <div class="nti-notes-panel">

                            <div class="nti-detail-heading">
                                ANALYST NOTE
                            </div>

                            <div
                                class="nti-notes"
                                data-nti-notes
                            >
                                —
                            </div>

                        </div>


                        <div class="nti-related-panel">

                            <div class="nti-detail-heading">
                                RELATED INTELLIGENCE
                            </div>

                            <div
                                class="nti-related-list"
                                data-nti-related
                            ></div>

                        </div>

                    </div>


                    <!-- =====================================
                         NO MATCH
                    ====================================== -->

                    <div
                        class="nti-no-match"
                        data-nti-no-match
                    >

                        <div class="nti-no-match-icon">
                            ?
                        </div>

                        <div class="nti-no-match-title">
                            NO INTELLIGENCE FOUND
                        </div>

                        <div class="nti-no-match-text">
                            No matching intelligence record
                            exists for this indicator.
                        </div>

                        <div class="nti-no-match-code">
                            RESULT: EMPTY
                        </div>

                    </div>

                </section>


                <!-- =========================================
                     SIDEBAR
                ========================================== -->

                <aside class="nti-sidebar">


                    <!-- =====================================
                         QUERY CONTEXT
                    ====================================== -->

                    <div class="nti-side-card">

                        <div class="nti-side-heading">
                            QUERY CONTEXT
                        </div>


                        <div class="nti-context-row">

                            <span>
                                SOURCE
                            </span>

                            <strong>
                                ANALYST INPUT
                            </strong>

                        </div>


                        <div class="nti-context-row">

                            <span>
                                MODE
                            </span>

                            <strong>
                                ON-DEMAND
                            </strong>

                        </div>


                        <div class="nti-context-row">

                            <span>
                                DATABASE
                            </span>

                            <strong class="nti-good">
                                ONLINE
                            </strong>

                        </div>


                        <div class="nti-context-row">

                            <span>
                                RECORDS
                            </span>

                            <strong
                                data-nti-record-count
                            >
                                0
                            </strong>

                        </div>

                    </div>


                    <!-- =====================================
                         HISTORY
                    ====================================== -->

                    <div class="nti-side-card nti-history-card">

                        <div class="nti-side-heading">
                            LOOKUP HISTORY
                        </div>


                        <div
                            class="nti-history"
                            data-nti-history
                        >

                            <div class="nti-history-empty">
                                No queries yet.
                            </div>

                        </div>


                        <button
                            class="nti-clear-history"
                            data-nti-action="clear-history"
                            type="button"
                        >
                            CLEAR HISTORY
                        </button>

                    </div>


                    <!-- =====================================
                         ANALYST GUIDANCE
                    ====================================== -->

                    <div class="nti-side-card">

                        <div class="nti-side-heading">
                            ANALYST SCOPE
                        </div>

                        <div class="nti-scope-item">
                            <span>01</span>
                            Query indicators already discovered.
                        </div>

                        <div class="nti-scope-item">
                            <span>02</span>
                            Compare reputation and context.
                        </div>

                        <div class="nti-scope-item">
                            <span>03</span>
                            Pivot to related indicators.
                        </div>

                    </div>


                </aside>

            </main>


            <!-- =============================================
                 FOOTER
            ============================================== -->

            <footer class="nti-footer">

                <span>
                    NORTHSTAR SOC
                </span>

                <span>
                    THREAT INTELLIGENCE SERVICE
                </span>

                <span>
                    SIMULATED ENVIRONMENT
                </span>

            </footer>

        </div>
    `;


    /* =====================================================
       ELEMENT REFERENCES
       ===================================================== */

    const queryInput =
        container.querySelector(
            "[data-nti-query]"
        );

    const typeSelect =
        container.querySelector(
            "[data-nti-type]"
        );

    const lookupButton =
        container.querySelector(
            '[data-nti-action="lookup"]'
        );

    const clearHistoryButton =
        container.querySelector(
            '[data-nti-action="clear-history"]'
        );


    const emptyState =
        container.querySelector(
            "[data-nti-empty]"
        );

    const resultContent =
        container.querySelector(
            "[data-nti-result-content]"
        );

    const noMatch =
        container.querySelector(
            "[data-nti-no-match]"
        );


    const resultIndicator =
        container.querySelector(
            "[data-nti-result-indicator]"
        );

    const resultBadge =
        container.querySelector(
            "[data-nti-result-badge]"
        );


    const lookupCountElement =
        container.querySelector(
            "[data-nti-lookup-count]"
        );

    const recordCountElement =
        container.querySelector(
            "[data-nti-record-count]"
        );

    const historyContainer =
        container.querySelector(
            "[data-nti-history]"
        );


    /* =====================================================
       INITIALIZE
    ===================================================== */

    recordCountElement.textContent =
        window.NorthstarThreatIntel
            ?.getAll()
            ?.length || 0;


    /*
     * RESTORE PERSISTED STATE
     * -----------------------------------------------
     * Put the query fields, lookup counter, history list,
     * and last result (or empty/no-match state) back the
     * way they were before this window was last closed.
     */

    lookupCountElement.textContent =
        lookupCount;

    queryInput.value =
        persistedQueryValue;

    typeSelect.value =
        persistedTypeValue;

    renderHistory();

    if (currentResult) {

        renderResult(
            currentResult
        );

    } else {

        showEmptyState();

    }


    /* =====================================================
       LOOKUP
    ===================================================== */

    function performLookup() {

        const rawQuery =
            queryInput.value.trim();

        persistedQueryValue =
            queryInput.value;

        persistedTypeValue =
            typeSelect.value;

        if (!rawQuery) {

            setQueryMessage(
                "ENTER AN INDICATOR BEFORE SEARCHING."
            );

            queryInput.focus();

            return;
        }


        const detectedType =
            window.NorthstarThreatIntel
                .detectType(
                    rawQuery
                );


        const selectedType =
            typeSelect.value;


        /*
         * Respect manual type selection.
         */

        if (
            selectedType !== "AUTO" &&
            detectedType !== "UNKNOWN" &&
            selectedType !== detectedType
        ) {

            setQueryMessage(
                `TYPE MISMATCH — INPUT APPEARS TO BE ${detectedType}.`
            );

            /*
             * A rejected query must not leave a previous
             * search's result on screen — otherwise it looks
             * like THIS query produced that result.
             */
            currentResult = null;

            persistedResult = null;

            showEmptyState();

            return;
        }


        lookupCount++;

        persistedLookupCount =
            lookupCount;

        lookupCountElement.textContent =
            lookupCount;


        const result =
            window.NorthstarThreatIntel
                .lookup(
                    rawQuery
                );


        addHistory(
            rawQuery,
            result
        );


        if (!result) {

            /*
             * A "no match" outcome must not leave a stale
             * earlier result sitting in currentResult — the
             * on-screen state and the stored state need to
             * agree, especially now that currentResult is
             * what gets restored on reopen.
             */

            currentResult = null;

            persistedResult = null;

            showNoMatch(
                rawQuery
            );

            return;
        }


        currentResult =
            result;

        persistedResult =
            result;


        renderResult(
            result
        );

    }


    /* =====================================================
       RENDER RESULT
    ===================================================== */

    function renderResult(record) {

        emptyState.style.display =
            "none";

        noMatch.style.display =
            "none";

        resultContent.style.display =
            "block";


        resultIndicator.textContent =
            record.indicator;


        resultBadge.textContent =
            record.reputation;


        resultBadge.className =
            "nti-result-badge " +
            getReputationClass(
                record.reputation
            );


        setText(
            "[data-nti-result-type]",
            record.type
        );


        setText(
            "[data-nti-result-reputation]",
            record.reputation
        );


        setText(
            "[data-nti-result-confidence]",
            record.confidence
        );


        setText(
            "[data-nti-result-classification]",
            record.classification
        );


        setText(
            "[data-nti-first-seen]",
            record.firstSeen
        );


        setText(
            "[data-nti-last-seen]",
            record.lastSeen
        );


        setText(
            "[data-nti-campaign]",
            record.campaign
        );


        setText(
            "[data-nti-asn]",
            record.asn
        );


        setText(
            "[data-nti-country]",
            record.country
        );


        setText(
            "[data-nti-notes]",
            record.notes
        );


        renderTags(
            "[data-nti-infrastructure]",
            record.infrastructure
        );


        renderTags(
            "[data-nti-tags]",
            record.tags
        );


        renderRelated(
            record.relatedIndicators
        );


        setQueryMessage(
            "INTELLIGENCE MATCH FOUND."
        );

    }


    /* =====================================================
       NO MATCH
    ===================================================== */

    function showNoMatch(indicator) {

        emptyState.style.display =
            "none";

        resultContent.style.display =
            "none";

        noMatch.style.display =
            "flex";


        resultIndicator.textContent =
            indicator;


        resultBadge.textContent =
            "NO DATA";


        resultBadge.className =
            "nti-result-badge nti-badge-neutral";


        setQueryMessage(
            "NO MATCH — INTELLIGENCE DATABASE RETURNED EMPTY."
        );

    }


    /* =====================================================
       EMPTY
    ===================================================== */

    function showEmptyState() {

        emptyState.style.display =
            "flex";

        resultContent.style.display =
            "none";

        noMatch.style.display =
            "none";


        resultIndicator.textContent =
            "NO INDICATOR QUERIED";


        resultBadge.textContent =
            "STANDBY";


        resultBadge.className =
            "nti-result-badge";

    }


    /* =====================================================
       HISTORY
    ===================================================== */

    function addHistory(
        indicator,
        result
    ) {

        lookupHistory.unshift({

            indicator,

            result:

                result
                    ? result.reputation
                    : "NO DATA",

            time:
                new Date()
                    .toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                        }
                    )

        });


        lookupHistory =
            lookupHistory.slice(
                0,
                8
            );

        persistedHistory =
            lookupHistory;


        renderHistory();

    }


    function renderHistory() {

        if (
            lookupHistory.length === 0
        ) {

            historyContainer.innerHTML = `
                <div class="nti-history-empty">
                    No queries yet.
                </div>
            `;

            return;
        }


        historyContainer.innerHTML =
            lookupHistory
                .map(
                    item => {

                        const reputationClass =
                            getReputationClass(
                                item.result
                            );


                        return `

                            <button
                                class="nti-history-item"
                                data-history-indicator="${escapeHTML(item.indicator)}"
                                type="button"
                            >

                                <div>

                                    <strong>
                                        ${escapeHTML(item.indicator)}
                                    </strong>

                                    <small>
                                        ${escapeHTML(item.time)}
                                    </small>

                                </div>


                                <span
                                    class="${reputationClass}"
                                >
                                    ${escapeHTML(item.result)}
                                </span>

                            </button>

                        `;

                    }
                )
                .join("");


        historyContainer
            .querySelectorAll(
                "[data-history-indicator]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            queryInput.value =
                                button.dataset
                                    .historyIndicator;

                            typeSelect.value =
                                "AUTO";

                            performLookup();

                        }
                    );

                }
            );

    }


    /* =====================================================
       TAGS
    ===================================================== */

    function renderTags(
        selector,
        tags
    ) {

        const element =
            container.querySelector(
                selector
            );


        if (!element) {
            return;
        }


        if (
            !Array.isArray(tags) ||
            tags.length === 0
        ) {

            element.innerHTML = `
                <span class="nti-tag-empty">
                    NONE
                </span>
            `;

            return;
        }


        element.innerHTML =
            tags
                .map(
                    tag =>
                        `
                        <span class="nti-tag">
                            ${escapeHTML(tag)}
                        </span>
                        `
                )
                .join("");

    }


    /* =====================================================
       RELATED INDICATORS
    ===================================================== */

    function renderRelated(
        indicators
    ) {

        const element =
            container.querySelector(
                "[data-nti-related]"
            );


        if (!element) {
            return;
        }


        if (
            !Array.isArray(indicators) ||
            indicators.length === 0
        ) {

            element.innerHTML = `
                <span class="nti-related-empty">
                    No related indicators.
                </span>
            `;

            return;
        }


        element.innerHTML =
            indicators
                .map(
                    indicator =>
                        `
                        <button
                            class="nti-related-indicator"
                            data-related-indicator="${escapeHTML(indicator)}"
                            type="button"
                        >
                            <span>↗</span>
                            ${escapeHTML(indicator)}
                        </button>
                        `
                )
                .join("");


        element
            .querySelectorAll(
                "[data-related-indicator]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            queryInput.value =
                                button.dataset
                                    .relatedIndicator;

                            typeSelect.value =
                                "AUTO";

                            performLookup();

                        }
                    );

                }
            );

    }


    /* =====================================================
       CLEAR HISTORY
    ===================================================== */

    function clearHistory() {

        lookupHistory = [];

        persistedHistory = [];

        renderHistory();

        setQueryMessage(
            "LOOKUP HISTORY CLEARED."
        );

    }


    /* =====================================================
       QUERY MESSAGE
    ===================================================== */

    function setQueryMessage(
        message
    ) {

        const note =
            container.querySelector(
                ".nti-query-note"
            );


        if (note) {

            note.textContent =
                message;

        }

    }


    /* =====================================================
       UTILITY
    ===================================================== */

    function setText(
        selector,
        value
    ) {

        const element =
            container.querySelector(
                selector
            );


        if (element) {

            element.textContent =
                value ?? "—";

        }

    }


    function getReputationClass(
        reputation
    ) {

        const value =
            String(
                reputation || ""
            )
                .toLowerCase();


        if (
            value === "malicious"
        ) {
            return "nti-malicious";
        }


        if (
            value === "suspicious"
        ) {
            return "nti-suspicious";
        }


        if (
            value === "benign"
        ) {
            return "nti-benign";
        }


        return "nti-neutral";

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }


    /* =====================================================
       EVENTS
    ===================================================== */

    lookupButton.addEventListener(
        "click",
        performLookup
    );


    queryInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                performLookup();

            }

        }
    );


    clearHistoryButton.addEventListener(
        "click",
        clearHistory
    );


    /* =====================================================
       EXTERNAL INDICATOR INTEGRATION
       
       Future apps can open/populate Threat Intel with:

       window.dispatchEvent(
           new CustomEvent(
               "northstar:threat-intel-query",
               {
                   detail: {
                       indicator: "185.XX.XX.42"
                   }
               }
           )
       );

       This is how the Malware Sandbox will feed
       indicators into this application.
    ===================================================== */

    function handleExternalQuery(
        event
    ) {

        const indicator =
            event.detail?.indicator;


        if (!indicator) {
            return;
        }


        queryInput.value =
            indicator;


        typeSelect.value =
            "AUTO";


        performLookup();

    }


    window.addEventListener(
        "northstar:threat-intel-query",
        handleExternalQuery
    );


    /* =====================================================
       CLEANUP
    ===================================================== */

    /*
     * The window manager now calls .destroy() on whatever
     * initializeThreatIntel() returns when the window closes
     * — this is what actually plugs that in, instead of the
     * cleanup function just sitting unused.
     */

    function destroy() {

        window.removeEventListener(
            "northstar:threat-intel-query",
            handleExternalQuery
        );

    }

    window.destroyThreatIntel =
        destroy;


    console.log(
        "%c[THREAT INTEL] Intelligence lookup initialized.",
        "color:#6fa8ff;"
    );


    return { destroy };

}


/* =========================================================
   MAKE AVAILABLE TO NORTHSTAR WINDOW MANAGER
   ========================================================= */

window.initializeThreatIntel =
    initializeThreatIntel;