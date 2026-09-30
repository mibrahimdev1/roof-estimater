import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcrypt";
import { DEFAULT_MARGIN, MATERIAL_PRICES } from "../constants/pricing.js";
import {
    ACCESSORY_PRODUCTS,
    DRIP_EDGE_PRODUCTS,
    FLASHING_PRODUCTS,
    FLAT_ROOF_PRODUCTS,
    ICE_WATER_PRODUCTS,
    PITCHED_SHINGLE_PRODUCTS,
    RIDGE_CAP_PRODUCTS,
    STARTER_PRODUCTS,
    SYNTHETIC_UNDERLAYMENT_PRODUCTS
} from "../constants/materialCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "app.db");
const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calculation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  input_json TEXT NOT NULL,
  materials_json TEXT NOT NULL,
  pricing_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_history_created ON calculation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_history_user ON calculation_history(user_id);

CREATE TABLE IF NOT EXISTS manufacturer_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roof_type TEXT NOT NULL,
  system_type TEXT,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  product TEXT NOT NULL,
  unit TEXT NOT NULL,
  coverage_value REAL NOT NULL,
  coverage_basis TEXT NOT NULL DEFAULT '',
  component_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mfr_roof_type ON manufacturer_products(roof_type);
CREATE INDEX IF NOT EXISTS idx_mfr_system_type ON manufacturer_products(system_type);
`);

function seedAdmin() {
    const row = db.prepare("SELECT COUNT(*) AS c FROM users").get();
    if (row.c > 0) return;
    const email = process.env.ADMIN_EMAIL || "admin@gmail.com";
    const plain = process.env.ADMIN_PASSWORD || "ChangeMe123!";
    const hash = bcrypt.hashSync(plain, 10);
    db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run(
        email,
        hash,
        "Administrator"
    );
}

function seedSettings() {
    const m = db.prepare("SELECT value FROM settings WHERE key = ?").get("default_margin_percent");
    if (!m) {
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
            "default_margin_percent",
            String(DEFAULT_MARGIN)
        );
    }
    const p = db.prepare("SELECT value FROM settings WHERE key = ?").get("material_prices_json");
    if (!p) {
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
            "material_prices_json",
            JSON.stringify(MATERIAL_PRICES)
        );
    }
}

function seedManufacturerProducts() {
    const row = db.prepare("SELECT COUNT(*) AS c FROM manufacturer_products").get();
    if (row.c > 0) return;
    const insert = db.prepare(
        `INSERT INTO manufacturer_products
         (roof_type, system_type, category, brand, product, unit, coverage_value, coverage_basis, component_type, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    let sort = 0;
    const add = (roofType, systemType, category, brand, product, unit, coverageValue, coverageBasis, componentType = null) => {
        sort += 1;
        insert.run(
            roofType,
            systemType,
            category,
            brand,
            product,
            unit,
            Number(coverageValue),
            coverageBasis || "",
            componentType,
            sort
        );
    };

    for (const p of PITCHED_SHINGLE_PRODUCTS) {
        add("pitched", null, "Shingles", p.brand, p.product, "bundles", p.coverageSqFtPerBundle, `${p.coverageSqFtPerBundle} sq ft/bundle`);
    }
    for (const p of STARTER_PRODUCTS) {
        add("pitched", null, "Starter", p.brand, p.product, "bundles", p.coverageLfPerBundle, `${p.coverageLfPerBundle} LF/bundle`);
    }
    for (const p of RIDGE_CAP_PRODUCTS) {
        add("pitched", null, "Ridge Cap", p.brand, p.product, "bundles", p.coverageLfPerBundle, `${p.coverageLfPerBundle} LF/bundle`);
    }
    for (const p of SYNTHETIC_UNDERLAYMENT_PRODUCTS) {
        add("pitched", null, "Underlayment", p.brand, p.product, "rolls", p.coverageSqFtPerRoll, `${p.coverageSqFtPerRoll} sq ft/roll`);
    }
    for (const p of ICE_WATER_PRODUCTS) {
        add("pitched", null, "Ice & Water", p.brand, p.product, "rolls", p.coverageLfPerRoll, `${p.coverageLfPerRoll} LF/roll`);
    }
    add("pitched", null, "Drip Edge", DRIP_EDGE_PRODUCTS[0].brand, DRIP_EDGE_PRODUCTS[0].product, "pieces", 10, "10 ft sections");
    add("pitched", null, "Drip Edge", DRIP_EDGE_PRODUCTS[1].brand, DRIP_EDGE_PRODUCTS[1].product, "pieces", 10, "10 ft sections");
    add("pitched", null, "Fasteners", ACCESSORY_PRODUCTS[0].brand, ACCESSORY_PRODUCTS[0].product, ACCESSORY_PRODUCTS[0].unit, ACCESSORY_PRODUCTS[0].coveragePerSquare, `${ACCESSORY_PRODUCTS[0].coveragePerSquare}/square`);
    add("pitched", null, "Fasteners", ACCESSORY_PRODUCTS[1].brand, ACCESSORY_PRODUCTS[1].product, ACCESSORY_PRODUCTS[1].unit, ACCESSORY_PRODUCTS[1].coveragePerSquare, `${ACCESSORY_PRODUCTS[1].coveragePerSquare}/square`);
    add("pitched", null, "Sealant", ACCESSORY_PRODUCTS[2].brand, ACCESSORY_PRODUCTS[2].product, ACCESSORY_PRODUCTS[2].unit, ACCESSORY_PRODUCTS[2].squaresPerTube, `1 tube / ${ACCESSORY_PRODUCTS[2].squaresPerTube} squares`);
    for (const p of FLASHING_PRODUCTS) {
        add("pitched", null, "Flashing", p.brand, p.product, "pieces", p.sectionLengthFt, "10 ft sections");
    }

    for (const p of FLAT_ROOF_PRODUCTS) {
        add("flat", p.systemType, p.systemType.toUpperCase(), p.brand, p.product, "rolls", p.coverageSqFtPerRoll, `${p.coverageSqFtPerRoll} sq ft/roll`, p.componentType || null);
    }
}

seedAdmin();
seedSettings();
seedManufacturerProducts();
migrateFlashingCatalog();

function migrateFlashingCatalog() {
    const update = db.prepare(`
        UPDATE manufacturer_products
        SET product = ?, unit = 'pieces', coverage_value = 10, coverage_basis = '10 ft sections', updated_at = datetime('now')
        WHERE roof_type = 'pitched' AND category = 'Flashing' AND product = ?
    `);
    const legacyNames = [
        ["Valley Flashing (10 ft section)", "Valley Flashing"],
        ["Step Flashing (10 ft section)", "Step Flashing"]
    ];
    for (const [nextName, legacyName] of legacyNames) {
        update.run(nextName, legacyName);
    }

    const apronExists = db
        .prepare(
            `SELECT COUNT(*) AS c FROM manufacturer_products
             WHERE roof_type = 'pitched' AND category = 'Flashing' AND product LIKE 'Apron Flashing%'`
        )
        .get();
    if (!apronExists?.c) {
        const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM manufacturer_products").get();
        db.prepare(
            `INSERT INTO manufacturer_products
             (roof_type, system_type, category, brand, product, unit, coverage_value, coverage_basis, component_type, sort_order, is_active)
             VALUES ('pitched', NULL, 'Flashing', 'No Brand', 'Apron Flashing (10 ft section)', 'pieces', 10, '10 ft sections', NULL, ?, 1)`
        ).run(Number(maxSort?.m || 0) + 1);
    }
}

export { db };
