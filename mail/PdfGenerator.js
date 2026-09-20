/* =========================================================
   NORTHSTAR SOC — MAIL PDF GENERATOR
   File: mail/PdfGenerator.js

   Purpose:
   Generates a REAL PDF file in the browser from a simple
   { title, subtitle, sections: [{heading, body}] } spec.

   CHANGED: this module only BUILDS the PDF and returns a
   Blob — it does not try to open a popup window. Popup
   windows opened after an async dynamic import are silently
   blocked by most browsers (window.open only works when
   called synchronously inside the original click handler),
   which is why PDFs weren't appearing. MailRenderer now
   renders the result inline in an in-app modal instead,
   which sidesteps popup blockers entirely.

   Uses jsPDF vendored locally at ./vendor/jspdf.umd.min.js
   (jsPDF 2.5.2, UMD build) instead of importing it from a
   CDN at runtime. It used to be dynamically imported from
   cdn.jsdelivr.net, which meant the finance-document viewer
   simply failed ("Couldn't generate this document") for
   anyone without live internet access to that specific CDN.
   Same fix pattern as capture/vendor/html2canvas.min.js —
   vendor the library alongside the code that uses it so the
   game has no runtime dependency on any external host.

   The UMD build (rather than jsPDF's npm ESM build) is used
   on purpose: jsPDF's published ESM bundle has bare-specifier
   imports of its own (`@babel/runtime/helpers/typeof`,
   `fflate`) that only resolve under a bundler, so it can't be
   loaded directly by the browser as a plain module file the
   way html2canvas's UMD build can. The UMD build has no such
   dependency — it's a single self-contained file that defines
   `window.jspdf.jsPDF` — so it's loaded here via a dynamically
   injected <script> tag instead of `import()`. This keeps the
   original behavior of only fetching/evaluating the library
   the first time a PDF is actually built, and only ever loads
   it once (subsequent calls reuse the same resolved promise).
   ========================================================= */

let jsPDFReadyPromise = null;

function loadJsPDF() {

    if (!jsPDFReadyPromise) {

        jsPDFReadyPromise = new Promise((resolve, reject) => {

            if (window.jspdf && window.jspdf.jsPDF) {
                resolve(window.jspdf);
                return;
            }

            const script =
                document.createElement("script");

            script.src =
                new URL("./vendor/jspdf.umd.min.js", import.meta.url).href;

            script.onload = () => {

                if (window.jspdf && window.jspdf.jsPDF) {
                    resolve(window.jspdf);
                } else {
                    reject(new Error(
                        "jsPDF vendor script loaded but window.jspdf.jsPDF is missing."
                    ));
                }
            };

            script.onerror = () => {
                reject(new Error(
                    "Failed to load vendored jsPDF script (mail/vendor/jspdf.umd.min.js)."
                ));
            };

            document.head.appendChild(script);
        });
    }

    return jsPDFReadyPromise;
}

/**
 * Build a real PDF from a document spec.
 *
 * @param {Object} pdfContent
 * @param {string} pdfContent.title
 * @param {string} [pdfContent.subtitle]
 * @param {Array<{heading: string, body: string}>} [pdfContent.sections]
 * @returns {Promise<{ blob: Blob, blobUrl: string }>}
 */
export async function buildReviewPdf(pdfContent) {

    if (!pdfContent) {
        throw new Error("buildReviewPdf: no pdfContent provided.");
    }

    const { jsPDF } =
        await loadJsPDF();

    const doc =
        new jsPDF({ unit: "pt", format: "letter" });

    const marginX = 56;

    const pageWidth =
        doc.internal.pageSize.getWidth();

    const pageHeight =
        doc.internal.pageSize.getHeight();

    const maxWidth =
        pageWidth - (marginX * 2);

    let y = 72;

    /*
     * Explicit page background. Without this, the page has NO
     * fill object at all — it's just "nothing drawn," which
     * PDF viewers treat as transparent/white by default. But
     * Chrome's built-in PDF viewer applies its own automatic
     * dark-mode heuristic (keyed off the OS/browser theme), and
     * that heuristic inverts colors per-object based on their
     * own luminance rather than needing an explicit background
     * to key off — a page with no real background object plus
     * light/medium-gray text (anything pushing toward white)
     * confuses that heuristic into inverting some text but not
     * others, which is exactly what reads as "some words are
     * whited out." Painting a real, explicit white rectangle
     * behind every page gives the heuristic something concrete
     * and light to invert consistently, so text doesn't get
     * treated as background.
     */
    function paintPageBackground() {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
    }

    paintPageBackground();

    function ensureSpace(neededHeight) {

        if (y + neededHeight > pageHeight - 56) {
            doc.addPage();
            paintPageBackground();
            y = 72;
        }
    }

    /* Title */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(20, 20, 20);
    ensureSpace(28);
    doc.text(pdfContent.title || "Document", marginX, y);
    y += 26;

    /*
     * Subtitle — kept dark enough to stay clearly on the "dark
     * text" side of any dark-mode inversion heuristic. The old
     * 110/110/110 sat close enough to the middle of the range
     * to be exactly the kind of tone these heuristics get wrong.
     */
    if (pdfContent.subtitle) {

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(90, 90, 90);
        ensureSpace(16);
        doc.text(pdfContent.subtitle, marginX, y);
        doc.setTextColor(20, 20, 20);
        y += 22;
    }

    /* Divider */
    doc.setDrawColor(190, 190, 190);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 24;

    /* Sections */
    const sections =
        Array.isArray(pdfContent.sections)
            ? pdfContent.sections
            : [];

    sections.forEach(section => {

        ensureSpace(24);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(20, 20, 20);
        doc.text(section.heading || "", marginX, y);
        y += 18;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(40, 40, 40);

        const lines =
            doc.splitTextToSize(section.body || "", maxWidth);

        lines.forEach(line => {

            ensureSpace(15);
            doc.text(line, marginX, y);
            y += 15;
        });

        y += 16;
    });

    /* Footer on every page */
    const pageCount =
        doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {

        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(115, 115, 115);
        doc.text(
            `NORTHSTAR INC. — SIMULATED DOCUMENT — Page ${i} of ${pageCount}`,
            marginX,
            pageHeight - 30
        );
    }

    const blob =
        doc.output("blob");

    const blobUrl =
        URL.createObjectURL(blob);

    return { blob, blobUrl };
}