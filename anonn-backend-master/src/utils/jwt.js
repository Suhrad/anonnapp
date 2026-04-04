import jwt from 'jsonwebtoken';

/**
 * JWT Utilities
 * Token generation and verification
 */

/**
 * Generate access token
 * @param {String} userId - User ID
 * @param {String} anonymousId - AnonymousProfile ID (never exposes real identity)
 * @returns {String} JWT access token
 */
export const generateAccessToken = (userId, anonymousId) => {
    return jwt.sign(
        { id: userId, anonymousId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

/**
 * Generate refresh token
 * @param {String} userId - User ID
 * @param {String} anonymousId - AnonymousProfile ID
 * @returns {String} JWT refresh token
 */
export const generateRefreshToken = (userId, anonymousId) => {
    return jwt.sign(
        { id: userId, anonymousId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
};

/**
 * Verify access token
 * @param {String} token - JWT token
 * @returns {Object} Decoded payload
 */
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

/**
 * Verify refresh token
 * @param {String} token - JWT refresh token
 * @returns {Object} Decoded payload
 */
export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
};
