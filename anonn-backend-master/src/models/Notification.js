import mongoose from 'mongoose';

/**
 * Notification Model
 * Represents user notifications for various events
 */

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Recipient is required'],
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        type: {
            type: String,
            enum: [
                'follow',
                'post_like',
                'post_comment',
                'poll_vote',
                'comment_reply',
                'comment_like',
                'mention',
                'community_invite',
                'moderator_added',
                'market_resolved',
                'market_expiring',
            ],
            required: [true, 'Notification type is required'],
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        message: {
            type: String,
            maxlength: [500, 'Message cannot exceed 500 characters'],
        },
        // Reference to related entity
        relatedPost: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        },
        relatedPoll: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Poll',
        },
        relatedComment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
        },
        relatedCommunity: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Community',
        },
        relatedMarket: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Market',
        },
        relatedChatGroup: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatGroup',
        },
        relatedChatMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatMessage',
        },
        // Action URL
        actionUrl: {
            type: String,
        },
        // Status
        isRead: {
            type: Boolean,
            default: false,
        },
        readAt: Date,
    },
    {
        timestamps: true,
    }
);

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Mark as read
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
