import { verifyAccessToken } from '../utils/jwt.js';
import { errorResponse } from '../utils/response.js';
import User from '../models/User.js';
import AnonymousProfile from '../models/AnonymousProfile.js';

/**
 * Authentication Middleware
 * Verifies JWT and attaches BOTH:
 *   req.user         — minimal User doc (for internal auth checks only, never returned to client)
 *   req.anonymousId  — the anonymousId from the JWT (used for all content attribution)
 *   req.anonProfile  — the AnonymousProfile doc (public-safe identity)
 */
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(res, 401, 'No token provided, authorization denied');
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(token);

        // Load minimal User (auth only — never returned to client)
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return errorResponse(res, 401, 'User not found, authorization denied');
        }

        // Extract anonymousId from JWT (or fall back to User.anonymousId)
        const anonymousId = decoded.anonymousId || user.anonymousId;
        if (!anonymousId) {
            return errorResponse(res, 401, 'Anonymous profile not found. Please log in again.');
        }

        // Load the public AnonymousProfile
        const anonProfile = await AnonymousProfile.findOne({ anonymousId });
        if (!anonProfile) {
            return errorResponse(res, 401, 'Anonymous profile not found. Please log in again.');
        }

        req.user = user;
        req.anonymousId = anonymousId;
        req.anonProfile = anonProfile;
        next();

    } catch (error) {
        return errorResponse(res, 401, 'Invalid token, authorization denied');
    }
};

/**
 * Optional authentication middleware — sets req.anonymousId if token valid, else continues.
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = verifyAccessToken(token);
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                const anonymousId = decoded.anonymousId || user.anonymousId;
                req.user = user;
                req.anonymousId = anonymousId;
                if (anonymousId) {
                    req.anonProfile = await AnonymousProfile.findOne({ anonymousId });
                }
            }
        }
        next();
    } catch (error) {
        next();
    }
};
