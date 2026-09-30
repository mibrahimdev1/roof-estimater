export const MANUFACTURER_CATEGORIES = [
    "Shingles",
    "Starter",
    "Ridge Cap",
    "Underlayment",
    "Ice & Water",
    "Drip Edge",
    "Fasteners",
    "Sealant",
    "Flashing",
    "TPO",
    "EPDM",
    "MODIFIED_BITUMEN"
];

export const MANUFACTURER_ROOF_TYPES = ["pitched", "flat"];

export const MANUFACTURER_SYSTEM_TYPES = ["tpo", "epdm", "modified_bitumen"];

/** Canonical column headers for product CSV/XLSX import (order matters for template). */
export const PRODUCT_IMPORT_HEADERS = [
    "roofType",
    "systemType",
    "category",
    "brand",
    "product",
    "unit",
    "coverageValue",
    "coverageBasis",
    "componentType",
    "sortOrder",
    "isActive"
];

export const PRODUCT_IMPORT_REQUIRED_HEADERS = [
    "roofType",
    "category",
    "brand",
    "product",
    "unit",
    "coverageValue"
];

export const PRODUCT_IMPORT_EXAMPLE_ROW = {
    roofType: "pitched",
    systemType: "",
    category: "Shingles",
    brand: "GAF",
    product: "Timberline HDZ",
    unit: "bundles",
    coverageValue: "33.3",
    coverageBasis: "sq ft per bundle",
    componentType: "",
    sortOrder: "0",
    isActive: "true"
};

export const PRODUCT_IMPORT_HEADER_LINE = PRODUCT_IMPORT_HEADERS.join(",");

/** Canonical column headers for manufacturer (brand group) CSV/XLSX import. */
export const MANUFACTURER_IMPORT_HEADERS = [
    "roofType",
    "systemType",
    "category",
    "brand",
    "isActive"
];

export const MANUFACTURER_IMPORT_REQUIRED_HEADERS = ["roofType", "category", "brand"];

export const MANUFACTURER_IMPORT_EXAMPLE_ROW = {
    roofType: "pitched",
    systemType: "",
    category: "Shingles",
    brand: "GAF",
    isActive: "true"
};

export const MANUFACTURER_IMPORT_HEADER_LINE = MANUFACTURER_IMPORT_HEADERS.join(",");

export const MANUFACTURER_GROUP_PLACEHOLDER_PRODUCT = "__MANUFACTURER_GROUP__";
export const MANUFACTURER_GROUP_PLACEHOLDER_UNIT = "n/a";
export const MANUFACTURER_GROUP_PLACEHOLDER_COVERAGE_VALUE = 0.0001;
