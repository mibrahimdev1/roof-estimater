import {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType
} from "docx";
import { CONSTANTS } from "../constants/estimation.js";
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

function complexityLabel(v, roofType) {
    if (roofType === "flat") {
        const m = { low: "Low", medium: "Medium", high: "High" };
        return m[v] || v || "—";
    }
    const m = { low: "Simple (gable)", medium: "Medium", high: "Complex (valleys, cuts)" };
    return m[v] || v || "—";
}

function money(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return `$${n.toFixed(2)}`;
}

function fmt(n, suffix = "") {
    if (n === undefined || n === null || Number.isNaN(n)) return "—";
    if (typeof n === "number") return `${Number.isInteger(n) ? n : n.toFixed(2)}${suffix}`;
    return String(n) + suffix;
}

const SUMMARY_HEADER_FILL = "E8EEF4";
const SUMMARY_HEADER_TEXT = "2563EB";
const SUMMARY_RECOMMENDED_FILL = "DBEAFE";

function sectionHeading(text, level = HeadingLevel.HEADING_1) {
    return new Paragraph({
        text,
        heading: level,
        spacing: { before: 160, after: 120 },
        keepNext: true
    });
}

function subsectionHeading(text) {
    return new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 80 },
        keepNext: true
    });
}

function metricGridParagraph(text, { bold = false, color, center = false, italic = false, size = 18, keepWithNext = false } = {}) {
    return new Paragraph({
        children: [
            new TextRun({
                text: String(text ?? ""),
                bold,
                color,
                italics: italic,
                size
            })
        ],
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        keepNext: keepWithNext
    });
}

function metricGridCell(text, { bold = false, center = false, shading, color, size = 18 } = {}) {
    return new TableCell({
        width: { size: 1, type: WidthType.AUTO },
        shading,
        children: [metricGridParagraph(text, { bold, center, color, size })]
    });
}

function buildMetricGridTableWord({
    rowLabelHeader,
    columnHeaders,
    dataRows,
    highlightColIndex = -1,
    recommendedLabelRow = false
}) {
    const labelPct = 18;
    const dataPct = (100 - labelPct) / Math.max(1, columnHeaders.length);
    const headerFill = { fill: SUMMARY_HEADER_FILL, type: ShadingType.CLEAR };
    const recommendedFill = { fill: SUMMARY_RECOMMENDED_FILL, type: ShadingType.CLEAR };

    const rows = [];

    if (recommendedLabelRow && highlightColIndex >= 0) {
        rows.push(
            new TableRow({
                cantSplit: true,
                children: [
                    new TableCell({
                        width: { size: labelPct, type: WidthType.PERCENTAGE },
                        children: [new Paragraph("")]
                    }),
                    ...columnHeaders.map((_, i) =>
                        new TableCell({
                            width: { size: dataPct, type: WidthType.PERCENTAGE },
                            shading: i === highlightColIndex ? recommendedFill : undefined,
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: i === highlightColIndex ? "Recommended" : "",
                                            bold: true,
                                            color: SUMMARY_HEADER_TEXT,
                                            size: 16
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER,
                                    keepNext: true
                                })
                            ]
                        })
                    )
                ]
            })
        );
    }

    rows.push(
        new TableRow({
            cantSplit: true,
            children: [
                new TableCell({
                    width: { size: labelPct, type: WidthType.PERCENTAGE },
                    shading: headerFill,
                    children: [
                        metricGridParagraph(rowLabelHeader, {
                            bold: true,
                            color: SUMMARY_HEADER_TEXT,
                            keepWithNext: true
                        })
                    ]
                }),
                ...columnHeaders.map((h, i) =>
                    new TableCell({
                        width: { size: dataPct, type: WidthType.PERCENTAGE },
                        shading:
                            i === highlightColIndex
                                ? recommendedFill
                                : headerFill,
                        children: [
                            metricGridParagraph(h, {
                                bold: true,
                                color: SUMMARY_HEADER_TEXT,
                                center: true
                            })
                        ]
                    })
                )
            ]
        })
    );

    for (const row of dataRows) {
        rows.push(
            new TableRow({
                cantSplit: true,
                children: [
                    new TableCell({
                        width: { size: labelPct, type: WidthType.PERCENTAGE },
                        children: [metricGridParagraph(row.label)]
                    }),
                    ...row.values.map((val, i) =>
                        new TableCell({
                            width: { size: dataPct, type: WidthType.PERCENTAGE },
                            shading: i === highlightColIndex ? recommendedFill : undefined,
                            children: [metricGridParagraph(val, { center: true })]
                        })
                    )
                ]
            })
        );
    }

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows
    });
}

function buildPitchWasteSummaryWord({ roof, sectionMeta }) {
    const pitchCols = buildPitchSummaryColumns(roof, sectionMeta);
    if (!pitchCols.length) return [];

    const wasteSummary = buildWasteSummaryColumns(sectionMeta);

    return [
        buildMetricGridTableWord({
            rowLabelHeader: "Pitch",
            columnHeaders: pitchCols.map((c) => c.label),
            dataRows: [
                { label: "Area (sqft)", values: pitchCols.map((c) => c.areaDisplay) },
                { label: "Squares", values: pitchCols.map((c) => c.squaresDisplay) }
            ]
        }),
        new Paragraph({ text: "", spacing: { after: 80 } }),
        buildMetricGridTableWord({
            rowLabelHeader: "Waste %",
            columnHeaders: wasteSummary.columns.map((c) => c.label),
            dataRows: [
                { label: "Area (sqft)", values: wasteSummary.columns.map((c) => c.areaDisplay) },
                { label: "Squares", values: wasteSummary.columns.map((c) => c.squaresDisplay) }
            ],
            highlightColIndex: wasteSummary.recommendedIdx,
            recommendedLabelRow: wasteSummary.recommendedIdx >= 0
        }),
        new Paragraph({ text: "", spacing: { after: 120 } })
    ];
}

function tableFromRows(headers, rows) {
    const headerRow = new TableRow({
        cantSplit: true,
        children: headers.map(
            (h) =>
                new TableCell({
                    width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: h, bold: true })],
                            alignment: AlignmentType.LEFT
                        })
                    ]
                })
        )
    });

    const dataRows = rows.map(
        (r) =>
            new TableRow({
                cantSplit: true,
                children: r.map(
                    (cell) =>
                        new TableCell({
                            width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    children: [new TextRun(String(cell ?? "—"))],
                                    alignment: AlignmentType.LEFT
                                })
                            ]
                        })
                )
            })
    );

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows]
    });
}

function tableFromEstimateMatrix(headers, rows) {
    const n = headers.length;
    const pct = 100 / n;
    const headerRow = new TableRow({
        cantSplit: true,
        children: headers.map(
            (h) =>
                new TableCell({
                    width: { size: pct, type: WidthType.PERCENTAGE },
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: h, bold: true })],
                            alignment: AlignmentType.LEFT
                        })
                    ]
                })
        )
    });

    const dataRows = rows.map((row) => {
        const cells = row.cells;
        const categoryHeader = row.categoryHeader === true;
        return new TableRow({
            cantSplit: true,
            children: cells.map((cell, ci) => {
                const boldFirst = categoryHeader && ci === 0;
                return new TableCell({
                    width: { size: pct, type: WidthType.PERCENTAGE },
                    shading: categoryHeader ? { fill: "E0E7FF", type: ShadingType.CLEAR } : undefined,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: String(cell ?? "—"),
                                    bold: boldFirst || categoryHeader,
                                    color: categoryHeader ? "1e3a5f" : "000000"
                                })
                            ],
                            alignment: AlignmentType.LEFT
                        })
                    ]
                });
            })
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows]
    });
}

function flatSystemSubtitle(sectionMeta) {
    const wf =
        sectionMeta?.suggestedWasteFactor != null
            ? `${(sectionMeta.suggestedWasteFactor * 100).toFixed(2)}%`
            : "—";
    const cf =
        sectionMeta?.wasteCustomFactor != null && Number.isFinite(Number(sectionMeta.wasteCustomFactor))
            ? ` · Custom waste: ${(Number(sectionMeta.wasteCustomFactor) * 100).toFixed(2)}%`
            : "";
    return `System: ${sectionMeta?.flatSystem || "—"} · Suggested waste (model): ${wf}${cf}`;
}

/** Returns table, or null when no products match (section should be omitted). */
function renderEstimateTables({ roofType, sectionMeta, lengths, recommendations, selectedBrands, requestPriceOverrides }) {
    const { scenarios, groups } = buildMaterialEstimateGroups({
        roofType,
        sectionMeta,
        recommendations,
        lengths,
        selectedBrands,
        wasteColumnMode: "multi"
    });

    if (!groups.length) {
        return null;
    }

    const priceScenarioKey = pickPricingScenarioKey(sectionMeta, scenarios);

    const headers = ["Product", "Unit", "Basis", ...scenarios.map((s) => s.label), "Unit price", "Line total"];
    const rows = [];

    for (const g of groups) {
        const totalsCells = scenarios.map((s) => {
            const t = g.totals[s.key];
            return t && t.value !== "" ? `${t.value} ${t.unit}` : "—";
        });
        rows.push({ categoryHeader: true, cells: [`${g.category}`, "", "", ...totalsCells, "", ""] });

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

    return tableFromEstimateMatrix(headers, rows);
}

export async function generateWordDoc(payload, res) {
    const { materials, pricing, input } = payload;
    const roof = input?.roof ?? {};
    const lengths = input?.lengths ?? {};
    const hasMixed = !!(materials?.pitched && materials?.flat);
    const isFlatOnly = roof.type === "flat" && !hasMixed;
    const selectedBrands = selectedBrandsFromInput(input);
    const generated = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });

    const lfRows = [
        ["Ridge (LF)", fmt(lengths.ridge_lf)],
        ["Hip (LF)", fmt(lengths.hip_lf)],
        ["Valley (LF)", fmt(lengths.valley_lf)],
        ["Eave (LF)", fmt(lengths.eave_lf)],
        ["Rake (LF)", fmt(lengths.rake_lf)],
        ["Step flashing (LF)", fmt(lengths.flashing_lf)],
        ["Apron flashing (LF)", fmt(lengths.apron_flashing_lf)]
    ];
    let summaryRows;
    if (isFlatOnly) {
        summaryRows = [
            ["Flat area (sq ft)", fmt(roof.flat_area_sqft ?? roof.area_sqft)],
            ["Pitch (input, not used for flat qty)", fmt(roof.pitch)],
            ["Complexity", complexityLabel(roof.complexity, "flat")],
            ["Flat roofing system", String(roof.flat_system || "—").toUpperCase()],
            ["Preferred brands", manufacturerDisplay(input)],
            ["Surface area (flat sq ft)", fmt(materials.flat?.meta?.surfaceArea ?? materials.meta?.surfaceArea)],
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
        ];
    } else if (hasMixed) {
        summaryRows = [
            ["Pitched area (sq ft)", fmt(roof.pitched_area_sqft)],
            ["Flat area (sq ft)", fmt(roof.flat_area_sqft)],
            ["Pitch (rise / 12)", fmt(roof.pitch)],
            ["Complexity", complexityLabel(roof.complexity, "pitched")],
            ["Shingle style", shingleStyleLabel(input?.product?.shingle_style)],
            ["Preferred brands", manufacturerDisplay(input)],
            ["Flat roofing system", String(roof.flat_system || "—").toUpperCase()],
            ...lfRows,
            ["Surface area (combined sq ft)", fmt(materials.meta?.surfaceArea)],
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
        ];
    } else {
        summaryRows = [
            ["Pitched area (sq ft)", fmt(roof.pitched_area_sqft)],
            ["Flat area (sq ft)", fmt(roof.flat_area_sqft)],
            ["Pitch (rise / 12)", fmt(roof.pitch)],
            ["Complexity", complexityLabel(roof.complexity, "pitched")],
            ["Shingle style", shingleStyleLabel(input?.product?.shingle_style)],
            ["Preferred brands", manufacturerDisplay(input)],
            ...lfRows,
            ["Surface area (combined sq ft)", fmt(materials.meta?.surfaceArea)],
            [
                "Suggested waste (model)",
                materials.pitched?.meta?.suggestedWasteFactor != null
                    ? `${(materials.pitched.meta.suggestedWasteFactor * 100).toFixed(2)}%`
                    : "—"
            ]
        ];
    }

    const pitchedMeta = materials.pitched?.meta;
    const showPitchWasteSummary = pitchedMeta && (roof.type !== "flat" || hasMixed);

    const doc = new Document({
        creator: "Roof Estimator",
        title: "Material Estimate",
        description: "Generated roofing material estimate",
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        text: "Material Estimate",
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 200 }
                    }),
                    ...(String(input?.job?.address || "").trim()
                        ? [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: String(input.job.address).trim(),
                                        color: "334155"
                                    })
                                ],
                                alignment: AlignmentType.LEFT,
                                spacing: { after: 120 }
                            })
                        ]
                        : []),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Generated: ${generated}`, italics: true, color: "666666" })
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 240 }
                    }),
                    sectionHeading("1. Roof summary"),
                    tableFromRows(["Field", "Value"], summaryRows),
                    ...(showPitchWasteSummary
                        ? buildPitchWasteSummaryWord({ roof, sectionMeta: pitchedMeta })
                        : [new Paragraph({ text: "", spacing: { after: 120 } })]),
                    sectionHeading("2. Material estimate (grouped by item)"),
                    ...(() => {
                        const priceOverrides = input?.pricing_overrides;
                        const blocks = [];

                        function pushSection({ title, roofType, sectionMeta, lengths: sectionLengths, recommendations }) {
                            const table = renderEstimateTables({
                                roofType,
                                sectionMeta,
                                lengths: sectionLengths,
                                recommendations,
                                selectedBrands,
                                requestPriceOverrides: priceOverrides
                            });
                            if (!table) return;
                            if (blocks.length) {
                                blocks.push(new Paragraph({ text: "", spacing: { after: 120 } }));
                            }
                            blocks.push(subsectionHeading(title));
                            if (roofType === "flat") {
                                blocks.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: flatSystemSubtitle(sectionMeta),
                                                italics: true,
                                                color: "666666"
                                            })
                                        ],
                                        spacing: { after: 80 },
                                        keepNext: true
                                    })
                                );
                            }
                            blocks.push(table);
                        }

                        if (materials?.pitched && materials?.flat) {
                            pushSection({
                                title: "Pitched roof",
                                roofType: "pitched",
                                sectionMeta: materials.pitched.meta,
                                lengths,
                                recommendations: materials.recommendations?.pitched || []
                            });
                            pushSection({
                                title: "Flat roof",
                                roofType: "flat",
                                sectionMeta: materials.flat.meta,
                                lengths: null,
                                recommendations: materials.recommendations?.flat?.length
                                    ? materials.recommendations.flat
                                    : materials.flat?.recommendations || []
                            });
                        } else if (materials?.meta?.roofType === "flat") {
                            pushSection({
                                title: "Flat roof",
                                roofType: "flat",
                                sectionMeta: materials.flat?.meta || materials.meta,
                                lengths: null,
                                recommendations: materials.recommendations?.flat?.length
                                    ? materials.recommendations.flat
                                    : materials.flat?.recommendations || []
                            });
                        } else {
                            pushSection({
                                title: "Pitched roof",
                                roofType: "pitched",
                                sectionMeta: materials.pitched?.meta || materials.meta,
                                lengths,
                                recommendations: materials.recommendations?.pitched?.length
                                    ? materials.recommendations.pitched
                                    : materials.pitched?.recommendations || []
                            });
                        }
                        return blocks;
                    })(),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Constants reference: ${CONSTANTS.bundlesPerSquare} bundles/square; starter ~${CONSTANTS.starterCoverage} LF/bundle; ridge ~${CONSTANTS.ridgeCapCoverage} LF/bundle.`,
                                italics: true,
                                size: 18,
                                color: "666666"
                            })
                        ],
                        spacing: { before: 120, after: 160 }
                    }),
                    sectionHeading("3. Pricing totals"),
                    tableFromRows(["Line item", "Amount (USD)"], [
                        ...buildPricingExportRows(pricing).map(([label, val]) => [
                            label,
                            typeof val === "number" && Number.isFinite(val) ? money(val) : "—"
                        ]),
                        ["Subtotal", money(pricing?.subtotal)],
                        [`Margin (${pricing?.marginPercent ?? 0}%)`, money(pricing?.marginAmount)],
                        ["TOTAL", money(pricing?.total)]
                    ]),
                    sectionHeading("4. Important notes"),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: MATERIAL_ESTIMATE_DISCLAIMER,
                                color: "333333"
                            })
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 200 }
                    })
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="roof-material-estimate.docx"');
    res.send(buffer);
}
