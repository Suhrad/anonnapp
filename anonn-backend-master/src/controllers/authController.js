import crypto from 'crypto';
import User from '../models/User.js';
import AnonymousProfile from '../models/AnonymousProfile.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { successResponse, errorResponse } from '../utils/response.js';
import * as solanaUtils from '../utils/solana.js';
import * as ethereumUtils from '../utils/ethereum.js';

/**
 * Generates a random username for new anonymous profiles (e.g. "ghost_a3f2b1")
 */
const generateRandomUsername = () => {
    const adjectives = ['dark', 'silent', 'swift', 'brave', 'quiet', 'sharp', 'bold', 'ghost', 'anon', 'covert'];
    const noun = adjectives[Math.floor(Math.random() * adjectives.length)];
    const hex = crypto.randomBytes(3).toString('hex');
    return `${noun}_${hex}`;
};

/**
 * Ensures a unique username — retries with a new random one if taken.
 */
const ensureUniqueUsername = async (base) => {
    let username = base;
    for (let i = 0; i < 10; i++) {
        const exists = await AnonymousProfile.findOne({ username });
        if (!exists) return username;
        username = generateRandomUsername();
    }
    // Last resort: append timestamp
    return `anon_${Date.now().toString(36)}`;
};

/**
 * Finds or creates an AnonymousProfile for a given userId.
 * Creates the profile if the user doesn't have one yet.
 */
const getOrCreateAnonymousProfile = async (user) => {
    if (user.anonymousId) {
        const profile = await AnonymousProfile.findOne({ anonymousId: user.anonymousId });
        if (profile) return profile;
    }
    // Create new anonymous profile
    const anonymousId = crypto.randomBytes(16).toString('hex');
    const username = await ensureUniqueUsername(generateRandomUsername());
    const profile = await AnonymousProfile.create({ anonymousId, username });
    // Store anonymousId on the User for JWT lookup
    await User.findByIdAndUpdate(user._id, { anonymousId });
    return profile;
};

/**
 * Auth Controller
 * Handles user authentication: register, login, logout, refresh, current user
 * + Multi-chain wallet authentication (Solana, Ethereum)
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email) {
                return errorResponse(res, 400, 'Email already registered');
            }
            if (existingUser.username === username) {
                return errorResponse(res, 400, 'Username already taken');
            }
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user (auth-only document)
        const anonymousId = crypto.randomBytes(16).toString('hex');
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            authMethod: 'email',
            anonymousId,
        });

        // Create the anonymous public profile
        const anonUsername = await ensureUniqueUsername(generateRandomUsername());
        const profile = await AnonymousProfile.create({ anonymousId, username: anonUsername });

        // Generate tokens (include anonymousId)
        const accessToken = generateAccessToken(user._id, anonymousId);
        const refreshToken = generateRefreshToken(user._id, anonymousId);

        // Never return the User document — return AnonymousProfile only
        return successResponse(res, 201, {
            user: profile,
            anonymousId,
            accessToken,
            refreshToken,
        }, 'User registered successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return errorResponse(res, 401, 'Invalid credentials');
        }

        // Check password
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return errorResponse(res, 401, 'Invalid credentials');
        }

        // Check if account is active
        if (!user.isActive) {
            return errorResponse(res, 403, 'Account is deactivated');
        }

        // Get or create anonymous profile
        const profile = await getOrCreateAnonymousProfile(user);
        const anonymousId = profile.anonymousId;

        // Generate tokens (include anonymousId)
        const accessToken = generateAccessToken(user._id, anonymousId);
        const refreshToken = generateRefreshToken(user._id, anonymousId);

        return successResponse(res, 200, {
            user: profile,
            anonymousId,
            accessToken,
            refreshToken,
        }, 'Login successful');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client should remove tokens)
 * @access  Private
 */
export const logout = async (req, res, next) => {
    try {
        // In a production app, you might want to implement token blacklisting
        // For now, logout is handled client-side by removing tokens
        return successResponse(res, 200, {}, 'Logout successful');
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
export const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return errorResponse(res, 400, 'Refresh token is required');
        }

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);

        // Generate new access token
        const accessToken = generateAccessToken(decoded.id);

        return successResponse(res, 200, {
            accessToken,
        }, 'Token refreshed successfully');

    } catch (error) {
        return errorResponse(res, 401, 'Invalid or expired refresh token');
    }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
export const getCurrentUser = async (req, res, next) => {
    try {
        // Return the AnonymousProfile — never the User document
        const profile = await AnonymousProfile.findOne({ anonymousId: req.anonymousId })
            .populate('joinedCommunities', 'name displayName avatar')
            .populate('joinedBowls', 'name displayName icon');

        if (!profile) {
            return errorResponse(res, 404, 'Profile not found');
        }

        return successResponse(res, 200, { user: profile }, 'User retrieved successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/wallet/nonce
 * @desc    Request nonce for wallet authentication (Solana or Ethereum)
 * @access  Public
 */
export const requestWalletNonce = async (req, res, next) => {
    try {
        const { publicKey, address, chain = 'solana' } = req.body;
        const walletIdentifier = publicKey || address;

        if (!walletIdentifier) {
            return errorResponse(res, 400, 'Wallet address or public key is required');
        }

        // Select appropriate utils based on chain
        const utils = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? ethereumUtils
            : solanaUtils;

        // Validate address format
        const isValid = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? utils.isValidEthereumAddress(walletIdentifier)
            : utils.isValidSolanaAddress(walletIdentifier);

        if (!isValid) {
            return errorResponse(res, 400, `Invalid ${chain} address`);
        }

        // Generate and store nonce
        const nonce = utils.generateNonce();

        // Format message to sign
        const message = utils.formatWalletMessage(nonce, 'authentication');

        // Store nonce with the message (await for database operation)
        if (chain === 'ethereum' || chain === 'polygon' || chain === 'binance') {
            await utils.storeNonce(walletIdentifier, nonce, message, chain);
        } else {
            await utils.storeNonce(walletIdentifier, nonce, message);
        }

        return successResponse(res, 200, {
            nonce,
            message,
            chain,
            expiresIn: 300, // 5 minutes in seconds
        }, 'Nonce generated successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/wallet/verify
 * @desc    Verify wallet signature and login/register (Solana or Ethereum)
 * @access  Public
 */
export const walletAuth = async (req, res, next) => {
    try {
        const { publicKey, address, signature, username, chain = 'solana' } = req.body;
        const walletIdentifier = publicKey || address;

        if (!walletIdentifier) {
            return errorResponse(res, 400, 'Wallet address or public key is required');
        }

        // Select appropriate utils based on chain
        const utils = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? ethereumUtils
            : solanaUtils;

        // Validate address format
        const isValid = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? utils.isValidEthereumAddress(walletIdentifier)
            : utils.isValidSolanaAddress(walletIdentifier);

        if (!isValid) {
            return errorResponse(res, 400, `Invalid ${chain} address`);
        }

        // Retrieve stored nonce and message (await for database operation)
        const stored = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? await utils.getNonce(walletIdentifier, chain)
            : await utils.getNonce(walletIdentifier);

        if (!stored) {
            return errorResponse(res, 400, 'Nonce not found or expired. Please request a new nonce.');
        }

        const { nonce: storedNonce, message } = stored;

        // Verify signature using the stored message
        const signatureValid = utils.verifySignature(message, signature, walletIdentifier);
        if (!signatureValid) {
            return errorResponse(res, 401, 'Invalid signature');
        }

        // Remove used nonce (one-time use, await for database operation)
        if (chain === 'ethereum' || chain === 'polygon' || chain === 'binance') {
            await utils.removeNonce(walletIdentifier, chain);
        } else {
            await utils.removeNonce(walletIdentifier);
        }

        // Normalize address for storage
        const normalizedAddress = (chain === 'ethereum' || chain === 'polygon' || chain === 'binance') && utils.normalizeAddress
            ? utils.normalizeAddress(walletIdentifier)
            : walletIdentifier;

        // Check if user already exists with this wallet (check both primaryWallet and walletAddresses)
        // For EVM chains, use case-insensitive matching; for Solana, use exact match
        const isEVMChain = chain === 'ethereum' || chain === 'polygon' || chain === 'binance';

        let walletQuery;
        if (isEVMChain) {
            // Case-insensitive regex for EVM addresses
            const addressRegex = new RegExp(`^${normalizedAddress}$`, 'i');
            walletQuery = {
                $or: [
                    { primaryWallet: addressRegex },
                    { 'walletAddresses.address': addressRegex }
                ]
            };
        } else {
            // Exact match for Solana
            walletQuery = {
                $or: [
                    { primaryWallet: normalizedAddress },
                    { 'walletAddresses.publicKey': normalizedAddress }
                ]
            };
        }

        console.log('[walletAuth] Looking up user with wallet:', normalizedAddress, 'on chain:', chain);
        let user = await User.findOne(walletQuery);

        if (user) {
            // Existing user - login
            if (!user.isActive) {
                return errorResponse(res, 403, 'Account is deactivated');
            }
        } else {
            // New user - register
            let generatedUsername = username || utils.generateUsernameFromWallet(normalizedAddress);

            // Check if username is taken and generate unique one if needed
            let existingUsername = await User.findOne({ username: generatedUsername });
            let attempts = 0;
            while (existingUsername && attempts < 5) {
                // Append random suffix to make username unique
                const randomSuffix = Math.random().toString(36).substring(2, 6);
                generatedUsername = `${utils.generateUsernameFromWallet(normalizedAddress)}_${randomSuffix}`;
                existingUsername = await User.findOne({ username: generatedUsername });
                attempts++;
            }

            if (existingUsername) {
                return errorResponse(res, 400, 'Unable to generate unique username. Please provide a custom username.');
            }

            // Create wallet address object based on chain
            const walletAddressObj = {
                chain: chain,
                isPrimary: true,
                verified: true,
                addedAt: new Date(),
            };

            // Add either address or publicKey based on chain type
            if (chain === 'solana') {
                walletAddressObj.publicKey = normalizedAddress;
            } else {
                walletAddressObj.address = normalizedAddress;
            }

            // Create new user with wallet authentication
            // Wrap in try-catch to handle race conditions with duplicate keys
            try {
                user = await User.create({
                    username: generatedUsername,
                    authMethod: 'wallet',
                    primaryWallet: normalizedAddress,
                    walletAddresses: [walletAddressObj],
                    reputation: 0,
                });
            } catch (createError) {
                // Check if this is a duplicate key error (MongoDB error code 11000)
                if (createError.code === 11000) {
                    const keyPattern = createError.keyPattern || {};
                    const keyValue = createError.keyValue || {};
                    console.log('[walletAuth] Duplicate key error caught. keyPattern:', JSON.stringify(keyPattern), 'keyValue:', JSON.stringify(keyValue));

                    // Check which field caused the duplicate
                    const isDuplicateWallet = keyPattern.primaryWallet || keyPattern['walletAddresses.publicKey'] || keyPattern['walletAddresses.address'];
                    const isDuplicateUsername = keyPattern.username;
                    const isDuplicateEmail = keyPattern.email;

                    if (isDuplicateWallet) {
                        // Wallet already exists - find and log in the existing user
                        console.log('[walletAuth] Duplicate key on wallet field, finding existing user...');
                        user = await User.findOne(walletQuery);

                        if (!user) {
                            // Wallet might be stored differently, try broader search
                            console.log('[walletAuth] Initial lookup failed, trying broader wallet search...');
                            user = await User.findOne({
                                $or: [
                                    { primaryWallet: normalizedAddress },
                                    { primaryWallet: { $regex: new RegExp(`^${normalizedAddress}$`, 'i') } },
                                    { 'walletAddresses.publicKey': normalizedAddress },
                                    { 'walletAddresses.address': normalizedAddress },
                                    { 'walletAddresses.address': { $regex: new RegExp(`^${normalizedAddress}$`, 'i') } }
                                ]
                            });
                        }

                        if (user) {
                            console.log('[walletAuth] Found existing user with wallet, logging in:', user._id);
                        } else {
                            console.log('[walletAuth] ERROR: Wallet duplicate reported but no user found. normalizedAddress:', normalizedAddress);
                            return errorResponse(res, 400, 'Wallet already registered but account not found. Please contact support.');
                        }
                    } else if (isDuplicateUsername || isDuplicateEmail) {
                        // Username or email collision, retry with unique username
                        console.log('[walletAuth] Duplicate key on username/email, retrying with unique username...');
                        const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                        const retryUsername = `user_${uniqueSuffix}`;

                        try {
                            user = await User.create({
                                username: retryUsername,
                                authMethod: 'wallet',
                                primaryWallet: normalizedAddress,
                                walletAddresses: [walletAddressObj],
                                reputation: 0,
                            });
                            console.log('[walletAuth] Created user with retry username:', retryUsername);
                        } catch (retryError) {
                            console.log('[walletAuth] Retry failed with error:', retryError.code, retryError.keyPattern);
                            if (retryError.code === 11000) {
                                // If retry still fails, the duplicate is likely on wallet now
                                user = await User.findOne(walletQuery);
                                if (!user) {
                                    return errorResponse(res, 400, 'Unable to create account due to a conflict. Please try again.');
                                }
                                console.log('[walletAuth] Found user after retry failure:', user._id);
                            } else {
                                throw retryError;
                            }
                        }
                    } else {
                        // Unknown duplicate key field
                        console.log('[walletAuth] Unknown duplicate key field, attempting to find existing user...');
                        user = await User.findOne(walletQuery);
                        if (!user) {
                            return errorResponse(res, 400, 'Account creation failed. Please try again.');
                        }
                    }
                } else {
                    // Re-throw non-duplicate errors
                    throw createError;
                }
            }
        }

        // Get or create anonymous profile
        const profile = await getOrCreateAnonymousProfile(user);
        const anonymousId = profile.anonymousId;

        // Generate tokens (include anonymousId)
        const accessToken = generateAccessToken(user._id, anonymousId);
        const refreshToken = generateRefreshToken(user._id, anonymousId);

        return successResponse(res, user.isNew ? 201 : 200, {
            user: profile,
            anonymousId,
            accessToken,
            refreshToken,
            isNewUser: user.isNew || false,
        }, user.isNew ? 'Account created successfully' : 'Login successful');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/wallet/link
 * @desc    Link wallet to existing authenticated account (Solana or Ethereum)
 * @access  Private
 */
export const linkWallet = async (req, res, next) => {
    try {
        const { publicKey, address, signature, chain = 'solana' } = req.body;
        const userId = req.user._id;
        const walletIdentifier = publicKey || address;

        if (!walletIdentifier) {
            return errorResponse(res, 400, 'Wallet address or public key is required');
        }

        // Select appropriate utils based on chain
        const utils = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? ethereumUtils
            : solanaUtils;

        // Validate address format
        const isValid = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? utils.isValidEthereumAddress(walletIdentifier)
            : utils.isValidSolanaAddress(walletIdentifier);

        if (!isValid) {
            return errorResponse(res, 400, `Invalid ${chain} address`);
        }

        // Normalize address for storage
        const normalizedAddress = (chain === 'ethereum' || chain === 'polygon' || chain === 'binance') && utils.normalizeAddress
            ? utils.normalizeAddress(walletIdentifier)
            : walletIdentifier;

        // Check if wallet is already linked to another account
        const existingWallet = await User.findOne({ primaryWallet: normalizedAddress });
        if (existingWallet && existingWallet._id.toString() !== userId.toString()) {
            return errorResponse(res, 400, 'This wallet is already linked to another account');
        }

        // Retrieve stored nonce and message (await for database operation)
        const stored = chain === 'ethereum' || chain === 'polygon' || chain === 'binance'
            ? await utils.getNonce(walletIdentifier, chain)
            : await utils.getNonce(walletIdentifier);

        if (!stored) {
            return errorResponse(res, 400, 'Nonce not found or expired. Please request a new nonce.');
        }

        const { nonce: storedNonce, message } = stored;

        // Verify signature using the stored message
        const signatureValid = utils.verifySignature(message, signature, walletIdentifier);
        if (!signatureValid) {
            return errorResponse(res, 401, 'Invalid signature');
        }

        // Remove used nonce (await for database operation)
        if (chain === 'ethereum' || chain === 'polygon' || chain === 'binance') {
            await utils.removeNonce(walletIdentifier, chain);
        } else {
            await utils.removeNonce(walletIdentifier);
        }

        // Update user
        const user = await User.findById(userId);

        // Set primary wallet if not already set
        if (!user.primaryWallet) {
            user.primaryWallet = normalizedAddress;
        }

        // Add to wallet addresses if not already there
        const walletExists = user.walletAddresses.some(w => {
            const walletId = w.address || w.publicKey;
            return walletId && walletId.toLowerCase() === normalizedAddress.toLowerCase();
        });

        if (!walletExists) {
            // Create wallet address object based on chain
            const walletAddressObj = {
                chain: chain,
                isPrimary: !user.primaryWallet || user.primaryWallet === normalizedAddress,
                verified: true,
                addedAt: new Date(),
            };

            // Add either address or publicKey based on chain type
            if (chain === 'solana') {
                walletAddressObj.publicKey = normalizedAddress;
            } else {
                walletAddressObj.address = normalizedAddress;
            }

            user.walletAddresses.push(walletAddressObj);
        }

        // Update auth method
        if (user.authMethod === 'email') {
            user.authMethod = 'both';
        } else if (user.authMethod === 'wallet' && !user.email) {
            // Keep as wallet-only if no email
            user.authMethod = 'wallet';
        }

        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        return successResponse(res, 200, {
            user: userResponse,
            wallets: user.walletAddresses,
        }, 'Wallet linked successfully');

    } catch (error) {
        next(error);
    }
};

export default {
    register,
    login,
    logout,
    refresh,
    getCurrentUser,
    requestWalletNonce,
    walletAuth,
    linkWallet,
};
