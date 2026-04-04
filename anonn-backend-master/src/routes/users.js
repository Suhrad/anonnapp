import express from 'express';
import { body, param } from 'express-validator';
import {
    getUserProfile,
    updateUserProfile,
    updateMyProfile,
    followUser,
    unfollowUser,
    addBookmark,
    removeBookmark,
    getBookmarks,
    getUserBowls,
    getTopUsersByPoints,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

/**
 * User Routes
 * Handles user profile management and social features
 */

// Validation rules
const updateProfileValidation = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('bio')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Bio cannot exceed 500 characters'),
    body('avatar')
        .optional()
        .custom((value) => {
            // Allow empty string to clear avatar
            if (value === '' || value === null || value === undefined) {
                return true;
            }
            // If value is provided, validate it as URL
            const urlPattern = /^https?:\/\/.+/;
            if (!urlPattern.test(value)) {
                throw new Error('Avatar must be a valid URL');
            }
            return true;
        }),
];

const addBookmarkValidation = [
    body('type')
        .isIn(['post', 'poll', 'comment', 'user'])
        .withMessage('Invalid bookmark type'),
    body('itemId')
        .isMongoId()
        .withMessage('Invalid item ID'),
];

// Routes
// NOTE: Specific routes (like /bookmarks) must come BEFORE generic routes (like /:id)
// to prevent route matching conflicts

/**
 * @swagger
 * /api/users/bookmarks:
 *   post:
 *     summary: Add a bookmark
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - itemId
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [post, poll, comment, user]
 *               itemId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bookmark added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/bookmarks', authenticate, addBookmarkValidation, validate, addBookmark);

/**
 * @swagger
 * /api/users/bookmarks/{id}:
 *   delete:
 *     summary: Remove a bookmark
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bookmark ID (Item ID)
 *     responses:
 *       200:
 *         description: Bookmark removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/bookmarks/:id', authenticate, removeBookmark);

/**
 * @swagger
 * /api/users/bookmarks:
 *   get:
 *     summary: Get all bookmarks
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bookmarks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/bookmarks', authenticate, getBookmarks);

/**
 * @swagger
 * /api/users/bowls:
 *   get:
 *     summary: Get user's joined bowls
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User bowls retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/bowls', authenticate, getUserBowls);

/**
 * @swagger
 * /api/users/leaderboard:
 *   get:
 *     summary: Get top 10 users by points
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Top users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get('/leaderboard', getTopUsersByPoints);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or Username
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', getUserProfile);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/me', authenticate, updateProfileValidation, validate, updateMyProfile);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/:id', authenticate, updateProfileValidation, validate, updateUserProfile);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to follow
 *     responses:
 *       200:
 *         description: User followed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/follow', authenticate, followUser);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unfollow
 *     responses:
 *       200:
 *         description: User unfollowed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id/follow', authenticate, unfollowUser);

export default router;
