import mongoose from 'mongoose';

/**
 * ChatMessage Model (E2EE)
 * - sender is stored as anonymousId (no User ObjectId)
 * - content is an XSalsa20-Poly1305 ciphertext when isEncrypted = true
 *   (encrypted client-side; server never sees plaintext)
 * - nonce is the base64-encoded 24-byte NaCl secretbox nonce
 */
const chatMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatGroup',
      required: true,
      index: true,
    },
    // Anonymized sender — no User ObjectId stored
    anonSenderId: {
      type: String,
      required: true,
    },
    // Ciphertext (base64) when isEncrypted=true; plaintext when false (legacy)
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [8000, 'Message cannot exceed 8000 characters'],
    },
    // base64-encoded NaCl secretbox nonce (24 bytes)
    nonce: {
      type: String,
      default: null,
    },
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      enum: ['text'],
      default: 'text',
    },
    isEdited: {
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

chatMessageSchema.index({ group: 1, createdAt: -1 });

// Virtual populate: resolve AnonymousProfile for the sender
chatMessageSchema.virtual('sender', {
  ref: 'AnonymousProfile',
  localField: 'anonSenderId',
  foreignField: 'anonymousId',
  justOne: true,
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
