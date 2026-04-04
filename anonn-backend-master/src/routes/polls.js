import express from 'express';
import { body } from 'express-validator';
import {
    createPoll,
    getPoll,
    getPolls,
    searchPolls,
    votePoll,
    updatePoll,
    deletePoll,
    votePollPost,
    addComment,
    getComments,
} from '../controllers/pollController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createContentLimiter, voteLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ... existing code ...

/**
 * @swagger
 * /api/polls/{id}/votes:
 *   post:
 *     summary: Vote on a poll (Up/Down)
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voteType
 *             properties:
 *               voteType:
 *                 type: string
 *                 enum: [upvote, downvote]
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/votes', authenticate, voteLimiter, votePollPost);

/**
 * Poll Routes
 * Handles poll CRUD and voting
 */

// Validation rules
const createPollValidation = [
    body('question')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Question must be 1-500 characters'),
    body('options')
        .isArray({ min: 2, max: 4 })
        .withMessage('Poll must have 2-4 options'),
    body('expiresAt')
        .isISO8601()
        .withMessage('Invalid expiry date'),
    body('attachedMarket')
        .optional()
        .isString()
        .withMessage('attachedMarket must be a string ID'),
];

const voteValidation = [
    body('optionIndex')
        .optional()
        .isInt({ min: 0, max: 3 })
        .withMessage('Invalid option index'),
    body('optionIds')
        .optional()
        .isArray()
        .withMessage('optionIds must be an array'),
];

const commentValidation = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 2000 })
        .withMessage('Comment must be 1-2000 characters'),
];

// Routes

/**
 * @swagger
 * /api/polls:
 *   post:
 *     summary: Create a new poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - options
 *               - expiresAt
 *             properties:
 *               question:
 *                 type: string
 *                 example: Will ETH reach $8000 in 2024?
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Yes", "No", "Maybe"]
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               community:
 *                 type: string
 *                 description: Community ID (optional)
 *     responses:
 *       201:
 *         description: Poll created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authenticate, createContentLimiter, createPollValidation, validate, createPoll);

/**
 * @swagger
 * /api/polls:
 *   get:
 *     summary: Get polls with filters
 *     tags: [Polls]
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, popular, endingSoon]
 *           default: latest
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, ended]
 *     responses:
 *       200:
 *         description: Polls retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/', optionalAuth, getPolls);
router.get('/search', optionalAuth, searchPolls);

/**
 * @swagger
 * /api/polls/{id}/comments:
 *   post:
 *     summary: Add a comment to a poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Great poll!
 *               parentComment:
 *                 type: string
 *                 description: Parent Comment ID (optional for replies)
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/comments', authenticate, commentValidation, validate, addComment);

/**
 * @swagger
 * /api/polls/{id}/comments:
 *   get:
 *     summary: Get comments for a poll
 *     tags: [Polls]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/:id/comments', getComments);

/**
 * @swagger
 * /api/polls/{id}:
 *   get:
 *     summary: Get a single poll by ID
 *     tags: [Polls]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     responses:
 *       200:
 *         description: Poll retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', optionalAuth, getPoll);

/**
 * @swagger
 * /api/polls/{id}:
 *   put:
 *     summary: Update a poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Poll updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', authenticate, updatePoll);

/**
 * @swagger
 * /api/polls/{id}:
 *   delete:
 *     summary: Delete a poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     responses:
 *       200:
 *         description: Poll deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', authenticate, deletePoll);

/**
 * @swagger
 * /api/polls/{id}/vote:
 *   post:
 *     summary: Vote on a poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - optionIndex
 *             properties:
 *               optionIndex:
 *                 type: integer
 *                 description: Index of the option (0-3)
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/vote', authenticate, voteLimiter, voteValidation, validate, votePoll);

export default router;
