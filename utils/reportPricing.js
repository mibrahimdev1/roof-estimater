import { MATERIAL_PRICES as BASE_PRICES } from "../constants/pricing.js";
import { getMaterialPriceOverrides } from "../services/settingsService.js";
import { fastenerPackSizeForProduct } from "./quantityHelpers.js";

/** Price key for flat catalog rows (category = TPO | EPDM | etc., component from catalog). */
export function priceKeyForFlatRow(componentType) {
    const ct = String(componentType || "").toLowerCase();
    if (ct === "membrane") return "flat_membrane_roll";
    if (ct === "base") return "flat_base_roll";
    if (ct === "underlayment") return "underlayment_roll";
    return "flat_membrane_roll";
}

export function priceKeyForPitchedCategory(category) {
    const c = String(category || "");
    if (c === "Shingles") return "shingles_bundle";
    if (c === "Starter") return "starter_bundle";
    if (c === "Ridge Cap") return "ridge_bundle";
    if (c === "Underlayment") return "underlayment_roll";
    if (c === "Drip Edge") return "drip_edge_piece";
    if (c === "Ice & Water") return "valley_roll";
    if (c === "Flashing") return "flashing_piece";
    if (c === "Fasteners") return "nail_unit";
    if (c === "Ventilation") return "vent_unit";
    if (c === "Sealant") return "sealant_tube";
    return null;
}

export function priceKeyForRow({ roofType, category, componentType }) {
    if (roofType === "flat") return priceKeyForFlatRow(componentType);
    return priceKeyForPitchedCategory(category);
}

export function getPriceMap(requestOverrides = null) {
    const overrides = getMaterialPriceOverrides();
    return {
        ...BASE_PRICES,
        ...(overrides && typeof overrides === "object" ? overrides : {}),
        ...(requestOverrides && typeof requestOverrides === "object" ? requestOverrides : {})
    };
}

/**
 * Unit price for a report row.
 * Fasteners are ordered in boxes — return $/box = packSize × $/nail-or-cap for line-total parity.
 */
export function unitPriceForRow({
    roofType,
    category,
    componentType,
    product = null,
    requestOverrides = null
} = {}) {
    const key = priceKeyForRow({ roofType, category, componentType });
    if (!key) return null;
    const prices = getPriceMap(requestOverrides);
    const v = prices[key];
    if (typeof v !== "number" || Number.isNaN(v)) return null;
    if (roofType !== "flat" && String(category || "") === "Fasteners") {
        return Number((v * fastenerPackSizeForProduct(product)).toFixed(2));
    }
    return v;
}

/** Flatten hybrid pricing breakdown for export line items. */
export function mergePricingBreakdown(pricing) {
    const b = pricing?.breakdown;
    if (!b) return {};
    if (b.pitched && b.flat) {
        const p = b.pitched;
        const f = b.flat;
        return {
            flatMembrane: Number(p.flatMembrane || 0) + Number(f.flatMembrane || 0),
            flatBase: Number(p.flatBase || 0) + Number(f.flatBase || 0),
            shingles: Number(p.shingles || 0) + Number(f.shingles || 0),
            starter: Number(p.starter || 0) + Number(f.starter || 0),
            ridgeCaps: Number(p.ridgeCaps || 0) + Number(f.ridgeCaps || 0),
            underlayment: Number(p.underlayment || 0) + Number(f.underlayment || 0),
            dripEdge: Number(p.dripEdge || 0) + Number(f.dripEdge || 0),
            valley: Number(p.valley || 0) + Number(f.valley || 0),
            nails: Number(p.nails || 0) + Number(f.nails || 0),
            vents: Number(p.vents || 0) + Number(f.vents || 0),
            flashing: Number(p.flashing || 0) + Number(f.flashing || 0)
        };
    }
    return b;
}

/** Line-item rows for PDF / Word / Excel pricing section (before subtotal). */
export function buildPricingExportRows(pricing) {
    const b = mergePricingBreakdown(pricing);
    const flatCombined = Number(b.flatMembrane || 0) + Number(b.flatBase || 0);
    return [
        ["Flat roof materials (roll/sheet subtotal)", flatCombined],
        ["Shingles", b.shingles],
        ["Starter", b.starter],
        ["Ridge / hip caps", b.ridgeCaps],
        ["Underlayment", b.underlayment],
        ["Drip edge", b.dripEdge],
        ["Valley", b.valley],
        ["Nails", b.nails],
        ["Vents", b.vents],
        ["Flashing", b.flashing]
    ];
}
