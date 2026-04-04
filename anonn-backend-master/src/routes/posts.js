import express from 'express';
import { body } from 'express-validator';
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    votePost,
    addComment,
    getComments,
    sharePost,
    searchPosts,
} from '../controllers/postController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createContentLimiter, voteLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Post Routes
 * Handles post CRUD, voting, comments, and filtering
 */

// Validation rules
const createPostValidation = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 300 })
        .withMessage('Title must be 1-300 characters'),
    body('content')
        .trim()
        .isLength({ min: 1, max: 10000 })
        .withMessage('Content must be 1-10000 characters'),
    body('bias')
        .optional()
        .isIn(['positive', 'negative', 'neutral'])
        .withMessage('Bias must be one of: positive, negative, neutral'),
    body('attachedMarket')
        .optional()
        .isString()
        .withMessage('attachedMarket must be a string ID'),
];

const voteValidation = [
    body('voteType')
        .isIn(['upvote', 'downvote', 'up', 'down'])
        .withMessage('Invalid vote type'),
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
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 example: My first post
 *               content:
 *                 type: string
 *                 example: This is the content of my post
 *               community:
 *                 type: string
 *                 description: Community ID (optional)
 *               companyTags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Company IDs (optional)
 *               bias:
 *                 type: string
 *                 enum: [positive, negative, neutral]
 *                 default: neutral
 *                 description: Sentiment bias indicator (optional)
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authenticate, createContentLimiter, createPostValidation, validate, createPost);

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get posts with filters
 *     tags: [Posts]
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
 *           enum: [latest, popular, controversial]
 *           default: latest
 *       - in: query
 *         name: community
 *         schema:
 *           type: string
 *         description: Filter by Community ID
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/', optionalAuth, getPosts);

/**
 * @swagger
 * /api/posts/search:
 *   get:
 *     summary: Search posts
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/search', searchPosts);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a single post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', optionalAuth, getPost);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', authenticate, updatePost);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', authenticate, deletePost);

/**
 * @swagger
 * /api/posts/{id}/vote:
 *   post:
 *     summary: Vote on a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/vote', authenticate, voteLimiter, voteValidation, validate, votePost);

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
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
 *                 example: Great post!
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
 * /api/posts/{id}/comments:
 *   get:
 *     summary: Get comments for a post
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
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
 * /api/posts/{id}/share:
 *   post:
 *     summary: Increment share count for a post
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Share count incremented successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post('/:id/share', sharePost);

export default router;
