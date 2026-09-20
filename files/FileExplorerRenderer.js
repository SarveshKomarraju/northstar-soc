/* =========================================================
   NORTHSTAR SOC — FILE EXPLORER RENDERER
   File: files/FileExplorerRenderer.js

   Windows 11-inspired File Explorer

   Added:
   - Locked scenario-file handling
   - Suspicious-file investigation view
   - Password-cracker unlock integration

   Existing Explorer layout is otherwise preserved.
   ========================================================= */

export class FileExplorerRenderer {

    constructor(container, store) {

        this.container =
            container;

        this.store =
            store;

        this.unsubscribe =
            null;

        this.view =
            this.store.uiView ||
            "home";

        this.thisPcExpanded =
            false;

        this.boundClick =
            this.handleClick.bind(this);

        this.boundDoubleClick =
            this.handleDoubleClick.bind(this);

        /*
         * Password Cracker dispatches this on window when a
         * linked target is cracked — that's how a locked
         * shared file's icon flips to unlocked without the
         * player having to click something in File Explorer
         * to trigger a re-render.
         */
        this.boundPasswordCracked =
            () => this.render();
    }


    /* =====================================================
       MOUNT
       ===================================================== */

    mount() {

        if (!this.container) {
            return;
        }

        this.container.classList.add(
            "northstar-files"
        );


        this.container.addEventListener(
            "click",
            this.boundClick
        );


        this.container.addEventListener(
            "dblclick",
            this.boundDoubleClick
        );


        window.addEventListener(
            "northstar:password-cracked",
            this.boundPasswordCracked
        );


        this.render();


        this.unsubscribe =
            this.store.subscribe(
                () => this.render()
            );
    }


    destroy() {

        if (this.container) {

            this.container.removeEventListener(
                "click",
                this.boundClick
            );

            this.container.removeEventListener(
                "dblclick",
                this.boundDoubleClick
            );
        }


        window.removeEventListener(
            "northstar:password-cracked",
            this.boundPasswordCracked
        );


        if (this.unsubscribe) {

            this.unsubscribe();

            this.unsubscribe =
                null;
        }
    }


    /* =====================================================
       ROOT
       ===================================================== */

    render() {

        if (!this.container) {
            return;
        }


        const host =
            this.store.getSelectedHost();


        const selectedFile =
            this.store.getSelectedFile();


        /*
         * render() rebuilds the whole shell from innerHTML on
         * every call — including a plain "select this file"
         * click, which happens constantly while browsing a
         * long list. Without this, every click snapped every
         * scrollable pane (the file list especially) straight
         * back to the top. Save each pane's scrollTop before
         * the rebuild and put it back afterward.
         */
        const scrollPositions =
            this.captureScrollPositions();


        this.container.innerHTML = `

            <div class="fx-shell ${selectedFile ? "fx-with-details" : ""}">

                ${this.renderCommandBar()}

                ${this.renderAddressBar(host)}

                <div class="fx-body">

                    ${this.renderSidebar(host)}

                    ${this.renderMain(host)}

                    ${selectedFile
                ? this.renderPropertiesPane(
                    selectedFile
                )
                : ""
            }

                </div>

                ${this.renderStatusBar(host)}

            </div>
        `;


        this.restoreScrollPositions(
            scrollPositions
        );


        this.registerPasswordTargets();
    }


    /**
     * The panes that scroll independently of each other.
     * Selection/state re-renders replace all of their DOM
     * nodes, so their scroll position has to be saved and
     * restored by hand around every render() call.
     */
    static SCROLLABLE_SELECTORS = [
        ".fx-sidebar",
        ".fx-home",
        ".fx-gallery",
        ".fx-this-pc",
        ".fx-list-body",
        ".fx-properties"
    ];

    captureScrollPositions() {

        const positions = {};

        FileExplorerRenderer.SCROLLABLE_SELECTORS.forEach(
            selector => {

                const el =
                    this.container.querySelector(
                        selector
                    );

                if (el) {
                    positions[selector] = el.scrollTop;
                }
            }
        );

        return positions;
    }

    restoreScrollPositions(positions) {

        FileExplorerRenderer.SCROLLABLE_SELECTORS.forEach(
            selector => {

                const saved =
                    positions[selector];

                if (saved == null) {
                    return;
                }

                const el =
                    this.container.querySelector(
                        selector
                    );

                if (el) {
                    el.scrollTop = saved;
                }
            }
        );
    }


    /**
     * Re-tags whichever locked shared-file rows are actually
     * on screen right now as real Password Cracker targets —
     * rebuilding innerHTML every render() means the previous
     * element (and its data-ns-password-target tag) is gone,
     * so this has to run after every render, not just once.
     */
    registerPasswordTargets() {

        const lockedShared =
            this.store.getSharedFiles().filter(
                file => file.locked
            );

        if (!lockedShared.length) {
            return;
        }

        lockedShared.forEach(file => {

            let row = null;

            try {

                row =
                    this.container.querySelector(
                        `[data-file-path="${CSS.escape(file.path)}"]`
                    );

            } catch (error) {
                row = null;
            }

            if (row) {

                this.store.registerFileAsLockTarget(
                    file,
                    row
                );
            }
        });
    }


    /* =====================================================
       COMMAND BAR
       ===================================================== */

    renderCommandBar() {

        return `

            <div class="fx-topbar">

                <button
                    class="fx-nav-button"
                    data-action="go-back"
                    ${this.store.canGoBack()
                ? ""
                : "disabled"
            }
                    title="Back"
                >
                    ‹
                </button>


                <button
                    class="fx-nav-button"
                    data-action="go-forward"
                    ${this.store.canGoForward()
                ? ""
                : "disabled"
            }
                    title="Forward"
                >
                    ›
                </button>


                <button
                    class="fx-nav-button"
                    data-action="go-up"
                    title="Up"
                >
                    ↑
                </button>


                <div class="fx-toolbar-divider"></div>


                <button class="fx-command">
                    <span class="fx-command-icon">＋</span>
                    <span>New</span>
                </button>


                <button class="fx-command">
                    <span class="fx-command-icon">✂</span>
                    <span>Cut</span>
                </button>


                <button class="fx-command">
                    <span class="fx-command-icon">⧉</span>
                    <span>Copy</span>
                </button>


                <button class="fx-command">
                    <span class="fx-command-icon">↗</span>
                    <span>Share</span>
                </button>


                <button class="fx-command">
                    <span class="fx-command-icon">⋯</span>
                    <span>More</span>
                </button>


                ${this.store.hasActiveRansomwareCampaign() ? `

                    <div class="fx-toolbar-divider"></div>

                    <button
                        class="fx-command fx-ransomware-toggle ${this.store.getViewMode() === "RANSOMWARE_HOST" ? "active" : ""}"
                        data-action="toggle-ransomware-view"
                        title="Switch between your PC and the affected host's files"
                    >
                        <span class="fx-command-icon">🖥</span>
                        <span>${this.store.getViewMode() === "RANSOMWARE_HOST" ? "Viewing: Affected Host" : "View Affected Host"}</span>
                    </button>

                ` : ""}

            </div>
        `;
    }


    /* =====================================================
       ADDRESS BAR
       ===================================================== */

    renderAddressBar(host) {

        let breadcrumb = [];

        if (host) {
            breadcrumb =
                this.store.getBreadcrumb();
        }


        const isHome =
            this.view === "home";

        const isGallery =
            this.view === "gallery";

        const isThisPC =
            this.view === "this-pc";

        const isShared =
            this.view === "shared";


        let content = "";


        if (isHome) {

            content = `
                <span class="fx-path-segment current">
                    Home
                </span>
            `;

        } else if (isGallery) {

            content = `
                <span class="fx-path-segment current">
                    Gallery
                </span>
            `;

        } else if (isThisPC) {

            content = `
                <span class="fx-path-segment current">
                    This PC
                </span>
            `;

        } else if (isShared) {

            content = `
                <span class="fx-path-segment current">
                    Shared files
                </span>
            `;

        } else if (host) {

            content =
                breadcrumb.map(
                    (segment, index) => `

                        <button
                            class="fx-path-segment ${index ===
                            breadcrumb.length - 1
                            ? "current"
                            : ""
                        }"
                            data-breadcrumb-index="${index}"
                        >
                            ${this.escapeHtml(segment)}
                        </button>

                        ${index <
                            breadcrumb.length - 1
                            ? `<span class="fx-path-sep">›</span>`
                            : ""
                        }

                    `
                ).join("");

        } else {

            content = `
                <span class="fx-path-segment current">
                    This PC
                </span>
            `;
        }


        return `

            <div class="fx-address-bar">

                <div class="fx-path-field">

                    <span class="fx-path-icon">📁</span>

                    ${content}

                </div>


                <div class="fx-search-field">

                    <span class="fx-search-icon">
                        ⌕
                    </span>

                    <input
                        type="search"
                        placeholder="Search"
                        disabled
                    >

                </div>

            </div>
        `;
    }


    /* =====================================================
       SIDEBAR
       ===================================================== */

    renderSidebar(host) {

        const QUICK_ACCESS_FOLDERS = [
            ["Desktop", "🖥️"],
            ["Documents", "📄️"],
            ["Downloads", "⬇️"],
            ["Pictures", "🖼️"],
            ["Music", "🎵️"],
            ["Videos", "🎞️"]
        ];

        const isThisPcView =
            this.view === "this-pc";

        const thisPcExpanded =
            !!this.thisPcExpanded;

        return `

            <nav class="fx-sidebar">

                <div class="fx-sidebar-section fx-sidebar-top">

                    <button
                        class="fx-sidebar-item ${this.view === "home"
                ? "active"
                : ""
            }"
                        data-view="home"
                    >

                        <span class="fx-sidebar-icon">
                            ⌂
                        </span>

                        <span class="fx-sidebar-label">
                            Home
                        </span>

                    </button>


                    <button
                        class="fx-sidebar-item ${this.view === "gallery"
                ? "active"
                : ""
            }"
                        data-view="gallery"
                    >

                        <span class="fx-sidebar-icon">
                            🖼
                        </span>

                        <span class="fx-sidebar-label">
                            Gallery
                        </span>

                    </button>

                </div>


                <div class="fx-sidebar-section">

                    <div class="fx-sidebar-heading">
                        Quick access
                    </div>


                    <button
                        class="fx-sidebar-item ${this.view === "recent"
                ? "active"
                : ""
            }"
                        data-view="recent"
                    >

                        <span class="fx-sidebar-icon">
                            🕘
                        </span>

                        <span class="fx-sidebar-label">
                            Recent
                        </span>

                    </button>


                    ${QUICK_ACCESS_FOLDERS.map(
                ([name, icon]) => `

                            <button
                                class="fx-sidebar-item"
                                data-quick-folder="${this.escapeAttribute(name)}"
                            >

                                <span class="fx-sidebar-icon">
                                    ${icon}
                                </span>

                                <span class="fx-sidebar-label">
                                    ${name}
                                </span>

                            </button>

                        `
            ).join("")
            }

                </div>


                <div class="fx-sidebar-section">

                    <div class="fx-sidebar-row">

                        <button
                            class="fx-sidebar-toggle"
                            data-action="toggle-this-pc"
                            aria-label="${thisPcExpanded ? "Collapse" : "Expand"} This PC"
                        >

                            <span class="fx-sidebar-arrow ${thisPcExpanded ? "expanded" : ""}">
                                ▸
                            </span>

                        </button>

                        <button
                            class="fx-sidebar-item ${isThisPcView ? "active" : ""}"
                            data-view="this-pc"
                        >

                            <span class="fx-sidebar-icon">
                                💻
                            </span>

                            <span class="fx-sidebar-label">
                                This PC
                            </span>

                        </button>

                    </div>


                    ${thisPcExpanded
                ? `

                                <div class="fx-sidebar-children">

                                    ${QUICK_ACCESS_FOLDERS.map(
                    ([name, icon]) => `

                                            <button
                                                class="fx-sidebar-item fx-sidebar-subitem"
                                                data-quick-folder="${this.escapeAttribute(name)}"
                                            >

                                                <span class="fx-sidebar-icon">
                                                    ${icon}
                                                </span>

                                                <span class="fx-sidebar-label">
                                                    ${name}
                                                </span>

                                            </button>

                                        `
                ).join("")
                }

                                    <button
                                        class="fx-sidebar-item fx-sidebar-subitem"
                                        data-quick-folder="__drive__"
                                    >

                                        <span class="fx-sidebar-icon">
                                            💽
                                        </span>

                                        <span class="fx-sidebar-label">
                                            Local Disk (C:)
                                        </span>

                                    </button>

                                </div>

                            `
                : ""
            }

                </div>


                <div class="fx-sidebar-section">

                    <div class="fx-sidebar-heading">
                        Shared
                    </div>


                    <button
                        class="fx-sidebar-item ${this.view === "shared" ? "active" : ""}"
                        data-view="shared"
                    >

                        <span class="fx-sidebar-icon">
                            🗂
                        </span>

                        <span class="fx-sidebar-label">
                            Shared files
                        </span>

                    </button>

                </div>

            </nav>
        `;
    }


    /* =====================================================
       MAIN VIEW
       ===================================================== */

    renderMain(host) {

        switch (this.view) {

            case "gallery":
                return this.renderGallery();

            case "this-pc":
                return this.renderThisPC();

            case "recent":
                return this.renderRecent();

            case "shared":
                return this.renderSharedFiles();

            case "home":
                return this.renderHome();

            default:
                return this.renderFileSystem(host);
        }
    }


    /* =====================================================
       HOME
       ===================================================== */

    renderHome() {

        const recent =
            this.getRecentFiles(8);


        return `

            <main class="fx-main fx-home">

                <div class="fx-home-title">
                    Home
                </div>


                <section class="fx-section">

                    <div class="fx-section-title">

                        <span>
                            Quick access
                        </span>

                        <span class="fx-section-action">
                            View all
                        </span>

                    </div>


                    <div class="fx-folder-grid">

                        ${this.renderQuickFolder(
            "Desktop",
            "🖥️",
            "Desktop files"
        )}

                        ${this.renderQuickFolder(
            "Documents",
            "📄️",
            "Documents"
        )}

                        ${this.renderQuickFolder(
            "Downloads",
            "⬇️",
            "Downloaded files"
        )}

                        ${this.renderQuickFolder(
            "Pictures",
            "🖼️",
            "Pictures"
        )}

                    </div>

                </section>


                <section class="fx-section">

                    <div class="fx-section-title">

                        <span>
                            Recent
                        </span>

                        <span
                            class="fx-section-action"
                            data-view="recent"
                        >
                            View all
                        </span>

                    </div>


                    <div class="fx-recent-list">

                        <div class="fx-recent-header">
                            <span>Name</span>
                            <span>Location</span>
                            <span>Date modified</span>
                            <span>Size</span>
                        </div>


                        ${recent.length
                ? recent
                    .map(
                        file =>
                            this.renderRecentRow(file)
                    )
                    .join("")
                : `
                                    <div class="fx-home-empty">
                                        No recent files yet.
                                    </div>
                                `
            }

                    </div>

                </section>

            </main>
        `;
    }


    renderQuickFolder(
        name,
        icon,
        description
    ) {

        return `

            <button
                class="fx-folder-card"
                data-quick-folder="${name}"
            >

                <span class="fx-folder-icon">
                    ${icon}
                </span>


                <span class="fx-folder-info">

                    <span class="fx-folder-name">
                        ${name}
                    </span>

                    <span class="fx-folder-meta">
                        ${description}
                    </span>

                </span>

            </button>
        `;
    }


    /* =====================================================
       RECENT
       ===================================================== */

    renderRecent() {

        const recent =
            this.getRecentFiles(50);


        return `

            <main class="fx-main fx-home">

                <div class="fx-home-title">
                    Recent
                </div>


                <div class="fx-recent-list">

                    <div class="fx-recent-header">
                        <span>Name</span>
                        <span>Location</span>
                        <span>Date modified</span>
                        <span>Size</span>
                    </div>


                    ${recent.length
                ? recent
                    .map(
                        file =>
                            this.renderRecentRow(file)
                    )
                    .join("")
                : `
                                <div class="fx-home-empty">
                                    No recent files.
                                </div>
                            `
            }

                </div>

            </main>
        `;
    }


    renderRecentRow(file) {

        const locked =
            file.locked === true;

        const unlocked =
            locked &&
            this.store.isFileUnlocked(file);

        const suspicious =
            file.scenarioType ===
            "suspicious";


        return `

            <button
                class="fx-recent-row ${locked && !unlocked
                ? "fx-scenario-locked"
                : locked && unlocked
                    ? "fx-scenario-unlocked"
                    : suspicious
                        ? "fx-scenario-suspicious"
                        : ""
            }"
                data-file-path="${this.escapeAttribute(file.path)}"
                data-folder-path="${this.escapeAttribute(JSON.stringify(this.folderSegmentsForPath(file.path)))}"
            >

                <span class="fx-recent-name">

                    <span class="fx-recent-icon">
                        ${locked
                ? (unlocked ? "🔓" : "🔒")
                : this.fileIcon(file.name)
            }
                    </span>

                    <span class="fx-recent-name-text">
                        ${this.escapeHtml(file.name)}
                    </span>

                </span>


                <span class="fx-recent-muted">
                    ${this.escapeHtml(file.location || "")}
                </span>


                <span class="fx-recent-muted">
                    ${this.formatShortTime(file.timestamp)}
                </span>


                <span class="fx-recent-muted">
                    ${this.formatBytes(file.size)}
                </span>

            </button>
        `;
    }


    /* =====================================================
       GALLERY
       ===================================================== */

    renderGallery() {

        const images =
            this.getAllFiles()
                .filter(file => {

                    const ext =
                        file.name
                            .split(".")
                            .pop()
                            ?.toLowerCase();

                    return [
                        "jpg",
                        "jpeg",
                        "png",
                        "gif",
                        "webp"
                    ].includes(ext);

                })
                .slice(0, 40);


        return `

            <main class="fx-main fx-gallery">

                <div class="fx-gallery-header">

                    <div class="fx-gallery-title">
                        Gallery
                    </div>


                    <div class="fx-gallery-controls">

                        <button
                            class="fx-gallery-button"
                            title="Grid view"
                        >
                            ▦
                        </button>

                        <button
                            class="fx-gallery-button"
                            title="Details"
                        >
                            ☷
                        </button>

                    </div>

                </div>


                ${images.length
                ? `

                            <div class="fx-gallery-grid">

                                ${images.map(
                    file => `

                                            <button
                                                class="fx-gallery-card"
                                                data-file-path="${this.escapeAttribute(file.path)}"
                                                data-folder-path="${this.escapeAttribute(JSON.stringify(this.folderSegmentsForPath(file.path)))}"
                                            >

                                                <div class="fx-gallery-preview">
                                                    ${file.dataUrl
                        ? `<img src="${file.dataUrl}" alt="" loading="lazy">`
                        : "🖼"
                    }
                                                </div>

                                                <div class="fx-gallery-name">
                                                    ${this.escapeHtml(file.name)}
                                                </div>

                                                <div class="fx-gallery-meta">
                                                    ${this.escapeHtml(file.location || "")}
                                                </div>

                                            </button>

                                        `
                ).join("")
                }

                            </div>

                        `
                : `

                            <div class="fx-gallery-empty">

                                <div class="fx-gallery-empty-icon">
                                    🖼
                                </div>

                                <div class="fx-gallery-empty-title">
                                    No pictures yet
                                </div>

                                <div class="fx-gallery-empty-description">
                                    Images created on monitored endpoints
                                    will appear here automatically.
                                </div>

                            </div>

                        `
            }

            </main>
        `;
    }


    /* =====================================================
       THIS PC
       ===================================================== */

    renderThisPC() {

        const machine =
            this.store.getSelectedHost();

        const tree =
            this.store.getActiveFileTree();

        const count =
            this.countFiles(tree);


        return `

            <main class="fx-main fx-this-pc">

                <div class="fx-home-title">
                    This PC
                </div>


                <section class="fx-section">

                    <div class="fx-section-title">
                        Devices and drives
                    </div>


                    <div class="fx-drive-grid">

                        <button
                            class="fx-drive-card"
                            data-quick-folder="__drive__"
                        >

                            <div class="fx-drive-top">

                                <span class="fx-drive-icon">
                                    💽
                                </span>


                                <span>

                                    <div class="fx-drive-name">
                                        Local Disk (C:)
                                    </div>

                                    <div class="fx-drive-type">
                                        ${this.escapeHtml(
                machine.operatingSystem ||
                "Windows 11"
            )}
                                    </div>

                                </span>

                            </div>


                            <div class="fx-drive-bar">

                                <div
                                    class="fx-drive-fill"
                                    style="width: ${Math.min(
                90,
                count * 4
            )}%"
                                ></div>

                            </div>


                            <div class="fx-drive-storage">

                                <span>
                                    ${count} files
                                </span>

                                <span>
                                    Connected
                                </span>

                            </div>

                        </button>

                    </div>

                </section>

            </main>
        `;
    }


    /* =====================================================
       SHARED FILES
       ---------------------------------------------------
       The deliberate investigation artifacts — files that
       need the Password Cracker, plus the one suspicious
       script — live outside the local machine's own folder
       tree, in a shared evidence location.
       ===================================================== */

    renderSharedFiles() {

        const files =
            this.store.getSharedFiles();

        const selectedFile =
            this.store.getSelectedFile();

        return `

            <main class="fx-main">

                <div class="fx-list-header">

                    <span class="fx-col-name">
                        Name
                    </span>

                    <span class="fx-col-modified">
                        Date modified
                    </span>

                    <span class="fx-col-type">
                        Type
                    </span>

                    <span class="fx-col-size">
                        Size
                    </span>

                </div>


                <div class="fx-list-body">

                    ${files.length
                ? files
                    .map(
                        file =>
                            this.renderListRow(
                                file,
                                selectedFile
                            )
                    )
                    .join("")
                : `

                                <div class="fx-empty-folder">

                                    <div class="fx-empty-folder-icon">
                                        🗂
                                    </div>

                                    <div class="fx-empty-folder-title">
                                        No shared files
                                    </div>

                                </div>

                            `
            }

                </div>

            </main>
        `;
    }


    /* =====================================================
       ACTUAL FILESYSTEM
       ===================================================== */

    renderFileSystem(host) {

        if (!host) {

            this.view =
                "this-pc";

            return this.renderThisPC();
        }


        const folder =
            this.store.getCurrentFolder();


        const selectedFile =
            this.store.getSelectedFile();


        const entries =
            [...(folder?.children || [])]
                .sort(
                    (a, b) => {

                        if (
                            a.type !==
                            b.type
                        ) {

                            return a.type ===
                                "folder"
                                ? -1
                                : 1;
                        }

                        return a.name.localeCompare(
                            b.name
                        );
                    }
                );


        return `

            <main class="fx-main">

                <div class="fx-list-header">

                    <span class="fx-col-name">
                        Name
                    </span>

                    <span class="fx-col-modified">
                        Date modified
                    </span>

                    <span class="fx-col-type">
                        Type
                    </span>

                    <span class="fx-col-size">
                        Size
                    </span>

                </div>


                <div class="fx-list-body">

                    ${entries.length
                ? entries
                    .map(
                        entry =>
                            this.renderListRow(
                                entry,
                                selectedFile
                            )
                    )
                    .join("")
                : `

                                <div class="fx-empty-folder">

                                    <div class="fx-empty-folder-icon">
                                        📁
                                    </div>

                                    <div class="fx-empty-folder-title">
                                        This folder is empty
                                    </div>

                                    <div class="fx-empty-folder-text">
                                        Files created on this endpoint
                                        will appear here.
                                    </div>

                                </div>

                            `
            }

                </div>

            </main>
        `;
    }


    renderListRow(
        entry,
        selectedFile
    ) {

        if (
            entry.type ===
            "folder"
        ) {

            return `

                <button
                    class="fx-row fx-row-folder"
                    data-folder-name="${this.escapeAttribute(entry.name)}"
                >

                    <span class="fx-col-name">

                        <span class="fx-row-icon">
                            📁
                        </span>

                        <span class="fx-col-name-text">
                            ${this.escapeHtml(entry.name)}
                        </span>

                    </span>


                    <span class="fx-col-modified">
                        —
                    </span>


                    <span class="fx-col-type">
                        File folder
                    </span>


                    <span class="fx-col-size">
                        —
                    </span>

                </button>
            `;
        }


        const isSelected =
            selectedFile?.path ===
            entry.path;


        const locked =
            entry.locked === true;


        const unlocked =
            locked &&
            this.store.isFileUnlocked(entry);


        const suspicious =
            entry.scenarioType ===
            "suspicious";


        return `

            <button
                class="
                    fx-row
                    fx-row-file
                    ${isSelected
                ? "selected"
                : ""
            }
                    ${locked && !unlocked
                ? "fx-scenario-locked"
                : ""
            }
                    ${locked && unlocked
                ? "fx-scenario-unlocked"
                : ""
            }
                    ${suspicious
                ? "fx-scenario-suspicious"
                : ""
            }
                "
                data-file-path="${this.escapeAttribute(entry.path)}"
            >

                <span class="fx-col-name">

                    <span class="fx-row-icon">

                        ${locked
                ? (unlocked ? "🔓" : "🔒")
                : entry.isRansomNote
                    ? "📄"
                    : entry.ransomStatus === "ENCRYPTED"
                        ? "🔒"
                        : entry.ransomStatus === "ENCRYPTING"
                            ? "⏳"
                            : entry.ransomStatus === "RECOVERED"
                                ? "✔"
                                : this.fileIcon(entry.name)
            }

                    </span>


                    <span class="fx-col-name-text">
                        ${this.escapeHtml(entry.name)}
                    </span>


                    ${locked
                ? `
                                <span class="fx-badge-pill ${unlocked ? "fx-badge-unlocked" : "fx-badge-locked"}">
                                    ${unlocked ? "UNLOCKED" : "LOCKED"}
                                </span>
                            `
                : suspicious
                    ? `
                                    <span class="fx-badge-pill fx-badge-suspicious">
                                        SUSPICIOUS
                                    </span>
                                `
                    : entry.isRansomNote
                        ? `
                                    <span class="fx-badge-pill fx-badge-ransom">
                                        RANSOM NOTE
                                    </span>
                                `
                        : entry.ransomStatus && entry.ransomStatus !== "NORMAL"
                            ? `
                                    <span class="fx-badge-pill fx-badge-ransom-${entry.ransomStatus.toLowerCase()}">
                                        ${this.ransomStatusLabel(entry.ransomStatus)}
                                    </span>
                                `
                            : ""
            }

                </span>


                <span class="fx-col-modified">
                    ${this.formatShortTime(entry.timestamp)}
                </span>


                <span class="fx-col-type">

                    ${locked
                ? (unlocked ? "Decrypted file" : "Encrypted file")
                : suspicious
                    ? "PowerShell script"
                    : entry.isRansomNote
                        ? "Text Document"
                        : this.fileType(entry.name)
            }

                </span>


                <span class="fx-col-size">
                    ${this.formatBytes(entry.size)}
                </span>

            </button>
        `;
    }


    /* =====================================================
       PROPERTIES
       ===================================================== */

    renderPropertiesPane(file) {

        const risk =
            this.store.computeFileRisk(
                file
            );


        const relatedEvent =
            this.store.getRelatedEvent(
                file
            );


        const relatedAlerts =
            this.store.getAlertsForFile(
                file
            );


        const isLocked =
            file.locked === true;


        const isUnlocked =
            isLocked &&
            this.store.isFileUnlocked(file);


        const isSuspicious =
            file.scenarioType ===
            "suspicious";


        return `

            <aside class="fx-properties">

                <button
                    class="fx-properties-close"
                    data-action="close-properties"
                >
                    ×
                </button>


                <div class="fx-properties-header">

                    <span class="fx-properties-icon">

                        ${isLocked
                ? (isUnlocked ? "🔓" : "🔒")
                : file.isRansomNote
                    ? "📄"
                    : file.ransomStatus === "ENCRYPTED"
                        ? "🔒"
                        : this.fileIcon(file.name)
            }

                    </span>


                    <div class="fx-properties-name">
                        ${this.escapeHtml(file.name)}
                    </div>


                    <span class="fx-risk-badge ${risk.toLowerCase()}">
                        ${risk} RISK
                    </span>

                </div>


                ${isLocked
                ? `

                            <div class="fx-properties-status ${isUnlocked ? "unlocked" : "locked"}">

                                <div class="fx-properties-status-title">
                                    ${isUnlocked ? "🔓 Unlocked" : "🔒 Protected file"}
                                </div>

                                <div class="fx-properties-status-text">
                                    ${isUnlocked
                    ? "This file has been decrypted by the Password Cracker and is ready for further investigation."
                    : "This file is encrypted and cannot be opened normally."
                }
                                </div>

                                ${isUnlocked
                    ? ""
                    : `
                                            <div class="fx-properties-status-action">
                                                Password cracker required
                                            </div>
                                        `
                }

                            </div>

                        `
                : ""
            }


                ${isSuspicious
                ? `

                            <div class="fx-properties-status suspicious">

                                <div class="fx-properties-status-title">
                                    ⚠ Investigation artifact
                                </div>

                                <div class="fx-properties-status-text">
                                    ${this.escapeHtml(
                    file.description ||
                    "Suspicious file requiring investigation."
                )}
                                </div>

                            </div>

                        `
                : ""
            }


                ${file.isCapture && (file.dataUrl || file.blobUrl)
                ? `

                            <div class="fx-properties-capture">

                                ${file.dataUrl && !file.blobUrl
                    ? `<img class="fx-properties-capture-thumb" src="${file.dataUrl}" alt="">`
                    : `<div class="fx-properties-capture-thumb fx-properties-capture-video">🎬</div>`
                }

                                <button class="fx-properties-view-button" data-action="view-capture">
                                    View
                                </button>

                            </div>

                        `
                : ""
            }


                ${file.isRansomNote
                ? `

                            <div class="fx-properties-status ransom">

                                <div class="fx-properties-status-title">
                                    🔒 Ransom note
                                </div>

                                <div class="fx-properties-status-text">
                                    Double-click to open. No real payment address or
                                    instructions are contained in this file — this is a
                                    NORTHSTAR SOC training simulation.
                                </div>

                            </div>

                        `
                : file.isRansomFile
                    ? `

                            <div class="fx-properties-status ransom-file ${(file.ransomStatus || "").toLowerCase()}">

                                <div class="fx-properties-status-title">
                                    ${this.ransomStatusLabel(file.ransomStatus)}
                                </div>

                            </div>

                        `
                    : ""
            }


                <div class="fx-properties-section">

                    <div class="fx-prop-row">
                        <span>Type</span>

                        <span>
                            ${isLocked
                ? (isUnlocked ? "Decrypted file" : "Encrypted file")
                : isSuspicious
                    ? "PowerShell script"
                    : this.fileType(file.name)
            }
                        </span>

                    </div>


                    <div class="fx-prop-row">

                        <span>
                            Location
                        </span>

                        <span class="fx-prop-mono">
                            ${this.escapeHtml(file.path)}
                        </span>

                    </div>


                    <div class="fx-prop-row">

                        <span>
                            Size
                        </span>

                        <span>
                            ${this.formatBytes(file.size)}
                        </span>

                    </div>


                    <div class="fx-prop-row">

                        <span>
                            Created
                        </span>

                        <span>
                            ${this.formatFullTime(file.timestamp)}
                        </span>

                    </div>


                    <div class="fx-prop-row fx-prop-row-hash">

                        <span>
                            SHA-256
                        </span>

                        <span class="fx-prop-hash-value">

                            <span class="fx-prop-mono fx-prop-hash">
                                ${this.escapeHtml(
                file.hash || "—"
            )}
                            </span>

                            ${file.hash
                ? this.renderCopyButton(file.hash, "Copy SHA-256")
                : ""
            }

                        </span>

                    </div>

                </div>


                <div class="fx-properties-divider"></div>


                <div class="fx-properties-subheading">
                    Security
                </div>


                ${relatedEvent
                ? `

                            <div class="fx-sec-event">

                                <div class="fx-sec-event-type">
                                    ${this.escapeHtml(
                    relatedEvent.eventType
                )}
                                </div>

                                <div class="fx-sec-event-message">
                                    ${this.escapeHtml(
                    relatedEvent.message ||
                    "—"
                )}
                                </div>

                            </div>

                        `
                : isSuspicious
                    ? `

                                <div class="fx-sec-event">

                                    <div class="fx-sec-event-type">
                                        SCENARIO ARTIFACT
                                    </div>

                                    <div class="fx-sec-event-message">
                                        ${this.escapeHtml(
                        file.investigationNote ||
                        "Suspicious artifact requires investigation."
                    )}
                                    </div>

                                </div>

                            `
                    : `

                                <div class="fx-sec-empty">
                                    No linked SIEM event.
                                </div>

                            `
            }


                ${relatedAlerts.length
                ? relatedAlerts
                    .map(
                        alert => `

                                    <div class="fx-sec-alert sev-${alert.severity.toLowerCase()}">

                                        <div class="fx-sec-alert-top">

                                            <span>
                                                ${alert.severity}
                                            </span>

                                            <span>
                                                ${alert.status}
                                            </span>

                                        </div>


                                        <div class="fx-sec-alert-title">
                                            ${this.escapeHtml(
                            alert.title
                        )}
                                        </div>


                                        <div class="fx-sec-alert-desc">
                                            ${this.escapeHtml(
                            alert.description
                        )}
                                        </div>

                                    </div>

                                `
                    )
                    .join("")
                : `

                            <div class="fx-sec-empty">
                                ${isSuspicious
                    ? "Investigate this artifact against endpoint and SIEM telemetry."
                    : "No alerts currently associated with this file."
                }
                            </div>

                        `
            }

            </aside>
        `;
    }


    /* =====================================================
       STATUS BAR
       ===================================================== */

    renderStatusBar(host) {

        if (
            !host ||
            this.view !==
            "filesystem"
        ) {

            const tree =
                this.store.getActiveFileTree();

            const totalCount =
                this.countFiles(tree);

            return `

                <div class="fx-status-bar">

                    <span>
                        ${totalCount}
                        item${totalCount === 1 ? "" : "s"}
                    </span>

                </div>

            `;
        }


        const folder =
            this.store.getCurrentFolder();


        const count =
            folder?.children?.length ||
            0;


        const selectedFile =
            this.store.getSelectedFile();


        return `

            <div class="fx-status-bar">

                <span>
                    ${count}
                    item${count === 1 ? "" : "s"}
                </span>


                ${selectedFile
                ? `

                            <span>
                                1 item selected —
                                ${this.formatBytes(
                    selectedFile.size
                )}
                            </span>

                        `
                : ""
            }

            </div>
        `;
    }


    /* =====================================================
       FILE INVESTIGATION
       ===================================================== */

    openSuspiciousFile(file) {

        if (!file) {
            return;
        }

        const existing =
            document.querySelector(".fx-investigate-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "fx-investigate-overlay";

        overlay.innerHTML = `

            <div class="fx-investigate-modal" role="dialog" aria-label="${this.escapeAttribute(file.name)}">

                <div class="fx-investigate-header">

                    <div>
                        <div class="fx-investigate-title">FILE INVESTIGATION</div>
                        <div class="fx-investigate-subtitle">NORTHSTAR SECURITY OPERATIONS CENTER</div>
                    </div>

                    <button class="fx-investigate-close" data-scenario-close>×</button>

                </div>

                <div class="fx-investigate-body">

                    <div class="fx-investigate-file">

                        <div class="fx-investigate-file-icon">⚠</div>

                        <div>
                            <div class="fx-investigate-file-name">${this.escapeHtml(file.name)}</div>
                            <div class="fx-investigate-file-meta">Suspicious PowerShell artifact</div>
                        </div>

                    </div>

                    <div class="fx-investigate-hash-row">

                        <span class="fx-investigate-hash-label">SHA-256</span>

                        <span class="fx-investigate-hash-value">
                            ${this.escapeHtml(file.hash || "—")}
                        </span>

                        ${file.hash
                ? this.renderCopyButton(file.hash, "Copy SHA-256")
                : ""
            }

                    </div>

                    <div class="fx-investigate-block">

                        <div class="fx-investigate-block-label">FILE CONTENT / ANALYST NOTES</div>

                        <pre class="fx-investigate-pre">${this.escapeHtml(
                file.contents ||
                "No readable content."
            )}</pre>

                    </div>

                    <div class="fx-investigate-next">
                        <strong>Next:</strong>
                        correlate this artifact with the endpoint process
                        timeline, SIEM events, network activity, and
                        related email telemetry — or open it directly
                        in the Malware Sandbox for dynamic analysis.
                    </div>

                    <div class="fx-investigate-actions">

                        <button
                            class="fx-investigate-sandbox-button"
                            data-action="open-in-sandbox"
                            data-sandbox-filename="${this.escapeAttribute(file.name)}"
                        >
                            🧪 Open in Malware Sandbox
                        </button>

                    </div>

                </div>

            </div>
        `;

        const close =
            () => overlay.remove();

        /*
         * This overlay is appended straight to document.body —
         * a sibling of the Explorer's own container, not a
         * descendant of it — so clicks here never reach
         * handleClick()'s container-scoped delegation. Handle
         * copy/sandbox-handoff/close directly on the overlay
         * itself instead of relying on that.
         */
        overlay.addEventListener("click", event => {

            const copyButton =
                event.target.closest('[data-action="copy-value"]');

            if (copyButton) {

                this.copyValueToClipboard(
                    copyButton.dataset.copyValue || "",
                    copyButton
                );

                return;
            }

            const sandboxButton =
                event.target.closest('[data-action="open-in-sandbox"]');

            if (sandboxButton) {

                this.handOffToSandbox(
                    sandboxButton.dataset.sandboxFilename || ""
                );

                close();

                return;
            }

            if (
                event.target === overlay ||
                event.target.closest("[data-scenario-close]")
            ) {
                close();
            }
        });

        document.body.appendChild(overlay);
    }


    /**
     * A small, purpose-built viewer for the ransom note —
     * deliberately separate from openSuspiciousFile() above,
     * whose modal is hardcoded around the credential-theft
     * campaign's "PowerShell artifact → Malware Sandbox"
     * workflow and would be actively misleading here. Reuses
     * the same overlay CSS classes for visual consistency.
     */
    openRansomNoteViewer(file) {

        if (!file) {
            return;
        }

        const existing =
            document.querySelector(".fx-investigate-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "fx-investigate-overlay";

        overlay.innerHTML = `

            <div class="fx-investigate-modal" role="dialog" aria-label="${this.escapeAttribute(file.name)}">

                <div class="fx-investigate-header">

                    <div>
                        <div class="fx-investigate-title">RANSOM NOTE</div>
                        <div class="fx-investigate-subtitle">NORTHSTAR SECURITY OPERATIONS CENTER</div>
                    </div>

                    <button class="fx-investigate-close" data-scenario-close>×</button>

                </div>

                <div class="fx-investigate-body">

                    <div class="fx-investigate-file">

                        <div class="fx-investigate-file-icon">🔒</div>

                        <div>
                            <div class="fx-investigate-file-name">${this.escapeHtml(file.name)}</div>
                            <div class="fx-investigate-file-meta">Dropped in the Documents folder</div>
                        </div>

                    </div>

                    <div class="fx-investigate-block">

                        <div class="fx-investigate-block-label">FILE CONTENT</div>

                        <pre class="fx-investigate-pre">${this.escapeHtml(
                file.ransomNoteContents || "No readable content."
            )}</pre>

                    </div>

                    <div class="fx-investigate-next">
                        <strong>Next:</strong>
                        collect this as evidence in Incident Response and correlate it
                        with the endpoint process timeline and C2 network activity.
                    </div>

                </div>

            </div>
        `;

        const close =
            () => overlay.remove();

        overlay.addEventListener("click", event => {

            if (
                event.target === overlay ||
                event.target.closest("[data-scenario-close]")
            ) {
                close();
            }
        });

        document.body.appendChild(overlay);
    }


    showLockedMessage(file) {

        const name =
            file?.name ||
            "Protected file";


        this.showStyledAlert({
            icon: "🔒",
            tone: "locked",
            title: name,
            lines: [
                "This file is encrypted and cannot be opened normally.",
                "Open Password Cracker, select LINK, then click this file again to link it as a crack target."
            ]
        });
    }


    /* =====================================================
       STYLED ALERT
       ---------------------------------------------------
       A themed stand-in for window.alert() — the native
       browser dialog can't be styled at all and looked
       completely out of place next to the rest of the
       Explorer UI. tone picks the accent color; anything
       not recognized falls back to the neutral/info look.
       ===================================================== */

    showStyledAlert({ icon = "ℹ️", tone = "info", title = "", lines = [] }) {

        const existing =
            document.querySelector(".fx-alert-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "fx-alert-overlay";

        overlay.innerHTML = `
            <div class="fx-alert-modal fx-alert-${this.escapeAttribute(tone)}" role="alertdialog" aria-label="${this.escapeAttribute(title)}">
                <div class="fx-alert-icon">${icon}</div>
                <div class="fx-alert-title">${this.escapeHtml(title)}</div>
                <div class="fx-alert-body">
                    ${lines.map(
            line => `<p>${this.escapeHtml(line)}</p>`
        ).join("")}
                </div>
                <button class="fx-alert-ok-button" data-fx-alert-ok>OK</button>
            </div>
        `;

        const close = () => overlay.remove();

        overlay.addEventListener("click", event => {

            if (
                event.target === overlay ||
                event.target.closest("[data-fx-alert-ok]")
            ) {
                close();
            }
        });

        const onKeydown = event => {

            if (event.key === "Escape" || event.key === "Enter") {
                close();
                document.removeEventListener("keydown", onKeydown);
            }
        };

        document.addEventListener("keydown", onKeydown);

        document.body.appendChild(overlay);

        overlay.querySelector("[data-fx-alert-ok]")?.focus();
    }


    /* =====================================================
       COPY TO CLIPBOARD
       ---------------------------------------------------
       Mirrors Mail's renderCopyButton()/copyValueToClipboard()
       pattern — so a hash can be copied straight into Threat
       Intel or Malware Sandbox without hand-selecting text.
       ===================================================== */

    renderCopyButton(value, label = "Copy") {

        const text =
            String(value || "").trim();

        if (!text) {
            return "";
        }

        return `
            <button
                type="button"
                class="fx-copy-button"
                data-action="copy-value"
                data-copy-value="${this.escapeAttribute(text)}"
                title="${this.escapeAttribute(label)}"
                aria-label="${this.escapeAttribute(label)}"
            >⧉</button>
        `;
    }

    copyValueToClipboard(value, buttonElement) {

        const text =
            String(value || "").trim();

        if (!text) {
            return;
        }

        const flashButton = () => {

            if (!buttonElement) {
                return;
            }

            const original =
                buttonElement.innerHTML;

            buttonElement.innerHTML = "✓";

            buttonElement.classList.add("copied");

            setTimeout(() => {

                buttonElement.innerHTML = original;

                buttonElement.classList.remove("copied");

            }, 1200);
        };

        const fallbackCopy = () => {

            try {

                const textarea =
                    document.createElement("textarea");

                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";

                document.body.appendChild(textarea);

                textarea.select();

                document.execCommand("copy");

                textarea.remove();

                return true;

            } catch {

                return false;
            }
        };

        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function"
        ) {

            navigator.clipboard.writeText(text)
                .then(() => {

                    flashButton();

                    this.showCopyToast(`Copied "${text}" to clipboard.`);

                })
                .catch(() => {

                    if (fallbackCopy()) {

                        flashButton();

                        this.showCopyToast(`Copied "${text}" to clipboard.`);

                    } else {

                        this.showCopyToast("Couldn't copy — copy it manually.");
                    }
                });

        } else if (fallbackCopy()) {

            flashButton();

            this.showCopyToast(`Copied "${text}" to clipboard.`);

        } else {

            this.showCopyToast("Couldn't copy — copy it manually.");
        }
    }

    showCopyToast(message) {

        const existing =
            document.querySelector(".fx-copy-toast");

        existing?.remove();

        const toast =
            document.createElement("div");

        toast.className = "fx-copy-toast";
        toast.textContent = message;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("fx-copy-toast-visible");
        });

        setTimeout(() => {

            toast.classList.remove("fx-copy-toast-visible");

            setTimeout(() => toast.remove(), 200);

        }, 2400);
    }


    /* =====================================================
       MALWARE SANDBOX HANDOFF
       ---------------------------------------------------
       Reuses the existing (previously unused) handoff event
       MalwareSandboxApp.js already listens for — same
       openApplication() + delayed-dispatch convention used
       everywhere else in NORTHSTAR (Sandbox → Attack Map,
       etc.), just triggered from File Explorer instead.
       ===================================================== */

    handOffToSandbox(filename) {

        if (!filename) {
            return;
        }

        window.SOCCommandCenter
            ?.openApplication?.("sandbox");

        setTimeout(() => {

            window.dispatchEvent(
                new CustomEvent("northstar:sandbox-select-file", {
                    detail: { filename }
                })
            );

        }, 150);
    }


    /* =====================================================
       DATA HELPERS
       ===================================================== */

    getAllFiles() {

        const tree =
            this.store.getActiveFileTree();

        const output = [];

        this.flattenFiles(
            tree,
            output
        );

        return output.sort(
            (a, b) =>
                new Date(
                    b.timestamp || 0
                ) -
                new Date(
                    a.timestamp || 0
                )
        );
    }


    flattenFiles(
        node,
        output
    ) {

        if (!node) {
            return;
        }


        for (
            const child
            of node.children || []
        ) {

            if (
                child.type ===
                "file"
            ) {

                output.push({

                    ...child,

                    location:
                        this.friendlyLocation(child.path)

                });

            } else {

                this.flattenFiles(
                    child,
                    output
                );
            }
        }
    }


    /**
     * Real folder segments leading to a file — used to jump
     * the browser there when a Recent/Gallery/Home row is
     * clicked, e.g. ["C:", "Users", "analyst", "Desktop"].
     */
    folderSegmentsForPath(filePath) {

        const separator =
            String(filePath || "").includes("\\") ? "\\" : "/";

        const parts =
            String(filePath || "").split(separator).filter(Boolean);

        parts.pop();

        return parts;
    }


    /**
     * Human-friendly folder location for display (Recent /
     * Gallery "Location" column) — the drive letter and the
     * "Users\<name>" prefix are implied on a single-PC
     * explorer, so they're dropped for readability.
     */
    friendlyLocation(filePath) {

        const parts =
            this.folderSegmentsForPath(filePath);

        if (parts[0] && /^[A-Za-z]:$/.test(parts[0])) {
            parts.shift();
        }

        if (parts[0] === "Users") {
            parts.shift();
            parts.shift();
        }

        return parts.length ? parts.join("\\") : "This PC";
    }


    getRecentFiles(
        limit = 20
    ) {

        return this.getAllFiles()
            .slice(
                0,
                limit
            );
    }


    countFiles(node) {

        if (!node) {
            return 0;
        }


        let count = 0;


        for (
            const child
            of node.children || []
        ) {

            if (
                child.type ===
                "file"
            ) {

                count++;

            } else {

                count +=
                    this.countFiles(
                        child
                    );
            }
        }


        return count;
    }


    /* =====================================================
       EVENTS
       ===================================================== */

    handleClick(event) {

        const viewButton =
            event.target.closest(
                "[data-view]"
            );


        if (viewButton) {

            this.view =
                viewButton.dataset.view;


            if (
                this.view === "recent" ||
                this.view === "home" ||
                this.view === "gallery" ||
                this.view === "this-pc" ||
                this.view === "shared"
            ) {

                this.store.state.currentPath =
                    [];

                this.store.state.selectedFilePath =
                    null;
            }


            this.render();

            return;
        }


        const ransomwareToggle =
            event.target.closest(
                '[data-action="toggle-ransomware-view"]'
            );


        if (ransomwareToggle) {

            const nextMode =
                this.store.getViewMode() === "RANSOMWARE_HOST"
                    ? "LOCAL"
                    : "RANSOMWARE_HOST";

            this.store.setViewMode(nextMode);

            this.view =
                "filesystem";

            return;
        }


        const back =
            event.target.closest(
                '[data-action="go-back"]'
            );


        if (
            back &&
            !back.disabled
        ) {

            this.store.goBack();

            this.view =
                "filesystem";

            return;
        }


        const forward =
            event.target.closest(
                '[data-action="go-forward"]'
            );


        if (
            forward &&
            !forward.disabled
        ) {

            this.store.goForward();

            this.view =
                "filesystem";

            return;
        }


        const up =
            event.target.closest(
                '[data-action="go-up"]'
            );


        if (up) {

            if (
                this.store.state.currentPath.length
            ) {

                this.view =
                    "filesystem";

                this.store.navigateToBreadcrumb(
                    this.store.state.currentPath.length - 1
                );
            }

            return;
        }


        const closeProps =
            event.target.closest(
                '[data-action="close-properties"]'
            );


        if (closeProps) {

            this.store.selectFile(
                null
            );

            return;
        }


        const copyButton =
            event.target.closest(
                '[data-action="copy-value"]'
            );

        if (copyButton) {

            this.copyValueToClipboard(
                copyButton.dataset.copyValue || "",
                copyButton
            );

            return;
        }


        const openInSandbox =
            event.target.closest(
                '[data-action="open-in-sandbox"]'
            );

        if (openInSandbox) {

            this.handOffToSandbox(
                openInSandbox.dataset.sandboxFilename || ""
            );

            return;
        }


        const viewCapture =
            event.target.closest(
                '[data-action="view-capture"]'
            );


        if (viewCapture) {

            const file =
                this.store.getSelectedFile();

            if (file) {
                this.openMediaViewer(file);
            }

            return;
        }


        const thisPcToggle =
            event.target.closest(
                '[data-action="toggle-this-pc"]'
            );


        if (thisPcToggle) {

            this.thisPcExpanded =
                !this.thisPcExpanded;

            this.render();

            return;
        }


        const quickFolder =
            event.target.closest(
                "[data-quick-folder]"
            );


        if (quickFolder) {

            this.view =
                "filesystem";


            const name =
                quickFolder.dataset.quickFolder;


            if (name === "__drive__") {

                this.store.navigateToDriveRoot();

            } else {

                this.store.navigateToUserFolder(name);
            }

            return;
        }


        const crumb =
            event.target.closest(
                "[data-breadcrumb-index]"
            );


        if (crumb) {

            this.view =
                "filesystem";


            this.store.navigateToBreadcrumb(
                Number(
                    crumb.dataset.breadcrumbIndex
                )
            );

            return;
        }


        const fileRow =
            event.target.closest(
                "[data-file-path]"
            );


        if (fileRow) {

            const filePath =
                fileRow.dataset.filePath;


            /*
             * Rows from Recent/Gallery/Home carry the real
             * folder they live in (the file browser view
             * itself doesn't need this — it's already there).
             */
            const folderPathRaw =
                fileRow.dataset.folderPath;


            if (folderPathRaw) {

                try {

                    this.store.state.currentPath =
                        JSON.parse(folderPathRaw);

                } catch (error) {
                    /* Malformed — just leave the current path alone. */
                }
            }


            /*
             * Find the actual file object before selecting it
             * — a shared investigation artifact first (it
             * lives outside the local machine's folder tree),
             * otherwise whatever's in the currently browsed
             * folder.
             */
            const sharedFile =
                this.store.getSharedFiles().find(
                    file => file.path === filePath
                );


            const folder =
                this.store.getCurrentFolder();


            const file =
                sharedFile ||
                folder?.children.find(
                    child =>
                        child.type ===
                        "file" &&
                        child.path ===
                        filePath
                );


            if (file?.locked && !this.store.isFileUnlocked(file)) {

                this.store.selectFile(
                    filePath
                );

                this.showLockedMessage(
                    file
                );

                return;
            }


            this.store.selectFile(
                filePath
            );

            return;
        }
    }


    handleDoubleClick(event) {

        const folder =
            event.target.closest(
                "[data-folder-name]"
            );


        if (folder) {

            this.view =
                "filesystem";


            this.store.navigateInto(
                folder.dataset.folderName
            );

            return;
        }


        /*
         * Double-clicking a locked file must NEVER open it.
         */
        const fileElement =
            event.target.closest(
                "[data-file-path]"
            );


        if (!fileElement) {
            return;
        }


        const filePath =
            fileElement.dataset.filePath;


        /*
         * Rows from Recent/Gallery carry the real folder the
         * file lives in — sync it first, same as handleClick,
         * or a double-click there can't find the file at all.
         */
        const folderPathRaw =
            fileElement.dataset.folderPath;

        if (folderPathRaw) {

            try {

                this.store.state.currentPath =
                    JSON.parse(folderPathRaw);

            } catch (error) {
                /* Malformed — just leave the current path alone. */
            }
        }


        const sharedFile =
            this.store.getSharedFiles().find(
                file => file.path === filePath
            );


        const currentFolder =
            this.store.getCurrentFolder();


        const file =
            sharedFile ||
            currentFolder?.children.find(
                child =>
                    child.type ===
                    "file" &&
                    child.path ===
                    filePath
            );


        if (!file) {
            return;
        }


        if (file.locked && !this.store.isFileUnlocked(file)) {

            this.showLockedMessage(
                file
            );

            return;
        }


        /*
         * BUGFIX: a locked file that's already been cracked in
         * Password Cracker used to fall straight through this
         * whole method with no matching branch below — the
         * reveal modal only ever fired once, at the moment of
         * cracking (FileExplorerStore's unlock callback), so
         * double-clicking the file again afterward silently did
         * nothing. revealUnlockedFile() re-shows the same reveal
         * on demand.
         */
        if (file.locked && this.store.isFileUnlocked(file)) {

            this.store.revealUnlockedFile(
                file
            );

            return;
        }


        if (
            file.scenarioType ===
            "suspicious"
        ) {

            this.openSuspiciousFile(
                file
            );

            return;
        }


        if (file.isRansomNote) {

            this.openRansomNoteViewer(
                file
            );

            return;
        }


        /*
         * Screenshots/recordings taken with the in-game
         * capture tool are real media sitting in memory —
         * open them straight up instead of doing nothing.
         */
        if (file.isCapture && (file.dataUrl || file.blobUrl)) {

            this.openMediaViewer(
                file
            );

            return;
        }
    }


    /* =====================================================
       MEDIA VIEWER (screenshots / recordings)
       ---------------------------------------------------
       For files the player captured themselves (Ctrl+Shift+S
       / Ctrl+Shift+R, or the on-screen capture buttons) — the
       image/video already exists locally, no generation step.
       ===================================================== */

    openMediaViewer(file) {

        const existing =
            document.querySelector(".fx-media-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "fx-media-overlay";

        const isVideo =
            file.mimeType?.startsWith("video/") ||
            !!file.blobUrl;

        const source =
            file.blobUrl || file.dataUrl;

        overlay.innerHTML = `
            <div class="fx-media-modal" role="dialog" aria-label="${this.escapeAttribute(file.name)}">
                <div class="fx-media-header">
                    <h2>${this.escapeHtml(file.name)}</h2>
                    <button class="fx-media-close" data-media-close>×</button>
                </div>
                <div class="fx-media-body">
                    ${isVideo
                ? `<video class="fx-media-video" src="${source}" controls autoplay></video>`
                : `<img class="fx-media-image" src="${source}" alt="${this.escapeAttribute(file.name)}">`
            }
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {

            overlay.querySelector("video")?.pause();

            overlay.remove();
        };

        overlay.querySelector("[data-media-close]")
            ?.addEventListener("click", close);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                close();
            }
        });
    }


    /* =====================================================
       ICONS
       ===================================================== */

    hostIcon(host) {

        const os =
            String(
                host?.operatingSystem ||
                ""
            ).toLowerCase();


        if (
            os.includes(
                "server"
            )
        ) {
            return "🖥";
        }


        if (
            String(
                host?.type ||
                ""
            )
                .toLowerCase()
                .includes(
                    "laptop"
                )
        ) {
            return "💻";
        }


        return "🖥";
    }


    ransomStatusLabel(status) {

        const labels = {
            NORMAL: "Normal",
            TARGETED: "⚠ Targeted",
            ENCRYPTING: "⏳ Encrypting…",
            ENCRYPTED: "🔒 Encrypted",
            RECOVERING: "↻ Restoring…",
            RECOVERED: "✔ Recovered"
        };

        return labels[status] || status || "Normal";
    }

    fileIcon(name) {

        const ext =
            String(name)
                .split(".")
                .pop()
                ?.toLowerCase();


        const iconMap = {

            exe: "⚙",
            dll: "⚙",
            bat: "⚙",
            sh: "⚙",
            ps1: "⚙",

            py: "🐍",

            docx: "📄",
            pdf: "📄",
            txt: "📄",
            md: "📄",

            xlsx: "📊",
            pptx: "📊",

            jpg: "🖼",
            jpeg: "🖼",
            png: "🖼",
            gif: "🖼",
            webp: "🖼",

            webm: "🎬",
            mp4: "🎬",

            log: "🧾",
            yaml: "🧾",
            xml: "🧾",
            tmp: "🧾",
            dat: "🧾",

            zip: "🗜",
            gz: "🗜",
            kdbx: "🔐"

        };


        return (
            iconMap[ext] ||
            "📄"
        );
    }


    fileType(name) {

        const ext =
            String(name)
                .split(".")
                .pop()
                ?.toLowerCase();


        const typeMap = {

            exe: "Application",
            dll: "Application extension",
            bat: "Batch file",
            sh: "Shell script",
            ps1: "PowerShell script",
            py: "Python file",

            docx: "Word Document",
            pdf: "PDF Document",
            txt: "Text Document",
            md: "Markdown Document",

            xlsx: "Excel Worksheet",
            pptx: "PowerPoint Presentation",

            jpg: "JPEG image",
            jpeg: "JPEG image",
            png: "PNG image",
            gif: "GIF image",
            webp: "WebP image",

            webm: "WebM video",
            mp4: "MP4 video",

            log: "Log file",
            yaml: "YAML file",
            xml: "XML Document",
            tmp: "Temporary file",
            dat: "Data file",

            zip: "ZIP archive",
            gz: "Compressed archive",
            kdbx: "Encrypted database"

        };


        return (
            typeMap[ext] ||
            `${(ext || "").toUpperCase()} File`
        );
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    formatBytes(bytes) {

        const size =
            Number(bytes);


        if (
            !Number.isFinite(size)
        ) {
            return "—";
        }


        if (
            size < 1024
        ) {
            return `${size} bytes`;
        }


        if (
            size <
            1024 * 1024
        ) {
            return `${(
                size / 1024
            ).toFixed(0)} KB`;
        }


        return `${(
            size /
            (1024 * 1024)
        ).toFixed(1)} MB`;
    }


    formatShortTime(
        isoString
    ) {

        if (!isoString) {
            return "—";
        }


        const date =
            new Date(
                isoString
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }


        return date.toLocaleString(
            [],
            {
                month: "numeric",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );
    }


    formatFullTime(
        isoString
    ) {

        if (!isoString) {
            return "—";
        }


        const date =
            new Date(
                isoString
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(
                isoString
            );
        }


        return date.toLocaleString(
            [],
            {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
            }
        );
    }


    /* =====================================================
       SAFETY
       ===================================================== */

    escapeHtml(value) {

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


    escapeAttribute(value) {

        return this.escapeHtml(
            value
        );
    }
}