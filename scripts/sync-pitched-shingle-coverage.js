/**
 * Re-applies coverage_value / coverage_basis for all pitched shingle rows from
 * constants/materialCatalog.js (does not reset the whole DB).
 *
 * Usage: node scripts/sync-pitched-shingle-coverage.js
 */
import { db } from "../db/database.js";
import { PITCHED_SHINGLE_PRODUCTS } from "../constants/materialCatalog.js";

const stmt = db.prepare(`
  UPDATE manufacturer_products
  SET coverage_value = ?, coverage_basis = ?, updated_at = datetime('now')
  WHERE roof_type = 'pitched' AND category = 'Shingles' AND brand = ? AND product = ?
`);

let ok = 0;
for (const p of PITCHED_SHINGLE_PRODUCTS) {
    const v = p.coverageSqFtPerBundle;
    const r = stmt.run(v, `${v} sq ft/bundle`, p.brand, p.product);
    if (typeof r?.changes === "number" && r.changes > 0) ok += r.changes;
}

console.log(`Pitched shingle coverage sync finished (${ok} rows updated). Check missing SKUs in admin if counts look low.`);
