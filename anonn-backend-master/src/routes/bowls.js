import express from 'express';
import { body } from 'express-validator';
import {
    createBowl,
    getBowls,
    getBowl,
    joinBowl,
    leaveBowl,
    getBowlPosts,
} from '../controllers/bowlController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const createValidation = [
    body('name').trim().isLength({ min: 3, max: 30 }),
    body('displayName').trim().isLength({ min: 1, max: 50 }),
    body('description').isLength({ min: 1, max: 500 }),
];

/**
 * @swagger
 * /api/bowls:
 *   post:
 *     summary: Create a new bowl
 *     tags: [Bowls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: defi_degen
 *               displayName:
 *                 type: string
 *                 example: DeFi Degen
 *               description:
 *                 type: string
 *                 example: High risk, high reward DeFi strategies
 *     responses:
 *       201:
 *         description: Bowl created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authenticate, createValidation, validate, createBowl);

/**
 * @swagger
 * /api/bowls:
 *   get:
 *     summary: Get all bowls
 *     tags: [Bowls]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Bowls retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/', getBowls);

/**
 * @swagger
 * /api/bowls/{id}/posts:
 *   get:
 *     summary: Get all posts for a specific bowl
 *     tags: [Bowls]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bowl ID or Name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [hot, trending, new, top, upvotes_desc, upvotes_asc]
 *           default: new
 *         description: Sort order. upvotes_desc = most upvotes first, upvotes_asc = least upvotes first
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/posts', getBowlPosts);

/**
 * @swagger
 * /api/bowls/{id}:
 *   get:
 *     summary: Get a single bowl
 *     tags: [Bowls]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bowl ID or Name
 *     responses:
 *       200:
 *         description: Bowl retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', getBowl);

/**
 * @swagger
 * /api/bowls/{id}/join:
 *   post:
 *     summary: Join a bowl
 *     tags: [Bowls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bowl ID
 *     responses:
 *       200:
 *         description: Joined bowl successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/join', authenticate, joinBowl);

/**
 * @swagger
 * /api/bowls/{id}/leave:
 *   delete:
 *     summary: Leave a bowl
 *     tags: [Bowls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bowl ID
 *     responses:
 *       200:
 *         description: Left bowl successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id/leave', authenticate, leaveBowl);

export default router;
