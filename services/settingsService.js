import { db } from "../db/database.js";
import { DEFAULT_MARGIN, MATERIAL_PRICES } from "../constants/pricing.js";
const CUSTOMER_MEASUREMENTS_KEY = "customer_measurements_json";

/** Admin "locked geometry" profile: only area, pitch, and lineal feet — never brands, waste, roof type, etc. */
export function sanitizeCustomerMeasurementProfile(raw) {
    if (!raw || typeof raw !== "object") return null;
    const roofIn = raw.roof && typeof raw.roof === "object" ? raw.roof : {};
    const lengthsIn = raw.lengths && typeof raw.lengths === "object" ? raw.lengths : {};
    return {
        roof: {
            area_sqft: roofIn.area_sqft ?? null,
            pitched_area_sqft: roofIn.pitched_area_sqft ?? null,
            flat_area_sqft: roofIn.flat_area_sqft ?? null,
            area_input_type: "slope_adjusted",
            pitch: roofIn.pitch ?? null
        },
        lengths: {
            ridge_lf: lengthsIn.ridge_lf ?? null,
            hip_lf: lengthsIn.hip_lf ?? null,
            valley_lf: lengthsIn.valley_lf ?? null,
            eave_lf: lengthsIn.eave_lf ?? null,
            rake_lf: lengthsIn.rake_lf ?? null
        }
    };
}

export function getDefaultMargin() {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("default_margin_percent");
    if (!row) return DEFAULT_MARGIN;
    const n = Number(row.value);
    return Number.isFinite(n) ? n : DEFAULT_MARGIN;
}

export function setDefaultMargin(v) {
    db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run("default_margin_percent", String(v));
}

export function getMaterialPriceOverrides() {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("material_prices_json");
    if (!row) return { ...MATERIAL_PRICES };
    try {
        const parsed = JSON.parse(row.value);
        if (typeof parsed !== "object" || parsed === null) return { ...MATERIAL_PRICES };
        return { ...MATERIAL_PRICES, ...parsed };
    } catch {
        return { ...MATERIAL_PRICES };
    }
}

export function setMaterialPricesFromForm(formObj) {
    const next = { ...MATERIAL_PRICES, ...formObj };
    db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run("material_prices_json", JSON.stringify(next));
}

export function getAdminSettings() {
    return {
        defaultMarginPercent: getDefaultMargin(),
        materialPrices: getMaterialPriceOverrides(),
        customerMeasurementProfile: getCustomerMeasurementProfile()
    };
}

export function getCustomerMeasurementProfile() {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(CUSTOMER_MEASUREMENTS_KEY);
    if (!row || !row.value) return null;
    try {
        const parsed = JSON.parse(row.value);
        return sanitizeCustomerMeasurementProfile(parsed);
    } catch {
        return null;
    }
}

export function setCustomerMeasurementProfile(profile) {
    const cleaned = sanitizeCustomerMeasurementProfile(profile);
    const value = cleaned ? JSON.stringify(cleaned) : "";
    db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run(CUSTOMER_MEASUREMENTS_KEY, value);
}

export function saveAdminSettings(input = {}) {
    const { defaultMarginPercent, materialPrices, customerMeasurementProfile } = input;
    if (defaultMarginPercent !== undefined && defaultMarginPercent !== null) {
        setDefaultMargin(Number(defaultMarginPercent));
    }
    if (materialPrices && typeof materialPrices === "object") {
        setMaterialPricesFromForm(materialPrices);
    }
    if (Object.prototype.hasOwnProperty.call(input, "customerMeasurementProfile")) {
        setCustomerMeasurementProfile(customerMeasurementProfile);
    }
}
