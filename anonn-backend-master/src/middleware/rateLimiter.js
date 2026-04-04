import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP
 * 
 * NOTE: Rate limiting is disabled for development/testing
 * Enable in production by removing the skip function
 */

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Very high limit for testing
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true, // DISABLED FOR TESTING
});

// Strict rate limiter for auth routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.',
    },
    skip: () => true, // DISABLED FOR TESTING
});

// Create post/poll rate limiter
export const createContentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10000,
    message: {
        success: false,
        message: 'Too many posts created, please try again later.',
    },
    skip: () => true, // DISABLED FOR TESTING
});

// Vote rate limiter
export const voteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10000,
    message: {
        success: false,
        message: 'Too many votes, please slow down.',
    },
    skip: () => true, // DISABLED FOR TESTING
});

// Wallet authentication rate limiter
export const walletAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
    message: {
        success: false,
        message: 'Too many wallet authentication attempts, please try again later.',
    },
    skip: () => true, // DISABLED FOR TESTING
});
