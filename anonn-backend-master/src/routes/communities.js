import express from 'express';
import { body } from 'express-validator';
import {
    createCommunity,
    getCommunities,
    getCommunity,
    updateCommunity,
    joinCommunity,
    leaveCommunity,
    getCommunityPosts,
} from '../controllers/communityController.js';
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
 * /api/communities:
 *   post:
 *     summary: Create a new community
 *     tags: [Communities]
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
 *                 example: crypto_talk
 *               displayName:
 *                 type: string
 *                 example: Crypto Talk
 *               description:
 *                 type: string
 *                 example: A place to discuss crypto
 *     responses:
 *       201:
 *         description: Community created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authenticate, createValidation, validate, createCommunity);

/**
 * @swagger
 * /api/communities:
 *   get:
 *     summary: Get all communities
 *     tags: [Communities]
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
 *         description: Communities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/', getCommunities);

/**
 * @swagger
 * /api/communities/{id}:
 *   get:
 *     summary: Get a single community
 *     tags: [Communities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID or Name
 *     responses:
 *       200:
 *         description: Community retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', getCommunity);

/**
 * @swagger
 * /api/communities/{id}:
 *   put:
 *     summary: Update a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               banner:
 *                 type: string
 *     responses:
 *       200:
 *         description: Community updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', authenticate, updateCommunity);

/**
 * @swagger
 * /api/communities/{id}/join:
 *   post:
 *     summary: Join a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Joined community successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/join', authenticate, joinCommunity);

/**
 * @swagger
 * /api/communities/{id}/leave:
 *   delete:
 *     summary: Leave a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Left community successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id/leave', authenticate, leaveCommunity);

/**
 * @swagger
 * /api/communities/{id}/posts:
 *   get:
 *     summary: Get posts from a community
 *     tags: [Communities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/:id/posts', getCommunityPosts);

export default router;
