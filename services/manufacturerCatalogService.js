import { db } from "../db/database.js";

const MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT = "__MANUFACTURER_GROUP__";
const ESTIMATOR_BRAND_EXCLUSIONS = new Set(["", "No Brand", "—"]);

export function listFlatProductsForEstimator({ systemType, brands = [], activeOnly = true } = {}) {
    if (!systemType) return [];
    const rows = listManufacturerProducts({ roofType: "flat", systemType, activeOnly });
    const brandList = Array.isArray(brands) ? brands.filter((b) => b && b !== "Other") : [];
    const filtered =
        brandList.length > 0
            ? rows.filter((row) => brandList.includes(String(row.brand || "")))
            : rows;
    return (filtered.length ? filtered : rows).map((row) => ({
        id: row.id,
        brand: row.brand,
        product: row.product,
        category: row.category,
        unit: row.unit,
        coverageValue: row.coverage_value,
        coverageBasis: row.coverage_basis,
        componentType: row.component_type,
        key: `${String(row.brand || "").trim()}::${String(row.product || "").trim()}`
    }));
}

/**
 * Distinct manufacturer brands for the estimator multi-select.
 * @param {object} opts
 * @param {boolean} [opts.activeOnly]
 * @param {"pitched"|"flat"|null} [opts.roofType] — when set, only brands with products for that roof type
 * @param {string|null} [opts.systemType] — for flat, limit to that system (tpo/epdm/modified_bitumen)
 * @param {boolean} [opts.includePitched] — hybrid helper: include pitched brands
 * @param {boolean} [opts.includeFlat] — hybrid helper: include flat brands (honors systemType)
 */
export function listDistinctBrands({
    activeOnly = true,
    roofType = null,
    systemType = null,
    includePitched = false,
    includeFlat = false
} = {}) {
    const clauses = ["product <> ?", "brand NOT IN ('', 'No Brand', '—')"];
    const params = [MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT];
    if (activeOnly) {
        clauses.push("is_active = 1");
    }

    if (includePitched || includeFlat) {
        const typeClauses = [];
        if (includePitched) {
            typeClauses.push("roof_type = 'pitched'");
        }
        if (includeFlat) {
            if (systemType) {
                typeClauses.push("(roof_type = 'flat' AND system_type = ?)");
                params.push(systemType);
            } else {
                typeClauses.push("roof_type = 'flat'");
            }
        }
        if (typeClauses.length) {
            clauses.push(`(${typeClauses.join(" OR ")})`);
        }
    } else if (roofType === "pitched" || roofType === "flat") {
        clauses.push("roof_type = ?");
        params.push(roofType);
        if (roofType === "flat" && systemType) {
            clauses.push("system_type = ?");
            params.push(systemType);
        }
    }

    const rows = db
        .prepare(
            `SELECT DISTINCT brand
             FROM manufacturer_products
             WHERE ${clauses.join(" AND ")}
             ORDER BY brand COLLATE NOCASE`
        )
        .all(...params);
    return rows
        .map((row) => String(row.brand || "").trim())
        .filter((brand) => brand && !ESTIMATOR_BRAND_EXCLUSIONS.has(brand));
}

function normalizeSystemType(systemType) {
    // Joi allows "" and null; the DB uses NULL for "none".
    return systemType ? systemType : null;
}

export function listManufacturerProducts({ roofType, systemType, activeOnly = true, includePlaceholder = false } = {}) {
    const clauses = [];
    const params = [];
    if (roofType) {
        clauses.push("roof_type = ?");
        params.push(roofType);
    }
    if (systemType) {
        clauses.push("system_type = ?");
        params.push(systemType);
    }
    if (activeOnly) {
        clauses.push("is_active = 1");
    }
    if (!includePlaceholder) {
        clauses.push("product <> ?");
        params.push(MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return db
        .prepare(
            `SELECT id, roof_type, system_type, category, brand, product, unit, coverage_value,
                    coverage_basis, component_type, sort_order, is_active, created_at, updated_at
             FROM manufacturer_products
             ${where}
             ORDER BY roof_type, COALESCE(system_type, ''), category, sort_order, brand, product`
        )
        .all(...params);
}

export function getManufacturerProductById(id) {
    return db
        .prepare(
            `SELECT id, roof_type, system_type, category, brand, product, unit, coverage_value,
                    coverage_basis, component_type, sort_order, is_active, created_at, updated_at
             FROM manufacturer_products
             WHERE id = ?`
        )
        .get(id);
}

export function listManufacturerGroups({ roofType, systemType, activeOnly = false } = {}) {
    const rows = listManufacturerProducts({ roofType, systemType, activeOnly, includePlaceholder: true });
    const map = new Map();
    for (const row of rows) {
        const key = [
            row.roof_type || "",
            row.system_type || "",
            row.category || "",
            row.brand || ""
        ].join("|");
        if (!map.has(key)) {
            map.set(key, {
                roofType: row.roof_type || null,
                systemType: row.system_type || null,
                category: row.category || "",
                brand: row.brand || "",
                products: [],
                placeholderProductId: null
            });
        }
        if (row.product === MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT) {
            map.get(key).placeholderProductId = row.id;
        } else {
            map.get(key).products.push(row);
        }
    }
    return Array.from(map.values());
}

export function createManufacturerProduct(input) {
    const now = "datetime('now')";
    const result = db
        .prepare(
            `INSERT INTO manufacturer_products
             (roof_type, system_type, category, brand, product, unit, coverage_value, coverage_basis, component_type, sort_order, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${now}, ${now})`
        )
        .run(
            input.roofType,
            input.systemType || null,
            input.category,
            input.brand,
            input.product,
            input.unit,
            input.coverageValue,
            input.coverageBasis || "",
            input.componentType || null,
            Number(input.sortOrder ?? 0),
            input.isActive ? 1 : 0
        );
    return db
        .prepare("SELECT * FROM manufacturer_products WHERE id = ?")
        .get(Number(result.lastInsertRowid));
}

export function updateManufacturerProduct(id, input) {
    db.prepare(
        `UPDATE manufacturer_products
         SET roof_type = ?,
             system_type = ?,
             category = ?,
             brand = ?,
             product = ?,
             unit = ?,
             coverage_value = ?,
             coverage_basis = ?,
             component_type = ?,
             sort_order = ?,
             is_active = ?,
             updated_at = datetime('now')
         WHERE id = ?`
    ).run(
        input.roofType,
        input.systemType || null,
        input.category,
        input.brand,
        input.product,
        input.unit,
        input.coverageValue,
        input.coverageBasis || "",
        input.componentType || null,
        Number(input.sortOrder ?? 0),
        input.isActive ? 1 : 0,
        id
    );
    return db.prepare("SELECT * FROM manufacturer_products WHERE id = ?").get(id);
}

export function deleteManufacturerProduct(id) {
    return db.prepare("DELETE FROM manufacturer_products WHERE id = ?").run(id);
}

export function findManufacturerProductByKey({ roofType, systemType, category, brand, product, excludeId } = {}) {
    const params = [roofType, normalizeSystemType(systemType), category, brand, product];
    let where = "roof_type = ? AND system_type IS ? AND category = ? AND brand = ? AND product = ?";
    if (excludeId !== undefined && excludeId !== null) {
        where += " AND id <> ?";
        params.push(excludeId);
    }
    return db.prepare(`SELECT id FROM manufacturer_products WHERE ${where}`).get(...params);
}

export function brandExistsForGroup({ roofType, systemType, category, brand } = {}) {
    const row = db
        .prepare(
            `SELECT id FROM manufacturer_products
             WHERE roof_type = ?
               AND system_type IS ?
               AND category = ?
               AND brand = ?
             LIMIT 1`
        )
        .get(roofType, normalizeSystemType(systemType), category, brand);
    return Boolean(row);
}

export function deleteManufacturerBrand({ roofType, systemType, brand }) {
    const result = db
        .prepare(
            `DELETE FROM manufacturer_products
             WHERE roof_type = ?
               AND system_type IS ?
               AND brand = ?`
        )
        .run(roofType, normalizeSystemType(systemType), brand);
    return result;
}

export function deleteManufacturerGroupByRepresentativeId(repId) {
    const rep = db
        .prepare(`SELECT roof_type, system_type, category, brand FROM manufacturer_products WHERE id = ?`)
        .get(repId);
    if (!rep) {
        return { changes: 0 };
    }

    const result = db
        .prepare(
            `DELETE FROM manufacturer_products
             WHERE roof_type = ?
               AND system_type IS ?
               AND category = ?
               AND brand = ?`
        )
        .run(rep.roof_type, rep.system_type, rep.category, rep.brand);

    return result;
}
