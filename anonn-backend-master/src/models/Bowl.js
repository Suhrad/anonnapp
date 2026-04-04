import mongoose from 'mongoose';

/**
 * Bowl Model
 * Represents bowls (category-based groupings similar to communities)
 */

const bowlSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Bowl name is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Name must be at least 3 characters'],
            maxlength: [30, 'Name cannot exceed 30 characters'],
        },
        displayName: {
            type: String,
            required: [true, 'Display name is required'],
            trim: true,
            maxlength: [50, 'Display name cannot exceed 50 characters'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        icon: {
            type: String,
            default: '',
        },
        banner: {
            type: String,
            default: '',
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        moderators: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        members: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        // Associated communities
        communities: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Community',
        }],
        // Category/Topic
        category: {
            type: String,
            enum: ['crypto', 'stocks', 'sports', 'politics', 'entertainment', 'technology', 'other'],
            default: 'other',
        },
        // Settings
        settings: {
            isPrivate: {
                type: Boolean,
                default: false,
            },
            requireApproval: {
                type: Boolean,
                default: false,
            },
        },
        // Appearance
        appearance: {
            primaryColor: {
                type: String,
                default: '#8b5cf6',
            },
            theme: {
                type: String,
                enum: ['light', 'dark', 'auto'],
                default: 'auto',
            },
        },
        // Stats
        memberCount: {
            type: Number,
            default: 0,
        },
        postCount: {
            type: Number,
            default: 0,
        },
        // Status
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

// Indexes
// Note: name has unique:true which creates index automatically
bowlSchema.index({ category: 1 });
bowlSchema.index({ memberCount: -1 });

// Auto-add creator as first moderator and member
bowlSchema.pre('save', function (next) {
    if (this.isNew) {
        this.moderators.push(this.creator);
        this.members.push(this.creator);
        this.memberCount = 1;
    }
    next();
});

const Bowl = mongoose.model('Bowl', bowlSchema);

export default Bowl;
