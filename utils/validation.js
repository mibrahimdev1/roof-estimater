import { getDefaultMargin } from "../services/settingsService.js";
import { listDistinctBrands } from "../services/manufacturerCatalogService.js";

const COMPLEXITY = new Set(["low", "medium", "high"]);
const ROOF_TYPES = new Set(["pitched", "flat", "hybrid"]);
const FLAT_SYSTEMS = new Set(["tpo", "epdm", "modified_bitumen"]);
const AREA_INPUT_TYPES = new Set(["plan", "slope_adjusted"]);
const SHINGLE_STYLES = new Set(["3tab", "architectural", "designer"]);
const OTHER_MANUFACTURER = "Other";

function getKnownManufacturersSet() {
    return new Set([...listDistinctBrands({ activeOnly: true }), OTHER_MANUFACTURER]);
}

function isFiniteNum(n) {
    return typeof n === "number" && Number.isFinite(n);
}

export function validateEstimatePayload(body) {
    const errors = [];
    const MANUFACTURERS = getKnownManufacturersSet();

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, errors: ["Request body must be a JSON object."] };
    }

    const roof = body.roof;
    const lengths = body.lengths;

    if (!roof || typeof roof !== "object") {
        errors.push('Missing or invalid "roof" object.');
    }
    if (!lengths || typeof lengths !== "object") {
        errors.push('Missing or invalid "lengths" object.');
    }

    if (errors.length) {
        return { ok: false, errors };
    }

    const rawArea = roof.area_sqft;
    const area = Number(rawArea);
    const pitchedArea = roof.pitched_area_sqft !== undefined && roof.pitched_area_sqft !== null && roof.pitched_area_sqft !== ""
        ? Number(roof.pitched_area_sqft)
        : null;
    const flatArea = roof.flat_area_sqft !== undefined && roof.flat_area_sqft !== null && roof.flat_area_sqft !== ""
        ? Number(roof.flat_area_sqft)
        : null;
    const hasMixedAreas = (pitchedArea !== null && pitchedArea > 0) || (flatArea !== null && flatArea > 0);

    if (hasMixedAreas) {
        if (pitchedArea !== null && (!isFiniteNum(pitchedArea) || pitchedArea < 0)) {
            errors.push("roof.pitched_area_sqft must be a non-negative number when provided.");
        }
        if (flatArea !== null && (!isFiniteNum(flatArea) || flatArea < 0)) {
            errors.push("roof.flat_area_sqft must be a non-negative number when provided.");
        }
        const sum = (isFiniteNum(pitchedArea) ? pitchedArea : 0) + (isFiniteNum(flatArea) ? flatArea : 0);
        if (!Number.isFinite(sum) || sum <= 0) {
            errors.push("At least one of roof.pitched_area_sqft or roof.flat_area_sqft must be > 0.");
        }
    } else {
        if (!isFiniteNum(area) || area <= 0) {
            errors.push("roof.area_sqft must be a positive number.");
        }
    }

    if (roof.pitch === null || roof.pitch === undefined || roof.pitch === "") {
        errors.push("roof.pitch is required (rise per 12\" run, 0–24).");
    } else {
        const pitch = Number(roof.pitch);
        if (!isFiniteNum(pitch) || pitch < 0 || pitch > 24) {
            errors.push("roof.pitch must be a number from 0 to 24 (rise per 12\" run).");
        }
    }

    if (roof.pitches !== undefined && roof.pitches !== null) {
        if (!Array.isArray(roof.pitches)) {
            errors.push("roof.pitches must be an array when provided.");
        } else if (roof.pitches.length > 24) {
            errors.push("roof.pitches may include at most 24 values.");
        } else {
            for (let i = 0; i < roof.pitches.length; i++) {
                const pv = Number(roof.pitches[i]);
                if (!isFiniteNum(pv) || pv < 0 || pv > 24) {
                    errors.push("Each roof.pitches value must be a number from 0 to 24.");
                    break;
                }
            }
        }
    }

    const complexity = roof.complexity;
    if (typeof complexity !== "string" || !COMPLEXITY.has(complexity)) {
        errors.push('roof.complexity must be one of: "low", "medium", "high".');
    }
    const roofType = roof.type ?? "pitched";
    if (typeof roofType !== "string" || !ROOF_TYPES.has(roofType)) {
        errors.push('roof.type must be one of: "pitched", "flat", "hybrid".');
    }
    if (roofType === "hybrid") {
        if (!isFiniteNum(pitchedArea) || pitchedArea <= 0) {
            errors.push("For hybrid roofs, roof.pitched_area_sqft must be a positive number.");
        }
        if (!isFiniteNum(flatArea) || flatArea <= 0) {
            errors.push("For hybrid roofs, roof.flat_area_sqft must be a positive number.");
        }
        if (isFiniteNum(area) && isFiniteNum(pitchedArea) && isFiniteNum(flatArea)) {
            const sum = Number((pitchedArea + flatArea).toFixed(6));
            const total = Number(area.toFixed(6));
            if (Math.abs(sum - total) > 0.001) {
                errors.push("For hybrid roofs, roof.area_sqft must equal roof.pitched_area_sqft + roof.flat_area_sqft.");
            }
        }
    }
    if (roof.flat_system !== undefined && roof.flat_system !== null && roof.flat_system !== "") {
        if (typeof roof.flat_system !== "string" || !FLAT_SYSTEMS.has(roof.flat_system)) {
            errors.push('roof.flat_system must be one of: "tpo", "epdm", "modified_bitumen".');
        }
    }
    if (roofType === "flat") {
        if (typeof roof.flat_system !== "string" || !FLAT_SYSTEMS.has(roof.flat_system)) {
            errors.push('For flat roofs, roof.flat_system is required and must be one of: "tpo", "epdm", "modified_bitumen".');
        }
    }
    if (hasMixedAreas) {
        if (flatArea !== null && flatArea > 0) {
            if (typeof roof.flat_system !== "string" || !FLAT_SYSTEMS.has(roof.flat_system)) {
                errors.push('For mixed roofs with a flat section, roof.flat_system is required and must be one of: "tpo", "epdm", "modified_bitumen".');
            }
        }
    }
    const areaInputType = roof.area_input_type ?? "plan";
    if (typeof areaInputType !== "string" || !AREA_INPUT_TYPES.has(areaInputType)) {
        errors.push('roof.area_input_type must be one of: "plan", "slope_adjusted".');
    }

    const requiredLfFields = [
        ["ridge_lf", "lengths.ridge_lf"],
        ["hip_lf", "lengths.hip_lf"],
        ["valley_lf", "lengths.valley_lf"],
        ["eave_lf", "lengths.eave_lf"],
        ["rake_lf", "lengths.rake_lf"]
    ];
    for (const [key, label] of requiredLfFields) {
        const v = Number(lengths[key]);
        if (!isFiniteNum(v) || v < 0) {
            errors.push(`${label} must be a non-negative number.`);
        }
    }
    if (lengths.flashing_lf !== undefined && lengths.flashing_lf !== null && lengths.flashing_lf !== "") {
        const fv = Number(lengths.flashing_lf);
        if (!isFiniteNum(fv) || fv < 0) {
            errors.push("lengths.flashing_lf must be a non-negative number when provided.");
        }
    }
    if (lengths.apron_flashing_lf !== undefined && lengths.apron_flashing_lf !== null && lengths.apron_flashing_lf !== "") {
        const av = Number(lengths.apron_flashing_lf);
        if (!isFiniteNum(av) || av < 0) {
            errors.push("lengths.apron_flashing_lf must be a non-negative number when provided.");
        }
    }

    const product = body.product;
    if (product !== undefined && product !== null) {
        if (typeof product !== "object" || Array.isArray(product)) {
            errors.push('"product" must be an object when provided.');
        } else {
            const style = product.shingle_style;
            if (style !== undefined && (typeof style !== "string" || !SHINGLE_STYLES.has(style))) {
                errors.push('product.shingle_style must be one of: "3tab", "architectural", "designer".');
            }
            const mfr = product.manufacturer;
            if (mfr !== undefined && mfr !== null && mfr !== "" && (typeof mfr !== "string" || !MANUFACTURERS.has(mfr))) {
                errors.push("product.manufacturer must be a supported manufacturer label.");
            }
            const mfrs = product.manufacturers;
            if (mfrs !== undefined) {
                if (!Array.isArray(mfrs)) {
                    errors.push("product.manufacturers must be an array when provided.");
                } else {
                    if (mfrs.length < 1 || mfrs.length > 4) {
                        errors.push("product.manufacturers must include 1 to 4 selected brands.");
                    }
                    for (const it of mfrs) {
                        if (typeof it !== "string" || !MANUFACTURERS.has(it)) {
                            errors.push("Each product.manufacturers item must be a supported manufacturer label.");
                            break;
                        }
                    }
                }
            }
            const custom = product.manufacturer_custom;
            if (custom !== undefined && custom !== null && typeof custom !== "string") {
                errors.push("product.manufacturer_custom must be a string.");
            }
            if (typeof custom === "string" && custom.length > 200) {
                errors.push("product.manufacturer_custom must be 200 characters or less.");
            }
            const needsCustomOther = mfr === "Other" || (Array.isArray(mfrs) && mfrs.includes("Other"));
            if (needsCustomOther) {
                const t = typeof custom === "string" ? custom.trim() : "";
                if (!t) {
                    errors.push('When "Other" is selected, provide product.manufacturer_custom.');
                }
            }
            const flatProducts = product.flat_products;
            if (flatProducts !== undefined && flatProducts !== null) {
                if (!Array.isArray(flatProducts)) {
                    errors.push("product.flat_products must be an array when provided.");
                } else {
                    for (const key of flatProducts) {
                        if (typeof key !== "string" || !key.trim()) {
                            errors.push("Each product.flat_products item must be a non-empty string key.");
                            break;
                        }
                    }
                }
            }
            if (
                product.include_roofing_nails !== undefined &&
                product.include_roofing_nails !== null &&
                typeof product.include_roofing_nails !== "boolean"
            ) {
                errors.push("product.include_roofing_nails must be a boolean when provided.");
            }
            if (
                product.include_plastic_caps !== undefined &&
                product.include_plastic_caps !== null &&
                typeof product.include_plastic_caps !== "boolean"
            ) {
                errors.push("product.include_plastic_caps must be a boolean when provided.");
            }
        }
    }

    const margin = body.pricing_margin_percent;
    if (margin !== undefined && margin !== null && margin !== "") {
        const m = Number(margin);
        if (!isFiniteNum(m) || m < 0 || m > 100) {
            errors.push("pricing_margin_percent must be between 0 and 100 when provided.");
        }
    }

    const suggestedWaste = body.waste_suggested_percent;
    if (suggestedWaste !== undefined && suggestedWaste !== null && suggestedWaste !== "") {
        const w = Number(suggestedWaste);
        if (!isFiniteNum(w) || w < 0 || w > 100) {
            errors.push("waste_suggested_percent must be between 0 and 100 when provided.");
        }
    }
    const customWaste = body.waste_custom_percent;
    if (customWaste !== undefined && customWaste !== null && customWaste !== "") {
        const w = Number(customWaste);
        if (!isFiniteNum(w) || w < 0 || w > 100) {
            errors.push("waste_custom_percent must be between 0 and 100 when provided.");
        }
    }

    const pricingOverrides = body.pricing_overrides;
    if (pricingOverrides !== undefined && pricingOverrides !== null) {
        if (typeof pricingOverrides !== "object" || Array.isArray(pricingOverrides)) {
            errors.push("pricing_overrides must be an object when provided.");
        } else {
            for (const [key, rawVal] of Object.entries(pricingOverrides)) {
                const v = Number(rawVal);
                if (!isFiniteNum(v) || v < 0) {
                    errors.push(`pricing_overrides.${key} must be a non-negative number.`);
                    break;
                }
            }
        }
    }

    const job = body.job;
    if (job !== undefined && job !== null) {
        if (typeof job !== "object" || Array.isArray(job)) {
            errors.push('"job" must be an object when provided.');
        } else if (job.address !== undefined && job.address !== null && typeof job.address !== "string") {
            errors.push("job.address must be a string when provided.");
        } else if (typeof job.address === "string" && job.address.length > 500) {
            errors.push("job.address must be 500 characters or less.");
        }
    }

    if (errors.length) {
        return { ok: false, errors };
    }

    return { ok: true, data: body };
}

export function normalizeEstimatePayload(body) {
    const MANUFACTURERS = getKnownManufacturersSet();
    const defaultManufacturer = [...MANUFACTURERS].find((m) => m !== OTHER_MANUFACTURER) || OTHER_MANUFACTURER;
    const product = body.product && typeof body.product === "object" ? body.product : {};
    const shingle_style = SHINGLE_STYLES.has(product.shingle_style)
        ? product.shingle_style
        : "architectural";
    let manufacturer_custom =
        typeof product.manufacturer_custom === "string" ? product.manufacturer_custom.trim() : "";

    let manufacturers = Array.isArray(product.manufacturers)
        ? [...new Set(product.manufacturers.filter((m) => typeof m === "string" && MANUFACTURERS.has(m)))].slice(0, 4)
        : [];

    let manufacturer =
        typeof product.manufacturer === "string" && MANUFACTURERS.has(product.manufacturer)
            ? product.manufacturer
            : defaultManufacturer;

    if (manufacturers.length) {
        const nonOther = manufacturers.find((m) => m !== OTHER_MANUFACTURER);
        manufacturer = nonOther || OTHER_MANUFACTURER;
    }

    if (!manufacturers.length) {
        manufacturers.push(manufacturer === OTHER_MANUFACTURER ? OTHER_MANUFACTURER : manufacturer);
    }

    if (!manufacturers.includes(OTHER_MANUFACTURER) && manufacturer !== OTHER_MANUFACTURER) {
        manufacturer_custom = "";
    }

    const flat_products = Array.isArray(product.flat_products)
        ? [...new Set(product.flat_products.map((k) => String(k || "").trim()).filter(Boolean))]
        : undefined;
    const include_roofing_nails = product.include_roofing_nails === false ? false : true;
    const include_plastic_caps = product.include_plastic_caps === false ? false : true;

    const marginRaw = body.pricing_margin_percent;
    let pricing_margin_percent = getDefaultMargin();
    if (marginRaw !== undefined && marginRaw !== null && marginRaw !== "") {
        const m = Number(marginRaw);
        if (Number.isFinite(m)) pricing_margin_percent = m;
    }

    const roofType = ROOF_TYPES.has(body.roof.type) ? body.roof.type : "pitched";
    const pitched_area_sqft_raw = body.roof.pitched_area_sqft;
    const flat_area_sqft_raw = body.roof.flat_area_sqft;
    const pitched_area_sqft =
        pitched_area_sqft_raw !== undefined && pitched_area_sqft_raw !== null && pitched_area_sqft_raw !== ""
            ? Number(pitched_area_sqft_raw)
            : null;
    const flat_area_sqft =
        flat_area_sqft_raw !== undefined && flat_area_sqft_raw !== null && flat_area_sqft_raw !== ""
            ? Number(flat_area_sqft_raw)
            : null;
    const hasMixedAreas = (pitched_area_sqft !== null && pitched_area_sqft > 0) || (flat_area_sqft !== null && flat_area_sqft > 0);

    const legacyArea = Number(body.roof.area_sqft);
    const effectivePitchedArea = hasMixedAreas
        ? Number(pitched_area_sqft || 0)
        : roofType === "pitched"
          ? legacyArea
          : 0;
    const effectiveFlatArea = hasMixedAreas
        ? Number(flat_area_sqft || 0)
        : roofType === "flat"
          ? legacyArea
          : 0;
    const area_sqft = hasMixedAreas ? effectivePitchedArea + effectiveFlatArea : legacyArea;
    const area_input_type =
        typeof body.roof.area_input_type === "string" && AREA_INPUT_TYPES.has(body.roof.area_input_type)
            ? body.roof.area_input_type
            : "plan";

    const suggestedWasteRaw = body.waste_suggested_percent;
    const customWasteRaw = body.waste_custom_percent;
    const waste_suggested_percent =
        suggestedWasteRaw !== undefined && suggestedWasteRaw !== null && suggestedWasteRaw !== ""
            ? Number(suggestedWasteRaw)
            : null;
    const waste_custom_percent =
        customWasteRaw !== undefined && customWasteRaw !== null && customWasteRaw !== ""
            ? Number(customWasteRaw)
            : null;

    let pitchesNorm = null;
    if (Array.isArray(body.roof.pitches) && body.roof.pitches.length) {
        const arr = body.roof.pitches
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n >= 0 && n <= 24);
        if (arr.length) pitchesNorm = arr;
    }

    let pitchAreaSqftNorm = null;
    if (Array.isArray(body.roof.pitch_area_sqft) && body.roof.pitch_area_sqft.length) {
        const arr = body.roof.pitch_area_sqft
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n >= 0);
        if (arr.length) pitchAreaSqftNorm = arr;
    }

    const roofOut = {
        area_sqft,
        pitched_area_sqft: effectivePitchedArea,
        flat_area_sqft: effectiveFlatArea,
        area_input_type,
        pitch: Number(body.roof.pitch),
        complexity: body.roof.complexity,
        type: roofType,
        flat_system: FLAT_SYSTEMS.has(body.roof.flat_system) ? body.roof.flat_system : null
    };
    if (pitchesNorm && pitchesNorm.length > 1) {
        roofOut.pitches = pitchesNorm;
    }
    if (pitchAreaSqftNorm && pitchAreaSqftNorm.length) {
        roofOut.pitch_area_sqft = pitchAreaSqftNorm;
    }

    const jobIn = body.job && typeof body.job === "object" && !Array.isArray(body.job) ? body.job : null;
    const job =
        jobIn && typeof jobIn.address === "string" && jobIn.address.trim()
            ? { address: jobIn.address.trim() }
            : null;

    return {
        roof: roofOut,
        lengths: {
            ridge_lf: Number(body.lengths.ridge_lf),
            hip_lf: Number(body.lengths.hip_lf),
            valley_lf: Number(body.lengths.valley_lf),
            eave_lf: Number(body.lengths.eave_lf),
            rake_lf: Number(body.lengths.rake_lf),
            flashing_lf: Number(body.lengths.flashing_lf),
            apron_flashing_lf: Number(body.lengths.apron_flashing_lf)
        },
        product: {
            shingle_style,
            manufacturer,
            manufacturers,
            manufacturer_custom,
            ...(flat_products !== undefined ? { flat_products } : {}),
            include_roofing_nails,
            include_plastic_caps
        },
        pricing_margin_percent,
        waste_suggested_percent,
        waste_custom_percent,
        pricing_overrides:
            body.pricing_overrides && typeof body.pricing_overrides === "object" && !Array.isArray(body.pricing_overrides)
                ? Object.fromEntries(
                    Object.entries(body.pricing_overrides)
                        .map(([k, v]) => [k, Number(v)])
                        .filter(([, v]) => Number.isFinite(v) && v >= 0)
                )
                : null,
        job
    };
}

export { COMPLEXITY, SHINGLE_STYLES, OTHER_MANUFACTURER, getKnownManufacturersSet, ROOF_TYPES, FLAT_SYSTEMS, AREA_INPUT_TYPES };
