import { CONSTANTS } from "../constants/estimation.js";

/** Ceil with FP guard so ceil(11.000000000000002) → 11 (e.g. 200×1.1/20). */
const roundUp = (n) => {
    const v = Number(n) || 0;
    if (v <= 0) return 0;
    return Math.ceil(v - 1e-6);
};

/**
 * Piece count for stick goods (drip edge, metal flashing): ceil(LF / sectionLength).
 * Client-confirmed: exact multiples must not over-count (60 LF → 6, 100 LF → 10, 140 LF → 14).
 */
export function sectionsForLf(totalLf, sectionLengthFt = CONSTANTS.dripEdgeLength) {
    const lf = Number(totalLf) || 0;
    const section = Number(sectionLengthFt) || CONSTANTS.dripEdgeLength;
    if (lf <= 0 || section <= 0) return 0;
    return roundUp(lf / section);
}

/** @deprecated Use sectionsForLf — kept for any residual callers; same as simple ceil. */
export function sectionsWithOverlap(totalLf, sectionLengthFt = CONSTANTS.dripEdgeLength, _overlapFt = 0.17) {
    return sectionsForLf(totalLf, sectionLengthFt);
}

export function dripEdgePiecesForLf(lf) {
    return sectionsForLf(lf, CONSTANTS.dripEdgeLength);
}

export function flashingLfForProduct(productLc, lengths = {}) {
    const lc = String(productLc || "").toLowerCase();
    const valley = Number(lengths.valley_lf) || 0;
    const stepLf = Number(lengths.flashing_lf) || 0;
    const apronLf = Number(lengths.apron_flashing_lf) || 0;
    if (lc.includes("valley")) return valley;
    if (lc.includes("apron")) return apronLf;
    if (lc.includes("step")) return stepLf;
    return stepLf;
}

export function flashingPiecesForProduct(productLc, lengths = {}, scenarioWaste = 0) {
    const lf = flashingLfForProduct(productLc, lengths) * (1 + (Number(scenarioWaste) || 0));
    return sectionsForLf(lf, CONSTANTS.dripEdgeLength);
}

export function totalFlashingPieces(lengths = {}, scenarioWaste = 0) {
    const products = ["valley", "step", "apron"];
    return products.reduce((sum, key) => {
        const lc = key === "valley" ? "valley flashing" : key === "apron" ? "apron flashing" : "step flashing";
        return sum + flashingPiecesForProduct(lc, lengths, scenarioWaste);
    }, 0);
}

export function totalDripEdgePieces(lengths = {}, scenarioWaste = 0) {
    const waste = 1 + (Number(scenarioWaste) || 0);
    const eave = (Number(lengths.eave_lf) || 0) * waste;
    const rake = (Number(lengths.rake_lf) || 0) * waste;
    return dripEdgePiecesForLf(eave) + dripEdgePiecesForLf(rake);
}

export function totalDripEdgeLf(lengths = {}, scenarioWaste = 0) {
    const waste = 1 + (Number(scenarioWaste) || 0);
    const eave = (Number(lengths.eave_lf) || 0) * waste;
    const rake = (Number(lengths.rake_lf) || 0) * waste;
    return Math.round(eave + rake);
}

export function totalFlashingLf(lengths = {}, scenarioWaste = 0) {
    const waste = 1 + (Number(scenarioWaste) || 0);
    const valley = (Number(lengths.valley_lf) || 0) * waste;
    const step = (Number(lengths.flashing_lf) || 0) * waste;
    const apron = (Number(lengths.apron_flashing_lf) || 0) * waste;
    return Math.round(valley + step + apron);
}

/** Convert raw fastener count to orderable boxes. */
export function fastenerBoxesFromCount(count, perBox) {
    const n = Number(count) || 0;
    const pack = Number(perBox) || 0;
    if (n <= 0 || pack <= 0) return 0;
    return Math.ceil(n / pack);
}

export function nailsPerBox() {
    return CONSTANTS.nailsPerBox;
}

export function capsPerBox() {
    return CONSTANTS.capsPerBox;
}

export function isPlasticCapProduct(productName) {
    const lc = String(productName || "").toLowerCase();
    return lc.includes("plastic") && lc.includes("cap");
}

export function isRoofingNailProduct(productName) {
    const lc = String(productName || "").toLowerCase();
    return lc.includes("nail");
}

export function fastenerPackSizeForProduct(productName) {
    if (isPlasticCapProduct(productName)) return capsPerBox();
    if (isRoofingNailProduct(productName)) return nailsPerBox();
    return nailsPerBox();
}

export { roundUp };
