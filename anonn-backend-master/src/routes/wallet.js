import express from 'express';
import { body } from 'express-validator';
import {
    linkWallet,
    unlinkWallet,
    getWalletInfo,
    getBalance,
    signTransaction,
    verifySignature,
} from '../controllers/walletController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const linkValidation = [
    body('address').isEthereumAddress().withMessage('Invalid wallet address'),
    body('chain').isIn(['ethereum', 'polygon', 'binance', 'solana', 'arbitrum', 'optimism']),
    body('signature').notEmpty(),
];

/**
 * @swagger
 * /api/wallet/link:
 *   post:
 *     summary: Link a new wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - chain
 *               - signature
 *             properties:
 *               address:
 *                 type: string
 *                 example: 0x123...
 *               chain:
 *                 type: string
 *                 enum: [ethereum, polygon, binance, solana, arbitrum, optimism]
 *               signature:
 *                 type: string
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
router.post('/link', authenticate, linkValidation, validate, linkWallet);

/**
 * @swagger
 * /api/wallet/{id}/unlink:
 *   delete:
 *     summary: Unlink a wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *     responses:
 *       200:
 *         description: Wallet unlinked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id/unlink', authenticate, unlinkWallet);

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     summary: Get all linked wallets
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticate, getWalletInfo);

/**
 * @swagger
 * /api/wallet/{id}/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:id/balance', authenticate, getBalance);

/**
 * @swagger
 * /api/wallet/sign:
 *   post:
 *     summary: Sign a transaction (Placeholder)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transaction
 *             properties:
 *               transaction:
 *                 type: object
 *     responses:
 *       200:
 *         description: Transaction signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/sign', authenticate, signTransaction);

/**
 * @swagger
 * /api/wallet/verify:
 *   post:
 *     summary: Verify a signature
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - signature
 *               - message
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signature verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post('/verify', verifySignature);

export default router;
