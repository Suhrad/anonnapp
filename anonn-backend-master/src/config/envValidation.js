import Joi from 'joi';

/**
 * Environment Variables Validation
 * Validates required environment variables on startup
 */

const envSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number()
        .default(8000),
    MONGODB_URI: Joi.string()
        .required()
        .description('MongoDB connection string is required'),
    JWT_SECRET: Joi.string()
        .min(32)
        .required()
        .description('JWT secret must be at least 32 characters'),
    JWT_REFRESH_SECRET: Joi.string()
        .min(32)
        .required()
        .description('JWT refresh secret must be at least 32 characters'),
    JWT_EXPIRE: Joi.string()
        .default('7d'),
    JWT_REFRESH_EXPIRE: Joi.string()
        .default('30d'),
    CORS_ORIGIN: Joi.string()
        .default('http://localhost:3000'),
    ETHEREUM_RPC_URL: Joi.string()
        .uri()
        .optional(),
    POLYGON_RPC_URL: Joi.string()
        .uri()
        .optional(),
}).unknown(true); // Allow other env vars

export const validateEnv = () => {
    const { error, value } = envSchema.validate(process.env, {
        abortEarly: false,
        stripUnknown: false,
    });

    if (error) {
        const errors = error.details.map(detail => detail.message).join('\n');
        throw new Error(`Environment validation failed:\n${errors}`);
    }

    return value;
};
