import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  createGroup,
  joinGroupByInviteCode,
  listGroups,
  getGroup,
  removeMember,
  postMessage,
  getMessages,
  getMessageById,
  getGroupKey,
  updateGroupKeys,
} from '../controllers/chatController.js';

const router = express.Router();

const mongoId = /^[0-9a-fA-F]{24}$/;
// anonymousId is a 32-char hex string
const anonIdPattern = /^[0-9a-fA-F]{32}$/;

const createGroupValidation = [
  body('name').trim().isLength({ min: 2, max: 80 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('encryptedGroupKeys').optional().isArray(),
];

const joinGroupValidation = [
  body('inviteCode')
    .trim()
    .isLength({ min: 6, max: 6 })
    .matches(/^[A-Za-z0-9]{6}$/)
    .withMessage('Invite code must be 6 alphanumeric characters'),
];

const groupIdValidation = [param('groupId').matches(mongoId).withMessage('Invalid group ID')];

const removeMemberValidation = [
  ...groupIdValidation,
  param('anonUserId').matches(anonIdPattern).withMessage('Invalid anonymous user ID'),
];

const messageValidation = [
  ...groupIdValidation,
  body('content').trim().isLength({ min: 1, max: 10000 }),
  body('nonce').optional().isString(),
  body('isEncrypted').optional().isBoolean(),
];

const getMessagesValidation = [
  ...groupIdValidation,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('before').optional().isISO8601(),
];

const messageIdValidation = [
  ...groupIdValidation,
  param('messageId').matches(mongoId).withMessage('Invalid message ID'),
];

const updateGroupKeysValidation = [
  ...groupIdValidation,
  body('keys').isArray({ min: 1 }),
  body('keys.*.anonUserId').matches(anonIdPattern).withMessage('Invalid anonUserId in keys'),
  body('keys.*.encryptedKey').isString().notEmpty(),
  body('keys.*.nonce').isString().notEmpty(),
];

router.post('/groups', authenticate, createGroupValidation, validate, createGroup);
router.post('/groups/join', authenticate, joinGroupValidation, validate, joinGroupByInviteCode);
router.get('/groups', authenticate, listGroups);
router.get('/groups/:groupId', authenticate, groupIdValidation, validate, getGroup);
router.delete('/groups/:groupId/members/:anonUserId', authenticate, removeMemberValidation, validate, removeMember);
router.post('/groups/:groupId/messages', authenticate, messageValidation, validate, postMessage);
router.get('/groups/:groupId/messages', authenticate, getMessagesValidation, validate, getMessages);
router.get('/groups/:groupId/messages/:messageId', authenticate, messageIdValidation, validate, getMessageById);

// E2EE group key management
router.get('/groups/:groupId/key', authenticate, groupIdValidation, validate, getGroupKey);
router.patch('/groups/:groupId/keys', authenticate, updateGroupKeysValidation, validate, updateGroupKeys);

export default router;
