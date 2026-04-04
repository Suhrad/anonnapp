import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    storeIdentityMapping,
    getIdentityMapping,
    storeEncryptionKey,
    getEncryptionKey,
    updateProfile,
} from '../controllers/anonymousController.js';

const router = express.Router();

// Identity mapping — encrypted link between anonymousId and real userId
router.post('/identity-mapping', authenticate, storeIdentityMapping);
router.get('/identity-mapping', authenticate, getIdentityMapping);

// E2EE encryption keys
router.post('/encryption-key', authenticate, storeEncryptionKey);
router.get('/encryption-key/:targetAnonymousId', authenticate, getEncryptionKey);

// Anonymous profile management
router.put('/profile', authenticate, updateProfile);

export default router;
