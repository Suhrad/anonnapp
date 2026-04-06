import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { createPointEvent } from '../utils/points.js';
import { PointEventType } from '../models/PointEvent.js';

/**
 * Comment Controller
 * Handles comment management (vote, update, delete)
 */

const ALLOWED_REACTIONS = ['👍', '😂', '🔥', '❤️', '🎯', '😮'];

/**
 * @route   POST /api/comments/:id/react
 * @desc    Toggle an emoji reaction on a comment
 * @access  Private
 */
export const reactToComment = async (req, res, next) => {
    try {
        const { emoji } = req.body;
        if (!ALLOWED_REACTIONS.includes(emoji)) {
            return errorResponse(res, 400, 'Invalid reaction');
        }

        const comment = await Comment.findById(req.params.id);
        if (!comment || !comment.isActive) {
            return errorResponse(res, 404, 'Comment not found');
        }

        const reactions = comment.reactions || new Map();
        const voters = reactions.get(emoji) || [];
        const idx = voters.indexOf(req.anonymousId);
        if (idx === -1) {
            voters.push(req.anonymousId);
        } else {
            voters.splice(idx, 1);
        }

        if (voters.length === 0) {
            reactions.delete(emoji);
        } else {
            reactions.set(emoji, voters);
        }

        comment.reactions = reactions;
        await comment.save();

        return successResponse(
            res,
            200,
            { reactions: Object.fromEntries(comment.reactions) },
            'Reaction updated'
        );
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/comments
 * @desc    Get comments with filters (e.g. by author)
 * @access  Public
 */
export const getComments = async (req, res, next) => {
    try {
        const { author, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const query = { isActive: true };
        if (author) {
            query.anonAuthorId = author;
        }

        const comments = await Comment.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author')
            .populate('post', 'title')
            .populate('poll', 'question');

        const total = await Comment.countDocuments(query);

        return paginatedResponse(res, comments, parseInt(page), parseInt(limit), total);

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/comments/:id/vote
 * @desc    Vote on comment
 * @access  Private
 */
export const voteComment = async (req, res, next) => {
    try {
        const { voteType } = req.body; // 'upvote' or 'downvote'
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return errorResponse(res, 404, 'Comment not found');
        }

        const anonId = req.anonymousId;
        const commentAuthorId = comment.anonAuthorId;
        const isAuthorVoting = anonId === commentAuthorId;
        const hasUpvoted = comment.upvotes.includes(anonId);
        const hasDownvoted = comment.downvotes.includes(anonId);

        if (voteType === 'upvote') {
            if (hasUpvoted) {
                // Remove upvote - revert points
                comment.upvotes = comment.upvotes.filter(id => id !== anonId);
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.UPVOTE_GIVEN_REVERTED, anonId, comment._id.toString());
                        await createPointEvent(PointEventType.UPVOTE_RECEIVED_REVERTED, commentAuthorId, comment._id.toString());
                    } catch (error) {
                        console.error('Error creating point event for upvote removal:', error);
                    }
                }
            } else {
                // Add upvote, remove downvote if exists
                comment.upvotes.push(anonId);
                if (hasDownvoted) {
                    comment.downvotes = comment.downvotes.filter(id => id !== anonId);
                    // Revert downvote points
                    if (!isAuthorVoting) {
                        try {
                            await createPointEvent(PointEventType.DOWNVOTE_GIVEN_REVERTED, anonId, comment._id.toString());
                            await createPointEvent(PointEventType.DOWNVOTE_RECEIVED_REVERTED, commentAuthorId, comment._id.toString());
                        } catch (error) {
                            console.error('Error creating point event for downvote removal:', error);
                        }
                    }
                }
                // Award upvote points
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.UPVOTE_GIVEN, anonId, comment._id.toString());
                        await createPointEvent(PointEventType.UPVOTE_RECEIVED, commentAuthorId, comment._id.toString());
                    } catch (error) {
                        console.error('Error creating point event for upvote:', error);
                    }
                }
            }
        } else if (voteType === 'downvote') {
            if (hasDownvoted) {
                // Remove downvote - revert points
                comment.downvotes = comment.downvotes.filter(id => id !== anonId);
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.DOWNVOTE_GIVEN_REVERTED, anonId, comment._id.toString());
                        await createPointEvent(PointEventType.DOWNVOTE_RECEIVED_REVERTED, commentAuthorId, comment._id.toString());
                    } catch (error) {
                        console.error('Error creating point event for downvote removal:', error);
                    }
                }
            } else {
                // Add downvote, remove upvote if exists
                comment.downvotes.push(anonId);
                if (hasUpvoted) {
                    comment.upvotes = comment.upvotes.filter(id => id !== anonId);
                    // Revert upvote points
                    if (!isAuthorVoting) {
                        try {
                            await createPointEvent(PointEventType.UPVOTE_GIVEN_REVERTED, anonId, comment._id.toString());
                            await createPointEvent(PointEventType.UPVOTE_RECEIVED_REVERTED, commentAuthorId, comment._id.toString());
                        } catch (error) {
                            console.error('Error creating point event for upvote removal:', error);
                        }
                    }
                }
                // Award downvote points
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.DOWNVOTE_GIVEN, anonId, comment._id.toString());
                        await createPointEvent(PointEventType.DOWNVOTE_RECEIVED, commentAuthorId, comment._id.toString());
                    } catch (error) {
                        console.error('Error creating point event for downvote:', error);
                    }
                }
            }
        } else {
            return errorResponse(res, 400, 'Invalid vote type');
        }

        await comment.save();

        return successResponse(res, 200, {
            voteScore: comment.upvotes.length - comment.downvotes.length,
            upvotes: comment.upvotes.length,
            downvotes: comment.downvotes.length,
        }, 'Vote recorded');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete comment
 * @access  Private
 */
export const deleteComment = async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return errorResponse(res, 404, 'Comment not found');
        }

        // Check authorization — only the anonymous author can delete
        if (comment.anonAuthorId !== req.anonymousId) {
            return errorResponse(res, 403, 'Not authorized to delete this comment');
        }

        // Soft delete — preserve thread structure, clear content
        comment.isActive = false;
        comment.content = '[deleted]';

        await comment.save();

        // Decrement post/poll comment count and revert points
        if (comment.post) {
            const post = await Post.findById(comment.post);
            if (post) {
                await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
                try {
                    await createPointEvent(PointEventType.COMMENT_GIVEN_REVERTED, req.anonymousId, comment._id.toString());
                    if (post.anonAuthorId !== req.anonymousId) {
                        await createPointEvent(PointEventType.COMMENT_RECEIVED_REVERTED, post.anonAuthorId, comment._id.toString());
                    }
                } catch (error) {
                    console.error('Error creating point event for comment deletion:', error);
                }
            }
        } else if (comment.poll) {
            const poll = await Poll.findById(comment.poll);
            if (poll) {
                await Poll.findByIdAndUpdate(comment.poll, { $inc: { commentCount: -1 } });
                try {
                    await createPointEvent(PointEventType.COMMENT_GIVEN_REVERTED, req.anonymousId, comment._id.toString());
                    if (poll.anonAuthorId !== req.anonymousId) {
                        await createPointEvent(PointEventType.COMMENT_RECEIVED_REVERTED, poll.anonAuthorId, comment._id.toString());
                    }
                } catch (error) {
                    console.error('Error creating point event for comment deletion:', error);
                }
            }
        }

        return successResponse(res, 200, {}, 'Comment deleted successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/comments/:id
 * @desc    Update comment
 * @access  Private
 */
export const updateComment = async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return errorResponse(res, 404, 'Comment not found');
        }

        if (comment.anonAuthorId !== req.anonymousId) {
            return errorResponse(res, 403, 'Not authorized to update this comment');
        }

        const { content } = req.body;
        if (!content) {
            return errorResponse(res, 400, 'Content is required');
        }

        comment.content = content;
        comment.isEdited = true;
        comment.editedAt = new Date();

        await comment.save();

        const populatedComment = await Comment.findById(comment._id)
            .populate('author');

        return successResponse(res, 200, { comment: populatedComment }, 'Comment updated successfully');

    } catch (error) {
        next(error);
    }
};
