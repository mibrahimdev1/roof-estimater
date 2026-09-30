import { Router } from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import { db } from "../db/database.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
    adminSettingsSchema,
    profileUpdateSchema,
    passwordChangeSchema,
    historyQuerySchema,
    manufacturerProductSchema
} from "../utils/joiSchemas.js";
import { getAdminSettings, saveAdminSettings } from "../services/settingsService.js";
import { getStats, listHistory, getHistoryById, countHistory } from "../services/historyService.js";
import {
    createManufacturerProduct,
    deleteManufacturerProduct,
    deleteManufacturerBrand,
    deleteManufacturerGroupByRepresentativeId,
    getManufacturerProductById,
    findManufacturerProductByKey,
    listManufacturerGroups,
    listManufacturerProducts,
    updateManufacturerProduct
} from "../services/manufacturerCatalogService.js";
import { importManufacturerProducts, validateImportFileHeaders } from "../services/manufacturerImportService.js";
import {
    importManufacturers,
    validateManufacturerImportHeaders
} from "../services/manufacturerBrandImportService.js";
import {
    PRODUCT_IMPORT_EXAMPLE_ROW,
    PRODUCT_IMPORT_HEADER_LINE,
    PRODUCT_IMPORT_HEADERS,
    MANUFACTURER_IMPORT_EXAMPLE_ROW,
    MANUFACTURER_IMPORT_HEADER_LINE,
    MANUFACTURER_IMPORT_HEADERS
} from "../constants/manufacturerCatalogMeta.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.use(requireAuth);

const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 10,
        fileSize: 5 * 1024 * 1024
    },
    fileFilter(_req, file, cb) {
        const name = String(file.originalname || "").toLowerCase();
        if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
            cb(null, true);
            return;
        }
        cb(new Error("Only CSV and Excel (.xlsx, .xls) files are allowed."));
    }
});

function withSummary(row) {
    let input;
    let materials;
    let pricing;
    try {
        input = JSON.parse(row.input_json);
        materials = JSON.parse(row.materials_json);
        pricing = JSON.parse(row.pricing_json);
    } catch {
        return {
            id: row.id,
            user_id: row.user_id,
            user_name: row.user_name || null,
            created_at: row.created_at,
            summary: null
        };
    }
    return {
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name || null,
        created_at: row.created_at,
        summary: {
            planArea: input?.roof?.area_sqft ?? null,
            pitch: input?.roof?.pitch ?? null,
            surfaceArea: materials?.meta?.surfaceArea ?? null,
            wasteFactor: materials?.meta?.wasteFactor ?? null,
            total: pricing?.total ?? null
        }
    };
}

router.get("/settings", (_req, res) => {
    return sendSuccess(res, { settings: getAdminSettings() });
});

router.get("/manufacturers", (req, res) => {
    const roofType = typeof req.query.roofType === "string" ? req.query.roofType : undefined;
    const systemType = typeof req.query.systemType === "string" ? req.query.systemType : undefined;
    const activeOnly = req.query.activeOnly === "false" ? false : true;
    return sendSuccess(res, {
        items: listManufacturerProducts({ roofType, systemType, activeOnly })
    });
});

router.get("/manufacturers/grouped", (req, res) => {
    const roofType = typeof req.query.roofType === "string" ? req.query.roofType : undefined;
    const systemType = typeof req.query.systemType === "string" ? req.query.systemType : undefined;
    const activeOnly = req.query.activeOnly === "true";
    return sendSuccess(res, {
        items: listManufacturerGroups({ roofType, systemType, activeOnly })
    });
});

router.get("/manufacturers/import/format", (_req, res) => {
    return sendSuccess(res, {
        headers: PRODUCT_IMPORT_HEADERS,
        headerLine: PRODUCT_IMPORT_HEADER_LINE,
        exampleRow: PRODUCT_IMPORT_EXAMPLE_ROW
    });
});

router.get("/manufacturers/import/template.csv", (_req, res) => {
    const exampleLine = PRODUCT_IMPORT_HEADERS.map((h) => {
        const raw = PRODUCT_IMPORT_EXAMPLE_ROW[h] ?? "";
        const s = String(raw);
        if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }).join(",");
    const body = `${PRODUCT_IMPORT_HEADER_LINE}\r\n${exampleLine}\r\n`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="product-import-template.csv"');
    return res.status(200).send(body);
});

router.post("/manufacturers/import/validate", (req, res) => {
    importUpload.array("files", 10)(req, res, async (err) => {
        if (err) {
            const message = err instanceof Error ? err.message : "Upload failed.";
            return sendError(res, 400, "UPLOAD_ERROR", message);
        }
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return sendError(res, 400, "VALIDATION_ERROR", "Select at least one CSV or Excel file.");
        }
        try {
            const result = await validateImportFileHeaders(files);
            return sendSuccess(res, result);
        } catch (e) {
            logger.error("Product import validate failed", e);
            return sendError(
                res,
                500,
                "IMPORT_ERROR",
                e instanceof Error ? e.message : "Validation failed."
            );
        }
    });
});

router.post("/manufacturers/import", (req, res) => {
    importUpload.array("files", 10)(req, res, async (err) => {
        if (err) {
            const message = err instanceof Error ? err.message : "Upload failed.";
            return sendError(res, 400, "UPLOAD_ERROR", message);
        }
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return sendError(res, 400, "VALIDATION_ERROR", "Select at least one CSV or Excel file.");
        }
        try {
            const result = await importManufacturerProducts(files);
            return sendSuccess(res, result);
        } catch (e) {
            logger.error("Product import failed", e);
            return sendError(
                res,
                500,
                "IMPORT_ERROR",
                e instanceof Error ? e.message : "Import failed."
            );
        }
    });
});

router.get("/manufacturers/import-brands/template.csv", (_req, res) => {
    const exampleLine = MANUFACTURER_IMPORT_HEADERS.map((h) => {
        const raw = MANUFACTURER_IMPORT_EXAMPLE_ROW[h] ?? "";
        const s = String(raw);
        if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }).join(",");
    const body = `${MANUFACTURER_IMPORT_HEADER_LINE}\r\n${exampleLine}\r\n`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="manufacturer-import-template.csv"');
    return res.status(200).send(body);
});

router.post("/manufacturers/import-brands/validate", (req, res) => {
    importUpload.array("files", 10)(req, res, async (err) => {
        if (err) {
            const message = err instanceof Error ? err.message : "Upload failed.";
            return sendError(res, 400, "UPLOAD_ERROR", message);
        }
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return sendError(res, 400, "VALIDATION_ERROR", "Select at least one CSV or Excel file.");
        }
        try {
            const result = await validateManufacturerImportHeaders(files);
            return sendSuccess(res, result);
        } catch (e) {
            logger.error("Manufacturer import validate failed", e);
            return sendError(
                res,
                500,
                "IMPORT_ERROR",
                e instanceof Error ? e.message : "Validation failed."
            );
        }
    });
});

router.post("/manufacturers/import-brands", (req, res) => {
    importUpload.array("files", 10)(req, res, async (err) => {
        if (err) {
            const message = err instanceof Error ? err.message : "Upload failed.";
            return sendError(res, 400, "UPLOAD_ERROR", message);
        }
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return sendError(res, 400, "VALIDATION_ERROR", "Select at least one CSV or Excel file.");
        }
        try {
            const result = await importManufacturers(files);
            return sendSuccess(res, result);
        } catch (e) {
            logger.error("Manufacturer import failed", e);
            return sendError(
                res,
                500,
                "IMPORT_ERROR",
                e instanceof Error ? e.message : "Import failed."
            );
        }
    });
});

router.get("/manufacturers/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid id.");
    }
    const item = getManufacturerProductById(id);
    if (!item) {
        return sendError(res, 404, "NOT_FOUND", "Manufacturer product not found.");
    }
    return sendSuccess(res, { item });
});

router.post("/manufacturers", validateBody(manufacturerProductSchema), (req, res) => {
    const input = req.validated;
    const duplicate = findManufacturerProductByKey({
        roofType: input.roofType,
        systemType: input.systemType,
        category: input.category,
        brand: input.brand,
        product: input.product
    });
    if (duplicate) {
        return sendError(res, 409, "DUPLICATE_PRODUCT", "This product already exists for the selected manufacturer.");
    }
    const item = createManufacturerProduct(input);
    return sendSuccess(res, { item }, 201);
});

router.put("/manufacturers/:id", validateBody(manufacturerProductSchema), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid id.");
    }
    const input = req.validated;
    const duplicate = findManufacturerProductByKey({
        roofType: input.roofType,
        systemType: input.systemType,
        category: input.category,
        brand: input.brand,
        product: input.product,
        excludeId: id
    });
    if (duplicate) {
        return sendError(res, 409, "DUPLICATE_PRODUCT", "This product already exists for the selected manufacturer.");
    }
    const item = updateManufacturerProduct(id, input);
    if (!item) {
        return sendError(res, 404, "NOT_FOUND", "Manufacturer product not found.");
    }
    return sendSuccess(res, { item });
});

router.delete("/manufacturers/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid id.");
    }
    const deleted = deleteManufacturerProduct(id);
    if (!deleted.changes) {
        return sendError(res, 404, "NOT_FOUND", "Manufacturer product not found.");
    }
    return sendSuccess(res, {});
});

router.delete("/manufacturers/group/:representativeId", (req, res) => {
    const representativeId = Number(req.params.representativeId);
    if (!Number.isFinite(representativeId)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid representativeId.");
    }
    const deleted = deleteManufacturerGroupByRepresentativeId(representativeId);
    if (!deleted.changes) {
        return sendError(res, 404, "NOT_FOUND", "Manufacturer group not found.");
    }
    return sendSuccess(res, {});
});

router.delete("/manufacturers/brand", (req, res) => {
    const roofType = typeof req.query.roofType === "string" ? req.query.roofType.trim() : "";
    const brand = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
    const systemType =
        typeof req.query.systemType === "string" && req.query.systemType.trim()
            ? req.query.systemType.trim()
            : null;
    if (!roofType || !brand) {
        return sendError(res, 400, "VALIDATION_ERROR", "roofType and brand are required.");
    }
    const deleted = deleteManufacturerBrand({ roofType, systemType, brand });
    if (!deleted.changes) {
        return sendError(res, 404, "NOT_FOUND", "Manufacturer brand not found.");
    }
    return sendSuccess(res, {});
});

router.put("/settings", validateBody(adminSettingsSchema), (req, res) => {
    saveAdminSettings(req.validated);
    return sendSuccess(res, { settings: getAdminSettings() });
});

router.get("/stats", (_req, res) => {
    const stats = getStats();
    const latestFive = Array.isArray(stats.latestFive) ? stats.latestFive.map(withSummary) : [];
    return sendSuccess(res, { stats: { ...stats, latestFive } });
});

router.get("/history", validateQuery(historyQuerySchema), (req, res) => {
    const { limit, offset, dateFrom, dateTo } = req.validatedQuery;
    const rows = listHistory({
        limit,
        offset,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
    });
    const total = countHistory({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
    return sendSuccess(res, { items: rows.map(withSummary), limit, offset, total, dateFrom, dateTo });
});

router.get("/history/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid id.");
    }
    const row = getHistoryById(id);
    if (!row) {
        return sendError(res, 404, "NOT_FOUND", "History entry not found.");
    }
    let input;
    let materials;
    let pricing;
    try {
        input = JSON.parse(row.input_json);
        materials = JSON.parse(row.materials_json);
        pricing = JSON.parse(row.pricing_json);
    } catch {
        return sendError(res, 500, "PARSE_ERROR", "Stored record is corrupted.");
    }
    return sendSuccess(res, {
        item: {
            id: row.id,
            userId: row.user_id,
            userName: row.user_name || null,
            createdAt: row.created_at,
            input,
            materials,
            pricing
        }
    });
});

router.get("/profile", (req, res) => {
    const row = db.prepare("SELECT id, email, display_name, created_at FROM users WHERE id = ?").get(req.user.id);
    if (!row) {
        return sendError(res, 404, "NOT_FOUND", "User not found.");
    }
    return sendSuccess(res, {
        profile: {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            createdAt: row.created_at
        }
    });
});

router.put("/profile", validateBody(profileUpdateSchema), (req, res) => {
    const { displayName } = req.validated;
    const hasEmail = Object.prototype.hasOwnProperty.call(req.validated, "email");
    const nextEmail = hasEmail ? String(req.validated.email || "").trim().toLowerCase() : undefined;

    if (hasEmail) {
        const exists = db
            .prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?")
            .get(nextEmail, req.user.id);
        if (exists) {
            return sendError(res, 409, "DUPLICATE_EMAIL", "Email is already used by another account.");
        }
    }

    if (Object.prototype.hasOwnProperty.call(req.validated, "displayName")) {
        db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName ?? null, req.user.id);
    }
    if (hasEmail) {
        db.prepare("UPDATE users SET email = ? WHERE id = ?").run(nextEmail, req.user.id);
    }

    const row = db.prepare("SELECT id, email, display_name, created_at FROM users WHERE id = ?").get(req.user.id);
    return sendSuccess(res, {
        profile: {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            createdAt: row.created_at
        }
    });
});

router.put("/password", validateBody(passwordChangeSchema), (req, res) => {
    const { currentPassword, newPassword } = req.validated;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return sendError(res, 401, "AUTH_FAILED", "Current password is incorrect.");
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user.id);
    return sendSuccess(res, {});
});

export default router;
