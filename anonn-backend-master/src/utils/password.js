import bcrypt from 'bcryptjs';

/**
 * Password Utilities
 * Hashing and verification functions
 */

/**
 * Hash a password
 * @param {String} password - Plain text password
 * @returns {String} Hashed password
 */
export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 * @param {String} password - Plain text password
 * @param {String} hash - Hashed password
 * @returns {Boolean} True if match
 */
export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};
