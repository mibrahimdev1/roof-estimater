/** Stable key for flat catalog rows in estimator payloads (`brand::product`). */
export function flatProductKey(brand, product) {
    return `${String(brand || "").trim()}::${String(product || "").trim()}`;
}

export function rowFlatProductKey(row) {
    return flatProductKey(row?.brand, row?.product);
}

export function productIncludesRoofingNails(product = {}) {
    return product.include_roofing_nails !== false;
}

export function productIncludesPlasticCaps(product = {}) {
    return product.include_plastic_caps !== false;
}

function isPlasticCapProduct(productName) {
    const lc = String(productName || "").toLowerCase();
    return lc.includes("plastic") && lc.includes("cap");
}

function isRoofingNailProduct(productName) {
    const lc = String(productName || "").toLowerCase();
    return lc.includes("nail");
}

/**
 * Filter catalog rows by customer product options.
 * - Flat: when `flat_products` is a non-empty array, only matching rows are kept.
 * - Pitched fasteners: nails / plastic caps can be toggled independently.
 */
export function filterCatalogRowsByProductSelection(rows, { roofType, product = {} } = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const hasFlatSelection = Array.isArray(product.flat_products);
    const flatKeys = hasFlatSelection
        ? new Set(product.flat_products.map((k) => String(k || "").trim()).filter(Boolean))
        : null;

    return list.filter((row) => {
        const category = String(row.category || "");
        const productName = String(row.product || "");

        if (roofType === "flat" && hasFlatSelection) {
            if (!flatKeys.has(rowFlatProductKey(row))) return false;
        }

        if (roofType === "pitched" && category === "Fasteners") {
            if (isRoofingNailProduct(productName) && !productIncludesRoofingNails(product)) return false;
            if (isPlasticCapProduct(productName) && !productIncludesPlasticCaps(product)) return false;
        }

        return true;
    });
}
