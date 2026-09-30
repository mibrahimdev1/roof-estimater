import "dotenv/config";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

import "./db/database.js";
import { generatePDF } from "./utils/pdf.js";
import { generateWordDoc } from "./utils/word.js";
import { generateExcelOrder } from "./utils/excel.js";
import { sendError } from "./utils/apiResponse.js";
import { runEstimate } from "./services/estimateService.js";
import { saveCalculation } from "./services/historyService.js";
import { getCustomerMeasurementProfile } from "./services/settingsService.js";
import { listDistinctBrands, listFlatProductsForEstimator } from "./services/manufacturerCatalogService.js";
import { optionalAuth } from "./middleware/auth.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { logger, requestLogger } from "./utils/logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 5005;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use(express.static(path.join(__dirname, "public")));

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

app.use("/api/auth", authRoutes);
app.use("/api/admin", optionalAuth, adminRoutes);

app.get("/api/health", (_req, res) => {
    res.json({ success: true, ok: true, service: "roof-estimator" });
});

app.get("/api/estimator/measurement-profile", (_req, res) => {
    return res.json({
        success: true,
        data: {
            profile: getCustomerMeasurementProfile()
        }
    });
});

app.get("/api/estimator/brands", (req, res) => {
    const roofTypeRaw = String(req.query.roofType || "").trim().toLowerCase();
    const systemTypeRaw = String(req.query.systemType || "").trim().toLowerCase();
    const allowedRoof = new Set(["pitched", "flat", "hybrid", "mixed", ""]);
    if (!allowedRoof.has(roofTypeRaw)) {
        return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            'Query param roofType must be one of: "pitched", "flat", "hybrid".'
        );
    }
    const allowedSystem = new Set(["tpo", "epdm", "modified_bitumen", ""]);
    if (systemTypeRaw && !allowedSystem.has(systemTypeRaw)) {
        return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            'Query param systemType must be one of: "tpo", "epdm", "modified_bitumen".'
        );
    }

    let brands;
    if (roofTypeRaw === "hybrid" || roofTypeRaw === "mixed") {
        brands = listDistinctBrands({
            activeOnly: true,
            includePitched: true,
            includeFlat: true,
            systemType: systemTypeRaw || null
        });
    } else if (roofTypeRaw === "flat") {
        brands = listDistinctBrands({
            activeOnly: true,
            roofType: "flat",
            systemType: systemTypeRaw || null
        });
    } else if (roofTypeRaw === "pitched") {
        brands = listDistinctBrands({ activeOnly: true, roofType: "pitched" });
    } else {
        brands = listDistinctBrands({ activeOnly: true });
    }

    return res.json({
        success: true,
        data: {
            brands: [...brands, "Other"]
        }
    });
});

app.get("/api/estimator/flat-products", (req, res) => {
    const systemType = String(req.query.systemType || "").trim();
    const allowed = new Set(["tpo", "epdm", "modified_bitumen"]);
    if (!allowed.has(systemType)) {
        return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            'Query param systemType must be one of: "tpo", "epdm", "modified_bitumen".'
        );
    }
    const brandsRaw = String(req.query.brands || "")
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
    const products = listFlatProductsForEstimator({
        systemType,
        brands: brandsRaw,
        activeOnly: true
    });
    return res.json({
        success: true,
        data: { systemType, products }
    });
});

app.post("/api/calculate", optionalAuth, (req, res) => {
    const result = runEstimate(req.body);
    if (!result.ok) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body.", result.errors);
    }
    saveCalculation({
        userId: req.user?.id ?? null,
        input: result.input,
        materials: result.materials,
        pricing: result.pricing
    });
    res.json({
        success: true,
        data: {
            materials: result.materials,
            pricing: result.pricing,
            input: result.input
        }
    });
});

app.post("/api/proposal", optionalAuth, (req, res) => {
    const result = runEstimate(req.body);
    if (!result.ok) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body.", result.errors);
    }
    try {
        generatePDF(
            { materials: result.materials, pricing: result.pricing, input: result.input },
            res
        );
    } catch (e) {
        logger.error("PDF generation failed", e);
        if (!res.headersSent) {
            sendError(res, 500, "PDF_ERROR", e instanceof Error ? e.message : "Failed to generate PDF.");
        }
    }
});

app.post(
    "/api/proposal/docx",
    optionalAuth,
    asyncHandler(async (req, res) => {
        const result = runEstimate(req.body);
        if (!result.ok) {
            return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body.", result.errors);
        }
        await generateWordDoc(
            { materials: result.materials, pricing: result.pricing, input: result.input },
            res
        );
    })
);

app.post(
    "/api/proposal/xlsx",
    optionalAuth,
    asyncHandler(async (req, res) => {
        const result = runEstimate(req.body);
        if (!result.ok) {
            return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body.", result.errors);
        }
        await generateExcelOrder(
            {
                materials: result.materials,
                pricing: result.pricing,
                input: result.input
            },
            res
        );
    })
);

app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((_req, res) => {
    return sendError(res, 404, "NOT_FOUND", "The requested resource was not found.");
});

app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError) {
        return sendError(res, 400, "INVALID_JSON", "Malformed JSON body.");
    }
    if (res.headersSent) {
        return next(err);
    }
    logger.error("Unhandled request error", err);
    return sendError(
        res,
        500,
        "INTERNAL_ERROR",
        err instanceof Error ? err.message : "Internal server error."
    );
});

app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});
