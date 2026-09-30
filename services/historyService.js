import { db } from "../db/database.js";

export function saveCalculation({ userId, input, materials, pricing }) {
    db.prepare(
        `INSERT INTO calculation_history (user_id, input_json, materials_json, pricing_json)
         VALUES (?, ?, ?, ?)`
    ).run(userId ?? null, JSON.stringify(input), JSON.stringify(materials), JSON.stringify(pricing));
}

export function listHistory({ limit = 50, offset = 0, dateFrom, dateTo } = {}) {
    const conditions = [];
    const params = [];
    if (dateFrom) {
        conditions.push("date(h.created_at) >= date(?)");
        params.push(dateFrom);
    }
    if (dateTo) {
        conditions.push("date(h.created_at) <= date(?)");
        params.push(dateTo);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT h.id, h.user_id, h.created_at,
                    h.input_json, h.materials_json, h.pricing_json,
                    COALESCE(NULLIF(TRIM(u.display_name), ''), u.email) AS user_name
             FROM calculation_history h
             LEFT JOIN users u ON u.id = h.user_id
             ${where}
             ORDER BY h.id DESC
             LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
}

export function countHistory({ dateFrom, dateTo } = {}) {
    const conditions = [];
    const params = [];
    if (dateFrom) {
        conditions.push("date(created_at) >= date(?)");
        params.push(dateFrom);
    }
    if (dateTo) {
        conditions.push("date(created_at) <= date(?)");
        params.push(dateTo);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const row = db.prepare(`SELECT COUNT(*) AS c FROM calculation_history ${where}`).get(...params);
    return row ? row.c : 0;
}

export function getHistoryById(id) {
    return db
        .prepare(
            `SELECT h.*,
                    COALESCE(NULLIF(TRIM(u.display_name), ''), u.email) AS user_name
             FROM calculation_history h
             LEFT JOIN users u ON u.id = h.user_id
             WHERE h.id = ?`
        )
        .get(id);
}

export function getStats() {
    const total = db.prepare("SELECT COUNT(*) AS c FROM calculation_history").get().c;
    const weekRow = db
        .prepare(
            `SELECT COUNT(*) AS c FROM calculation_history
             WHERE datetime(created_at) >= datetime('now', '-7 days')`
        )
        .get();
    const monthRow = db
        .prepare(
            `SELECT COUNT(*) AS c FROM calculation_history
             WHERE datetime(created_at) >= datetime('now', '-30 days')`
        )
        .get();
    const last = db.prepare("SELECT id, created_at FROM calculation_history ORDER BY id DESC LIMIT 1").get();
    const latestFive = db
        .prepare(
            `SELECT h.id, h.created_at,
                    h.input_json, h.materials_json, h.pricing_json,
                    COALESCE(NULLIF(TRIM(u.display_name), ''), u.email) AS user_name
             FROM calculation_history h
             LEFT JOIN users u ON u.id = h.user_id
             ORDER BY h.id DESC
             LIMIT 5`
        )
        .all();
    return {
        totalCalculations: total,
        lastSevenDays: weekRow.c,
        lastThirtyDays: monthRow.c,
        lastRunAt: last ? last.created_at : null,
        lastId: last ? last.id : null,
        latestFive
    };
}
