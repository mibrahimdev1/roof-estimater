import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/database.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "../utils/joiSchemas.js";
import { optionalAuth, signUserToken, COOKIE_NAME, cookieOptions } from "../middleware/auth.js";

const router = Router();

router.post("/login", validateBody(loginSchema), (req, res) => {
    const { email, password } = req.validated;
    const user = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return sendError(res, 401, "AUTH_FAILED", "Invalid email or password.");
    }
    const token = signUserToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    return sendSuccess(res, {
        user: { id: user.id, email: user.email, displayName: user.display_name }
    });
});

router.post("/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/", httpOnly: true, sameSite: "lax" });
    return sendSuccess(res, {});
});

router.get("/me", optionalAuth, (req, res) => {
    if (!req.user) {
        return sendSuccess(res, { user: null });
    }
    return sendSuccess(res, { user: req.user });
});

export default router;
