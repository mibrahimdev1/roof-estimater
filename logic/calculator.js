import { CONSTANTS } from "../constants/estimation.js";
import { listManufacturerProducts } from "../services/manufacturerCatalogService.js";
import {
    dripEdgePiecesForLf,
    fastenerBoxesFromCount,
    fastenerPackSizeForProduct,
    flashingPiecesForProduct,
    roundUp,
    totalFlashingPieces
} from "../utils/quantityHelpers.js";
import {
    filterCatalogRowsByProductSelection,
    productIncludesRoofingNails
} from "../utils/productSelection.js";

function pitchMultiplier(pitch) {
    return Math.sqrt((pitch * pitch + 144) / 144);
}

function calculateWaste({ valley, hip, ridge, complexity }) {
    let waste = 0.1;
    waste += (valley / 100) * 0.05;
    waste += (hip / 100) * 0.03;
    waste += (ridge / 100) * 0.01;
    if (complexity === "medium") waste += 0.02;
    if (complexity === "high") waste += 0.04;
    return Math.min(waste, 0.25);
}

/** Smaller footprints tend to need a slightly higher waste %; larger roofs slightly lower (bounded). */
function areaWasteAdjustment(surfaceAreaSqft, roofType) {
    if (!Number.isFinite(surfaceAreaSqft) || surfaceAreaSqft <= 0) return 0;
    const refSqft = 3200;
    const ratio = surfaceAreaSqft / refSqft;
    if (ratio <= 0) return 0;
    const cap = roofType === "flat" ? 0.02 : 0.028;
    const sensitivity = roofType === "flat" ? 0.0085 : 0.011;
    const bump = -Math.log2(ratio) * sensitivity;
    if (!Number.isFinite(bump)) return 0;
    return Math.max(-cap, Math.min(cap, bump));
}

function dynamicWasteFactor({ roofType, pitch, complexity, valley, hip, ridge, surfaceAreaSqft }) {
    // Calibrated model aligned to client report tendencies; still bounded.
    const complexityBump =
        complexity === "high"
            ? roofType === "flat"
                ? 0.018
                : 0.028
            : complexity === "medium"
              ? roofType === "flat"
                  ? 0.011
                  : 0.014
              : roofType === "flat"
                ? 0.004
                : 0;
    const base = roofType === "flat" ? 0.038 : 0.068;
    const pitchBump = roofType === "flat" ? 0 : Math.max(0, Math.min((pitch - 4) * 0.0027, 0.036));
    const shapeBump =
        roofType === "flat"
            ? 0
            : (valley / 100) * 0.036 + (hip / 100) * 0.022 + (ridge / 100) * 0.009;
    const areaBump = areaWasteAdjustment(surfaceAreaSqft, roofType);
    const cap = roofType === "flat" ? 0.18 : 0.3;
    return Math.min(base + complexityBump + pitchBump + shapeBump + areaBump, cap);
}

function calcShingles(surfaceArea, waste) {
    const adjustedArea = surfaceArea * (1 + waste);
    const rawSquares = adjustedArea / 100;
    const squares = roundUp(rawSquares);
    const bundles = squares * CONSTANTS.bundlesPerSquare;

    return {
        surfaceArea: Number(surfaceArea.toFixed(2)),
        adjustedArea: Number(adjustedArea.toFixed(2)),
        squares,
        bundles
    };
}

function calcStarter(eave, rake) {
    const totalLF = eave + rake;

    return {
        lf: totalLF,
        bundles: roundUp(totalLF / CONSTANTS.starterCoverage)
    };
}

function calcRidgeCaps(ridge, hip) {
    const totalLF = ridge + hip;

    return {
        lf: totalLF,
        bundles: roundUp(totalLF / CONSTANTS.ridgeCapCoverage)
    };
}

function calcUnderlayment(surfaceArea, waste) {
    const adjusted = surfaceArea * (1 + waste);

    return {
        rolls: roundUp(adjusted / CONSTANTS.underlaymentEffectiveCoverage)
    };
}

function calcDripEdge(eave, rake) {
    const total = eave + rake;

    return {
        lf: total,
        pieces: roundUp(total / CONSTANTS.dripEdgeLength)
    };
}

function calcValley(valley) {
    const width = 3;
    const sqft = valley * width;

    return {
        lf: valley,
        sqft,
        rolls: roundUp(sqft / 200)
    };
}

function calcNails(squares) {
    return {
        count: squares * CONSTANTS.nailsPerSquare
    };
}

function calcVents(area) {
    return {
        units: roundUp(area / 300)
    };
}

function calcFlashing(lengths) {
    const valley = Number(lengths?.valley_lf) || 0;
    const step = Number(lengths?.flashing_lf) || 0;
    const apron = Number(lengths?.apron_flashing_lf) || 0;
    const lf = valley + step + apron;
    return {
        lf,
        pieces: totalFlashingPieces(lengths, 0)
    };
}

function buildRecoRow({
    section,
    category,
    brand,
    product,
    qty,
    unit,
    coverageBasis,
    coverageValue,
    componentType = null
}) {
    const cv = Number(coverageValue);
    return {
        section,
        category,
        brand,
        product,
        qty: roundUp(qty),
        unit,
        coverageBasis,
        coverageValue: Number.isFinite(cv) && cv > 0 ? cv : null,
        componentType
    };
}

export function calculateRoofEstimate(input) {
    const { roof, lengths } = input;
    const roofType = roof.type || "pitched";
    const flatSystem = roof.flat_system || null;

    const pitchedPlanArea = Number(roof.pitched_area_sqft ?? 0) || 0;
    const flatPlanArea = Number(roof.flat_area_sqft ?? 0) || 0;
    const hasPitched = pitchedPlanArea > 0;
    const hasFlat = flatPlanArea > 0;
    const isMixed = hasPitched && hasFlat;

    const selectedManufacturers = Array.isArray(input?.product?.manufacturers)
        ? input.product.manufacturers.filter((m) => typeof m === "string" && m.trim())
        : [];

    function computeSection(sectionRoofType, planAreaSqft) {
        const pitchAdjustedArea =
            sectionRoofType === "flat"
                ? planAreaSqft
                : roof.area_input_type === "slope_adjusted"
                  ? planAreaSqft
                  : planAreaSqft * pitchMultiplier(roof.pitch);
        const surfaceArea = pitchAdjustedArea;

        const legacyWaste = calculateWaste({
            valley: lengths.valley_lf,
            hip: lengths.hip_lf,
            ridge: lengths.ridge_lf,
            complexity: roof.complexity
        });
        const computedWaste = dynamicWasteFactor({
            roofType: sectionRoofType,
            pitch: roof.pitch,
            complexity: roof.complexity,
            valley: lengths.valley_lf,
            hip: lengths.hip_lf,
            ridge: lengths.ridge_lf,
            surfaceAreaSqft: surfaceArea
        });
        const rawSuggested = input?.waste_suggested_percent;
        const overrideSuggested =
            rawSuggested === undefined || rawSuggested === null || rawSuggested === ""
                ? NaN
                : Number(rawSuggested);
        const customWasteFrac =
            Number.isFinite(Number(input?.waste_custom_percent)) && Number(input.waste_custom_percent) >= 0
                ? Number(input.waste_custom_percent) / 100
                : null;
        const waste =
            customWasteFrac !== null
                ? customWasteFrac
                : Number.isFinite(overrideSuggested) && overrideSuggested >= 0
                  ? overrideSuggested / 100
                  : computedWaste;

        const shingles = calcShingles(surfaceArea, waste);
        const adjustedArea = surfaceArea * (1 + waste);

        const starterLf = lengths.eave_lf + lengths.rake_lf;
        const ridgeHipLf = lengths.ridge_lf + lengths.hip_lf;
        const iceWaterCriticalLf = lengths.eave_lf + lengths.valley_lf;
        const rakeDripPieces = dripEdgePiecesForLf(lengths.rake_lf);
        const eaveDripPieces = dripEdgePiecesForLf(lengths.eave_lf);

        const rows =
            sectionRoofType === "flat"
                ? listManufacturerProducts({
                    roofType: "flat",
                    systemType: flatSystem || undefined,
                    activeOnly: true
                })
                : listManufacturerProducts({ roofType: "pitched", activeOnly: true });
        let filteredRows = selectedManufacturers.length
            ? rows.filter((r) => {
                const brand = String(r.brand || "");
                if (brand === "No Brand" || brand === "—") return true;
                return selectedManufacturers.includes(brand);
            })
            : rows;
        let flatBrandFilterRelaxed = false;
        if (sectionRoofType === "flat" && rows.length > 0 && filteredRows.length === 0) {
            filteredRows = rows;
            flatBrandFilterRelaxed = true;
        }
        filteredRows = filterCatalogRowsByProductSelection(filteredRows, {
            roofType: sectionRoofType,
            product: input?.product
        });

        const recommendations = filteredRows.map((row) => {
            const coverage = Number(row.coverage_value) || 1;
            const productLc = String(row.product || "").toLowerCase();
            let qtyRaw = adjustedArea / coverage;

            if (sectionRoofType === "pitched") {
                if (row.category === "Starter") qtyRaw = starterLf / coverage;
                else if (row.category === "Ridge Cap") qtyRaw = ridgeHipLf / coverage;
                else if (row.category === "Ice & Water") qtyRaw = iceWaterCriticalLf / coverage;
                else if (row.category === "Drip Edge" && productLc.includes("rake")) qtyRaw = rakeDripPieces;
                else if (row.category === "Drip Edge" && productLc.includes("eave")) qtyRaw = eaveDripPieces;
                else if (row.category === "Fasteners") {
                    const count = shingles.squares * coverage;
                    qtyRaw = fastenerBoxesFromCount(count, fastenerPackSizeForProduct(row.product));
                } else if (row.category === "Sealant") qtyRaw = shingles.squares / coverage;
                else if (row.category === "Flashing") qtyRaw = flashingPiecesForProduct(productLc, lengths);
            }

            const isFastener = row.category === "Fasteners";
            const pack = isFastener ? fastenerPackSizeForProduct(row.product) : null;

            return buildRecoRow({
                section: sectionRoofType === "flat" ? "Flat Roof Materials" : "Pitched Roof Materials",
                category: row.category,
                brand: row.brand,
                product: row.product,
                qty: qtyRaw,
                unit: isFastener ? "boxes" : row.unit,
                coverageBasis: isFastener
                    ? `${coverage}/square · ${pack}/box`
                    : row.coverage_basis || `${coverage} basis`,
                coverageValue: coverage,
                componentType: row.component_type || null
            });
        });
        if (sectionRoofType === "pitched") {
            const hasVentRow = recommendations.some((r) => String(r.category || "") === "Ventilation");
            if (!hasVentRow) {
                recommendations.push(
                    buildRecoRow({
                        section: "Pitched Roof Materials",
                        category: "Ventilation",
                        brand: "No Brand",
                        product: "Roof Vent (1 per 300 sq ft recorded roof area)",
                        qty: calcVents(planAreaSqft).units,
                        unit: "units",
                        coverageBasis: "1 unit per 300 sq ft",
                        coverageValue: 300,
                        componentType: "ventilation"
                    })
                );
            }
        }

        return {
            meta: {
                planArea: planAreaSqft,
                pitch: sectionRoofType === "flat" ? 0 : roof.pitch,
                roofType: sectionRoofType,
                flatSystem: sectionRoofType === "flat" ? flatSystem : null,
                areaInputType: roof.area_input_type || "plan",
                surfaceArea: Number(surfaceArea.toFixed(2)),
                wasteFactor: Number(waste.toFixed(3)),
                suggestedWasteFactor: Number(computedWaste.toFixed(3)),
                legacyWasteFactor: Number(legacyWaste.toFixed(3)),
                wasteSource:
                    customWasteFrac !== null
                        ? "client_custom_waste_percent"
                        : Number.isFinite(overrideSuggested) && overrideSuggested >= 0
                          ? "client_suggested_waste_override"
                          : "calibrated_dynamic_model",
                wasteCustomFactor:
                    Number.isFinite(Number(input?.waste_custom_percent)) && Number(input.waste_custom_percent) >= 0
                        ? Number((Number(input.waste_custom_percent) / 100).toFixed(3))
                        : null,
                flatBrandFilterRelaxed: sectionRoofType === "flat" ? flatBrandFilterRelaxed : false
            },
            recommendations,
            shingles,
            starter: sectionRoofType === "flat" ? null : calcStarter(lengths.eave_lf, lengths.rake_lf),
            ridgeCaps: sectionRoofType === "flat" ? null : calcRidgeCaps(lengths.ridge_lf, lengths.hip_lf),
            underlayment: sectionRoofType === "flat" ? null : calcUnderlayment(surfaceArea, waste),
            dripEdge: sectionRoofType === "flat" ? null : calcDripEdge(lengths.eave_lf, lengths.rake_lf),
            valley: sectionRoofType === "flat" ? null : calcValley(lengths.valley_lf),
            nails:
                sectionRoofType === "flat" || !productIncludesRoofingNails(input?.product)
                    ? null
                    : calcNails(shingles.squares),
            vents: sectionRoofType === "flat" ? null : calcVents(planAreaSqft),
            flashing: sectionRoofType === "flat" ? null : calcFlashing(lengths)
        };
    }

    // Legacy single-roof behavior remains, but the output supports mixed roofs too.
    const pitched = hasPitched ? computeSection("pitched", pitchedPlanArea) : null;
    const flat = hasFlat ? computeSection("flat", flatPlanArea) : null;

    if ((roofType === "pitched" || isMixed) && pitched && pitched.recommendations.length === 0) {
        throw new Error("No active pitched manufacturer products configured.");
    }
    if ((roofType === "flat" || isMixed) && flat && flat.recommendations.length === 0) {
        throw new Error("No active flat manufacturer products configured for selected system.");
    }

    const combinedSurfaceArea =
        (pitched?.meta?.surfaceArea || 0) + (flat?.meta?.surfaceArea || 0);

    return {
        meta: {
            planArea: Number(roof.area_sqft),
            pitch: roof.pitch,
            roofType: isMixed ? "mixed" : roofType,
            flatSystem,
            surfaceArea: Number(combinedSurfaceArea.toFixed(2)),
            wasteFactor: Number((pitched?.meta?.wasteFactor ?? flat?.meta?.wasteFactor ?? 0).toFixed(3)),
            legacyWasteFactor: Number((pitched?.meta?.legacyWasteFactor ?? flat?.meta?.legacyWasteFactor ?? 0).toFixed(3)),
            areaInputType: roof.area_input_type || "plan",
            wasteCustomFactor:
                Number.isFinite(Number(input?.waste_custom_percent)) && Number(input.waste_custom_percent) >= 0
                    ? Number((Number(input.waste_custom_percent) / 100).toFixed(3))
                    : null,
            suggestedWasteFactor: Number(
                (pitched?.meta?.suggestedWasteFactor ?? flat?.meta?.suggestedWasteFactor ?? 0).toFixed(3)
            ),
            pitchedPlanArea,
            flatPlanArea
        },
        recommendations: {
            pitched: pitched ? pitched.recommendations : [],
            flat: flat ? flat.recommendations : []
        },
        pitched,
        flat,
        // Keep legacy keys for backwards compatibility (pitched-only callers).
        ...(pitched && !isMixed
            ? {
                shingles: pitched.shingles,
                starter: pitched.starter,
                ridgeCaps: pitched.ridgeCaps,
                underlayment: pitched.underlayment,
                dripEdge: pitched.dripEdge,
                valley: pitched.valley,
                nails: pitched.nails,
                vents: pitched.vents,
                flashing: pitched.flashing
            }
            : {})
    };
}

