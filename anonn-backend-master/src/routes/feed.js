import express from 'express';
import {
    getRecommendedFeed,
    getFollowingFeed,
    getForYouFeed,
} from '../controllers/feedController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/feed/recommended:
 *   get:
 *     summary: Get recommended feed
 *     tags: [Feed]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Recommended feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/recommended', getRecommendedFeed);

/**
 * @swagger
 * /api/feed/following:
 *   get:
 *     summary: Get following feed
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Following feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/following', authenticate, getFollowingFeed);

/**
 * @swagger
 * /api/feed/for-you:
 *   get:
 *     summary: Get personalized "For You" feed
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Personalized feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/for-you', authenticate, getForYouFeed);

export default router;
