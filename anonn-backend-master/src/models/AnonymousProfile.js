import mongoose from 'mongoose';

/**
 * AnonymousProfile Model
 * The only public-facing identity document. Contains zero PII.
 * Linked to a real User ONLY through the encrypted IdentityMapping collection.
 */
const anonymousProfileSchema = new mongoose.Schema(
    {
        anonymousId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            maxlength: [30, 'Username cannot exceed 30 characters'],
        },
        avatar: {
            type: String,
            default: '',
        },
        bio: {
            type: String,
            maxlength: [500, 'Bio cannot exceed 500 characters'],
            default: '',
        },
        points: {
            type: Number,
            default: 0,
        },
        reputation: {
            type: Number,
            default: 0,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        // X25519 public key for E2EE chat (base64-encoded)
        encryptionPublicKey: {
            type: String,
            default: null,
        },
        // Joined communities / bowls (no User reference)
        joinedCommunities: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Community',
        }],
        joinedBowls: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bowl',
        }],
        bookmarkedPosts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        }],
        bookmarkedPolls: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Poll',
        }],
        notificationSettings: {
            push: { type: Boolean, default: true },
            comments: { type: Boolean, default: true },
            mentions: { type: Boolean, default: true },
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

anonymousProfileSchema.index({ username: 1 });

const AnonymousProfile = mongoose.model('AnonymousProfile', anonymousProfileSchema);

export default AnonymousProfile;
