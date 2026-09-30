export function sendError(res, status, code, message, details) {
    const body = {
        success: false,
        error: {
            code,
            message,
            ...(details && details.length ? { details } : {})
        }
    };
    return res.status(status).json(body);
}

export function sendSuccess(res, data, status = 200) {
    return res.status(status).json({ success: true, ...data });
}
