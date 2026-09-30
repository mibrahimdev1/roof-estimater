import PDFDocument from "pdfkit";
import {
    buildMaterialEstimateGroups,
    buildPitchSummaryColumns,
    buildWasteSummaryColumns,
    manufacturerDisplay,
    pickPricingScenarioKey,
    selectedBrandsFromInput,
    shingleStyleLabel
} from "./reportHelpers.js";
import { MATERIAL_ESTIMATE_DISCLAIMER } from "../constants/reportNotes.js";
import { buildPricingExportRows, unitPriceForRow } from "./reportPricing.js";

const MARGIN = 48;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TABLE_GAP = 6;
const SECTION_GAP = 14;

const SUMMARY_HEADER_FILL = "#e8eef4";
const SUMMARY_HEADER_TEXT = "#2563eb";
const SUMMARY_RECOMMENDED_FILL = "#dbeafe";
const SUMMARY_BORDER = "#cbd5e1";

function money(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return `$${n.toFixed(2)}`;
}

function fmt(n, suffix = "") {
    if (n === undefined || n === null || Number.isNaN(n)) return "—";
    if (typeof n === "number") return `${Number.isInteger(n) ? n : n.toFixed(2)}${suffix}`;
    return String(n) + suffix;
}

function complexityLabel(v, roofType) {
    if (roofType === "flat") {
        const m = { low: "Low", medium: "Medium", high: "High" };
        return m[v] || v || "—";
    }
    const m = { low: "Simple (gable)", medium: "Medium", high: "Complex (valleys, cuts)" };
    return m[v] || v || "—";
}

function sectionTitle(doc, y, title) {
    // Keep heading with at least the next line — do not reserve space for whole tables.
    y = ensurePageSpace(doc, y, 36);
    doc.save();
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#1e3a5f");
    doc.text(title, MARGIN, y);
    doc.restore();
    return y + 14;
}

function textBlockHeight(doc, text, width, fontSize = 9) {
    doc.font("Helvetica").fontSize(fontSize);
    return doc.heightOfString(String(text ?? ""), { width: Math.max(1, width) });
}

function ensurePageSpace(doc, y, needed) {
    const bottomLimit = doc.page.height - MARGIN;
    if (y + needed > bottomLimit) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

function pageBottom(doc) {
    return doc.page.height - MARGIN;
}

const CATEGORY_ROW_FILL = "#e0e7ff";
const DATA_ROW_FILL = "#ffffff";

function drawTable(doc, startY, { headers, colWidths, rows, rowHeight = 20, headerHeight = 22 }) {
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    let y = startY;
    const cellPaddingX = 5;
    const cellPaddingY = 5;

    doc.font("Helvetica-Bold").fontSize(9);
    const computedHeaderHeight = Math.max(
        headerHeight,
        ...headers.map((h, i) =>
            doc.heightOfString(String(h ?? "—"), { width: Math.max(1, colWidths[i] - cellPaddingX * 2) }) + cellPaddingY * 2
        )
    );

    function drawHeaderRow() {
        if (y + computedHeaderHeight > pageBottom(doc)) {
            doc.addPage();
            y = MARGIN;
        }
        doc.save();
        doc.rect(MARGIN, y, totalW, computedHeaderHeight).fill("#1e3a5f");
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
        let x = MARGIN;
        headers.forEach((h, i) => {
            doc.text(h, x + cellPaddingX, y + cellPaddingY, { width: colWidths[i] - cellPaddingX * 2 });
            x += colWidths[i];
        });
        doc.restore();
        y += computedHeaderHeight;
    }

    drawHeaderRow();

    doc.font("Helvetica").fontSize(9);
    rows.forEach((row) => {
        const cells = Array.isArray(row) ? row : row.cells;
        const categoryHeader = !Array.isArray(row) && row.categoryHeader === true;
        // Measure with the same font weight used for rendering, otherwise bold
        // category rows wrap to more lines than reserved and get cut/overlapped.
        doc.font(categoryHeader ? "Helvetica-Bold" : "Helvetica").fontSize(9);
        const computedRowHeight = Math.max(
            rowHeight,
            ...cells.map((cell, ci) =>
                doc.heightOfString(String(cell ?? "—"), { width: Math.max(1, colWidths[ci] - cellPaddingX * 2) }) + cellPaddingY * 2
            )
        );

        if (y + computedRowHeight > pageBottom(doc)) {
            doc.addPage();
            y = MARGIN;
        }

        const fill = categoryHeader ? CATEGORY_ROW_FILL : DATA_ROW_FILL;
        doc.save();
        doc.rect(MARGIN, y, totalW, computedRowHeight).fill(fill);
        doc.strokeColor("#cbd5e1").lineWidth(0.5);
        doc.rect(MARGIN, y, totalW, computedRowHeight).stroke();
        doc.fillColor(categoryHeader ? "#1e3a5f" : "#0f172a");
        if (categoryHeader) {
            doc.font("Helvetica-Bold").fontSize(9);
        } else {
            doc.font("Helvetica").fontSize(9);
        }

        let x = MARGIN;
        cells.forEach((cell, ci) => {
            doc.rect(x, y, colWidths[ci], computedRowHeight).stroke();
            doc.text(String(cell ?? "—"), x + cellPaddingX, y + cellPaddingY, {
                width: colWidths[ci] - cellPaddingX * 2
            });
            x += colWidths[ci];
        });
        doc.restore();
        y += computedRowHeight;
    });

    return y + TABLE_GAP;
}

/**
 * Compact Pitch / Waste % summary grids matching client layout.
 */
function drawMetricGridTable(doc, startY, { rowLabelHeader, columnHeaders, dataRows, highlightColIndex = -1, showRecommendedLabel = false }) {
    const labelColW = CONTENT_WIDTH * 0.18;
    const dataColCount = Math.max(1, columnHeaders.length);
    const dataColW = (CONTENT_WIDTH - labelColW) / dataColCount;
    const colWidths = [labelColW, ...Array.from({ length: dataColCount }, () => dataColW)];
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const cellPadX = 4;
    const cellPadY = 4;
    const rowH = 18;
    const headerH = 20;
    let y = startY;

    if (showRecommendedLabel && highlightColIndex >= 0) {
        if (y + 12 > pageBottom(doc)) {
            doc.addPage();
            y = MARGIN;
        }
        const recX = MARGIN + labelColW + highlightColIndex * dataColW;
        doc.font("Helvetica-Bold").fontSize(8).fillColor(SUMMARY_HEADER_TEXT);
        doc.text("Recommended", recX, y, { width: dataColW, align: "center" });
        y += 12;
    }

    function drawGridHeaderRow() {
        if (y + headerH > pageBottom(doc)) {
            doc.addPage();
            y = MARGIN;
        }
        doc.save();
        doc.rect(MARGIN, y, totalW, headerH).fill(SUMMARY_HEADER_FILL);
        doc.strokeColor(SUMMARY_BORDER).lineWidth(0.5);
        doc.rect(MARGIN, y, totalW, headerH).stroke();
        doc.font("Helvetica-Bold").fontSize(9).fillColor(SUMMARY_HEADER_TEXT);

        let x = MARGIN;
        doc.text(rowLabelHeader, x + cellPadX, y + cellPadY, { width: colWidths[0] - cellPadX * 2 });
        doc.rect(x, y, colWidths[0], headerH).stroke();
        x += colWidths[0];

        columnHeaders.forEach((h, i) => {
            if (highlightColIndex === i) {
                doc.rect(x, y, colWidths[i + 1], headerH).fill(SUMMARY_RECOMMENDED_FILL);
            }
            doc.fillColor(SUMMARY_HEADER_TEXT);
            doc.text(h, x + cellPadX, y + cellPadY, { width: colWidths[i + 1] - cellPadX * 2, align: "center" });
            doc.strokeColor(SUMMARY_BORDER).rect(x, y, colWidths[i + 1], headerH).stroke();
            x += colWidths[i + 1];
        });
        doc.restore();
        y += headerH;
    }

    drawGridHeaderRow();

    doc.font("Helvetica").fontSize(9);
    for (const row of dataRows) {
        if (y + rowH > pageBottom(doc)) {
            doc.addPage();
            y = MARGIN;
        }

        let x = MARGIN;
        doc.save();
        doc.rect(MARGIN, y, totalW, rowH).fill("#ffffff");
        doc.strokeColor(SUMMARY_BORDER).lineWidth(0.5);
        doc.rect(MARGIN, y, totalW, rowH).stroke();

        doc.fillColor("#0f172a");
        doc.text(row.label, x + cellPadX, y + cellPadY, { width: colWidths[0] - cellPadX * 2 });
        doc.rect(x, y, colWidths[0], rowH).stroke();
        x += colWidths[0];

        row.values.forEach((val, i) => {
            if (highlightColIndex === i) {
                doc.rect(x, y, colWidths[i + 1], rowH).fill(SUMMARY_RECOMMENDED_FILL);
            }
            doc.fillColor("#0f172a");
            doc.text(String(val ?? "—"), x + cellPadX, y + cellPadY, {
                width: colWidths[i + 1] - cellPadX * 2,
                align: "center"
            });
            doc.strokeColor(SUMMARY_BORDER).rect(x, y, colWidths[i + 1], rowH).stroke();
            x += colWidths[i + 1];
        });
        doc.restore();
        y += rowH;
    }

    return y + TABLE_GAP;
}

function renderPitchWasteSummary(doc, y, { roof, sectionMeta }) {
    const pitchCols = buildPitchSummaryColumns(roof, sectionMeta);
    if (!pitchCols.length) return y;

    const wasteSummary = buildWasteSummaryColumns(sectionMeta);

    y = drawMetricGridTable(doc, y, {
        rowLabelHeader: "Pitch",
        columnHeaders: pitchCols.map((c) => c.label),
        dataRows: [
            { label: "Area (sqft)", values: pitchCols.map((c) => c.areaDisplay) },
            { label: "Squares", values: pitchCols.map((c) => c.squaresDisplay) }
        ]
    });

    y += 4;

    y = drawMetricGridTable(doc, y, {
        rowLabelHeader: "Waste %",
        columnHeaders: wasteSummary.columns.map((c) => c.label),
        dataRows: [
            { label: "Area (sqft)", values: wasteSummary.columns.map((c) => c.areaDisplay) },
            { label: "Squares", values: wasteSummary.columns.map((c) => c.squaresDisplay) }
        ],
        highlightColIndex: wasteSummary.recommendedIdx,
        showRecommendedLabel: wasteSummary.recommendedIdx >= 0
    });

    return y + SECTION_GAP;
}

function renderEstimateTable(doc, y, { title, roofType, sectionMeta, lengths, recommendations, selectedBrands, requestPriceOverrides }) {
    const { scenarios, groups } = buildMaterialEstimateGroups({
        roofType,
        sectionMeta,
        recommendations,
        lengths,
        selectedBrands,
        wasteColumnMode: "multi"
    });

    // Client: omit empty pitched/flat sections entirely (no brand-mismatch notice).
    if (!groups.length) {
        return y;
    }

    y += SECTION_GAP;
    y = sectionTitle(doc, y, title);

    if (roofType !== "pitched") {
        const suggestedWf = Number(sectionMeta?.suggestedWasteFactor ?? sectionMeta?.wasteFactor ?? 0);
        const cf = sectionMeta?.wasteCustomFactor;
        const customNote =
            cf != null && Number.isFinite(Number(cf))
                ? ` · Custom waste override: ${(Number(cf) * 100).toFixed(2)}%`
                : "";
        const subtitle = `System: ${sectionMeta?.flatSystem || "—"} · Suggested waste (model): ${(suggestedWf * 100).toFixed(2)}%${customNote}`;

        doc.font("Helvetica").fontSize(9).fillColor("#334155");
        doc.text(subtitle, MARGIN, y, { width: CONTENT_WIDTH });
        y += textBlockHeight(doc, subtitle, CONTENT_WIDTH) + 4;
    }

    const priceScenarioKey = pickPricingScenarioKey(sectionMeta, scenarios);

    const headers = ["Product", "Unit", "Basis", ...scenarios.map((s) => s.label), "Unit price", "Line total"];
    const scenarioCount = scenarios.length;
    const fixedProduct = CONTENT_WIDTH * 0.24;
    const fixedUnit = CONTENT_WIDTH * 0.08;
    const fixedBasis = CONTENT_WIDTH * 0.12;
    const fixedUnitPrice = CONTENT_WIDTH * 0.09;
    const fixedLineTotal = CONTENT_WIDTH * 0.09;
    const scenarioWidth = (CONTENT_WIDTH - fixedProduct - fixedUnit - fixedBasis - fixedUnitPrice - fixedLineTotal) / Math.max(1, scenarioCount);
    const colWidths = [
        fixedProduct,
        fixedUnit,
        fixedBasis,
        ...Array.from({ length: scenarioCount }, () => scenarioWidth),
        fixedUnitPrice,
        fixedLineTotal
    ];

    const rows = [];
    for (const g of groups) {
        const totalsCells = scenarios.map((s) => {
            const t = g.totals[s.key];
            return t && t.value !== "" ? `${t.value} ${t.unit}` : "—";
        });
        rows.push({
            categoryHeader: true,
            cells: [`${g.category}`, "", "", ...totalsCells, "", ""]
        });

        for (const r of g.rows) {
            const qtyCells = scenarios.map((s) => String(r.qtyByScenario[s.key] ?? "—"));
            const raw = r.raw || {};
            const componentType = raw.componentType ?? raw.component_type ?? null;
            const unitPrice = unitPriceForRow({
                roofType,
                category: g.category,
                componentType,
                product: r.product,
                requestOverrides: requestPriceOverrides
            });
            const billQty = Number(r.qtyByScenario[priceScenarioKey] ?? 0) || 0;
            const lineTotal = unitPrice != null ? unitPrice * billQty : null;
            rows.push({
                categoryHeader: false,
                cells: [
                    `${r.brand} - ${r.product}`,
                    r.unit,
                    r.coverageBasis || "—",
                    ...qtyCells,
                    unitPrice != null ? money(unitPrice) : "—",
                    lineTotal != null ? money(lineTotal) : "—"
                ]
            });
        }
    }

    return drawTable(doc, y, {
        headers,
        colWidths,
        rows,
        rowHeight: 20,
        headerHeight: 22
    });
}

export function generatePDF({ materials, pricing, input }, res) {
    const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
            Title: "Roof Material & Estimate Summary",
            Author: "Roof Estimator"
        }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="roof-material-estimate.pdf"');

    doc.pipe(res);

    const roof = input?.roof ?? {};
    const lengths = input?.lengths ?? {};
    const selectedBrands = selectedBrandsFromInput(input);
    const hasMixed = !!(materials?.pitched && materials?.flat);
    const isFlatOnly = roof.type === "flat" && !hasMixed;
    const generated = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });

    doc.save();
    doc.rect(0, 0, PAGE_WIDTH, 72).fill("#0f172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20);
    doc.text("Material Estimate", MARGIN, 22, { width: CONTENT_WIDTH, align: "left" });
    doc.font("Helvetica").fontSize(9).fillColor("#94a3b8");
    const address = (input?.job?.address || "").trim();
    if (address) {
        doc.text(address, MARGIN, 42, { width: CONTENT_WIDTH, align: "left" });
        doc.text(`Generated: ${generated}`, MARGIN, 56, { width: CONTENT_WIDTH, align: "left" });
    } else {
        doc.text(`Generated: ${generated}`, MARGIN, 48, { width: CONTENT_WIDTH, align: "left" });
    }
    doc.restore();

    let y = 88;

    const lfRows = [
        ["Ridge length", fmt(lengths.ridge_lf, " LF")],
        ["Hip length", fmt(lengths.hip_lf, " LF")],
        ["Valley length", fmt(lengths.valley_lf, " LF")],
        ["Eave length", fmt(lengths.eave_lf, " LF")],
        ["Rake length", fmt(lengths.rake_lf, " LF")],
        ["Step flashing length", fmt(lengths.flashing_lf, " LF")],
        ["Apron flashing length", fmt(lengths.apron_flashing_lf, " LF")]
    ];
    let metaRows;
    if (isFlatOnly) {
        metaRows = [
            ["Flat area", fmt(roof.flat_area_sqft ?? roof.area_sqft, " sq ft")],
            ["Roof pitch (input)", `${fmt(roof.pitch)} (not used for flat membrane qty)`],
            ["Complexity", complexityLabel(roof.complexity, "flat")],
            ["Flat roofing system", String(roof.flat_system || "—").toUpperCase()],
            ["Preferred brands", manufacturerDisplay(input)]
        ];
    } else if (hasMixed) {
        metaRows = [
            ["Pitched area", fmt(roof.pitched_area_sqft, " sq ft")],
            ["Flat area", fmt(roof.flat_area_sqft, " sq ft")],
            ["Roof pitch (rise / 12)", fmt(roof.pitch)],
            ["Complexity", complexityLabel(roof.complexity, "pitched")],
            ["Shingle style", shingleStyleLabel(input?.product?.shingle_style)],
            ["Preferred brands", manufacturerDisplay(input)],
            ["Flat roofing system", String(roof.flat_system || "—").toUpperCase()],
            ...lfRows
        ];
    } else {
        metaRows = [
            ["Pitched area", fmt(roof.pitched_area_sqft, " sq ft")],
            ["Flat area", fmt(roof.flat_area_sqft, " sq ft")],
            ["Roof pitch (rise / 12)", fmt(roof.pitch)],
            ["Complexity", complexityLabel(roof.complexity, "pitched")],
            ["Shingle style", shingleStyleLabel(input?.product?.shingle_style)],
            ["Preferred brands", manufacturerDisplay(input)],
            ...lfRows
        ];
    }
    const calcMeta = hasMixed
        ? [
              ["Surface area (combined)", fmt(materials.meta?.surfaceArea, " sq ft")],
              [
                  "Suggested waste (pitched)",
                  materials.pitched?.meta?.suggestedWasteFactor != null
                      ? `${(materials.pitched.meta.suggestedWasteFactor * 100).toFixed(2)}%`
                      : "—"
              ],
              [
                  "Suggested waste (flat)",
                  materials.flat?.meta?.suggestedWasteFactor != null
                      ? `${(materials.flat.meta.suggestedWasteFactor * 100).toFixed(2)}%`
                      : "—"
              ]
          ]
        : isFlatOnly
          ? [
                [
                    "Surface area (flat)",
                    fmt(materials.flat?.meta?.surfaceArea ?? materials.meta?.surfaceArea, " sq ft")
                ],
                [
                    "Suggested waste (model)",
                    materials.flat?.meta?.suggestedWasteFactor != null
                        ? `${(materials.flat.meta.suggestedWasteFactor * 100).toFixed(2)}%`
                        : "—"
                ],
                [
                    "Custom waste (if provided)",
                    materials.meta?.wasteCustomFactor != null
                        ? `${(Number(materials.meta.wasteCustomFactor) * 100).toFixed(2)}%`
                        : "—"
                ]
            ]
          : [
                ["Surface area (combined)", fmt(materials.meta?.surfaceArea, " sq ft")],
                [
                    "Suggested waste (model)",
                    materials.pitched?.meta?.suggestedWasteFactor != null
                        ? `${(materials.pitched.meta.suggestedWasteFactor * 100).toFixed(2)}%`
                        : "—"
                ]
            ];
    y += SECTION_GAP;
    y = sectionTitle(doc, y, "1. Roof summary");
    y = drawTable(doc, y, {
        headers: ["Field", "Value"],
        colWidths: [CONTENT_WIDTH * 0.55, CONTENT_WIDTH * 0.45],
        rows: [...metaRows, ...calcMeta]
    });

    const pitchedMeta = materials.pitched?.meta;
    if (pitchedMeta && (roof.type !== "flat" || hasMixed)) {
        y = renderPitchWasteSummary(doc, y, { roof, sectionMeta: pitchedMeta });
    }

    y = sectionTitle(doc, y, "2. Material estimate (grouped by item)");

    if (hasMixed) {
        if (materials.pitched) {
            y = renderEstimateTable(doc, y, {
                title: "Pitched roof",
                roofType: "pitched",
                sectionMeta: materials.pitched.meta,
                lengths,
                recommendations: materials.recommendations?.pitched || [],
                selectedBrands,
                requestPriceOverrides: input?.pricing_overrides
            });
        }
        if (materials.flat) {
            y = renderEstimateTable(doc, y, {
                title: "Flat roof",
                roofType: "flat",
                sectionMeta: materials.flat.meta,
                lengths: null,
                recommendations: (materials.recommendations?.flat?.length ? materials.recommendations.flat : (materials.flat?.recommendations || [])),
                selectedBrands,
                requestPriceOverrides: input?.pricing_overrides
            });
        }
    } else {
        const rt = materials?.meta?.roofType || roof.type || "pitched";
        const sectionMeta = rt === "flat" ? materials.flat?.meta || materials.meta : materials.pitched?.meta || materials.meta;
        y = renderEstimateTable(doc, y, {
            title: rt === "flat" ? "Flat roof" : "Pitched roof",
            roofType: rt,
            sectionMeta,
            lengths: rt === "flat" ? null : lengths,
            recommendations: rt === "flat"
                ? (materials.recommendations?.flat?.length ? materials.recommendations.flat : (materials.flat?.recommendations || []))
                : (materials.recommendations?.pitched?.length ? materials.recommendations.pitched : (materials.pitched?.recommendations || [])),
            selectedBrands,
            requestPriceOverrides: input?.pricing_overrides
        });
    }

    y += SECTION_GAP;
    y = sectionTitle(doc, y, "3. Pricing totals");
    const pricingLineRows = buildPricingExportRows(pricing).map(([label, val]) => [
        label,
        typeof val === "number" && Number.isFinite(val) ? money(val) : "—"
    ]);
    y = drawTable(doc, y, {
        headers: ["Line item", "Amount (USD)"],
        colWidths: [CONTENT_WIDTH * 0.6, CONTENT_WIDTH * 0.4],
        rows: [
            ...pricingLineRows,
            ["Subtotal", money(pricing?.subtotal)],
            [`Margin (${pricing?.marginPercent ?? 0}%)`, money(pricing?.marginAmount)],
            ["TOTAL", money(pricing?.total)]
        ],
        rowHeight: 20,
        headerHeight: 22
    });

    y += SECTION_GAP;
    y = sectionTitle(doc, y, "4. Important notes");
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    doc.text(MATERIAL_ESTIMATE_DISCLAIMER, MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "left",
        lineGap: 2
    });

    doc.end();
}
