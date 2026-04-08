import Poll from '../models/Poll.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import ExternalMarket from '../models/ExternalMarket.js';
import Notification from '../models/Notification.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { createPointEvent } from '../utils/points.js';
import { PointEventType } from '../models/PointEvent.js';

const findNotificationRecipientByAnonymousId = async (anonymousId) => {
    if (!anonymousId) return null;
    return User.findOne({ anonymousId }).select('_id notificationSettings');
};

/**
 * Poll Controller
 * Handles poll CRUD, voting, and results
 */

/**
 * @route   GET /api/polls/search
 * @desc    Search polls by question text
 * @access  Public
 */
export const searchPolls = async (req, res, next) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        if (!q) {
            return errorResponse(res, 400, 'Search query is required');
        }

        const polls = await Poll.find({
            $text: { $search: q },
            isActive: true,
        })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author')  // virtual → AnonymousProfile
            .populate('attachedMarket');

        const total = await Poll.countDocuments({
            $text: { $search: q },
            isActive: true,
        });

        return paginatedResponse(res, polls, parseInt(page), parseInt(limit), total);

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/polls
 * @desc    Create a new poll
 * @access  Private
 */
/**
 * @route   POST /api/polls/:id/votes
 * @desc    Vote on poll (upvote/downvote like a post)
 * @access  Private
 */
export const votePollPost = async (req, res, next) => {
    try {
        let { voteType } = req.body; // 'upvote' or 'downvote'
        if (voteType === 'up') voteType = 'upvote';
        if (voteType === 'down') voteType = 'downvote';
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return errorResponse(res, 404, 'Poll not found');
        }

        const anonId = req.anonymousId;
        const isAuthorVoting = anonId === poll.anonAuthorId;
        if (!poll.upvotes) poll.upvotes = [];
        if (!poll.downvotes) poll.downvotes = [];

        const hasUpvoted = poll.upvotes.includes(anonId);
        const hasDownvoted = poll.downvotes.includes(anonId);

        if (voteType === 'upvote') {
            if (hasUpvoted) {
                poll.upvotes = poll.upvotes.filter(id => id !== anonId);
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.UPVOTE_GIVEN_REVERTED, req.user._id, poll._id.toString());
                        await createPointEvent(PointEventType.UPVOTE_RECEIVED_REVERTED, req.user._id, poll._id.toString());
                    } catch (e) { /* non-critical */ }
                }
            } else {
                poll.upvotes.push(anonId);
                if (hasDownvoted) {
                    poll.downvotes = poll.downvotes.filter(id => id !== anonId);
                    if (!isAuthorVoting) {
                        try {
                            await createPointEvent(PointEventType.DOWNVOTE_GIVEN_REVERTED, req.user._id, poll._id.toString());
                            await createPointEvent(PointEventType.DOWNVOTE_RECEIVED_REVERTED, req.user._id, poll._id.toString());
                        } catch (e) { /* non-critical */ }
                    }
                }
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.UPVOTE_GIVEN, req.user._id, poll._id.toString());
                        await createPointEvent(PointEventType.UPVOTE_RECEIVED, req.user._id, poll._id.toString());
                    } catch (e) { /* non-critical */ }
                }
            }
        } else if (voteType === 'downvote') {
            if (hasDownvoted) {
                poll.downvotes = poll.downvotes.filter(id => id !== anonId);
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.DOWNVOTE_GIVEN_REVERTED, req.user._id, poll._id.toString());
                        await createPointEvent(PointEventType.DOWNVOTE_RECEIVED_REVERTED, req.user._id, poll._id.toString());
                    } catch (e) { /* non-critical */ }
                }
            } else {
                poll.downvotes.push(anonId);
                if (hasUpvoted) {
                    poll.upvotes = poll.upvotes.filter(id => id !== anonId);
                    if (!isAuthorVoting) {
                        try {
                            await createPointEvent(PointEventType.UPVOTE_GIVEN_REVERTED, req.user._id, poll._id.toString());
                            await createPointEvent(PointEventType.UPVOTE_RECEIVED_REVERTED, req.user._id, poll._id.toString());
                        } catch (e) { /* non-critical */ }
                    }
                }
                if (!isAuthorVoting) {
                    try {
                        await createPointEvent(PointEventType.DOWNVOTE_GIVEN, req.user._id, poll._id.toString());
                        await createPointEvent(PointEventType.DOWNVOTE_RECEIVED, req.user._id, poll._id.toString());
                    } catch (e) { /* non-critical */ }
                }
            }
        } else {
            return errorResponse(res, 400, 'Invalid vote type');
        }

        await poll.save();

        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        const currentUserVote = poll.upvotes.includes(anonId)
            ? { voteType: 'upvote' }
            : poll.downvotes.includes(anonId)
                ? { voteType: 'downvote' }
                : null;

        return successResponse(res, 200, {
            voteScore: poll.upvotes.length - poll.downvotes.length,
            upvotes: poll.upvotes.length,
            downvotes: poll.downvotes.length,
            userVote: currentUserVote,
            points: userPoints
        }, 'Vote recorded');

    } catch (error) {
        next(error);
    }
};

export const createPoll = async (req, res, next) => {
    try {
        const { question, description, options, bias, community, bowl, company, expiresAt, attachedMarket } = req.body;
        const mongoose = (await import('mongoose')).default;

        // Validate options count
        if (!options || options.length < 2 || options.length > 4) {
            return errorResponse(res, 400, 'Poll must have between 2 and 4 options');
        }

        // Validate expiry date
        if (new Date(expiresAt) <= new Date()) {
            return errorResponse(res, 400, 'Expiry date must be in the future');
        }

        // Format options
        const formattedOptions = options.map(opt => ({
            text: opt,
            voteCount: 0,
            votes: [],
        }));

        let attachedMarketId = null;
        if (attachedMarket !== undefined && attachedMarket !== null && attachedMarket !== '') {
            if (!mongoose.Types.ObjectId.isValid(attachedMarket)) {
                return errorResponse(res, 400, 'Invalid attached market ID');
            }
            attachedMarketId = new mongoose.Types.ObjectId(attachedMarket);
            const marketExists = await ExternalMarket.findById(attachedMarketId).select('_id');
            if (!marketExists) {
                return errorResponse(res, 404, 'Attached market not found');
            }
        }

        const poll = await Poll.create({
            question,
            description,
            anonAuthorId: req.anonymousId,
            options: formattedOptions,
            bias: bias || 'neutral',
            community,
            bowl,
            company,
            attachedMarket: attachedMarketId,
            expiresAt,
        });

        const populatedPoll = await Poll.findById(poll._id)
            .populate('author')  // virtual → AnonymousProfile
            .populate('community', 'name displayName')
            .populate('company', 'name ticker logo')
            .populate('attachedMarket');

        // Award points for creating a poll
        try {
            await createPointEvent(PointEventType.POLL_CREATED, req.user._id, poll._id.toString());
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error creating point event for poll creation:', error);
        }

        return successResponse(res, 201, { poll: populatedPoll }, 'Poll created successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/polls/:id
 * @desc    Get poll with results
 * @access  Public
 */
export const getPoll = async (req, res, next) => {
    try {
        const poll = await Poll.findById(req.params.id)
            .populate('author')  // virtual → AnonymousProfile
            .populate('community', 'name displayName')
            .populate('company', 'name ticker logo')
            .populate('attachedMarket');

        if (!poll || !poll.isActive) {
            return errorResponse(res, 404, 'Poll not found');
        }

        // Increment view count only if not a refetch (skipViewCount query param)
        const skipViewCount = req.query.skipViewCount === 'true';
        if (!skipViewCount) {
            poll.viewCount += 1;
            await poll.save();
        }

        const results = poll.getResults();

        const pollObj = {
            ...poll.toObject(),
            results,
            isExpired: poll.isExpired,
            totalVotes: poll.totalVotes,
        };

        // Check if user has voted (if authenticated) — use anonymousId
        if (req.anonymousId) {
            const anonId = req.anonymousId;
            const hasVoted = poll.voters.includes(anonId);

            if (hasVoted) {
                const selectedOptions = poll.options
                    .map((option) => {
                        const userVoted = option.votes.includes(anonId);
                        if (userVoted) {
                            return option._id ? option._id.toString() : (option.id ? option.id.toString() : null);
                        }
                        return null;
                    })
                    .filter(id => id !== null);
                
                pollObj.hasVoted = true;
                pollObj.selectedOptions = selectedOptions;
            } else {
                pollObj.hasVoted = false;
                pollObj.selectedOptions = [];
            }
        } else {
            pollObj.hasVoted = false;
            pollObj.selectedOptions = [];
        }

        return successResponse(res, 200, { poll: pollObj }, 'Poll retrieved');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/polls/:id/vote
 * @desc    Vote on poll
 * @access  Private
 */
export const votePoll = async (req, res, next) => {
    try {
        const { optionIndex, optionIds } = req.body;
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return errorResponse(res, 404, 'Poll not found');
        }

        // Check if poll is expired or closed
        if (poll.isExpired || poll.isClosed) {
            return errorResponse(res, 400, 'Poll is closed for voting');
        }

        // Check if user has already voted
        if (poll.voters.includes(req.anonymousId)) {
            return errorResponse(res, 400, 'You have already voted on this poll');
        }

        let targetIndices = [];

        if (Array.isArray(optionIds) && optionIds.length > 0) {
            // Find indices from IDs
            targetIndices = optionIds.map(id =>
                poll.options.findIndex(opt => opt._id.toString() === id.toString() || opt.id === id)
            ).filter(idx => idx !== -1);

            if (targetIndices.length === 0) {
                return errorResponse(res, 400, 'Invalid option IDs');
            }
        } else if (typeof optionIndex === 'number') {
            if (optionIndex < 0 || optionIndex >= poll.options.length) {
                return errorResponse(res, 400, 'Invalid option index');
            }
            targetIndices = [optionIndex];
        } else {
            return errorResponse(res, 400, 'Option index or ID(s) required');
        }

        // Check if multiple choices allowed
        if (targetIndices.length > 1 && !poll.allowMultipleChoices) {
            return errorResponse(res, 400, 'Multiple choices not allowed for this poll');
        }

        // Add votes (using anonymousId, not userId)
        targetIndices.forEach(idx => {
            poll.options[idx].votes.push(req.anonymousId);
            poll.options[idx].voteCount += 1;
        });

        poll.voters.push(req.anonymousId);

        await poll.save();

        if (poll.anonAuthorId !== req.anonymousId) {
            try {
                const recipient = await findNotificationRecipientByAnonymousId(poll.anonAuthorId);
                if (recipient?.notificationSettings?.comments !== false) {
                    await Notification.create({
                        recipient: recipient._id,
                        sender: req.user._id,
                        type: 'poll_vote',
                        title: 'New vote on your poll',
                        message: 'Someone voted on your poll',
                        relatedPoll: poll._id,
                        actionUrl: `/poll?id=${poll._id}`,
                    });
                }
            } catch (error) { /* non-critical */ }
        }

        const results = poll.getResults();

        // Get the selected option IDs that were voted for
        // Return as strings to match frontend format (frontend sends option._id as string)
        const selectedOptions = targetIndices.map(idx => {
            const option = poll.options[idx];
            return option._id ? option._id.toString() : (option.id ? option.id.toString() : idx.toString());
        });

        return successResponse(res, 200, {
            results,
            options: poll.options, // Return updated options
            totalVotes: poll.totalVotes,
            hasVoted: true,
            selectedOptions: selectedOptions
        }, 'Vote recorded successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/polls
 * @desc    Get polls with filters
 * @access  Public
 */
export const getPolls = async (req, res, next) => {
    try {
        const { community, company, organizationId, status = 'active', page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let query = { isActive: true };

        if (community) {
            query.community = community;
        }

        // Support both 'company' and 'organizationId' query parameters
        const companyId = company || organizationId;
        if (companyId) {
            query.company = companyId;
        }

        if (status === 'active') {
            query.isClosed = false;
            query.expiresAt = { $gt: new Date() };
        } else if (status === 'closed') {
            query.$or = [
                { isClosed: true },
                { expiresAt: { $lte: new Date() } }
            ];
        }

        const polls = await Poll.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('author')  // virtual → AnonymousProfile
            .populate('community', 'name displayName')
            .populate('company', 'name ticker logo')
            .populate('attachedMarket');

        const total = await Poll.countDocuments(query);

        const pollsWithResults = polls.map(poll => {
            const pollObj = poll.toObject();
            pollObj.results = poll.getResults();
            pollObj.totalVotes = poll.totalVotes;
            return pollObj;
        });

        return paginatedResponse(res, pollsWithResults, parseInt(page), parseInt(limit), total);

    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/polls/:id
 * @desc    Update poll
 * @access  Private
 */
export const updatePoll = async (req, res, next) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return errorResponse(res, 404, 'Poll not found');
        }

        // Check authorization
        if (poll.author.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'Not authorized to update this poll');
        }

        // Only allow updating description if no votes yet
        if (poll.voters.length > 0) {
            return errorResponse(res, 400, 'Cannot update poll after votes have been cast');
        }

        const { question, description } = req.body;

        if (question) poll.question = question;
        if (description !== undefined) poll.description = description;

        await poll.save();

        return successResponse(res, 200, { poll }, 'Poll updated successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   DELETE /api/polls/:id
 * @desc    Delete poll
 * @access  Private
 */
export const deletePoll = async (req, res, next) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return errorResponse(res, 404, 'Poll not found');
        }

        // Check authorization
        if (poll.author.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'Not authorized to delete this poll');
        }

        // Soft delete
        poll.isActive = false;
        await poll.save();

        // Revert points for poll creation
        try {
            await createPointEvent(PointEventType.POLL_CREATED_REVERTED, req.user._id, poll._id.toString());
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error creating point event for poll deletion:', error);
        }

        return successResponse(res, 200, {}, 'Poll deleted successfully');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/polls/:id/comments
 * @desc    Add a comment to a poll
 * @access  Private
 */
export const addComment = async (req, res, next) => {
    try {
        const { content, parentComment } = req.body;
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return errorResponse(res, 404, 'Poll not found');
        }

        const comment = await Comment.create({
            content,
            author: req.user._id,
            poll: req.params.id,
            parentComment: parentComment || null,
        });

        // Increment comment count
        poll.commentCount += 1;
        await poll.save();

        // If it's a reply, increment parent comment's reply count
        if (parentComment) {
            await Comment.findByIdAndUpdate(parentComment, { $inc: { replyCount: 1 } });
        }

        // Award points for comments
        try {
            // Points for the commenter
            await createPointEvent(PointEventType.COMMENT_GIVEN, req.user._id, comment._id.toString());
            // Points for the poll author (if not commenting on their own poll)
            const pollAuthorId = poll.author.toString();
            if (pollAuthorId !== req.user._id.toString()) {
                await createPointEvent(PointEventType.COMMENT_RECEIVED, pollAuthorId, comment._id.toString());
            }
        } catch (error) {
            console.error('Error creating point event for comment:', error);
        }

        // Fetch updated user points
        const updatedUser = await User.findById(req.user._id).select('points');
        const userPoints = updatedUser ? updatedUser.points : 0;

        const populatedComment = await Comment.findById(comment._id)
            .populate('author')  // virtual → AnonymousProfile;

        return successResponse(res, 201, { comment: populatedComment, points: userPoints }, 'Comment added');

    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/polls/:id/comments
 * @desc    Get poll comments
 * @access  Public
 */
export const getComments = async (req, res, next) => {
    try {
        const comments = await Comment.find({
            poll: req.params.id,
            parentComment: null,
            isActive: true
        })
            .sort({ createdAt: -1 })
            .populate('author')  // virtual → AnonymousProfile
            .populate({
                path: 'replies',
                match: { isActive: true },
                populate: { path: 'author', select: 'username avatar' }
            });

        return successResponse(res, 200, { comments }, 'Comments retrieved');

    } catch (error) {
        next(error);
    }
};
