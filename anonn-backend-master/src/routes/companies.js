import express from 'express';
import { body } from 'express-validator';
import {
    createCompany,
    getCompanies,
    getCompany,
    addSentiment,
    getCompanyPosts,
    getCompanyFeed,
    getAllCompaniesPostStats,
    createMarket,
    getCompanyMarkets,
    tradeMarket,
} from '../controllers/companyController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const createCompanyValidation = [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('ticker').trim().isLength({ min: 1, max: 10 }),
    body('description').isLength({ min: 1, max: 1000 }),
];

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Create a new company
 *     tags: [Companies]
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
 *               - ticker
 *             properties:
 *               name:
 *                 type: string
 *                 example: Ethereum Foundation
 *               ticker:
 *                 type: string
 *                 example: ETH
 *               description:
 *                 type: string
 *                 example: Decentralized smart contract platform
 *     responses:
 *       201:
 *         description: Company created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authenticate, createCompanyValidation, validate, createCompany);

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Get all companies
 *     tags: [Companies]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or ticker
 *       - in: query
 *         name: sector
 *         schema:
 *           type: string
 *         description: Filter by sector
 *     responses:
 *       200:
 *         description: Companies retrieved successfully
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
 *                     companies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           ticker:
 *                             type: string
 *                           description:
 *                             type: string
 *                           postCount:
 *                             type: integer
 *                             description: Total number of active posts
 *                           pollCount:
 *                             type: integer
 *                             description: Total number of active polls
 *                           positivePosts:
 *                             type: integer
 *                             description: Number of positive posts
 *                           negativePosts:
 *                             type: integer
 *                             description: Number of negative posts
 *                           authorCount:
 *                             type: integer
 *                             description: Number of unique users who posted
 *                     total:
 *                       type: integer
 *                 message:
 *                   type: string
 */
router.get('/', getCompanies);

/**
 * @swagger
 * /api/companies/{id}:
 *   get:
 *     summary: Get a single company
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID or Ticker
 *     responses:
 *       200:
 *         description: Company retrieved successfully
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
 *                     company:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         ticker:
 *                           type: string
 *                         description:
 *                           type: string
 *                         postCount:
 *                           type: integer
 *                           description: Total number of active posts
 *                         pollCount:
 *                           type: integer
 *                           description: Total number of active polls
 *                         positivePosts:
 *                           type: integer
 *                           description: Number of positive posts
 *                         negativePosts:
 *                           type: integer
 *                           description: Number of negative posts
 *                         authorCount:
 *                           type: integer
 *                           description: Number of unique users who posted
 *                 message:
 *                   type: string
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', getCompany);

/**
 * @swagger
 * /api/companies/{id}/sentiment:
 *   post:
 *     summary: Add sentiment (bullish/bearish)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [bullish, bearish]
 *     responses:
 *       200:
 *         description: Sentiment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/sentiment', authenticate, addSentiment);

/**
 * @swagger
 * /api/companies/posts/stats:
 *   get:
 *     summary: Get post statistics (positive/negative counts) for all companies
 *     tags: [Companies]
 *     responses:
 *       200:
 *         description: Company post statistics retrieved successfully
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
 *                     companies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           ticker:
 *                             type: string
 *                           positivePosts:
 *                             type: integer
 *                             description: Number of positive posts
 *                           negativePosts:
 *                             type: integer
 *                             description: Number of negative posts
 *                           totalPosts:
 *                             type: integer
 *                             description: Total number of positive and negative posts
 *                 message:
 *                   type: string
 */
router.get('/posts/stats', getAllCompaniesPostStats);


/**
 * @swagger
 * /api/companies/{id}/posts:
 *   get:
 *     summary: Get posts related to a company with sorting and filtering
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
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
 *           enum: [createdAt-desc, createdAt-asc, upvotes-desc, upvotes-asc, upvotes]
 *           default: createdAt-desc
 *         description: Sort order. upvotes is alias for upvotes-desc
 *       - in: query
 *         name: minUpvotes
 *         schema:
 *           type: integer
 *         description: Filter posts by minimum number of upvotes
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/:id/posts', getCompanyPosts);

/**
 * @swagger
 * /api/companies/{id}/feed:
 *   get:
 *     summary: Get combined feed for a company (top posts, all polls, all posts)
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company feed retrieved successfully
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
 *                     topPosts:
 *                       type: array
 *                       description: Top 2 posts sorted by upvotes
 *                       items:
 *                         type: object
 *                     polls:
 *                       type: array
 *                       description: All polls for the company
 *                       items:
 *                         type: object
 *                     posts:
 *                       type: array
 *                       description: All posts for the company
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         polls:
 *                           type: object
 *                           properties:
 *                             totalItems:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *                         posts:
 *                           type: object
 *                           properties:
 *                             totalItems:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 */
router.get('/:id/feed', getCompanyFeed);

/**
 * @swagger
 * /api/companies/{id}/markets:
 *   post:
 *     summary: Create a prediction market for a company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - expiresAt
 *             properties:
 *               question:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Market created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/markets', authenticate, createMarket);

/**
 * @swagger
 * /api/companies/{id}/markets:
 *   get:
 *     summary: Get markets for a company
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Markets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/:id/markets', getCompanyMarkets);

/**
 * @swagger
 * /api/companies/{id}/markets/{marketId}/trade:
 *   post:
 *     summary: Trade on a market
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *       - in: path
 *         name: marketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Market ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - outcome
 *               - amount
 *               - side
 *             properties:
 *               outcome:
 *                 type: string
 *                 enum: [YES, NO]
 *               amount:
 *                 type: number
 *               side:
 *                 type: string
 *                 enum: [buy, sell]
 *     responses:
 *       200:
 *         description: Trade executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/markets/:marketId/trade', authenticate, tradeMarket);

export default router;
