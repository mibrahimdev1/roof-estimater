/**
 * Market-aligned quantity basis labels for exports (Basis column).
 * Values must stay in sync with coverage_value / coverage_basis on catalog rows.
 */
export const MARKET_QUANTITY_BASIS = {
    shingles: "sq ft/bundle (manufacturer SKU)",
    starter: "LF/bundle (eave + rake)",
    ridgeCap: "LF/bundle (ridge + hip)",
    underlayment: "sq ft/roll",
    iceWater: "LF/roll (~65–75 LF typical)",
    dripEdge: "10 ft sections (eave / rake split)",
    nailsPerSquare: 320,
    capsPerSquare: 120,
    nailsPerBox: 7200,
    capsPerBox: 2000,
    flashingSectionFt: 10
};

export const PITCHED_SHINGLE_PRODUCTS = [
    { brand: "IKO", product: "Cambridge", coverageSqFtPerBundle: 33.3 },
    { brand: "IKO", product: "Dynasty", coverageSqFtPerBundle: 33.3 },
    { brand: "IKO", product: "Nordic", coverageSqFtPerBundle: 33.3 },
    { brand: "IKO", product: "Armourshake (Luxury)", coverageSqFtPerBundle: 20 },
    { brand: "IKO", product: "Crowne Slate (Luxury)", coverageSqFtPerBundle: 25 },
    // CertainTeed bundle coverage = 100 sq ft ÷ bundles/square per current product data sheets (Landmark PRO / Landmark series, NorthGate, Grand Manor, Presidential Shake).
    { brand: "CertainTeed", product: "Landmark", coverageSqFtPerBundle: 33.3 }, // 3 bundles/square
    { brand: "CertainTeed", product: "Landmark Pro", coverageSqFtPerBundle: 33.3 },
    { brand: "CertainTeed", product: "NorthGate", coverageSqFtPerBundle: 25 }, // 4 bundles/square (ClimateFlex / SBS line)
    { brand: "CertainTeed", product: "Presidential Shake (Luxury)", coverageSqFtPerBundle: 20 }, // 5 bundles/square typical
    { brand: "CertainTeed", product: "Grand Manor (Luxury)", coverageSqFtPerBundle: 20 }, // 5 bundles/square
    { brand: "GAF", product: "Timberline HDZ", coverageSqFtPerBundle: 33.3 },
    { brand: "GAF", product: "Timberline NS", coverageSqFtPerBundle: 33.3 },
    { brand: "GAF", product: "Timberline UHDZ", coverageSqFtPerBundle: 28.6 },
    { brand: "GAF", product: "Grand Sequoia", coverageSqFtPerBundle: 25 },
    { brand: "GAF", product: "Camelot II", coverageSqFtPerBundle: 25 },
    { brand: "Owens Corning", product: "Duration", coverageSqFtPerBundle: 32.8 },
    { brand: "Owens Corning", product: "Duration Designer", coverageSqFtPerBundle: 32.8 },
    { brand: "Owens Corning", product: "Duration FLEX", coverageSqFtPerBundle: 32.8 },
    { brand: "Owens Corning", product: "TruDefinition Duration MAX", coverageSqFtPerBundle: 25 },
    { brand: "Owens Corning", product: "Woodmoor", coverageSqFtPerBundle: 16.67 },
    { brand: "Owens Corning", product: "Woodcrest", coverageSqFtPerBundle: 16.67 },
    { brand: "BP", product: "Mystique", coverageSqFtPerBundle: 32.9 },
    { brand: "BP", product: "Vangard 42 IR", coverageSqFtPerBundle: 32.9 },
    { brand: "BP", product: "Manoir", coverageSqFtPerBundle: 32.3 },
    { brand: "BP", product: "Yukon SB (3-tab)", coverageSqFtPerBundle: 32.3 },
    { brand: "Tamko", product: "Heritage", coverageSqFtPerBundle: 33.3 },
    { brand: "Tamko", product: "Heritage Proline", coverageSqFtPerBundle: 30.76 },
    { brand: "Tamko", product: "StormFighter FLEX", coverageSqFtPerBundle: 30.76 },
    { brand: "Tamko", product: "Elite Glass-Seal (3-tab)", coverageSqFtPerBundle: 33.3 },
    { brand: "Malarkey", product: "Vista", coverageSqFtPerBundle: 33.3 },
    { brand: "Malarkey", product: "Highlander", coverageSqFtPerBundle: 33.3 },
    { brand: "Malarkey", product: "Legacy", coverageSqFtPerBundle: 25 },
    { brand: "Malarkey", product: "Windsor (Designer/Luxury)", coverageSqFtPerBundle: 20 },
    { brand: "Atlas", product: "Pinnacle Pristine HP42", coverageSqFtPerBundle: 40.83 }
    ,
    { brand: "Atlas", product: "StormMaster Shake", coverageSqFtPerBundle: 32 },
    { brand: "Atlas", product: "StormMaster Slate", coverageSqFtPerBundle: 32 },
    { brand: "Atlas", product: "ProLam", coverageSqFtPerBundle: 32.8 },
    { brand: "Atlas", product: "GlassMaster (3-tab)", coverageSqFtPerBundle: 32.5 }
];

export const STARTER_PRODUCTS = [
    { brand: "IKO", product: "Leading Edge Plus", coverageLfPerBundle: 123 },
    { brand: "GAF", product: "Pro-Start", coverageLfPerBundle: 120 },
    { brand: "GAF", product: "WeatherBlocker", coverageLfPerBundle: 100 },
    { brand: "Owens Corning", product: "Starter Strip Plus", coverageLfPerBundle: 105 },
    { brand: "BP", product: "BP Starter Strip Shingles", coverageLfPerBundle: 69 },
    { brand: "Tamko", product: "Starter Strip Shingles", coverageLfPerBundle: 102 },
    { brand: "Malarkey", product: "Starter Shingle (Smart Start)", coverageLfPerBundle: 114.75 },
    { brand: "Atlas", product: "Pro-Cut Starter", coverageLfPerBundle: 106 }
];

export const RIDGE_CAP_PRODUCTS = [
    { brand: "CertainTeed", product: "Shadow Ridge", coverageLfPerBundle: 31 },
    { brand: "CertainTeed", product: "Mountain Ridge", coverageLfPerBundle: 20 },
    { brand: "CertainTeed", product: "Shangle Ridge (Luxury)", coverageLfPerBundle: 31 },
    { brand: "IKO", product: "UltraHP", coverageLfPerBundle: 20 },
    { brand: "IKO", product: "Hip & Ridge 12", coverageLfPerBundle: 36.5 },
    { brand: "IKO", product: "Hip & Ridge Plus", coverageLfPerBundle: 29.5 },
    { brand: "GAF", product: "TimberTex", coverageLfPerBundle: 20 },
    { brand: "GAF", product: "Seal-A-Ridge", coverageLfPerBundle: 25 },
    { brand: "GAF", product: "Z Ridge", coverageLfPerBundle: 33.3 },
    { brand: "Owens Corning", product: "DecoRidge", coverageLfPerBundle: 20 },
    { brand: "Owens Corning", product: "ProEdge", coverageLfPerBundle: 33 },
    { brand: "BP", product: "Accu-Ridge", coverageLfPerBundle: 39 },
    { brand: "Tamko", product: "Heritage Hip & Ridge", coverageLfPerBundle: 33.3 },
    { brand: "Malarkey", product: "EZ-Ridge", coverageLfPerBundle: 20 },
    { brand: "Atlas", product: "Pro-Cut Hip & Ridge", coverageLfPerBundle: 31 }
];

export const SYNTHETIC_UNDERLAYMENT_PRODUCTS = [
    { brand: "CertainTeed", product: "DiamondDeck", coverageSqFtPerRoll: 937.5 },
    { brand: "CertainTeed", product: "RoofRunner", coverageSqFtPerRoll: 937.5 },
    { brand: "IKO", product: "Stormtite", coverageSqFtPerRoll: 1000 },
    { brand: "IKO", product: "RoofGard-Cool Grey", coverageSqFtPerRoll: 1000 },
    { brand: "GAF", product: "Tiger Paw", coverageSqFtPerRoll: 1000 },
    { brand: "GAF", product: "Deck-Armor", coverageSqFtPerRoll: 1000 },
    { brand: "GAF", product: "FeltBuster", coverageSqFtPerRoll: 1000 },
    { brand: "Owens Corning", product: "Deck Defense", coverageSqFtPerRoll: 937 },
    { brand: "Owens Corning", product: "ProArmor", coverageSqFtPerRoll: 929 },
    { brand: "BP", product: "SureDeck", coverageSqFtPerRoll: 1000 },
    { brand: "Tamko", product: "Synthetic Guard", coverageSqFtPerRoll: 1000 },
    { brand: "Malarkey", product: "Right Start UDL", coverageSqFtPerRoll: 216.6 },
    { brand: "Malarkey", product: "SecureStart", coverageSqFtPerRoll: 1000 },
    { brand: "Atlas", product: "Summit Series", coverageSqFtPerRoll: 1000 }
];

export const ICE_WATER_PRODUCTS = [
    { brand: "IKO", product: "ArmourGuard", coverageLfPerRoll: 65 },
    { brand: "CertainTeed", product: "WinterGuard", coverageLfPerRoll: 65 },
    { brand: "Malarkey", product: "Arctic Seal", coverageLfPerRoll: 65 },
    { brand: "Atlas", product: "WeatherMaster", coverageLfPerRoll: 65 },
    { brand: "GAF", product: "WeatherWatch / StormGuard", coverageLfPerRoll: 66.7 },
    { brand: "Owens Corning", product: "WeatherLock Series", coverageLfPerRoll: 75 },
    { brand: "Tamko", product: "TW Series / Moisture Guard", coverageLfPerRoll: 65 },
    { brand: "BP", product: "TW Series", coverageLfPerRoll: 65 }
];

export const DRIP_EDGE_PRODUCTS = [
    { brand: "No Brand", product: "Rake Drip Edge (10 ft section)", sectionLengthFt: 10 },
    { brand: "No Brand", product: "Eave Drip Edge (10 ft section)", sectionLengthFt: 10 }
];

export const FLASHING_PRODUCTS = [
    { brand: "No Brand", product: "Valley Flashing (10 ft section)", sectionLengthFt: 10 },
    { brand: "No Brand", product: "Step Flashing (10 ft section)", sectionLengthFt: 10 },
    { brand: "No Brand", product: "Apron Flashing (10 ft section)", sectionLengthFt: 10 }
];

export const ACCESSORY_PRODUCTS = [
    { brand: "No Brand", product: "Roofing Nails 1-1/4 in", coveragePerSquare: 320, unit: "boxes" },
    { brand: "No Brand", product: "Plastic Caps", coveragePerSquare: 120, unit: "boxes" },
    { brand: "No Brand", product: "Caulking (Roof Sealant)", squaresPerTube: 5, unit: "tubes" }
];

export const FLAT_ROOF_PRODUCTS = [
    { systemType: "modified_bitumen", componentType: "membrane", brand: "CertainTeed", product: "Flintlastic SA Cap", coverageSqFtPerRoll: 100 },
    { systemType: "modified_bitumen", componentType: "base", brand: "CertainTeed", product: "Flintlastic SA Base", coverageSqFtPerRoll: 200 },
    { systemType: "modified_bitumen", componentType: "underlayment", brand: "Tamko", product: "TW Underlayment", coverageSqFtPerRoll: 180 },
    { systemType: "tpo", componentType: "membrane", brand: "GAF", product: "EverGuard TPO", coverageSqFtPerRoll: 1000 },
    { systemType: "tpo", componentType: "base", brand: "GAF", product: "Vapor Retarder / Cover Board Basis", coverageSqFtPerRoll: 200 },
    { systemType: "modified_bitumen", componentType: "membrane", brand: "Owens Corning", product: "DeckSeal Cap Sheet", coverageSqFtPerRoll: 100 },
    { systemType: "modified_bitumen", componentType: "base", brand: "Owens Corning", product: "DeckSeal Base", coverageSqFtPerRoll: 100 },
    { systemType: "modified_bitumen", componentType: "membrane", brand: "IKO", product: "Modiflex Cap Sheet", coverageSqFtPerRoll: 98 },
    { systemType: "modified_bitumen", componentType: "base", brand: "IKO", product: "Modiflex Base Sheet", coverageSqFtPerRoll: 147 },
    { systemType: "epdm", componentType: "membrane", brand: "Carlisle", product: "Sure-Seal EPDM", coverageSqFtPerRoll: 1000 },
    { systemType: "epdm", componentType: "membrane", brand: "GAF", product: "EverGuard EPDM", coverageSqFtPerRoll: 1000 },
    { systemType: "epdm", componentType: "base", brand: "GAF", product: "Vapor Retarder / Cover Board Basis", coverageSqFtPerRoll: 200 },
    { systemType: "epdm", componentType: "membrane", brand: "Owens Corning", product: "RhinoBond EPDM (basis)", coverageSqFtPerRoll: 1000 }
];
