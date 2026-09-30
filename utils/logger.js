const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const COLORS = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    debug: "\x1b[36m", // cyan
    info: "\x1b[32m", // green
    warn: "\x1b[33m", // orange/yellow
    error: "\x1b[31m" // red
};

const useColor = process.env.NO_COLOR == null && process.stdout.isTTY !== false;

function resolveMinLevel() {
    const raw = String(process.env.LOG_LEVEL || "").trim().toLowerCase();
    if (raw && Object.prototype.hasOwnProperty.call(LEVELS, raw)) {
        return LEVELS[raw];
    }
    return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

const minLevel = resolveMinLevel();

function stamp() {
    return new Date().toISOString();
}

function formatMeta(meta) {
    if (meta == null) return "";
    if (meta instanceof Error) {
        return ` ${meta.stack || meta.message}`;
    }
    if (typeof meta === "string") return ` ${meta}`;
    try {
        return ` ${JSON.stringify(meta)}`;
    } catch {
        return ` ${String(meta)}`;
    }
}

function paint(level, text) {
    if (!useColor) return text;
    const color = COLORS[level] || COLORS.reset;
    return `${color}${text}${COLORS.reset}`;
}

function write(level, message, meta) {
    if (LEVELS[level] < minLevel) return;
    const time = useColor ? `${COLORS.dim}[${stamp()}]${COLORS.reset}` : `[${stamp()}]`;
    const tag = paint(level, `[${level.toUpperCase()}]`);
    const body = paint(level, `${message}${formatMeta(meta)}`);
    const line = `${time} ${tag} ${body}`;
    if (level === "error") {
        console.error(line);
    } else if (level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

export const logger = {
    debug(message, meta) {
        write("debug", message, meta);
    },
    info(message, meta) {
        write("info", message, meta);
    },
    warn(message, meta) {
        write("warn", message, meta);
    },
    error(message, meta) {
        write("error", message, meta);
    }
};

/**
 * Express middleware: logs method, path, status, duration.
 * Does not log bodies or uploaded files.
 */
export function requestLogger(req, res, next) {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const pathOnly = (req.originalUrl || req.url || "").split("?")[0];
        if (pathOnly === "/api/health") return;

        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        const status = res.statusCode;
        const msg = `${req.method} ${pathOnly} ${status} ${elapsedMs.toFixed(1)}ms`;
        if (status >= 500) logger.error(msg);
        else if (status >= 400) logger.warn(msg);
        else logger.info(msg);
    });
    next();
}
