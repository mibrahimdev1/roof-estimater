import ExcelJS from "exceljs";
import { MATERIAL_ESTIMATE_DISCLAIMER } from "../constants/reportNotes.js";
import { buildMaterialOrderRows, manufacturerDisplay, shingleStyleLabel } from "./reportHelpers.js";
import { buildPricingExportRows, unitPriceForRow } from "./reportPricing.js";

const HEADER_FILL = "FF1E3A5F";
const CATEGORY_FILL = "FFE0E7FF";

function complexityLabel(v) {
    const m = { low: "Simple (gable)", medium: "Medium", high: "Complex (valleys, cuts)" };
    return m[v] || v || "—";
}

function money(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "";
    return Number(n.toFixed(2));
}

export async function buildMaterialOrderWorkbookBuffer(payload) {
    const { materials, pricing, input } = payload;
    const roof = input?.roof ?? {};
    const lengths = input?.lengths ?? {};
    const jobAddr = String(input?.job?.address || "").trim();

    const wb = new ExcelJS.Workbook();
    wb.creator = "Roof Estimator";
    wb.created = new Date();

    const lastCol = "K";

    const ws = wb.addWorksheet("Roofing Material Order", {
        properties: { tabColor: { argb: "FF1E3A5F" } },
        views: [{ state: "frozen", ySplit: jobAddr ? 8 : 7 }]
    });

    ws.mergeCells(`A1:${lastCol}1`);
    const title = ws.getCell("A1");
    title.value = "Roofing Material Order";
    title.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
    title.alignment = { vertical: "middle", horizontal: "center" };

    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell("A2").value = `Generated: ${new Date().toLocaleString()}`;
    ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    ws.getCell("A2").alignment = { horizontal: "center" };

    let rowNum = 3;
    if (jobAddr) {
        ws.mergeCells(`A${rowNum}:${lastCol}${rowNum}`);
        ws.getCell(`A${rowNum}`).value = jobAddr;
        ws.getCell(`A${rowNum}`).font = { size: 11, color: { argb: "FF334155" } };
        ws.getCell(`A${rowNum}`).alignment = { horizontal: "center", wrapText: true };
        rowNum++;
    }

    ws.addRow([]);
    const summaryTitleRow = ws.addRow(["Job summary"]);
    summaryTitleRow.font = { bold: true };

    const summary = [
        ["Surface area (sq ft)", materials.meta?.surfaceArea ?? "—", "Pitch (rise/12)", roof.pitch],
        ["Complexity", complexityLabel(roof.complexity), "Shingle style", shingleStyleLabel(input?.product?.shingle_style)],
        [
            "Manufacturer",
            manufacturerDisplay(input),
            "Suggested waste (model)",
            materials.meta?.suggestedWasteFactor != null ? `${(materials.meta.suggestedWasteFactor * 100).toFixed(1)}%` : "—"
        ],
        ["Ridge LF", lengths.ridge_lf, "Hip LF", lengths.hip_lf],
        ["Valley LF", lengths.valley_lf, "Eave LF", lengths.eave_lf],
        ["Rake LF", lengths.rake_lf, "Squares (rounded)", materials.shingles?.squares]
    ];
    summary.forEach((cells) => ws.addRow(cells));

    ws.addRow([]);
    const headerLabels = [
        "Line",
        "Section",
        "Category",
        "Description",
        "Manufacturer",
        "Shingle style",
        "Qty",
        "Unit",
        "Notes / detail",
        "Unit price (USD)",
        "Line total (USD)"
    ];
    const headerRow = ws.addRow(headerLabels);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL }
    };
    headerRow.alignment = { vertical: "middle", wrapText: true };

    const roofForPricing = materials?.meta?.roofType === "flat" ? "flat" : "pitched";
    let prevCategory = null;

    for (const r of buildMaterialOrderRows(materials, input)) {
        if (r.category !== prevCategory) {
            prevCategory = r.category;
            const cr = ws.addRow(["", "", r.category, "", "", "", "", "", "", "", ""]);
            cr.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: CATEGORY_FILL }
            };
            cr.font = { bold: true, color: { argb: "FF1E3A5F" } };
            for (let c = 1; c <= 11; c++) {
                cr.getCell(c).fill = cr.fill;
                cr.getCell(c).font = cr.font;
            }
        }
        const unitP = unitPriceForRow({
            roofType: roofForPricing,
            category: r.category,
            componentType: r.componentType,
            product: r.product,
            requestOverrides: input?.pricing_overrides
        });
        const lineTot =
            unitP != null && r.qty != null && Number.isFinite(Number(r.qty)) ? unitP * Number(r.qty) : null;
        const dataRow = ws.addRow([
            r.line,
            r.section || (materials?.meta?.roofType === "flat" ? "Flat Roof Materials" : "Pitched Roof Materials"),
            r.category,
            r.description,
            r.manufacturer,
            r.shingle_style,
            r.qty,
            r.unit,
            r.detail,
            unitP != null ? money(unitP) : "",
            lineTot != null ? money(lineTot) : ""
        ]);
        dataRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFFFF" }
        };
        for (let c = 1; c <= 11; c++) {
            dataRow.getCell(c).fill = dataRow.fill;
        }
    }

    ws.columns = [
        { width: 6 },
        { width: 22 },
        { width: 14 },
        { width: 32 },
        { width: 18 },
        { width: 22 },
        { width: 10 },
        { width: 12 },
        { width: 44 },
        { width: 14 },
        { width: 14 }
    ];

    const priceSheet = wb.addWorksheet("Pricing", {
        properties: { tabColor: { argb: "FF0F766E" } }
    });
    priceSheet.addRow(["Line item", "Amount (USD)"]);
    priceSheet.getRow(1).font = { bold: true };
    priceSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL }
    };
    priceSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    const lines = [
        ...buildPricingExportRows(pricing),
        ["Subtotal", pricing?.subtotal],
        [`Margin (${pricing?.marginPercent ?? 0}%)`, pricing?.marginAmount],
        ["TOTAL", pricing?.total]
    ];
    lines.forEach(([k, v], idx) => {
        const row = priceSheet.addRow([k, typeof v === "number" ? v : v]);
        if (idx === lines.length - 1) {
            row.font = { bold: true };
        }
    });

    priceSheet.getColumn(1).width = 36;
    priceSheet.getColumn(2).width = 18;

    const notesSheet = wb.addWorksheet("Important notes", {
        properties: { tabColor: { argb: "FF64748B" } }
    });
    notesSheet.mergeCells(`A1:${lastCol}12`);
    const noteCell = notesSheet.getCell("A1");
    noteCell.value = MATERIAL_ESTIMATE_DISCLAIMER;
    noteCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    noteCell.font = { size: 11, color: { argb: "FF334155" } };
    notesSheet.getRow(1).height = 200;

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

export async function generateExcelOrder(payload, res) {
    const buffer = await buildMaterialOrderWorkbookBuffer(payload);
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="roofing-material-order.xlsx"');
    res.send(buffer);
}
