import User from '../models/User.js';
import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import Comment from '../models/Comment.js';
import mongoose from 'mongoose';
import { successResponse, errorResponse } from '../utils/response.js';
import { createPointEvent } from '../utils/points.js';
import { PointEventType } from '../models/PointEvent.js';

/**
 * User Controller
 * Handles user profile management, follow/unfollow, bookmarks
 */

/**
 * Helper function to find user by ID or username
 */
const findUserByIdOrUsername = async (idOrUsername) => {
    const isValidObjectId = mongoose.Types.ObjectId.isValid(idOrUsername);
    const query = isValidObjectId ? { _id: idOrUsername } : { username: idOrUsername };
    return await User.findOne(query);
};

/**
 * @route   GET /api/users/:id
 * @desc    Get user profile by ID or username
 * @access  Public
 */
export const getUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if id is a valid MongoDB ObjectId or a username
        const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

        // Query by _id if valid ObjectId, otherwise query by username
        const query = isValidObjectId ? { _id: id } : { username: id };

        const user = await User.findOne(query)
            .select('-password')
            .populate('joinedCommunities', 'name displayName avatar memberCount')
            .populate('joinedBowls', 'name displayName icon memberCount');

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Get counts
        const postCount = await Post.countDocuments({ author: user._id, isActive: true });
        const pollCount = await Poll.countDocuments({ author: user._id, isActive: true });
        const commentCount = await Comment.countDocuments({ author: user._id, isActive: true });

        const userProfile = {
            ...user.toObject(),
            stats: {
                posts: postCount,
                polls: pollCount,
                comments: commentCount,
                followers: user.followers.length,
                following: user.following.length,
                communities: user.joinedCommunities.length,
                bowls: user.joinedBowls.length,
            },
            points: user.points || 0,
        };

        return successResponse(res, 200, { user: userProfile }, 'User profile retrieved');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private
 */
export const updateUserProfile = async (req, res, next) => {
    try {
        // Only allow users to update their own profile
        if (req.user._id.toString() !== req.params.id) {
            return errorResponse(res, 403, 'Not authorized to update this profile');
        }

        const { username, bio, avatar } = req.body;

        const updates = {};
        if (username) updates.username = username;
        if (bio !== undefined) updates.bio = bio;
        if (avatar !== undefined) updates.avatar = avatar;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        return successResponse(res, 200, { user }, 'Profile updated successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/users/me
 * @desc    Update current user's profile (convenience endpoint)
 * @access  Private
 */
export const updateMyProfile = async (req, res, next) => {
    try {
        const { username, bio, avatar, notificationSettings } = req.body;

        const updates = {};
        if (username) updates.username = username;
        if (bio !== undefined) updates.bio = bio;
        if (avatar !== undefined) updates.avatar = avatar;
        if (notificationSettings !== undefined) {
            updates.notificationSettings = notificationSettings;
        }

        const user = await User.findByIdAndUpdate(
            req.user._id, // Use authenticated user's ID
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        return successResponse(res, 200, { user }, 'Profile updated successfully');

    } catch (error) {
        next(error);
    }
};


/**
 * @route   POST /api/users/:id/follow
 * @desc    Follow a user
 * @access  Private
 */
export const followUser = async (req, res, next) => {
    try {
        const userToFollow = await findUserByIdOrUsername(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!userToFollow) {
            return errorResponse(res, 404, 'User not found');
        }

        // Can't follow yourself
        if (userToFollow._id.toString() === req.user._id.toString()) {
            return errorResponse(res, 400, 'You cannot follow yourself');
        }

        // Check if already following
        if (currentUser.following.some(id => id.toString() === userToFollow._id.toString())) {
            return errorResponse(res, 400, 'Already following this user');
        }

        // Add to following and followers
        currentUser.following.push(userToFollow._id);
        userToFollow.followers.push(req.user._id);

        await currentUser.save();
        await userToFollow.save();

        return successResponse(res, 200, {}, 'User followed successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   DELETE /api/users/:id/follow
 * @desc    Unfollow a user
 * @access  Private
 */
export const unfollowUser = async (req, res, next) => {
    try {
        const userToUnfollow = await findUserByIdOrUsername(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!userToUnfollow) {
            return errorResponse(res, 404, 'User not found');
        }

        // Check if following
        if (!currentUser.following.some(id => id.toString() === userToUnfollow._id.toString())) {
            return errorResponse(res, 400, 'Not following this user');
        }

        // Remove from following and followers
        currentUser.following = currentUser.following.filter(
            id => id.toString() !== userToUnfollow._id.toString()
        );
        userToUnfollow.followers = userToUnfollow.followers.filter(
            id => id.toString() !== req.user._id.toString()
        );

        await currentUser.save();
        await userToUnfollow.save();

        return successResponse(res, 200, {}, 'User unfollowed successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/users/bookmarks
 * @desc    Add bookmark
 * @access  Private
 */
export const addBookmark = async (req, res, next) => {
    try {
        const { type, itemId } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Add to appropriate bookmark array
        let authorId = null;
        switch (type) {
            case 'post':
                if (!user.bookmarkedPosts.includes(itemId)) {
                    user.bookmarkedPosts.push(itemId);
                    const post = await Post.findById(itemId);
                    if (post) {
                        await Post.findByIdAndUpdate(itemId, { $inc: { bookmarkCount: 1 } });
                        authorId = post.author.toString();
                    }
                }
                break;
            case 'poll':
                if (!user.bookmarkedPolls.includes(itemId)) {
                    user.bookmarkedPolls.push(itemId);
                    const poll = await Poll.findById(itemId);
                    if (poll) {
                        await Poll.findByIdAndUpdate(itemId, { $inc: { bookmarkCount: 1 } });
                        authorId = poll.author.toString();
                    }
                }
                break;
            case 'comment':
                if (!user.bookmarkedComments.includes(itemId)) {
                    user.bookmarkedComments.push(itemId);
                    const comment = await Comment.findById(itemId);
                    if (comment) {
                        authorId = comment.author.toString();
                    }
                }
                break;
            case 'user':
                if (!user.bookmarkedUsers.includes(itemId)) {
                    user.bookmarkedUsers.push(itemId);
                    authorId = itemId; // For user bookmarks, the itemId is the author
                }
                break;
            default:
                return errorResponse(res, 400, 'Invalid bookmark type');
        }

        await user.save();

        // Award points for bookmarks (only for post, poll, comment, user types)
        if (authorId && authorId !== req.user._id.toString()) {
            try {
                await createPointEvent(PointEventType.BOOKMARK_GIVEN, req.user._id, itemId);
                await createPointEvent(PointEventType.BOOKMARK_RECEIVED, authorId, itemId);
            } catch (error) {
                console.error('Error creating point event for bookmark:', error);
            }
        }

        // Fetch updated user points
        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        return successResponse(res, 200, { points: userPoints }, 'Bookmark added successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   DELETE /api/users/bookmarks/:id
 * @desc    Remove bookmark
 * @access  Private
 */
export const removeBookmark = async (req, res, next) => {
    try {
        const { type } = req.query;
        const user = await User.findById(req.user._id);

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Remove from appropriate bookmark array
        let authorId = null;
        switch (type) {
            case 'post':
                user.bookmarkedPosts = user.bookmarkedPosts.filter(
                    id => id.toString() !== req.params.id
                );
                const post = await Post.findById(req.params.id);
                if (post) {
                    await Post.findByIdAndUpdate(req.params.id, { $inc: { bookmarkCount: -1 } });
                    authorId = post.author.toString();
                }
                break;
            case 'poll':
                user.bookmarkedPolls = user.bookmarkedPolls.filter(
                    id => id.toString() !== req.params.id
                );
                const poll = await Poll.findById(req.params.id);
                if (poll) {
                    await Poll.findByIdAndUpdate(req.params.id, { $inc: { bookmarkCount: -1 } });
                    authorId = poll.author.toString();
                }
                break;
            case 'comment':
                user.bookmarkedComments = user.bookmarkedComments.filter(
                    id => id.toString() !== req.params.id
                );
                const comment = await Comment.findById(req.params.id);
                if (comment) {
                    authorId = comment.author.toString();
                }
                break;
            case 'user':
                user.bookmarkedUsers = user.bookmarkedUsers.filter(
                    id => id.toString() !== req.params.id
                );
                authorId = req.params.id; // For user bookmarks, the param id is the author
                break;
            default:
                return errorResponse(res, 400, 'Invalid bookmark type');
        }

        await user.save();

        // Revert points for bookmarks (only if author exists and is not the current user)
        if (authorId && authorId !== req.user._id.toString()) {
            try {
                await createPointEvent(PointEventType.BOOKMARK_GIVEN_REVERTED, req.user._id, req.params.id);
                await createPointEvent(PointEventType.BOOKMARK_RECEIVED_REVERTED, authorId, req.params.id);
            } catch (error) {
                console.error('Error creating point event for bookmark removal:', error);
            }
        }

        // Fetch updated user points
        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        return successResponse(res, 200, { points: userPoints }, 'Bookmark removed successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/users/bookmarks
 * @desc    Get all user bookmarks
 * @access  Private
 */
export const getBookmarks = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: 'bookmarkedPosts',
                populate: { path: 'author', select: 'username avatar points' },
            })
            .populate({
                path: 'bookmarkedPolls',
                populate: [
                    { path: 'author', select: 'username avatar points' },
                    { path: 'community', select: 'name displayName avatar' },
                    { path: 'company', select: 'name ticker logo' }
                ],
            })
            .populate({
                path: 'bookmarkedComments',
                populate: { path: 'author', select: 'username avatar points' },
            })
            .populate('bookmarkedUsers', 'username avatar bio points');

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Transform polls to include type field and match post structure
        const transformedPolls = user.bookmarkedPolls.map(poll => {
            const pollObj = poll.toObject();
            pollObj.type = 'poll';
            pollObj.title = poll.question; // Use question as title for consistency
            pollObj.content = poll.description || '';
            pollObj.results = poll.getResults ? poll.getResults() : [];
            pollObj.totalVotes = poll.totalVotes || 0;
            pollObj.isExpired = poll.isExpired || false;
            return pollObj;
        });

        const bookmarks = {
            posts: user.bookmarkedPosts,
            polls: transformedPolls,
            comments: user.bookmarkedComments,
            users: user.bookmarkedUsers,
        };

        return successResponse(res, 200, { bookmarks }, 'Bookmarks retrieved');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/users/bowls
 * @desc    Get user's joined bowls
 * @access  Private
 */
export const getUserBowls = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('joinedBowls', 'name displayName description icon memberCount postCount');

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        return successResponse(res, 200, { bowls: user.joinedBowls }, 'User bowls retrieved');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/users/leaderboard
 * @desc    Get top 10 users by points (descending)
 * @access  Public
 */
export const getTopUsersByPoints = async (req, res, next) => {
    try {
        const topUsers = await User.find({ isActive: true })
            .select('username avatar bio points')
            .sort({ points: -1 })
            .limit(10);

        return successResponse(res, 200, { users: topUsers }, 'Top users retrieved');

    } catch (error) {
        next(error);
    }
};
