import mongoose from 'mongoose';



/**
 * User Model
 * Represents users with profiles, bookmarks, and social features
 * Supports both email/password and Solana wallet authentication
 */

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            maxlength: [30, 'Username cannot exceed 30 characters'],
            match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
        },
        email: {
            type: String,
            unique: true,
            sparse: true, // Allow null values for wallet-only accounts
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
            required: function () {
                return this.authMethod === 'email' || this.authMethod === 'both';
            },
        },
        password: {
            type: String,
            minlength: [6, 'Password must be at least 6 characters'],
            required: function () {
                return this.authMethod === 'email' || this.authMethod === 'both';
            },
        },
        // Authentication method
        authMethod: {
            type: String,
            enum: ['email', 'wallet', 'both'],
            default: 'email',
            required: true,
        },
        // Primary Solana wallet for quick lookup
        primaryWallet: {
            type: String,
            sparse: true, // Allows null, but enforces uniqueness when set
            unique: true, // Creates index automatically
        },
        // Profile information
        avatar: {
            type: String,
            default: '',
        },
        bio: {
            type: String,
            maxlength: [500, 'Bio cannot exceed 500 characters'],
            default: '',
        },
        // Web3 wallet addresses
        walletAddresses: [{
            address: String, // For EVM chains (Ethereum, Polygon, BSC)
            publicKey: String, // For Solana
            chain: {
                type: String,
                enum: ['ethereum', 'polygon', 'binance', 'solana'],
            },
            isPrimary: {
                type: Boolean,
                default: false,
            },
            verified: {
                type: Boolean,
                default: false,
            },
            addedAt: {
                type: Date,
                default: Date.now,
            },
        }],
        // Social features
        followers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        following: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        // Bookmarks
        bookmarkedPosts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        }],
        bookmarkedPolls: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Poll',
        }],
        bookmarkedComments: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
        }],
        bookmarkedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        // Communities and Bowls
        joinedCommunities: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Community',
        }],
        joinedBowls: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bowl',
        }],
        followedMarkets: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExternalMarket',
        }],
        // Notification settings
        notificationSettings: {
            email: {
                type: Boolean,
                default: true,
            },
            push: {
                type: Boolean,
                default: true,
            },
            comments: {
                type: Boolean,
                default: true,
            },
            follows: {
                type: Boolean,
                default: true,
            },
            mentions: {
                type: Boolean,
                default: true,
            },
            chat: {
                type: Boolean,
                default: true,
            },
        },
        // Anonymous identity — stored here for JWT lookup only.
        // The IdentityMapping collection stores it encrypted so
        // admin can never reverse anonymousId → userId from posts alone.
        anonymousId: {
            type: String,
            sparse: true,
            unique: true,
            index: true,
        },
        // Reputation score
        reputation: {
            type: Number,
            default: 0,
        },
        // Points
        points: {
            type: Number,
            default: 0,
        },
        // Account status
        isActive: {
            type: Boolean,
            default: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes for performance
// Note: username, email have unique:true which creates indexes automatically
userSchema.index({ createdAt: -1 });

// Virtual for follower count
userSchema.virtual('followerCount').get(function () {
    return Array.isArray(this.followers) ? this.followers.length : 0;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function () {
    return Array.isArray(this.following) ? this.following.length : 0;
});

// Virtual for post count (will be populated by queries)
userSchema.virtual('postCount', {
    ref: 'Post',
    localField: '_id',
    foreignField: 'author',
    count: true,
});

// Virtual for poll count
userSchema.virtual('pollCount', {
    ref: 'Poll',
    localField: '_id',
    foreignField: 'author',
    count: true,
});

// Virtual for comment count
userSchema.virtual('commentCount', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'author',
    count: true,
});

const User = mongoose.model('User', userSchema);

export default User;
