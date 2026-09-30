import Joi from "joi";

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).max(500).required()
});

export const adminSettingsSchema = Joi.object({
    defaultMarginPercent: Joi.number().min(0).max(100),
    materialPrices: Joi.object()
        .pattern(
            Joi.string().max(64),
            Joi.number().min(0).max(1e9)
        )
        .min(0),
    customerMeasurementProfile: Joi.alternatives().try(
        Joi.object().unknown(true),
        Joi.valid(null)
    )
}).min(1);

export const profileUpdateSchema = Joi.object({
    displayName: Joi.string().allow("", null).max(120),
    email: Joi.string().trim().email().max(320)
}).min(1);

export const passwordChangeSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
});

function optionalQueryYmd(field) {
    return Joi.string()
        .trim()
        .empty("")
        .optional()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .messages({ "string.pattern.base": `${field} must be YYYY-MM-DD.` });
}

export const historyQuerySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).max(1e6).default(0),
    dateFrom: optionalQueryYmd("dateFrom"),
    dateTo: optionalQueryYmd("dateTo")
});

export const manufacturerProductSchema = Joi.object({
    roofType: Joi.string().valid("pitched", "flat").required(),
    systemType: Joi.string().allow(null, "").valid("tpo", "epdm", "modified_bitumen"),
    category: Joi.string().trim().min(1).max(80).required(),
    brand: Joi.string().trim().min(1).max(120).required(),
    product: Joi.string().trim().min(1).max(200).required(),
    unit: Joi.string().trim().min(1).max(40).required(),
    coverageValue: Joi.number().positive().max(1e9).required(),
    coverageBasis: Joi.string().allow("").max(200).default(""),
    componentType: Joi.string().allow(null, "").max(50),
    sortOrder: Joi.number().integer().min(0).max(1e7).default(0),
    isActive: Joi.boolean().default(true)
});
