// Ethereum wallet authentication controller
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const NONCE_EXPIRY_MINUTES = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// In-memory nonce store (replace with DB for production)
const nonces = {};

export async function ethNonce(req, res) {
  const { address } = req.body;
  if (!address) return res.status(400).json({ success: false, message: 'Address required' });
  const nonce = `Login to Anonn with address ${address} at ${Date.now()}`;
  nonces[address.toLowerCase()] = { nonce, created: Date.now() };
  res.json({ success: true, data: { message: nonce } });
}

export async function ethVerify(req, res) {
  const { address, signature } = req.body;
  if (!address || !signature) return res.status(400).json({ success: false, message: 'Address and signature required' });
  const entry = nonces[address.toLowerCase()];
  if (!entry) return res.status(400).json({ success: false, message: 'Nonce not found' });
  if (Date.now() - entry.created > NONCE_EXPIRY_MINUTES * 60 * 1000) {
    delete nonces[address.toLowerCase()];
    return res.status(400).json({ success: false, message: 'Nonce expired' });
  }
  let recovered;
  try {
    recovered = ethers.utils.verifyMessage(entry.nonce, signature);
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return res.status(401).json({ success: false, message: 'Signature does not match address' });
  }
  // Find or create user
  let user = await User.findOne({ ethAddress: address.toLowerCase() });
  if (!user) {
    user = await User.create({ ethAddress: address.toLowerCase() });
  }
  // Issue JWT
  const token = jwt.sign({ id: user._id, eth: address.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
  delete nonces[address.toLowerCase()];
  res.json({ success: true, token });
}
