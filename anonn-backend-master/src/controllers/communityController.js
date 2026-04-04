import Community from '../models/Community.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Community Controller
 * Handles community CRUD, membership, and moderation
 */

export const createCommunity = async (req, res, next) => {
    try {
        const { name, displayName, description, avatar, banner } = req.body;

        const community = await Community.create({
            name,
            displayName,
            description,
            avatar,
            banner,
            creator: req.user._id,
        });

        return successResponse(res, 201, { community }, 'Community created');
    } catch (error) {
        next(error);
    }
};

export const getCommunities = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, sort = 'popular' } = req.query;
        const skip = (page - 1) * limit;

        let sortOption = {};
        if (sort === 'popular') {
            sortOption = { memberCount: -1 };
        } else if (sort === 'new') {
            sortOption = { createdAt: -1 };
        }

        const communities = await Community.find({ isActive: true })
            .sort(sortOption)
            .limit(parseInt(limit))
            .skip(skip)
            .populate('creator', 'username avatar');

        const total = await Community.countDocuments({ isActive: true });

        return successResponse(res, 200, { communities, total }, 'Communities retrieved');
    } catch (error) {
        next(error);
    }
};

export const getCommunity = async (req, res, next) => {
    try {
        const community = await Community.findById(req.params.id)
            .populate('creator', 'username avatar')
            .populate('moderators', 'username avatar');

        if (!community) {
            return errorResponse(res, 404, 'Community not found');
        }

        return successResponse(res, 200, { community }, 'Community retrieved');
    } catch (error) {
        next(error);
    }
};

export const updateCommunity = async (req, res, next) => {
    try {
        const community = await Community.findById(req.params.id);

        if (!community) {
            return errorResponse(res, 404, 'Community not found');
        }

        // Check if user is creator or moderator
        const isMod = community.moderators.some(mod => mod.toString() === req.user._id.toString());
        if (!isMod && community.creator.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'Not authorized');
        }

        const { description, avatar, banner, settings, appearance } = req.body;

        if (description) community.description = description;
        if (avatar) community.avatar = avatar;
        if (banner) community.banner = banner;
        if (settings) community.settings = { ...community.settings, ...settings };
        if (appearance) community.appearance = { ...community.appearance, ...appearance };

        await community.save();

        return successResponse(res, 200, { community }, 'Community updated');
    } catch (error) {
        next(error);
    }
};

export const joinCommunity = async (req, res, next) => {
    try {
        const community = await Community.findById(req.params.id);

        if (!community) {
            return errorResponse(res, 404, 'Community not found');
        }

        if (community.members.includes(req.user._id)) {
            return errorResponse(res, 400, 'Already a member');
        }

        community.members.push(req.user._id);
        community.memberCount += 1;
        await community.save();

        // Add to user's joined communities
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { joinedCommunities: req.params.id }
        });

        return successResponse(res, 200, {}, 'Joined community');
    } catch (error) {
        next(error);
    }
};

export const leaveCommunity = async (req, res, next) => {
    try {
        const community = await Community.findById(req.params.id);

        if (!community) {
            return errorResponse(res, 404, 'Community not found');
        }

        community.members = community.members.filter(
            id => id.toString() !== req.user._id.toString()
        );
        community.memberCount = Math.max(0, community.memberCount - 1);
        await community.save();

        // Remove from user's joined communities
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { joinedCommunities: req.params.id }
        });

        return successResponse(res, 200, {}, 'Left community');
    } catch (error) {
        next(error);
    }
};

export const getCommunityPosts = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const posts = await Post.find({ community: req.params.id, isActive: true })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author', 'username avatar');

        const total = await Post.countDocuments({ community: req.params.id, isActive: true });

        return successResponse(res, 200, { posts, total }, 'Posts retrieved');
    } catch (error) {
        next(error);
    }
};
