import { v4 as uuidv4 } from 'uuid';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';

/**
 * Security Middleware
 * Implements various security best practices
 */

// Generate unique Request ID
export const requestId = (req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
};

// Request Size Limiter (for JSON body)
// Note: Express body-parser limit is usually set in server.js, 
// but we can add a custom check if needed.
export const checkRequestSize = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || 0);
    const limit = 10 * 1024 * 1024; // 10MB

    if (contentLength > limit) {
        return res.status(413).json({
            success: false,
            message: 'Request entity too large'
        });
    }
    next();
};

// SQL/NoSQL Injection Prevention
// Wrapper around express-mongo-sanitize
export const sanitizeData = mongoSanitize();

// XSS Protection
// Wrapper around xss-clean
export const xssProtection = xss();

// Parameter Pollution Prevention
// Wrapper around hpp
export const preventParamPollution = hpp();

// Security Headers (Additional to Helmet)
export const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
};
