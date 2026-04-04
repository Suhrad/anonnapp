import express from 'express';
import { body } from 'express-validator';
import {
    importMarket,
    searchMarkets,
    searchEvents,
    getTrendingMarkets,
    getMarket,
    getMarketPosts,
    getMarketPolls,
    getMarketDiscussion,
    createMarketDiscussionMessage,
    followMarket,
} from '../controllers/marketController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const importValidation = [
    body('source')
        .optional()
        .isIn(['polymarket', 'manifold', 'kalshi', 'manual'])
        .withMessage('Invalid market source'),
    body('url')
        .optional()
        .isString()
        .withMessage('URL must be a string'),
    body('externalId')
        .optional()
        .isString()
        .withMessage('externalId must be a string'),
    body('title')
        .optional()
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Title must be 1-500 characters'),
];

const discussionValidation = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 2000 })
        .withMessage('Message must be 1-2000 characters'),
    body('parentMessage')
        .optional()
        .isString()
        .withMessage('parentMessage must be a string'),
];

router.post('/import', authenticate, importValidation, validate, importMarket);
router.get('/trending', getTrendingMarkets);
router.get('/search', optionalAuth, searchMarkets);
router.get('/events/search', optionalAuth, searchEvents);
router.get('/:id', optionalAuth, getMarket);
router.get('/:id/posts', optionalAuth, getMarketPosts);
router.get('/:id/polls', optionalAuth, getMarketPolls);
router.get('/:id/discussion', optionalAuth, getMarketDiscussion);
router.post('/:id/discussion', authenticate, discussionValidation, validate, createMarketDiscussionMessage);
router.post('/:id/follow', authenticate, followMarket);

export default router;

