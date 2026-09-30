import { calculateRoofEstimate } from "../logic/calculator.js";
import { calculatePricing } from "../logic/pricing.js";
import { validateEstimatePayload, normalizeEstimatePayload } from "../utils/validation.js";
import { getDefaultMargin, getMaterialPriceOverrides } from "./settingsService.js";

export function runEstimate(body) {
    const validation = validateEstimatePayload(body);
    if (!validation.ok) {
        return { ok: false, errors: validation.errors };
    }

    const input = normalizeEstimatePayload(body);
    const marginRaw = body.pricing_margin_percent;
    let marginPct = getDefaultMargin();
    if (marginRaw !== undefined && marginRaw !== null && marginRaw !== "") {
        const m = Number(marginRaw);
        if (Number.isFinite(m) && m >= 0 && m <= 100) marginPct = m;
    }
    input.pricing_margin_percent = marginPct;

    try {
        const materials = calculateRoofEstimate(input);
        const adminOverrides = getMaterialPriceOverrides();
        const requestOverrides =
            input.pricing_overrides && typeof input.pricing_overrides === "object" ? input.pricing_overrides : null;
        const materialPrices = requestOverrides
            ? { ...(adminOverrides || {}), ...requestOverrides }
            : adminOverrides;
        const pricing = calculatePricing(materials, input.pricing_margin_percent, materialPrices);
        return { ok: true, input, materials, pricing };
    } catch (e) {
        return {
            ok: false,
            errors: [e instanceof Error ? e.message : "Calculation failed."]
        };
    }
}
