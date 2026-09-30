import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import { sendError } from "../utils/apiResponse.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
export const COOKIE_NAME = "roof_token";

export function optionalAuth(req, res, next) {
    req.user = null;
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const row = db.prepare("SELECT id, email, display_name FROM users WHERE id = ?").get(payload.sub);
        if (row) {
            req.user = {
                id: row.id,
                email: row.email,
                displayName: row.display_name
            };
        }
    } catch {
        req.user = null;
    }
    next();
}

export function requireAuth(req, res, next) {
    if (!req.user) {
        return sendError(res, 401, "UNAUTHORIZED", "Authentication required.");
    }
    next();
}

export function signUserToken(user) {
    return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

export function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/"
    };
}
