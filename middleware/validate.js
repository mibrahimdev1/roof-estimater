import { sendError } from "../utils/apiResponse.js";

export function validateBody(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const details = error.details.map((d) => d.message);
            return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body.", details);
        }
        req.validated = value;
        next();
    };
}

export function validateQuery(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error) {
            const details = error.details.map((d) => d.message);
            return sendError(res, 400, "VALIDATION_ERROR", "Invalid query.", details);
        }
        req.validatedQuery = value;
        next();
    };
}
