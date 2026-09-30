import { CONSTANTS } from "../constants/estimation.js";
import {
    dripEdgePiecesForLf,
    fastenerBoxesFromCount,
    fastenerPackSizeForProduct,
    flashingLfForProduct,
    flashingPiecesForProduct,
    roundUp,
    totalDripEdgeLf,
    totalFlashingLf
} from "./quantityHelpers.js";

export function shingleStyleLabel(code) {
    const m = { "3tab": "3-Tab", architectural: "Architectural (dimensional)", designer: "Designer / luxury" };
    return m[code] || code || "—";
}

export function manufacturerDisplay(input) {
    const p = input?.product;
    if (!p) return "—";
    if (Array.isArray(p.manufacturers) && p.manufacturers.length) {
        return p.manufacturers
            .map((m) =>
                m === "Other" && p.manufacturer_custom ? `Other (${p.manufacturer_custom})` : m
            )
            .join(", ");
    }
    if (p.manufacturer === "Other" && p.manufacturer_custom) {
        return `Other (${p.manufacturer_custom})`;
    }
    return p.manufacturer || "—";
}

export function selectedBrandsFromInput(input) {
    const raw = input?.product?.manufacturers;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((b) => String(b || "").trim())
        .filter((b) => !!b && b !== "Other");
}

export function filterRecommendationsByBrands(recommendations, selectedBrands) {
    const rows = Array.isArray(recommendations) ? recommendations : [];
    const brands = Array.isArray(selectedBrands) ? selectedBrands.filter(Boolean) : [];
    if (!brands.length) return rows;
    return rows.filter((r) => {
        const brand = String(r?.brand || "");
        // Keep neutral/common accessories that are not manufacturer-specific.
        if (brand === "No Brand" || brand === "—") return true;
        return brands.includes(brand);
    });
}

export function buildMaterialOrderRows(materials, input) {
    const m = materials;
    const roofType = materials?.meta?.roofType || input?.roof?.type || "pitched";
    const mfr = manufacturerDisplay(input);
    const style = shingleStyleLabel(input?.product?.shingle_style);
    const recommendationRowsRaw =
        roofType === "flat"
            ? materials?.recommendations?.flat || []
            : materials?.recommendations?.pitched || [];
    const recommendationRows = filterRecommendationsByBrands(recommendationRowsRaw, selectedBrandsFromInput(input));

    function suggestedWasteForRow(row) {
        const sec = String(row.section || "").toLowerCase();
        if (sec.includes("flat")) {
            return materials.flat?.meta?.suggestedWasteFactor ?? materials.meta?.suggestedWasteFactor;
        }
        return materials.pitched?.meta?.suggestedWasteFactor ?? materials.meta?.suggestedWasteFactor;
    }

    const dynamicRows = recommendationRows.map((row, idx) => {
        const sw = suggestedWasteForRow(row);
        const swPct = Number.isFinite(Number(sw)) ? (Number(sw) * 100).toFixed(1) : "—";
        return {
            line: idx + 1,
            section: row.section,
            category: row.category,
            description: `${row.brand} - ${row.product}`,
            product: row.product,
            manufacturer: row.brand,
            shingle_style: "—",
            qty: row.qty,
            unit: row.unit,
            detail: `${row.coverageBasis} · suggested waste ${swPct}%`,
            isCategoryHeader: false,
            componentType: row.componentType || null
        };
    });

    if (dynamicRows.length) {
        return dynamicRows;
    }

    return [
        ...dynamicRows,
        {
            line: dynamicRows.length + 1,
            section: "Pitched Roof Materials",
            category: "Shingles",
            description: `Asphalt shingles (${style})`,
            manufacturer: mfr,
            shingle_style: style,
            qty: m.shingles.bundles,
            unit: "bundles",
            detail: `${m.shingles.squares} squares · pitch-adjusted ${m.shingles.surfaceArea} sq ft · suggested waste ${((materials.meta?.suggestedWasteFactor ?? materials.meta?.wasteFactor ?? 0) * 100).toFixed(1)}%`
        },
        {
            line: dynamicRows.length + 2,
            section: "Pitched Roof Materials",
            category: "Starter",
            description: "Starter strip",
            manufacturer: mfr,
            shingle_style: style,
            qty: m.starter.bundles,
            unit: "bundles",
            detail: `${m.starter.lf} LF (eave + rake)`
        },
        {
            line: dynamicRows.length + 3,
            section: "Pitched Roof Materials",
            category: "Ridge / hip",
            description: "Ridge & hip caps",
            manufacturer: mfr,
            shingle_style: style,
            qty: m.ridgeCaps.bundles,
            unit: "bundles",
            detail: `${m.ridgeCaps.lf} LF ridge+hip`
        },
        {
            line: dynamicRows.length + 4,
            section: "Pitched Roof Materials",
            category: "Underlayment",
            description: "Synthetic underlayment",
            manufacturer: mfr,
            shingle_style: "—",
            qty: m.underlayment.rolls,
            unit: "rolls",
            detail: `~${CONSTANTS.underlaymentEffectiveCoverage} sq ft eff. / roll`
        },
        {
            line: dynamicRows.length + 5,
            section: "Pitched Roof Materials",
            category: "Drip edge",
            description: `Drip edge (${CONSTANTS.dripEdgeLength}' sticks)`,
            manufacturer: mfr,
            shingle_style: "—",
            qty: m.dripEdge.pieces,
            unit: "pieces",
            detail: `${m.dripEdge.lf} LF`
        },
        {
            line: dynamicRows.length + 6,
            section: "Pitched Roof Materials",
            category: "Valley",
            description: "Valley membrane",
            manufacturer: mfr,
            shingle_style: "—",
            qty: m.valley.rolls,
            unit: "rolls",
            detail: `${m.valley.lf} LF · ${m.valley.sqft} sq ft (3' width est.)`
        },
        {
            line: dynamicRows.length + 7,
            section: "Pitched Roof Materials",
            category: "Fasteners",
            description: "Roofing nails",
            manufacturer: "—",
            shingle_style: "—",
            qty: m.nails.count,
            unit: "nails (est.)",
            detail: `${CONSTANTS.nailsPerSquare} nails / square × ${m.shingles.squares} squares`
        },
        {
            line: dynamicRows.length + 8,
            section: "Pitched Roof Materials",
            category: "Ventilation",
            description: "Box / ridge vents",
            manufacturer: "—",
            shingle_style: "—",
            qty: m.vents.units,
            unit: "units",
            detail: "1 unit per 300 sq ft recorded roof area (rounded up)"
        },
        {
            line: dynamicRows.length + 9,
            section: "Pitched Roof Materials",
            category: "Flashing",
            description: "Flashing (combined est.)",
            manufacturer: mfr,
            shingle_style: "—",
            qty: m.flashing.pieces,
            unit: "pieces",
            detail: `${m.flashing.lf} LF total (valley + step + apron) · 10 ft sections`
        }
    ];
}

function fmtPct(p) {
    const v = Number(p);
    if (!Number.isFinite(v)) return "—";
    return (v * 100).toFixed(2).replace(/\.00$/, "") + "%";
}

export function approxEqWaste(a, b, eps = 1e-6) {
    return Math.abs(Number(a) - Number(b)) <= eps;
}

/**
 * Waste comparison columns for exports. Omits a "suggested" column when it would
 * duplicate 0%, 10%, or 15%. Omits "custom" when it duplicates an existing column.
 */
export function scenarioPercents(suggestedWasteFactor, customWasteFactor = null) {
    const s = Number(suggestedWasteFactor);
    const suggestedWaste = Number.isFinite(s) && s >= 0 ? s : 0.1;

    const arr = [
        { key: "w0", label: "Waste (0%)", waste: 0 },
        { key: "w10", label: "Waste (10%)", waste: 0.1 }
    ];

    const sugDupFixed =
        approxEqWaste(suggestedWaste, 0) ||
        approxEqWaste(suggestedWaste, 0.1) ||
        approxEqWaste(suggestedWaste, 0.15);
    if (!sugDupFixed) {
        arr.push({
            key: "ws",
            label: `Waste (suggested ${fmtPct(suggestedWaste)})`,
            waste: suggestedWaste
        });
    }

    arr.push({ key: "w15", label: "Waste (15%)", waste: 0.15 });

    const c = Number(customWasteFactor);
    if (Number.isFinite(c) && c >= 0) {
        const dupExisting =
            approxEqWaste(c, 0) ||
            approxEqWaste(c, 0.1) ||
            approxEqWaste(c, 0.15) ||
            (!sugDupFixed && approxEqWaste(c, suggestedWaste));
        if (!dupExisting) {
            arr.push({ key: "wc", label: `Waste (custom ${fmtPct(c)})`, waste: c });
        }
    }

    return arr;
}

/** Single ordering / comparison column: model-suggested label when custom not used for qty. */
export function orderingScenariosSingle(sectionMeta) {
    const custom = Number(sectionMeta?.wasteCustomFactor);
    const ordering =
        Number.isFinite(custom) && custom >= 0
            ? custom
            : Number.isFinite(Number(sectionMeta?.wasteFactor)) && sectionMeta.wasteFactor >= 0
              ? sectionMeta.wasteFactor
              : 0.1;
    const suggested = Number(sectionMeta?.suggestedWasteFactor);
    const isCustomOrdering =
        Number.isFinite(custom) && custom >= 0 && (!Number.isFinite(suggested) || !approxEqWaste(custom, suggested));
    const label = isCustomOrdering
        ? `Qty (waste ${(ordering * 100).toFixed(2)}%, custom)`
        : `Qty (waste ${(ordering * 100).toFixed(2)}%, suggested)`;
    return [{ key: "wOrd", label, waste: ordering }];
}

/** Scenario key used for unit price × qty line math. */
export function pickPricingScenarioKey(sectionMeta, scenarios) {
    const one = scenarios.length === 1 ? scenarios[0] : null;
    if (one && one.key === "wOrd") return "wOrd";

    const custom = Number(sectionMeta?.wasteCustomFactor);
    const suggested = Number(sectionMeta?.suggestedWasteFactor ?? sectionMeta?.wasteFactor);
    const sugWaste = Number.isFinite(suggested) && suggested >= 0 ? suggested : 0.1;

    if (Number.isFinite(custom) && custom >= 0) {
        for (const sc of scenarios) {
            if (approxEqWaste(sc.waste, custom)) return sc.key;
        }
    }
    const ws = scenarios.find((sc) => sc.key === "ws");
    if (ws) return "ws";
    if (Number.isFinite(suggested) && suggested >= 0) {
        for (const sc of scenarios) {
            if (approxEqWaste(sc.waste, sugWaste)) return sc.key;
        }
    }
    return "w10";
}

function basisForCategoryPitched(inputLengths, category) {
    const lengths = inputLengths || {};
    const eave = Number(lengths.eave_lf) || 0;
    const rake = Number(lengths.rake_lf) || 0;
    const ridge = Number(lengths.ridge_lf) || 0;
    const hip = Number(lengths.hip_lf) || 0;
    const valley = Number(lengths.valley_lf) || 0;
    const stepLf = Number(lengths.flashing_lf) || 0;
    const apronLf = Number(lengths.apron_flashing_lf) || 0;
    const flashingLf = valley + stepLf + apronLf;

    if (category === "Starter") return { basis: eave + rake, unit: "ft" };
    if (category === "Ridge Cap") return { basis: ridge + hip, unit: "ft" };
    if (category === "Ice & Water") return { basis: eave + valley, unit: "ft" };
    if (category === "Drip Edge") return { basis: eave + rake, unit: "ft" };
    if (category === "Flashing") return { basis: flashingLf, unit: "ft" };
    if (category === "Fasteners") return { basis: null, unit: "" };
    if (category === "Sealant") return { basis: null, unit: "" };
    // Shingles, Underlayment, etc are area-based.
    return { basis: null, unit: "" };
}

function computeQtyForRow({ roofType, category, row, sectionMeta, lengths, scenarioWaste }) {
    const coverage = Number(row.coverage_value || row.coverageValue) || 1;
    const surfaceArea = Number(sectionMeta.surfaceArea) || 0;
    const waste = Number(scenarioWaste) || 0;
    const adjustedArea = surfaceArea * (1 + waste);

    if (roofType === "flat") {
        return roundUp(adjustedArea / coverage);
    }

    // Pitched:
    const base = basisForCategoryPitched(lengths, category);
    const productLc = String(row.product || "").toLowerCase();

    // Area-based by default.
    let qtyRaw = adjustedArea / coverage;

    if (category === "Starter" || category === "Ridge Cap" || category === "Ice & Water") {
        // ceil((basisLf × (1+waste)) / coverage) — no intermediate LF rounding
        const adjustedLf = (Number(base.basis) || 0) * (1 + waste);
        qtyRaw = adjustedLf / coverage;
    } else if (category === "Drip Edge") {
        const eave = Number(lengths?.eave_lf) || 0;
        const rake = Number(lengths?.rake_lf) || 0;
        const lfBase = productLc.includes("rake")
            ? rake
            : productLc.includes("eave")
              ? eave
              : (Number(base.basis) || 0);
        return dripEdgePiecesForLf(lfBase * (1 + waste));
    } else if (category === "Fasteners") {
        // Catalog coverage_value = count per square; display/order as boxes.
        const squares = adjustedArea / 100;
        const count = squares * coverage;
        const pack = fastenerPackSizeForProduct(row.product);
        return fastenerBoxesFromCount(count, pack);
    } else if (category === "Sealant") {
        const squares = adjustedArea / 100;
        qtyRaw = squares / coverage;
    } else if (category === "Flashing") {
        return flashingPiecesForProduct(productLc, lengths, waste);
    }

    return roundUp(qtyRaw);
}

function totalBasisForCategory({ roofType, category, sectionMeta, lengths, scenarioWaste }) {
    const surfaceArea = Number(sectionMeta.surfaceArea) || 0;
    const waste = Number(scenarioWaste) || 0;
    if (roofType === "flat") {
        return { value: Math.round(surfaceArea * (1 + waste)), unit: "sqft" };
    }
    // Pitched: shingles/underlayment/etc are sqft; LF categories (incl. drip/flashing) show distance.
    const base = basisForCategoryPitched(lengths, category);
    if (category === "Shingles" || category === "Underlayment" || category === "TPO" || category === "EPDM" || category === "MODIFIED_BITUMEN") {
        return { value: Math.round(surfaceArea * (1 + waste)), unit: "sqft" };
    }
    if (category === "Drip Edge") {
        return { value: totalDripEdgeLf(lengths, waste), unit: "ft" };
    }
    if (category === "Flashing") {
        return { value: totalFlashingLf(lengths, waste), unit: "ft" };
    }
    if (base.basis != null) {
        return { value: Math.round((Number(base.basis) || 0) * (1 + waste)), unit: "ft" };
    }
    return { value: "", unit: "" };
}

export function buildMaterialEstimateGroups({
    roofType,
    sectionMeta,
    recommendations,
    lengths,
    selectedBrands = [],
    wasteColumnMode = "multi"
}) {
    const modelSuggested = Number(sectionMeta?.suggestedWasteFactor ?? sectionMeta?.wasteFactor) || 0.1;
    const customWaste = Number(sectionMeta?.wasteCustomFactor);
    const scenarios =
        wasteColumnMode === "single"
            ? orderingScenariosSingle(sectionMeta)
            : scenarioPercents(modelSuggested, Number.isFinite(customWaste) ? customWaste : null);

    // Group by category.
    const byCategory = new Map();
    for (const r of filterRecommendationsByBrands(recommendations || [], selectedBrands)) {
        const cat = String(r.category || "").trim() || "Other";
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(r);
    }

    const categories = Array.from(byCategory.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    const groups = categories.map((category) => {
        const rows = (byCategory.get(category) || []).slice().sort((a, b) => {
            const ab = String(a.brand || "").localeCompare(String(b.brand || ""), undefined, { sensitivity: "base" });
            if (ab !== 0) return ab;
            return String(a.product || "").localeCompare(String(b.product || ""), undefined, { sensitivity: "base" });
        });

        const totals = {};
        for (const s of scenarios) {
            const t = totalBasisForCategory({ roofType, category, sectionMeta, lengths, scenarioWaste: s.waste });
            totals[s.key] = t;
        }

        const lineRows = rows.map((row) => {
            const qtyByScenario = {};
            for (const s of scenarios) {
                qtyByScenario[s.key] = computeQtyForRow({
                    roofType,
                    category,
                    row,
                    sectionMeta,
                    lengths,
                    scenarioWaste: s.waste
                });
            }
            const productLc = String(row.product || "").toLowerCase();
            let coverageBasis = row.coverageBasis || row.coverage_basis || "";
            let unit = row.unit;
            if (category === "Drip Edge") {
                const edgeLf = productLc.includes("rake")
                    ? Number(lengths?.rake_lf) || 0
                    : productLc.includes("eave")
                      ? Number(lengths?.eave_lf) || 0
                      : (Number(lengths?.eave_lf) || 0) + (Number(lengths?.rake_lf) || 0);
                if (edgeLf > 0) {
                    const edgeLabel = productLc.includes("rake") ? "rake" : productLc.includes("eave") ? "eave" : "total";
                    coverageBasis = `${coverageBasis || "10 ft sections"} · ${Math.round(edgeLf)} LF ${edgeLabel}`;
                }
            } else if (category === "Flashing") {
                const lf = flashingLfForProduct(productLc, lengths);
                if (lf > 0) {
                    coverageBasis = `${coverageBasis || "10 ft sections"} · ${Math.round(lf)} LF`;
                }
            } else if (category === "Fasteners") {
                unit = "boxes";
                const pack = fastenerPackSizeForProduct(row.product);
                const rate = Number(row.coverage_value || row.coverageValue) || 0;
                const perSquare = rate || (isPlasticCapProduct(row.product) ? 120 : CONSTANTS.nailsPerSquare);
                coverageBasis = `${perSquare}/square · ${pack}/box`;
            }
            return {
                brand: row.brand,
                product: row.product,
                unit,
                coverageBasis,
                qtyByScenario,
                raw: row
            };
        });

        return { category, totals, rows: lineRows };
    });

    return { scenarios, groups };
}

/** Integer sq ft with thousands separator (e.g. 5,374). */
export function fmtSqftInt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return Math.round(v).toLocaleString("en-US");
}

/** Roofing squares for summary tables — one decimal, rounded up at 0.1 (e.g. 63.5). */
export function fmtSquaresSummary(areaSqft) {
    const v = Number(areaSqft);
    if (!Number.isFinite(v) || v < 0) return "—";
    return (Math.ceil((v / 100) * 10) / 10).toFixed(1);
}

function wastePctLabel(w) {
    const pct = Number(w) * 100;
    if (!Number.isFinite(pct)) return "—";
    if (Math.abs(pct - Math.round(pct)) < 0.001) return `${Math.round(pct)}%`;
    return `${pct.toFixed(2)}%`;
}

/** Fixed waste % anchors for the summary grid; suggested % is inserted when distinct. */
export function wasteSummaryPercents(suggestedWasteFactor) {
    const s = Number(suggestedWasteFactor);
    const suggested = Number.isFinite(s) && s >= 0 ? s : 0.1;
    const fixed = [0, 0.1, 0.12, 0.15, 0.17, 0.2];
    const eps = 0.0005;
    const all = fixed.some((w) => approxEqWaste(w, suggested, eps)) ? [...fixed] : [...fixed, suggested];
    all.sort((a, b) => a - b);
    const recommendedIdx = all.findIndex((w) => approxEqWaste(w, suggested, eps));
    return { percents: all, recommendedIdx, suggested };
}

/**
 * Per-pitch columns for the Pitch summary table.
 * Uses roof.pitch_area_sqft when provided; otherwise splits pitched surface area across pitches.
 */
export function buildPitchSummaryColumns(roof, sectionMeta) {
    const surfaceArea = Number(sectionMeta?.surfaceArea) || 0;
    const primaryPitch = Number(roof?.pitch ?? sectionMeta?.pitch ?? 0);
    const pitches =
        Array.isArray(roof?.pitches) && roof.pitches.length
            ? roof.pitches.map(Number).filter((p) => Number.isFinite(p))
            : Number.isFinite(primaryPitch)
              ? [primaryPitch]
              : [];

    if (!pitches.length) return [];

    let areas;
    const explicit = Array.isArray(roof?.pitch_area_sqft) ? roof.pitch_area_sqft.map(Number) : null;
    if (explicit && explicit.length === pitches.length && explicit.every((a) => Number.isFinite(a) && a >= 0)) {
        areas = explicit;
    } else if (pitches.length === 1) {
        areas = [surfaceArea];
    } else {
        const per = surfaceArea / pitches.length;
        let allocated = 0;
        areas = pitches.map((_, i) => {
            if (i === pitches.length - 1) return Math.max(0, Math.round(surfaceArea - allocated));
            const chunk = Math.round(per);
            allocated += chunk;
            return chunk;
        });
    }

    return pitches.map((pitch, i) => {
        const areaSqft = areas[i];
        return {
            pitch,
            label: `${pitch}/12`,
            areaSqft,
            areaDisplay: fmtSqftInt(areaSqft),
            squaresDisplay: fmtSquaresSummary(areaSqft)
        };
    });
}

/** Waste % summary columns (area + squares at each waste level). */
export function buildWasteSummaryColumns(sectionMeta) {
    const surfaceArea = Number(sectionMeta?.surfaceArea) || 0;
    const { percents, recommendedIdx } = wasteSummaryPercents(sectionMeta?.suggestedWasteFactor);

    const columns = percents.map((waste) => {
        const areaSqft = Math.round(surfaceArea * (1 + waste));
        return {
            waste,
            label: wastePctLabel(waste),
            areaSqft,
            areaDisplay: fmtSqftInt(areaSqft),
            squaresDisplay: fmtSquaresSummary(areaSqft)
        };
    });

    return { columns, recommendedIdx };
}
