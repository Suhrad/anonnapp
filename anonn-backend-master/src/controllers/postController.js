import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import AnonymousProfile from '../models/AnonymousProfile.js';
import Notification from '../models/Notification.js';
import ExternalMarket from '../models/ExternalMarket.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { createPointEvent } from '../utils/points.js';
import { PointEventType } from '../models/PointEvent.js';
import { parseMentions } from '../utils/mentions.js';

/**
 * Post Controller
 * Handles post CRUD, voting, comments, and filtering
 */

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private
 */
export const createPost = async (req, res, next) => {
    try {
        const { title, content, community, bowl, companyTags, type, mediaUrl, linkUrl, bias, attachedMarket } = req.body;
        const mongoose = (await import('mongoose')).default;

        let communityId = community;
        if (communityId && typeof communityId === 'string') {
            if (mongoose.Types.ObjectId.isValid(communityId)) {
                communityId = new mongoose.Types.ObjectId(communityId);
            } else {
                return errorResponse(res, 400, null, 'Invalid community ID');
            }
        }

        let companyTagIds = Array.isArray(companyTags) ? companyTags : [];
        companyTagIds = companyTagIds.map(tag => {
            if (typeof tag === 'string' && mongoose.Types.ObjectId.isValid(tag)) {
                return new mongoose.Types.ObjectId(tag);
            } else {
                return null;
            }
        });
        if (companyTagIds.includes(null)) {
            return errorResponse(res, 400, null, 'One or more companyTags are invalid IDs');
        }

        let attachedMarketId = null;
        if (attachedMarket !== undefined && attachedMarket !== null && attachedMarket !== '') {
            if (!mongoose.Types.ObjectId.isValid(attachedMarket)) {
                return errorResponse(res, 400, null, 'Invalid attached market ID');
            }
            attachedMarketId = new mongoose.Types.ObjectId(attachedMarket);
            const marketExists = await ExternalMarket.findById(attachedMarketId).select('_id');
            if (!marketExists) {
                return errorResponse(res, 404, null, 'Attached market not found');
            }
        }

        const post = await Post.create({
            title,
            content,
            anonAuthorId: req.anonymousId,
            community: communityId,
            bowl,
            companyTags: companyTagIds,
            attachedMarket: attachedMarketId,
            type: type || 'text',
            mediaUrl,
            linkUrl,
            bias,
        });

        const populatedPost = await Post.findById(post._id)
            .populate('author')   // virtual → AnonymousProfile
            .populate('community', 'name displayName')
            .populate('companyTags', 'name ticker')
            .populate('attachedMarket');

        // Award points for creating a post
        try {
            await createPointEvent(PointEventType.POST_CREATED, req.user._id, post._id.toString());
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error creating point event for post creation:', error);
        }

        return successResponse(res, 201, { post: populatedPost }, 'Post created successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/posts
 * @desc    Get posts with filters
 * @access  Public
 */
export const getPosts = async (req, res, next) => {
    try {
        // Accept both 'sortBy' (frontend) and 'sort' (legacy) param names
        const { sort: sortParam, sortBy, community, company, companies, page = 1, limit = 20, author } = req.query;
        const sort = sortBy || sortParam || 'hot';
        const skip = (page - 1) * limit;

        let query = { isActive: true };

        if (community) {
            query.community = community;
        }

        // Support both 'company' and 'companies' query parameters
        const companyId = company || companies;
        if (companyId) {
            query.companyTags = companyId;
        }

        if (author) {
            query.author = author;
        }

        // HOT algorithm: engagement-weighted time decay (Reddit-style)
        // hotScore = engagementScore / (hoursSincePost + 2)^1.5
        // engagementScore = max(voteScore, 1) + comments*0.5 + shares*2 + views*0.05
        if (sort === 'hot' && !author) {
            const now = new Date();
            const [result] = await Post.aggregate([
                { $match: query },
                {
                    $addFields: {
                        upvoteCount: { $size: '$upvotes' },
                        downvoteCount: { $size: '$downvotes' },
                        hoursSincePost: {
                            $divide: [
                                { $subtract: [now, '$createdAt'] },
                                3600000
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        voteScore: { $subtract: ['$upvoteCount', '$downvoteCount'] }
                    }
                },
                {
                    $addFields: {
                        engagementScore: {
                            $add: [
                                { $cond: [{ $gt: ['$voteScore', 0] }, '$voteScore', 1] },
                                { $multiply: ['$commentCount', 0.5] },
                                { $multiply: ['$shareCount', 2.0] },
                                { $multiply: ['$viewCount', 0.05] }
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        hotScore: {
                            $divide: [
                                '$engagementScore',
                                { $pow: [{ $add: ['$hoursSincePost', 2] }, 1.5] }
                            ]
                        }
                    }
                },
                { $sort: { hotScore: -1, createdAt: -1 } },
                {
                    $facet: {
                        metadata: [{ $count: 'total' }],
                        data: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }]
                    }
                }
            ]);

            const total = result.metadata[0]?.total || 0;
            const rawPosts = result.data;

            const populatedPosts = await Post.populate(rawPosts, [
                { path: 'author' },   // virtual → AnonymousProfile
                { path: 'community', select: 'name displayName avatar' },
                { path: 'companyTags', select: 'name ticker logo' },
                { path: 'attachedMarket' },
            ]);

            return paginatedResponse(res, populatedPosts, parseInt(page), parseInt(limit), total);
        }

        let sortOption = {};
        if (sort === 'new') {
            sortOption = { createdAt: -1 };
        } else if (sort === 'top') {
            sortOption = { createdAt: -1 };
        } else {
            sortOption = { createdAt: -1 };
        }

        const posts = await Post.find(query)
            .sort(sortOption)
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author')   // virtual → AnonymousProfile
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        const total = await Post.countDocuments(query);

        // Calculate scores for client-side sorting if needed
        const postsWithScores = posts.map(post => {
            const postObj = post.toObject();
            postObj.voteScore = post.upvotes.length - post.downvotes.length;
            return postObj;
        });

        // If filtering by author, also fetch polls from the same author and combine them
        let allItems = [...postsWithScores];
        if (author) {
            const pollQuery = { isActive: true, author: author };
            
            if (community) {
                pollQuery.community = community;
            }
            
            if (companyId) {
                pollQuery.company = companyId;
            }

            const polls = await Poll.find(pollQuery)
                .sort(sortOption)
                .populate('author', 'username avatar')
                .populate('community', 'name displayName')
                .populate('company', 'name ticker logo')
                .populate('attachedMarket');

            // Transform polls to match post structure with type: 'poll'
            const pollsWithType = polls.map(poll => {
                const pollObj = poll.toObject();
                pollObj.type = 'poll';
                pollObj.voteScore = poll.upvotes.length - poll.downvotes.length;
                pollObj.title = poll.question; // Use question as title for consistency
                pollObj.content = poll.description || '';
                // Add poll-specific fields that frontend expects
                pollObj.results = poll.getResults();
                pollObj.totalVotes = poll.totalVotes;
                pollObj.isExpired = poll.isExpired;
                return pollObj;
            });

            allItems = [...postsWithScores, ...pollsWithType];
            // Sort combined array by createdAt
            allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            // Apply pagination to combined results
            const paginatedItems = allItems.slice(skip, skip + parseInt(limit));
            const totalWithPolls = allItems.length;

            return paginatedResponse(res, paginatedItems, parseInt(page), parseInt(limit), totalWithPolls);
        }

        return paginatedResponse(res, postsWithScores, parseInt(page), parseInt(limit), total);

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/posts/:id
 * @desc    Get single post
 * @access  Public
 */
export const getPost = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'username avatar bio')
            .populate('community', 'name displayName avatar')
            .populate('bowl', 'name displayName icon')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        if (!post || !post.isActive) {
            return errorResponse(res, 404, 'Post not found');
        }

        // Increment view count
        post.viewCount += 1;
        await post.save();

        const postObj = post.toObject();
        postObj.voteScore = post.upvotes.length - post.downvotes.length;

        return successResponse(res, 200, { post: postObj }, 'Post retrieved');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/posts/:id
 * @desc    Update post
 * @access  Private
 */
export const updatePost = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return errorResponse(res, 404, 'Post not found');
        }

        // Check authorization (compare anonymousIds)
        if (post.anonAuthorId !== req.anonymousId) {
            return errorResponse(res, 403, 'Not authorized to update this post');
        }

        const { title, content } = req.body;

        if (title) post.title = title;
        if (content) post.content = content;

        await post.save();

        return successResponse(res, 200, { post }, 'Post updated successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete post
 * @access  Private
 */
export const deletePost = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return errorResponse(res, 404, 'Post not found');
        }

        // Check authorization (compare anonymousIds)
        if (post.anonAuthorId !== req.anonymousId) {
            return errorResponse(res, 403, 'Not authorized to delete this post');
        }

        // Soft delete
        post.isActive = false;
        await post.save();

        // Revert points for post creation
        try {
            await createPointEvent(PointEventType.POST_CREATED_REVERTED, req.user._id, post._id.toString());
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error creating point event for post deletion:', error);
        }

        // Fetch updated user points
        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        return successResponse(res, 200, { points: userPoints }, 'Post deleted successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/posts/:id/vote
 * @desc    Vote on post
 * @access  Private
 */
export const votePost = async (req, res, next) => {
    try {
        let { voteType } = req.body; // 'upvote' or 'downvote'

        // Normalize aliases
        if (voteType === 'up') voteType = 'upvote';
        if (voteType === 'down') voteType = 'downvote';

        const post = await Post.findById(req.params.id);

        if (!post) {
            return errorResponse(res, 404, 'Post not found');
        }

        // Use anonymousId for all vote tracking (never real userId)
        const anonId = req.anonymousId;
        const postAnonAuthorId = post.anonAuthorId;
        const isAuthorVoting = anonId === postAnonAuthorId;
        const hasUpvoted = post.upvotes.includes(anonId);
        const hasDownvoted = post.downvotes.includes(anonId);

        if (voteType === 'upvote') {
            if (hasUpvoted) {
                post.upvotes = post.upvotes.filter(id => id !== anonId);
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.UPVOTE_GIVEN_REVERTED, req.user._id, post._id.toString());
                        await createPointEvent(PointEventType.UPVOTE_RECEIVED_REVERTED, req.user._id, post._id.toString());
                    } catch (error) { /* non-critical */ }
                }
            } else {
                post.upvotes.push(anonId);
                if (hasDownvoted) {
                    post.downvotes = post.downvotes.filter(id => id !== anonId);
                    if (!isAuthorVoting) {
                        try {
                            await createPointEvent(PointEventType.DOWNVOTE_GIVEN_REVERTED, req.user._id, post._id.toString());
                            await createPointEvent(PointEventType.DOWNVOTE_RECEIVED_REVERTED, req.user._id, post._id.toString());
                        } catch (error) { /* non-critical */ }
                    }
                }
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.UPVOTE_GIVEN, req.user._id, post._id.toString());
                        await createPointEvent(PointEventType.UPVOTE_RECEIVED, req.user._id, post._id.toString());
                    } catch (error) { /* non-critical */ }
                }
            }
        } else if (voteType === 'downvote') {
            if (hasDownvoted) {
                post.downvotes = post.downvotes.filter(id => id !== anonId);
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.DOWNVOTE_GIVEN_REVERTED, req.user._id, post._id.toString());
                        await createPointEvent(PointEventType.DOWNVOTE_RECEIVED_REVERTED, req.user._id, post._id.toString());
                    } catch (error) { /* non-critical */ }
                }
            } else {
                post.downvotes.push(anonId);
                if (hasUpvoted) {
                    post.upvotes = post.upvotes.filter(id => id !== anonId);
                    if (!isAuthorVoting) {
                        try {
                            await createPointEvent(PointEventType.UPVOTE_GIVEN_REVERTED, req.user._id, post._id.toString());
                            await createPointEvent(PointEventType.UPVOTE_RECEIVED_REVERTED, req.user._id, post._id.toString());
                        } catch (error) { /* non-critical */ }
                    }
                }
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.DOWNVOTE_GIVEN, req.user._id, post._id.toString());
                        await createPointEvent(PointEventType.DOWNVOTE_RECEIVED, req.user._id, post._id.toString());
                    } catch (error) { /* non-critical */ }
                }
            }
        } else {
            return errorResponse(res, 400, 'Invalid vote type');
        }

        await post.save();

        // Fetch updated user points
        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        const currentUserVote = post.upvotes.includes(anonId)
            ? { voteType: 'up' }
            : post.downvotes.includes(anonId)
            ? { voteType: 'down' }
            : null;

        return successResponse(res, 200, {
            updatedCounts: {
                upvotes: post.upvotes.length,
                downvotes: post.downvotes.length,
            },
            userVote: currentUserVote,
            voteScore: post.upvotes.length - post.downvotes.length,
            points: userPoints,
        }, 'Vote recorded');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/posts/:id/comments
 * @desc    Add comment to post
 * @access  Private
 */
export const addComment = async (req, res, next) => {
    try {
        const { content, parentComment } = req.body;
        const post = await Post.findById(req.params.id);

        if (!post) {
            return errorResponse(res, 404, 'Post not found');
        }

        const comment = await Comment.create({
            content,
            anonAuthorId: req.anonymousId,
            post: req.params.id,
            parentComment: parentComment || null,
        });

        // Increment comment count
        post.commentCount += 1;
        await post.save();

        // If it's a reply, increment parent comment's reply count
        if (parentComment) {
            await Comment.findByIdAndUpdate(parentComment, { $inc: { replyCount: 1 } });
        }

        // Award points for comments
        try {
            await createPointEvent(PointEventType.COMMENT_GIVEN, req.user._id, comment._id.toString());
            if (post.anonAuthorId !== req.anonymousId) {
                await createPointEvent(PointEventType.COMMENT_RECEIVED, req.user._id, comment._id.toString());
            }
        } catch (error) { /* non-critical */ }

        // Fire @mention notifications (non-critical)
        try {
            const mentionedUsernames = parseMentions(content);
            for (const username of mentionedUsernames) {
                if (username === req.anonProfile?.username) continue; // skip self-mentions
                const mentionedProfile = await AnonymousProfile.findOne({ username });
                if (!mentionedProfile) continue;
                const mentionedUser = await User.findOne({ anonymousId: mentionedProfile.anonymousId });
                if (!mentionedUser) continue;
                await Notification.create({
                    recipient: mentionedUser._id,
                    sender: req.user._id,
                    type: 'mention',
                    title: 'You were mentioned',
                    message: `@${req.anonProfile.username} mentioned you in a comment`,
                    relatedComment: comment._id,
                    relatedPost: req.params.id,
                    actionUrl: `/post/${req.params.id}`,
                });
            }
        } catch (error) { /* non-critical */ }

        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        const populatedComment = await Comment.findById(comment._id)
            .populate('author');  // virtual → AnonymousProfile

        return successResponse(res, 201, { comment: populatedComment, points: userPoints }, 'Comment added');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/posts/:id/comments
 * @desc    Get post comments
 * @access  Public
 */
export const getComments = async (req, res, next) => {
    try {
        const { sort = 'new' } = req.query;

        const comments = await Comment.find({
            post: req.params.id,
            parentComment: null,
            isActive: true
        })
            .sort({ createdAt: -1 })
            .populate('author')  // virtual → AnonymousProfile
            .populate({
                path: 'replies',
                populate: { path: 'author' }
            });

        if (sort === 'top') {
            comments.sort((a, b) =>
                (b.upvotes.length - b.downvotes.length) - (a.upvotes.length - a.downvotes.length)
            );
        } else if (sort === 'controversial') {
            comments.sort((a, b) =>
                (b.upvotes.length + b.downvotes.length) - (a.upvotes.length + a.downvotes.length)
            );
        }
        // 'new' keeps existing createdAt DESC order from the DB query

        return successResponse(res, 200, { comments }, 'Comments retrieved');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/posts/:id/share
 * @desc    Increment share count
 * @access  Public
 */
export const sharePost = async (req, res, next) => {
    try {
        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { shareCount: 1 } },
            { new: true }
        );

        if (!post) {
            return errorResponse(res, 404, 'Post not found');
        }

        // Award points for sharing (if user is authenticated)
        if (req.user) {
            try {
                await createPointEvent(PointEventType.POST_SHARED, req.user._id, post._id.toString());
            } catch (error) {
                console.error('Error creating point event for post share:', error);
            }
        }

        return successResponse(res, 200, {}, 'Share count updated');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/posts/search
 * @desc    Search posts
 * @access  Public
 */
export const searchPosts = async (req, res, next) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        if (!q) {
            return errorResponse(res, 400, 'Search query is required');
        }

        const posts = await Post.find({
            $text: { $search: q },
            isActive: true,
        })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author', 'username avatar')
            .populate('community', 'name displayName')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        const total = await Post.countDocuments({
            $text: { $search: q },
            isActive: true,
        });

        return paginatedResponse(res, posts, parseInt(page), parseInt(limit), total);

    } catch (error) {
        next(error);
    }
};
