import ChatGroup from '../models/ChatGroup.js';
import ChatMessage from '../models/ChatMessage.js';
import AnonymousProfile from '../models/AnonymousProfile.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { broadcastToGroup } from '../realtime/chatHub.js';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generateInviteCode = () => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_CODE_CHARS.charAt(Math.floor(Math.random() * INVITE_CODE_CHARS.length));
  }
  return code;
};

const createUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const inviteCode = generateInviteCode();
    const exists = await ChatGroup.findOne({ inviteCode }).select('_id');
    if (!exists) {
      return inviteCode;
    }
  }
  throw new Error('Failed to generate unique invite code');
};

// Helpers that operate on anonUserId strings (not ObjectIds)
const groupMemberAnonIds = (group) => group.members.map((m) => m.anonUserId);

const findMemberRecord = (group, anonId) =>
  group.members.find((m) => m.anonUserId === anonId);

const isGroupMember = (group, anonId) => Boolean(findMemberRecord(group, anonId));

const isOwner = (group, anonId) => {
  const member = findMemberRecord(group, anonId);
  if (!member) return false;
  return member.role === 'owner' || group.anonCreatedBy === anonId;
};

// Populate group members via AnonymousProfile (no PII)
const populateGroup = (groupId) =>
  ChatGroup.findById(groupId)
    .populate('creator')
    .populate('memberProfiles');

/**
 * @route   POST /api/chat/groups
 * @desc    Create a new chat group
 * @access  Private
 */
export const createGroup = async (req, res, next) => {
  try {
    const { name, description = '', encryptedGroupKeys = [] } = req.body;

    const inviteCode = await createUniqueInviteCode();

    const group = await ChatGroup.create({
      name,
      description,
      inviteCode,
      anonCreatedBy: req.anonymousId,
      members: [
        {
          anonUserId: req.anonymousId,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
      encryptedGroupKeys,
      lastMessageAt: new Date(),
    });

    const populated = await populateGroup(group._id);

    return successResponse(res, 201, { group: populated }, 'Chat group created');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/chat/groups/join
 * @desc    Join a group via invite code
 * @access  Private
 */
export const joinGroupByInviteCode = async (req, res, next) => {
  try {
    const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();

    const group = await ChatGroup.findOne({ inviteCode, isActive: true });
    if (!group) {
      return errorResponse(res, 404, 'Invalid invite code');
    }

    if (isGroupMember(group, req.anonymousId)) {
      const existing = await populateGroup(group._id);
      return successResponse(res, 200, { group: existing }, 'Already a member');
    }

    group.members.push({
      anonUserId: req.anonymousId,
      role: 'member',
      joinedAt: new Date(),
    });

    await group.save();

    const populated = await populateGroup(group._id);
    return successResponse(res, 200, { group: populated }, 'Joined group successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/groups
 * @desc    List groups the current user belongs to
 * @access  Private
 */
export const listGroups = async (req, res, next) => {
  try {
    const groups = await ChatGroup.find({
      isActive: true,
      'members.anonUserId': req.anonymousId,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('creator')
      .populate('memberProfiles')
      .limit(100);

    return successResponse(res, 200, { groups }, 'Chat groups retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/groups/:groupId
 * @desc    Get group details
 * @access  Private
 */
export const getGroup = async (req, res, next) => {
  try {
    const group = await populateGroup(req.params.groupId);

    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isGroupMember(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Not authorized to access this chat group');
    }

    return successResponse(res, 200, { group }, 'Chat group retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/chat/groups/:groupId/members/:anonUserId
 * @desc    Remove a member from the group (owner only)
 * @access  Private
 */
export const removeMember = async (req, res, next) => {
  try {
    const group = await ChatGroup.findById(req.params.groupId);
    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isOwner(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Only group owner can remove members');
    }

    const targetAnonId = req.params.anonUserId;

    if (group.anonCreatedBy === targetAnonId) {
      return errorResponse(res, 400, 'Cannot remove the group owner');
    }

    const exists = group.members.some((m) => m.anonUserId === targetAnonId);
    if (!exists) {
      return errorResponse(res, 404, 'Member not found in group');
    }

    group.members = group.members.filter((m) => m.anonUserId !== targetAnonId);
    // Remove their encrypted group key too
    group.encryptedGroupKeys = group.encryptedGroupKeys.filter((k) => k.anonUserId !== targetAnonId);
    await group.save();

    const populated = await populateGroup(group._id);
    return successResponse(res, 200, { group: populated }, 'Member removed');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/chat/groups/:groupId/messages
 * @desc    Post an encrypted message to a group
 *          Body: { content: base64(ciphertext), nonce: base64(24-byte nonce), isEncrypted: true }
 * @access  Private
 */
export const postMessage = async (req, res, next) => {
  try {
    const { content, nonce, isEncrypted = true } = req.body;

    const group = await ChatGroup.findById(req.params.groupId);
    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isGroupMember(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Not authorized to post in this chat group');
    }

    const message = await ChatMessage.create({
      group: group._id,
      anonSenderId: req.anonymousId,
      content,
      nonce,
      isEncrypted,
      type: 'text',
    });

    group.lastMessageAt = new Date();
    await group.save();

    const populatedMessage = await ChatMessage.findById(message._id).populate('sender');

    broadcastToGroup(group._id.toString(), groupMemberAnonIds(group), {
      type: 'chat_message',
      data: {
        groupId: group._id,
        message: populatedMessage,
      },
    });

    return successResponse(res, 201, { message: populatedMessage }, 'Message sent');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/groups/:groupId/messages
 * @desc    Get paginated messages for a group (server returns ciphertext)
 * @access  Private
 */
export const getMessages = async (req, res, next) => {
  try {
    const { limit = 50, before } = req.query;

    const group = await ChatGroup.findById(req.params.groupId);
    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isGroupMember(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Not authorized to access messages in this chat group');
    }

    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const query = { group: group._id };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const rawMessages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(cappedLimit)
      .populate('sender');

    const messages = rawMessages.reverse();

    return successResponse(
      res,
      200,
      {
        messages,
        pagination: {
          limit: cappedLimit,
          hasMore: rawMessages.length === cappedLimit,
          nextBefore: rawMessages.length ? rawMessages[rawMessages.length - 1].createdAt : null,
        },
      },
      'Messages retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/groups/:groupId/messages/:messageId
 * @desc    Get a single message by ID
 * @access  Private
 */
export const getMessageById = async (req, res, next) => {
  try {
    const group = await ChatGroup.findById(req.params.groupId);
    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isGroupMember(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Not authorized to access messages in this chat group');
    }

    const message = await ChatMessage.findOne({
      _id: req.params.messageId,
      group: group._id,
    }).populate('sender');

    if (!message) {
      return errorResponse(res, 404, 'Message not found');
    }

    return successResponse(res, 200, { message }, 'Message retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/groups/:groupId/key
 * @desc    Get the encrypted group key for the requesting user
 *          Returns the ciphertext the client can decrypt with their private key
 * @access  Private
 */
export const getGroupKey = async (req, res, next) => {
  try {
    const group = await ChatGroup.findById(req.params.groupId).select('isActive members encryptedGroupKeys anonCreatedBy');
    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isGroupMember(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Not a member of this group');
    }

    const keyEntry = group.encryptedGroupKeys.find((k) => k.anonUserId === req.anonymousId);
    if (!keyEntry) {
      return errorResponse(res, 404, 'No group key found for your identity. Ask the group owner to re-share the key.');
    }

    return successResponse(res, 200, {
      encryptedKey: keyEntry.encryptedKey,
      nonce: keyEntry.nonce,
      senderPublicKey: keyEntry.senderPublicKey,
    }, 'Group key retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/chat/groups/:groupId/keys
 * @desc    Add or update encrypted group keys for members (owner only)
 *          Body: { keys: [{ anonUserId, encryptedKey, nonce, senderPublicKey }] }
 * @access  Private
 */
export const updateGroupKeys = async (req, res, next) => {
  try {
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return errorResponse(res, 400, 'keys array is required');
    }

    const group = await ChatGroup.findById(req.params.groupId);
    if (!group || !group.isActive) {
      return errorResponse(res, 404, 'Chat group not found');
    }

    if (!isOwner(group, req.anonymousId)) {
      return errorResponse(res, 403, 'Only group owner can distribute group keys');
    }

    // Upsert each key entry
    for (const keyEntry of keys) {
      const { anonUserId, encryptedKey, nonce, senderPublicKey } = keyEntry;
      if (!anonUserId || !encryptedKey || !nonce) continue;

      const existing = group.encryptedGroupKeys.findIndex((k) => k.anonUserId === anonUserId);
      if (existing >= 0) {
        group.encryptedGroupKeys[existing] = { anonUserId, encryptedKey, nonce, senderPublicKey };
      } else {
        group.encryptedGroupKeys.push({ anonUserId, encryptedKey, nonce, senderPublicKey });
      }
    }

    await group.save();

    return successResponse(res, 200, {}, 'Group keys updated');
  } catch (error) {
    next(error);
  }
};
