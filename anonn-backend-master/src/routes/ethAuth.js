import express from 'express';
import { ethNonce, ethVerify } from '../controllers/ethAuthController.js';

const router = express.Router();

// POST /auth/eth/nonce { address }
router.post('/nonce', ethNonce);
// POST /auth/eth/verify { address, signature }
router.post('/verify', ethVerify);

export default router;
