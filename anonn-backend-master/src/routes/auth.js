import express from 'express';
import { body } from 'express-validator';
import {
    register,
    login,
    logout,
    refresh,
    getCurrentUser,
    requestWalletNonce,
    walletAuth,
    linkWallet,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { authLimiter, walletAuthLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Auth Routes
 * Handles user authentication and token management
 */

// Validation rules
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

const refreshValidation = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required'),
];

const walletNonceValidation = [
    body('chain')
        .optional()
        .isIn(['solana', 'ethereum', 'polygon', 'binance'])
        .withMessage('Chain must be one of: solana, ethereum, polygon, binance'),
    body('publicKey')
        .optional(),
    body('address')
        .optional(),
    // At least one wallet identifier must be provided
    body()
        .custom((value, { req }) => {
            if (!req.body.publicKey && !req.body.address) {
                throw new Error('Either publicKey or address is required');
            }
            return true;
        }),
];

const walletVerifyValidation = [
    body('chain')
        .optional()
        .isIn(['solana', 'ethereum', 'polygon', 'binance'])
        .withMessage('Chain must be one of: solana, ethereum, polygon, binance'),
    body('publicKey')
        .optional(),
    body('address')
        .optional(),
    body('signature')
        .notEmpty()
        .withMessage('Signature is required'),
    body('username')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters'),
    // At least one wallet identifier must be provided
    body()
        .custom((value, { req }) => {
            if (!req.body.publicKey && !req.body.address) {
                throw new Error('Either publicKey or address is required');
            }
            return true;
        }),
];

// Routes

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 example: alice_trader
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/register', authLimiter, registerValidation, validate, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, loginValidation, validate, login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/logout', authenticate, logout);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', refreshValidation, validate, refresh);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', authenticate, getCurrentUser);

// Wallet Authentication Routes

/**
 * @swagger
 * /api/auth/wallet/nonce:
 *   post:
 *     summary: Request nonce for Solana wallet authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicKey
 *             properties:
 *               publicKey:
 *                 type: string
 *                 example: 7xKzL3v...XqB
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     nonce:
 *                       type: string
 *                     message:
 *                       type: string
 *                     expiresIn:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/wallet/nonce', walletAuthLimiter, walletNonceValidation, validate, requestWalletNonce);

/**
 * @swagger
 * /api/auth/wallet/verify:
 *   post:
 *     summary: Verify wallet signature and login/register
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicKey
 *               - signature
 *             properties:
 *               publicKey:
 *                 type: string
 *                 example: 7xKzL3v...XqB
 *               signature:
 *                 type: string
 *                 example: 3Bv7wX...zY2
 *               username:
 *                 type: string
 *                 example: my_username
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     isNewUser:
 *                       type: boolean
 *       201:
 *         description: Account created successfully
 *       401:
 *         description: Invalid signature
 */
router.post('/wallet/verify', walletAuthLimiter, walletVerifyValidation, validate, walletAuth);

/**
 * @swagger
 * /api/auth/wallet/link:
 *   post:
 *     summary: Link Solana wallet to existing account
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicKey
 *               - signature
 *             properties:
 *               publicKey:
 *                 type: string
 *                 example: 7xKzL3v...XqB
 *               signature:
 *                 type: string
 *                 example: 3Bv7wX...zY2
 *     responses:
 *       200:
 *         description: Wallet linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/wallet/link', authenticate, walletAuthLimiter, walletVerifyValidation, validate, linkWallet);

export default router;
