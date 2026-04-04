import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Feed Controller
 * Handles feed algorithms: recommended, following, for-you
 */

export const getRecommendedFeed = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // Recommended: popular posts across all communities
        const posts = await Post.find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author', 'username avatar')
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        const polls = await Poll.find({ isActive: true, isClosed: false })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('author', 'username avatar')
            .populate('attachedMarket');

        // Mix posts and polls
        const feed = [...posts, ...polls].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        return successResponse(res, 200, { feed }, 'Recommended feed retrieved');
    } catch (error) {
        next(error);
    }
};

export const getFollowingFeed = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user._id);

        // Get posts from followed users and joined communities
        const posts = await Post.find({
            $or: [
                { author: { $in: user.following } },
                { community: { $in: user.joinedCommunities } }
            ],
            isActive: true
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author', 'username avatar')
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        return successResponse(res, 200, { feed: posts }, 'Following feed retrieved');
    } catch (error) {
        next(error);
    }
};

export const getForYouFeed = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user._id);

        // Personalized feed based on joined communities and activity
        const posts = await Post.find({
            $or: [
                { community: { $in: user.joinedCommunities } },
                { bowl: { $in: user.joinedBowls } }
            ],
            isActive: true
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author', 'username avatar')
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        return successResponse(res, 200, { feed: posts }, 'For you feed retrieved');
    } catch (error) {
        next(error);
    }
};
