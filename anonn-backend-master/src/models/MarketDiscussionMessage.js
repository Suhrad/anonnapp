import mongoose from 'mongoose';

const marketDiscussionMessageSchema = new mongoose.Schema(
    {
        market: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExternalMarket',
            required: [true, 'Market is required'],
            index: true,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Author is required'],
            index: true,
        },
        content: {
            type: String,
            required: [true, 'Message content is required'],
            trim: true,
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
        },
        parentMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MarketDiscussionMessage',
        },
        upvotes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        downvotes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

marketDiscussionMessageSchema.index({ market: 1, createdAt: -1 });
marketDiscussionMessageSchema.index({ parentMessage: 1, createdAt: 1 });

marketDiscussionMessageSchema.virtual('voteScore').get(function () {
    return (this.upvotes?.length || 0) - (this.downvotes?.length || 0);
});

const MarketDiscussionMessage = mongoose.model('MarketDiscussionMessage', marketDiscussionMessageSchema);

export default MarketDiscussionMessage;

