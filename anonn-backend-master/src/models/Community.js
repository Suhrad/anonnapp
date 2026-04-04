import mongoose from 'mongoose';

/**
 * Community Model
 * Represents communities (similar to subreddits)
 */

const communitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Community name is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Name must be at least 3 characters'],
            maxlength: [30, 'Name cannot exceed 30 characters'],
            match: [/^[a-zA-Z0-9_]+$/, 'Name can only contain letters, numbers, and underscores'],
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
        avatar: {
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
            allowPolls: {
                type: Boolean,
                default: true,
            },
            allowImages: {
                type: Boolean,
                default: true,
            },
            allowVideos: {
                type: Boolean,
                default: true,
            },
            minimumKarma: {
                type: Number,
                default: 0,
            },
        },
        // Appearance
        appearance: {
            primaryColor: {
                type: String,
                default: '#3b82f6',
            },
            theme: {
                type: String,
                enum: ['light', 'dark', 'auto'],
                default: 'auto',
            },
        },
        // Rules
        rules: [{
            title: String,
            description: String,
        }],
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
    }
);

// Indexes
// Note: name has unique:true which creates index automatically
communitySchema.index({ memberCount: -1 });
communitySchema.index({ createdAt: -1 });

// Auto-add creator as first moderator and member
communitySchema.pre('save', function (next) {
    if (this.isNew) {
        this.moderators.push(this.creator);
        this.members.push(this.creator);
        this.memberCount = 1;
    }
    next();
});

const Community = mongoose.model('Community', communitySchema);

export default Community;
