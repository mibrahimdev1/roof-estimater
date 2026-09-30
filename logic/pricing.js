import { DEFAULT_MARGIN, MATERIAL_PRICES as BASE_PRICES } from "../constants/pricing.js";

function isMixed(materials) {
    return !!(materials && materials.pitched && materials.flat);
}

export function calculatePricing(materials, margin = DEFAULT_MARGIN, priceOverrides = null) {
    const MATERIAL_PRICES =
        priceOverrides && typeof priceOverrides === "object"
            ? { ...BASE_PRICES, ...priceOverrides }
            : { ...BASE_PRICES };

    if (isMixed(materials)) {
        const pitchedPricing = calculatePricing(materials.pitched, margin, MATERIAL_PRICES);
        const flatPricing = calculatePricing(materials.flat, margin, MATERIAL_PRICES);

        // Combine subtotals and re-apply margin once at the top.
        const subtotal = Number((pitchedPricing.subtotal + flatPricing.subtotal).toFixed(2));
        const marginAmount = Number(((subtotal * margin) / 100).toFixed(2));
        const total = Number((subtotal + marginAmount).toFixed(2));

        return {
            breakdown: {
                pitched: pitchedPricing.breakdown,
                flat: flatPricing.breakdown
            },
            pitched: pitchedPricing,
            flat: flatPricing,
            subtotal,
            marginPercent: margin,
            marginAmount,
            total
        };
    }

    let subtotal = 0;

    const isFlat = materials?.meta?.roofType === "flat";
    const flatRecs = isFlat && Array.isArray(materials?.recommendations?.flat) ? materials.recommendations.flat : [];
    let membraneCost = 0;
    let baseCost = 0;
    for (const r of flatRecs) {
        const q = Number(r.qty) || 0;
        const ct = String(r.componentType || "").toLowerCase();
        if (ct === "membrane") {
            membraneCost += q * MATERIAL_PRICES.flat_membrane_roll;
        } else if (ct === "base") {
            baseCost += q * MATERIAL_PRICES.flat_base_roll;
        } else if (ct === "underlayment") {
            baseCost += q * MATERIAL_PRICES.underlayment_roll;
        } else {
            membraneCost += q * MATERIAL_PRICES.flat_membrane_roll;
        }
    }
    const breakdown = isFlat
        ? {
            flatMembrane: Number(membraneCost.toFixed(2)),
            flatBase: Number(baseCost.toFixed(2)),
            shingles: 0,
            starter: 0,
            ridgeCaps: 0,
            underlayment: 0,
            dripEdge: 0,
            valley: 0,
            nails: 0,
            vents: 0,
            flashing: 0
        }
        : {
            flatMembrane: 0,
            flatBase: 0,
            shingles: materials.shingles.bundles * MATERIAL_PRICES.shingles_bundle,
            starter: materials.starter.bundles * MATERIAL_PRICES.starter_bundle,
            ridgeCaps: materials.ridgeCaps.bundles * MATERIAL_PRICES.ridge_bundle,
            underlayment: materials.underlayment.rolls * MATERIAL_PRICES.underlayment_roll,
            dripEdge: materials.dripEdge.pieces * MATERIAL_PRICES.drip_edge_piece,
            valley: materials.valley.rolls * MATERIAL_PRICES.valley_roll,
            nails: materials.nails ? materials.nails.count * MATERIAL_PRICES.nail_unit : 0,
            vents: materials.vents.units * MATERIAL_PRICES.vent_unit,
            flashing: (materials.flashing?.pieces ?? 0) * (MATERIAL_PRICES.flashing_piece ?? MATERIAL_PRICES.flashing_roll)
        };

    for (let key in breakdown) {
        subtotal += breakdown[key];
    }

    const marginAmount = (subtotal * margin) / 100;
    const total = subtotal + marginAmount;

    return {
        breakdown,
        subtotal: Number(subtotal.toFixed(2)),
        marginPercent: margin,
        marginAmount: Number(marginAmount.toFixed(2)),
        total: Number(total.toFixed(2))
    };
}

