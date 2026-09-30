import ExcelJS from "exceljs";
import {
    MANUFACTURER_CATEGORIES,
    MANUFACTURER_GROUP_PLACEHOLDER_COVERAGE_VALUE,
    MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT,
    MANUFACTURER_GROUP_PLACEHOLDER_UNIT,
    MANUFACTURER_IMPORT_HEADERS,
    MANUFACTURER_IMPORT_REQUIRED_HEADERS
} from "../constants/manufacturerCatalogMeta.js";
import { manufacturerProductSchema } from "../utils/joiSchemas.js";
import {
    brandExistsForGroup,
    createManufacturerProduct
} from "./manufacturerCatalogService.js";

const CATEGORY_SET = new Set(MANUFACTURER_CATEGORIES);
const HEADER_LOOKUP = new Map(MANUFACTURER_IMPORT_HEADERS.map((h) => [h.toLowerCase(), h]));

function cellToString(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if (value.text != null) return String(value.text).trim();
        if (value.result != null) return String(value.result).trim();
        if (Array.isArray(value.richText)) {
            return value.richText.map((p) => p.text || "").join("").trim();
        }
    }
    return String(value).trim();
}

function normalizeHeader(raw) {
    const key = cellToString(raw).replace(/^\uFEFF/, "").trim().toLowerCase();
    return HEADER_LOOKUP.get(key) || null;
}

function parseIsActive(raw) {
    if (raw === null || raw === undefined || raw === "") return true;
    const s = String(raw).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(s)) return true;
    if (["false", "0", "no", "n"].includes(s)) return false;
    return raw;
}

function isBlankRow(rowObj) {
    return MANUFACTURER_IMPORT_HEADERS.every((h) => !cellToString(rowObj[h]));
}

function originalRowSnapshot(rowObj) {
    const out = {};
    for (const h of MANUFACTURER_IMPORT_HEADERS) {
        out[h] = cellToString(rowObj[h] ?? "");
    }
    return out;
}

function mapRowToPlaceholderPayload(rowObj) {
    const systemRaw = cellToString(rowObj.systemType);
    return {
        roofType: cellToString(rowObj.roofType),
        systemType: systemRaw === "" ? null : systemRaw,
        category: cellToString(rowObj.category),
        brand: cellToString(rowObj.brand),
        product: MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT,
        unit: MANUFACTURER_GROUP_PLACEHOLDER_UNIT,
        coverageValue: MANUFACTURER_GROUP_PLACEHOLDER_COVERAGE_VALUE,
        coverageBasis: "",
        componentType: null,
        sortOrder: 0,
        isActive: parseIsActive(rowObj.isActive)
    };
}

async function workbookFromBuffer(buffer, fileName) {
    const workbook = new ExcelJS.Workbook();
    const lower = String(fileName || "").toLowerCase();
    if (lower.endsWith(".csv")) {
        const { Readable } = await import("stream");
        const stream = Readable.from([buffer]);
        await workbook.csv.read(stream);
        return workbook;
    }
    await workbook.xlsx.load(buffer);
    return workbook;
}

function extractSheetRows(workbook) {
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headerError: "File has no worksheet.", rows: [] };

    const matrix = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const values = [];
        const maxCol = Math.max(row.cellCount, MANUFACTURER_IMPORT_HEADERS.length);
        for (let c = 1; c <= maxCol; c++) {
            values.push(row.getCell(c).value);
        }
        matrix.push({ rowNumber, values });
    });

    if (!matrix.length) {
        return { headerError: "File is empty.", rows: [] };
    }

    const headerCells = matrix[0].values;
    const mappedHeaders = headerCells.map((c) => normalizeHeader(c));
    const present = new Set(mappedHeaders.filter(Boolean));

    const missingRequired = MANUFACTURER_IMPORT_REQUIRED_HEADERS.filter((h) => !present.has(h));
    if (missingRequired.length) {
        return {
            headerError: `Header mismatch. Missing required column(s): ${missingRequired.join(", ")}. Expected: ${MANUFACTURER_IMPORT_HEADERS.join(", ")}.`,
            rows: []
        };
    }

    const unknown = [];
    headerCells.forEach((c, i) => {
        const raw = cellToString(c);
        if (!raw) return;
        if (!mappedHeaders[i]) unknown.push(raw);
    });
    if (unknown.length) {
        return {
            headerError: `Header mismatch. Unknown column(s): ${unknown.join(", ")}. Expected: ${MANUFACTURER_IMPORT_HEADERS.join(", ")}.`,
            rows: []
        };
    }

    const colIndex = {};
    mappedHeaders.forEach((h, i) => {
        if (h) colIndex[h] = i;
    });

    const rows = [];
    for (let i = 1; i < matrix.length; i++) {
        const { rowNumber, values } = matrix[i];
        const rowObj = {};
        for (const h of MANUFACTURER_IMPORT_HEADERS) {
            const idx = colIndex[h];
            rowObj[h] = idx === undefined ? "" : values[idx];
        }
        if (isBlankRow(rowObj)) continue;
        rows.push({ rowNumber, rowObj });
    }

    return { headerError: null, rows };
}

function validateAndCreateRow(rowObj) {
    const snapshot = originalRowSnapshot(rowObj);
    const payload = mapRowToPlaceholderPayload(rowObj);

    if (payload.category && !CATEGORY_SET.has(payload.category)) {
        return {
            ok: false,
            failed: {
                ...snapshot,
                reason: "category is not a supported category"
            }
        };
    }

    const { error, value } = manufacturerProductSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const reason = error.details.map((d) => d.message.replace(/"/g, "")).join("; ");
        return { ok: false, failed: { ...snapshot, reason } };
    }

    if (
        brandExistsForGroup({
            roofType: value.roofType,
            systemType: value.systemType,
            category: value.category,
            brand: value.brand
        })
    ) {
        return {
            ok: false,
            failed: {
                ...snapshot,
                reason: "Duplicate manufacturer — already exists for this roofType, systemType, category, and brand"
            }
        };
    }

    createManufacturerProduct(value);
    return { ok: true };
}

/**
 * Validate headers only (no row inserts).
 * @param {Array<{ buffer: Buffer, originalname: string }>} files
 */
export async function validateManufacturerImportHeaders(files) {
    const results = [];
    for (const file of files) {
        const fileName = file.originalname || "upload";
        try {
            const workbook = await workbookFromBuffer(file.buffer, fileName);
            const { headerError } = extractSheetRows(workbook);
            results.push({
                fileName,
                ok: !headerError,
                headerError: headerError || null
            });
        } catch (e) {
            results.push({
                fileName,
                ok: false,
                headerError: e instanceof Error ? e.message : "Could not parse file."
            });
        }
    }
    return { files: results };
}

/**
 * @param {Array<{ buffer: Buffer, originalname: string }>} files
 */
export async function importManufacturers(files) {
    const fileResults = [];
    const failedRows = [];
    let importedCount = 0;

    for (const file of files) {
        const fileName = file.originalname || "upload";
        const result = {
            fileName,
            imported: 0,
            skipped: 0,
            headerError: null
        };

        let workbook;
        try {
            workbook = await workbookFromBuffer(file.buffer, fileName);
        } catch (e) {
            result.headerError = e instanceof Error ? e.message : "Could not parse file.";
            fileResults.push(result);
            continue;
        }

        const { headerError, rows } = extractSheetRows(workbook);
        if (headerError) {
            result.headerError = headerError;
            fileResults.push(result);
            continue;
        }

        for (const { rowNumber, rowObj } of rows) {
            const outcome = validateAndCreateRow(rowObj);
            if (outcome.ok) {
                result.imported += 1;
                importedCount += 1;
            } else {
                result.skipped += 1;
                failedRows.push({
                    sourceFile: fileName,
                    rowNumber,
                    ...outcome.failed
                });
            }
        }

        fileResults.push(result);
    }

    return {
        files: fileResults,
        failedRows,
        importedCount
    };
}
