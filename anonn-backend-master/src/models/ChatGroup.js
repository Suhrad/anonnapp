import mongoose from 'mongoose';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generateInviteCode = () => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_CODE_CHARS.charAt(Math.floor(Math.random() * INVITE_CODE_CHARS.length));
  }
  return code;
};

/**
 * chatGroupMemberSchema
 * Uses anonymousId only — no User ObjectId stored.
 */
const chatGroupMemberSchema = new mongoose.Schema(
  {
    anonUserId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * encryptedGroupKeySchema
 * One entry per member: stores the group's symmetric key
 * encrypted for that specific member's X25519 public key.
 * Only the intended member can decrypt their copy.
 */
const encryptedGroupKeySchema = new mongoose.Schema(
  {
    anonUserId: { type: String, required: true },
    // nacl.box ciphertext, base64-encoded
    encryptedKey: { type: String, required: true },
    // base64-encoded NaCl box nonce (24 bytes)
    nonce: { type: String, required: true },
    // base64-encoded sender's X25519 public key (needed for nacl.box.open)
    senderPublicKey: { type: String, required: true },
  },
  { _id: false }
);

const chatGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters'],
      maxlength: [80, 'Group name cannot exceed 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
      index: true,
    },
    // Anonymized creator — no User ObjectId
    anonCreatedBy: {
      type: String,
      required: true,
    },
    members: {
      type: [chatGroupMemberSchema],
      validate: {
        validator: (members) => Array.isArray(members) && members.length > 0,
        message: 'A group must have at least one member',
      },
    },
    // Per-member encrypted copies of the group symmetric key
    encryptedGroupKeys: {
      type: [encryptedGroupKeySchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
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

chatGroupSchema.pre('validate', function setInviteCode(next) {
  if (!this.inviteCode) {
    this.inviteCode = generateInviteCode();
  }
  next();
});

// Virtual: populate the group creator's anonymous profile
chatGroupSchema.virtual('creator', {
  ref: 'AnonymousProfile',
  localField: 'anonCreatedBy',
  foreignField: 'anonymousId',
  justOne: true,
});

// Virtual: populate all members' anonymous profiles
// Note: members[] is an array of { anonUserId } — we populate from those IDs
chatGroupSchema.virtual('memberProfiles', {
  ref: 'AnonymousProfile',
  localField: 'members.anonUserId',
  foreignField: 'anonymousId',
});

chatGroupSchema.index({ 'members.anonUserId': 1 });
chatGroupSchema.index({ updatedAt: -1 });

const ChatGroup = mongoose.model('ChatGroup', chatGroupSchema);

export default ChatGroup;
