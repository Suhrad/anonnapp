import mongoose from 'mongoose';

/**
 * PointEvent Model
 * Tracks all point-related events for users
 */

// Point Event Types
export const PointEventType = {
    // Invites
    INVITE_ACCEPTED: 'INVITE_ACCEPTED',
    // Content creation
    POST_CREATED: 'POST_CREATED',
    POST_CREATED_REVERTED: 'POST_CREATED_REVERTED',
    POLL_CREATED: 'POLL_CREATED',
    POLL_CREATED_REVERTED: 'POLL_CREATED_REVERTED',
    COMPANY_RATED: 'COMPANY_RATED',
    // Comments
    COMMENT_GIVEN: 'COMMENT_GIVEN',
    COMMENT_GIVEN_REVERTED: 'COMMENT_GIVEN_REVERTED',
    COMMENT_RECEIVED: 'COMMENT_RECEIVED',
    COMMENT_RECEIVED_REVERTED: 'COMMENT_RECEIVED_REVERTED',
    // Votes
    UPVOTE_GIVEN: 'UPVOTE_GIVEN',
    UPVOTE_RECEIVED: 'UPVOTE_RECEIVED',
    UPVOTE_GIVEN_REVERTED: 'UPVOTE_GIVEN_REVERTED',
    UPVOTE_RECEIVED_REVERTED: 'UPVOTE_RECEIVED_REVERTED',
    DOWNVOTE_GIVEN: 'DOWNVOTE_GIVEN',
    DOWNVOTE_RECEIVED: 'DOWNVOTE_RECEIVED',
    DOWNVOTE_GIVEN_REVERTED: 'DOWNVOTE_GIVEN_REVERTED',
    DOWNVOTE_RECEIVED_REVERTED: 'DOWNVOTE_RECEIVED_REVERTED',
    // Engagement
    POST_SHARED: 'POST_SHARED',
    POLL_SHARED: 'POLL_SHARED',
    BOOKMARK_GIVEN: 'BOOKMARK_GIVEN',
    BOOKMARK_GIVEN_REVERTED: 'BOOKMARK_GIVEN_REVERTED',
    BOOKMARK_RECEIVED: 'BOOKMARK_RECEIVED',
    BOOKMARK_RECEIVED_REVERTED: 'BOOKMARK_RECEIVED_REVERTED',
};

// Point Rules - Points awarded for each event type
export const POINT_RULES = {
    // Invites
    [PointEventType.INVITE_ACCEPTED]: 100,
    // Content
    [PointEventType.POST_CREATED]: 20,
    [PointEventType.POST_CREATED_REVERTED]: -20,
    [PointEventType.POLL_CREATED]: 20,
    [PointEventType.POLL_CREATED_REVERTED]: -20,
    [PointEventType.COMPANY_RATED]: 50,
    // Comments
    [PointEventType.COMMENT_GIVEN]: 10,
    [PointEventType.COMMENT_GIVEN_REVERTED]: -10,
    [PointEventType.COMMENT_RECEIVED]: 10,
    [PointEventType.COMMENT_RECEIVED_REVERTED]: -10,
    // Votes
    [PointEventType.UPVOTE_GIVEN]: 5,
    [PointEventType.UPVOTE_RECEIVED]: 5,
    [PointEventType.UPVOTE_GIVEN_REVERTED]: -5,
    [PointEventType.UPVOTE_RECEIVED_REVERTED]: -5,
    [PointEventType.DOWNVOTE_GIVEN]: 5,
    [PointEventType.DOWNVOTE_GIVEN_REVERTED]: -5,
    [PointEventType.DOWNVOTE_RECEIVED]: 5,
    [PointEventType.DOWNVOTE_RECEIVED_REVERTED]: -5,
    // Engagement
    [PointEventType.POST_SHARED]: 10,
    [PointEventType.POLL_SHARED]: 10,
    [PointEventType.BOOKMARK_GIVEN]: 5,
    [PointEventType.BOOKMARK_GIVEN_REVERTED]: -5,
    [PointEventType.BOOKMARK_RECEIVED]: 5,
    [PointEventType.BOOKMARK_RECEIVED_REVERTED]: -5,
};

const pointEventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(PointEventType),
            required: [true, 'Event type is required'],
            index: true,
        },
        /**
         * ID of related entity:
         * postId | pollId | commentId | companyId | inviteId
         */
        referenceId: {
            type: String,
            sparse: true,
        },
        /**
         * Points awarded (positive or negative)
         * Should always come from POINT_RULES
         */
        points: {
            type: Number,
            required: [true, 'Points are required'],
        },
    },
    {
        timestamps: true, // Creates createdAt and updatedAt automatically
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes for performance
pointEventSchema.index({ userId: 1, createdAt: -1 });
pointEventSchema.index({ type: 1, createdAt: -1 });
pointEventSchema.index({ referenceId: 1 });
pointEventSchema.index({ createdAt: -1 });

const PointEvent = mongoose.model('PointEvent', pointEventSchema);

export default PointEvent;

