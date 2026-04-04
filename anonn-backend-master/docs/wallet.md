# Backend Setup Guide for Wallet Authentication

## Overview
This guide explains how to set up your backend to properly handle wallet authentication and store wallet credentials according to the Anonn API specification.

## Database Schema

### Users Collection/Table

Your backend needs a `users` collection/table with the following structure:

```javascript
{
  _id: ObjectId,
  username: String (required, unique, 3-30 chars),
  email: String (optional for wallet users, unique),
  password: String (optional, hashed with bcrypt - only for email auth),
  
  // Wallet Authentication Fields
  authMethod: String (enum: 'email', 'wallet'),
  primaryWallet: String (the main wallet address/publicKey),
  walletAddresses: [
    {
      address: String,        // EVM chains (Ethereum, Polygon, BSC)
      publicKey: String,      // Solana
      chain: String,          // 'ethereum', 'polygon', 'binance', 'solana'
      isPrimary: Boolean,
      verified: Boolean,
      addedAt: Date
    }
  ],
  
  // Profile Fields
  avatar: String (URL),
  bio: String (max 500 chars),
  
  // Social Fields
  followers: [ObjectId],
  following: [ObjectId],
  
  // Bookmarks
  bookmarkedPosts: [ObjectId],
  bookmarkedPolls: [ObjectId],
  bookmarkedComments: [ObjectId],
  bookmarkedUsers: [ObjectId],
  
  // Communities & Bowls
  joinedCommunities: [ObjectId],
  joinedBowls: [ObjectId],
  
  // Settings
  notificationSettings: {
    email: Boolean,
    push: Boolean,
    comments: Boolean,
    follows: Boolean,
    mentions: Boolean
  },
  deviceTokens: [String],
  
  // Status
  reputation: Number (default: 0),
  isActive: Boolean (default: true),
  isVerified: Boolean (default: false),
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

### Nonces Collection/Table (Temporary Storage)

You need a separate collection for temporary nonce storage:

```javascript
{
  _id: ObjectId,
  address: String,      // For EVM chains
  publicKey: String,    // For Solana
  chain: String,        // 'ethereum', 'polygon', 'binance', 'solana'
  nonce: String,        // 64-character hex string
  message: String,      // Full message to be signed
  expiresAt: Date,      // Typically 5 minutes from creation
  createdAt: Date
}
```

**Important**: Nonces should:
- Auto-expire after 5 minutes (use TTL index in MongoDB)
- Be deleted immediately after verification (one-time use)
- Be indexed by address/publicKey for fast lookup

## API Endpoints Implementation

### 1. POST /api/auth/wallet/nonce

**Purpose**: Generate a unique nonce for wallet signature verification

**Request Body**:
```javascript
{
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",  // For EVM
  // OR
  publicKey: "473UzffRY9hAFbK7XCkUsZkHd5wWBPdHzrdEXnrL5Ltj", // For Solana
  chain: "ethereum" // Optional, default: "solana"
}
```

**Backend Logic**:
```javascript
1. Validate request:
   - Check if address OR publicKey is provided
   - Validate address/publicKey format
   - Validate chain value

2. Generate nonce:
   - Create 64-character random hex string
   - Use crypto.randomBytes(32).toString('hex')

3. Create message:
   const message = `Sign this message to authenticate with Anonn:

Action: authentication
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This request will not trigger a blockchain transaction or cost any gas fees.`;

4. Store in database:
   - Save to nonces collection
   - Set expiresAt: Date.now() + 5 minutes
   - Index by address/publicKey for fast retrieval

5. Return response:
   {
     success: true,
     data: {
       nonce: "a1b2c3d4...",
       message: "Sign this message...",
       chain: "ethereum",
       expiresIn: 300
     }
   }
```

**Rate Limiting**: 10 requests per minute per IP

### 2. POST /api/auth/wallet/verify

**Purpose**: Verify wallet signature and authenticate user (login or register)

**Request Body**:
```javascript
{
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",  // For EVM
  // OR
  publicKey: "473UzffRY9hAFbK7XCkUsZkHd5wWBPdHzrdEXnrL5Ltj", // For Solana
  signature: "0x1234567890abcdef...", // Hex for EVM, Base58 for Solana
  chain: "ethereum",
  username: "alice_trader" // Optional for new users
}
```

**Backend Logic**:
```javascript
1. Validate request:
   - Check if address OR publicKey is provided
   - Validate signature format
   - Check chain value

2. Retrieve nonce from database:
   - Find by address/publicKey and chain
   - Check if expired
   - If not found or expired: return 400 error

3. Verify signature:
   For Ethereum/EVM:
   - Use ethers.js or web3.js
   - verifyMessage(message, signature) should return the address
   
   For Solana:
   - Use @solana/web3.js
   - nacl.sign.detached.verify(message, signature, publicKey)

4. If signature invalid:
   - Delete nonce from database
   - Return 401 error

5. Check if user exists:
   - Find user by wallet address/publicKey in walletAddresses array
   
6. If user exists (LOGIN):
   - Generate JWT tokens (access + refresh)
   - Delete nonce from database
   - Return user data + tokens + isNewUser: false

7. If user doesn't exist (REGISTER):
   - Generate username if not provided:
     username = `wallet_${address.substring(2, 10)}`
   - Check if username is taken
   - Create new user:
     {
       username: username,
       authMethod: 'wallet',
       primaryWallet: address || publicKey,
       walletAddresses: [{
         address: address,          // or null
         publicKey: publicKey,      // or null
         chain: chain,
         isPrimary: true,
         verified: true,
         addedAt: new Date()
       }],
       email: null,
       password: null,
       avatar: '',
       bio: '',
       followers: [],
       following: [],
       joinedCommunities: [],
       joinedBowls: [],
       reputation: 0,
       isActive: true,
       isVerified: false
     }
   - Generate JWT tokens
   - Delete nonce from database
   - Return user data + tokens + isNewUser: true

8. Return response:
   {
     success: true,
     data: {
       user: { /* sanitized user object */ },
       accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       isNewUser: true/false
     },
     message: isNewUser ? "Account created successfully" : "Login successful"
   }
```

**Rate Limiting**: 5 requests per minute per IP

### 3. GET /api/auth/me

**Purpose**: Get current authenticated user's profile

**Headers**: 
```javascript
Authorization: Bearer <accessToken>
```

**Backend Logic**:
```javascript
1. Verify JWT token:
   - Extract token from Authorization header
   - Verify with JWT secret
   - Extract userId from token payload

2. Fetch user from database:
   - Find by _id
   - Exclude password field

3. Return response:
   {
     success: true,
     data: {
       user: { /* user object with all fields except password */ }
     }
   }
```

### 4. POST /api/auth/wallet/link

**Purpose**: Link additional wallet to existing account

**Headers**: 
```javascript
Authorization: Bearer <accessToken>
```

**Request Body**:
```javascript
{
  address: "0x9876543210FeDcBa9876543210FeDcBa98765432",
  // OR
  publicKey: "...",
  signature: "0xabcdef...",
  chain: "polygon"
}
```

**Backend Logic**:
```javascript
1. Authenticate user from JWT token

2. Follow same nonce verification process as /verify endpoint

3. Check if wallet is already linked:
   - Search all users' walletAddresses arrays
   - If found: return 400 error

4. Add wallet to user's walletAddresses:
   - Push new wallet object to array
   - Set isPrimary: false
   - Set verified: true
   - Set addedAt: new Date()

5. Save user and return updated data
```

## JWT Token Structure

### Access Token (15-minute expiry)
```javascript
{
  userId: "60d0fe4f5311236168a109ca",
  iat: 1701864000,
  exp: 1701864900
}
```

### Refresh Token (7-day expiry)
```javascript
{
  userId: "60d0fe4f5311236168a109ca",
  iat: 1701864000,
  exp: 1702468800
}
```

## Environment Variables

Your backend needs these environment variables:

```bash
# Server
PORT=8000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/anonn
# OR
DATABASE_URL=postgresql://...

# JWT Secrets
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Rate Limiting (optional, has defaults)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Security Best Practices

### 1. Password & Secret Management
- Never store JWT secrets in code
- Use environment variables
- Different secrets for access and refresh tokens
- Rotate secrets periodically

### 2. Wallet Verification
- **CRITICAL**: Always verify signatures cryptographically
- Never trust client-provided verification results
- Use well-tested libraries (ethers.js, web3.js, @solana/web3.js)
- Verify the recovered address matches the claimed address

### 3. Nonce Management
- One-time use: Delete immediately after verification
- Time-limited: 5-minute expiry
- Random: Use cryptographically secure random generation
- Indexed: Fast lookup by wallet address

### 4. Rate Limiting
- Implement per-IP rate limiting
- Different limits for different endpoints:
  - `/nonce`: 10/min
  - `/verify`: 5/min
  - `/link`: 5/min

### 5. Input Validation
- Validate all wallet addresses:
  - Ethereum: 42 chars starting with 0x
  - Solana: 32-44 chars Base58
- Sanitize usernames (alphanumeric + underscore, 3-30 chars)
- Validate chain values against whitelist

### 6. Error Handling
- Never expose internal errors to clients
- Use generic error messages
- Log detailed errors server-side
- Return appropriate HTTP status codes

## Example Backend Code Snippets

### Signature Verification (Ethereum)

```javascript
const ethers = require('ethers');

async function verifyEthereumSignature(message, signature, expectedAddress) {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
```

### Signature Verification (Solana)

```javascript
const nacl = require('tweetnacl');
const { PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

function verifySolanaSignature(message, signature, publicKey) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
```

### JWT Token Generation

```javascript
const jwt = require('jsonwebtoken');

function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
}
```

### Nonce Generation

```javascript
const crypto = require('crypto');

function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

function createSignMessage(nonce) {
  return `Sign this message to authenticate with Anonn:

Action: authentication
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This request will not trigger a blockchain transaction or cost any gas fees.`;
}
```

### MongoDB Nonce Schema with TTL

```javascript
const mongoose = require('mongoose');

const nonceSchema = new mongoose.Schema({
  address: String,
  publicKey: String,
  chain: String,
  nonce: String,
  message: String,
  createdAt: { type: Date, default: Date.now, expires: 300 } // 5 minutes TTL
});

// Indexes for fast lookup
nonceSchema.index({ address: 1, chain: 1 });
nonceSchema.index({ publicKey: 1, chain: 1 });

module.exports = mongoose.model('Nonce', nonceSchema);
```

## Testing Your Backend

### 1. Test Nonce Generation

```bash
curl -X POST http://localhost:8000/api/auth/wallet/nonce \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain": "ethereum"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "nonce": "a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789",
    "message": "Sign this message to authenticate with Anonn:\n\nAction: authentication\nNonce: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789\nTimestamp: 2025-12-07T10:30:00.000Z\n\nThis request will not trigger a blockchain transaction or cost any gas fees.",
    "chain": "ethereum",
    "expiresIn": 300
  },
  "message": "Nonce generated successfully"
}
```

### 2. Test Signature Verification

```bash
curl -X POST http://localhost:8000/api/auth/wallet/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "signature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    "chain": "ethereum"
  }'
```

### 3. Test Get Current User

```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Frontend Integration Checklist

- [x] Frontend sends wallet address/publicKey to `/nonce`
- [x] Frontend receives message and displays in MetaMask
- [x] Frontend gets signature from MetaMask
- [x] Frontend sends signature to `/verify`
- [x] Frontend stores accessToken and refreshToken
- [x] Frontend uses accessToken in Authorization header
- [ ] Backend validates address format
- [ ] Backend generates cryptographically secure nonce
- [ ] Backend stores nonce with TTL
- [ ] Backend verifies signature cryptographically
- [ ] Backend creates user if doesn't exist
- [ ] Backend returns JWT tokens
- [ ] Backend deletes nonce after verification
- [ ] Backend implements rate limiting
- [ ] Backend handles all error cases

## Common Issues & Solutions

### Issue: "Nonce not found or expired"
**Solution**: 
- Check nonce TTL is set correctly
- Ensure nonce is stored before verification
- Check database indexes

### Issue: "Invalid signature"
**Solution**:
- Use exact message from nonce response
- Verify signature format matches chain (hex vs base58)
- Check signature verification library is correct

### Issue: "Username already taken"
**Solution**:
- Generate unique username with timestamp
- Or prompt user for custom username
- Check uniqueness before creating user

### Issue: Rate limit exceeded
**Solution**:
- Implement exponential backoff
- Show user-friendly error message
- Consider increasing limits for authenticated users

## Next Steps

1. **Implement the database schema**
   - Create users collection/table
   - Create nonces collection with TTL
   - Add necessary indexes

2. **Implement the three endpoints**
   - POST /api/auth/wallet/nonce
   - POST /api/auth/wallet/verify
   - GET /api/auth/me

3. **Add signature verification**
   - Install ethers.js for Ethereum
   - Install @solana/web3.js for Solana
   - Implement verification functions

4. **Add JWT token generation**
   - Install jsonwebtoken
   - Implement token generation
   - Implement token verification middleware

5. **Test the complete flow**
   - Test nonce generation
   - Test signature verification
   - Test user creation
   - Test user login
   - Test token refresh

6. **Deploy and configure**
   - Set environment variables
   - Configure CORS
   - Enable rate limiting
   - Set up monitoring

## Additional Resources

- **Ethereum Signature Verification**: https://docs.ethers.org/v6/api/utils/#SigningKey
- **Solana Signature Verification**: https://solana-labs.github.io/solana-web3.js/
- **JWT Best Practices**: https://jwt.io/introduction
- **MongoDB TTL Indexes**: https://www.mongodb.com/docs/manual/core/index-ttl/

## Support

If you encounter issues:
1. Check backend logs for detailed errors
2. Verify environment variables are set correctly
3. Test each endpoint individually
4. Check database connections and indexes
5. Verify JWT secrets are configured

Your wallet authentication system is ready on the frontend! Now implement these backend specifications to complete the integration.


