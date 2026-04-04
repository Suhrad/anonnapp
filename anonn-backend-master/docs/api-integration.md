# Anonn Backend API Integration Guide

This document provides everything the frontend needs to integrate with the Anonn backend: base URLs, authentication, headers, endpoints, request/response payloads, pagination, error formats, and example calls. All example values are provided.

## Base URL

- Development: `http://localhost:8000`
- Production: `https://your-production-url.com`
- Base path: All endpoints are under `/api`

## Authentication

- Scheme: Bearer JWT
- Header: `Authorization: Bearer <accessToken>`
- Obtain tokens via email login or Solana wallet auth.
- Refresh token endpoint issues new `accessToken`.

### Token Lifecycle
- `accessToken`: short-lived, used in `Authorization` header.
- `refreshToken`: long-lived, used only at `/api/auth/refresh`.

## Common Headers

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>` for protected endpoints

## Standard Response Shapes

Successful response:
```
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

Error response:
```
{
  "success": false,
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "errors": { "email": "Email is invalid" }
}
```

Paginated response (posts example):
```
{
  "success": true,
  "data": {
    "posts": [ ... ],
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 42,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

## Rate Limiting

- Login/Register: `authLimiter` applies.
- Wallet auth: `walletAuthLimiter` applies.
- Content creation and voting: `createContentLimiter` and `voteLimiter` apply.

## Entities

### User (simplified)
```
{
  "_id": "60d0fe4f5311236168a109ca",
  "username": "john_doe",
  "email": "john@example.com",
  "authMethod": "email",
  "primaryWallet": "7xKzL3v...XqB",
  "avatar": "https://example.com/avatar.png",
  "bio": "Web3 enthusiast",
  "followers": ["60d0fe4f5311236168a109cb"],
  "following": ["60d0fe4f5311236168a109cc"],
  "bookmarkedPosts": ["60d0fe4f5311236168a109cd"],
  "bookmarkedPolls": [],
  "bookmarkedComments": [],
  "bookmarkedUsers": [],
  "joinedCommunities": [],
  "joinedBowls": [],
  "notificationSettings": { "email": true, "push": true, "comments": true, "follows": true, "mentions": true },
  "deviceTokens": [],
  "isActive": true,
  "isVerified": false,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

---

## Authentication Endpoints

### Register
- `POST /api/auth/register`
- Body:
```
{
  "username": "alice_trader",
  "email": "alice@example.com",
  "password": "password123"
}
```
- Response `201`:
```
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { /* User */ },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login
- `POST /api/auth/login`
- Body:
```
{ "email": "alice@example.com", "password": "password123" }
```
- Response `200`: same structure as Register.

### Logout
- `POST /api/auth/logout`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Logout successful" }
```

### Refresh Access Token
- `POST /api/auth/refresh`
- Body:
```
{ "refreshToken": "<refreshToken>" }
```
- Response `200`:
```
{ "success": true, "data": { "accessToken": "<newAccessToken>" } }
```

### Current User (Me)
- `GET /api/auth/me`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "data": { "user": { /* User */ } } }
```

### Wallet: Request Nonce
- `POST /api/auth/wallet/nonce`
- Body:
```
{ "publicKey": "7xKzL3v...XqB" }
```
- Response `200`:
```
{
  "success": true,
  "data": {
    "nonce": "1c2b3d4e5f",
    "message": "Sign this message to authenticate",
    "expiresIn": 300
  }
}
```

### Wallet: Verify Signature (Login/Register)
- `POST /api/auth/wallet/verify`
- Body:
```
{
  "publicKey": "7xKzL3v...XqB",
  "signature": "3Bv7wX...zY2",
  "username": "my_username" // optional for new users
}
```
- Response `200/201`:
```
{
  "success": true,
  "data": {
    "user": { /* User */ },
    "accessToken": "<accessToken>",
    "refreshToken": "<refreshToken>",
    "isNewUser": false
  }
}
```

### Wallet: Link to Account
- `POST /api/auth/wallet/link`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "publicKey": "7xKzL3v...XqB", "signature": "3Bv7wX...zY2" }
```
- Response `200`:
```
{ "success": true, "message": "Wallet linked successfully" }
```

---

## User Endpoints

### Get User Profile
- `GET /api/users/{id}`
- Path `id`: user ID or username
- Response `200`:
```
{ "success": true, "message": "User profile retrieved successfully", "data": { "user": { /* User */ } } }
```

### Update User Profile
- `PUT /api/users/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Body (all optional):
```
{ "username": "new_name", "bio": "Hello", "avatar": "https://img.example/avatar.png" }
```
- Response `200`:
```
{ "success": true, "message": "Profile updated successfully", "data": { "user": { /* User */ } } }
```

### Follow User
- `POST /api/users/{id}/follow`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "User followed successfully" }
```

### Unfollow User
- `DELETE /api/users/{id}/follow`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "User unfollowed successfully" }
```

### Add Bookmark
- `POST /api/users/bookmarks`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "type": "post", "itemId": "60d0fe4f5311236168a109cd" }
```
- Response `200`:
```
{ "success": true, "message": "Bookmark added successfully" }
```

### Remove Bookmark
- `DELETE /api/users/bookmarks/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Path `id`: Bookmark Item ID
- Response `200`:
```
{ "success": true, "message": "Bookmark removed successfully" }
```

### Get Bookmarks
- `GET /api/users/bookmarks`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Bookmarks retrieved successfully", "data": { "bookmarks": [/* items */] } }
```

---

## Post Endpoints

### Create Post
- `POST /api/posts`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "title": "My first post",
  "content": "This is the content of my post",
  "community": "60d0fe4f5311236168a109d1", // optional
  "companyTags": ["60d0fe4f5311236168a109e1", "60d0fe4f5311236168a109e2"] // optional
}
```
- Response `201`:
```
{ "success": true, "message": "Post created successfully", "data": { "post": { /* post */ } } }
```

### Get Posts (with filters)
- `GET /api/posts`
- Query params:
  - `page`: integer, default 1
  - `limit`: integer, default 10
  - `sort`: `latest | popular | controversial`, default `latest`
  - `community`: string, filter by community ID
- Response `200`: paginated format (see above).

### Search Posts
- `GET /api/posts/search?q=bitcoin`
- Response `200`:
```
{ "success": true, "message": "Search results retrieved successfully", "data": { "posts": [/* ... */] } }
```

### Get Post by ID
- `GET /api/posts/{id}`
- Response `200`:
```
{ "success": true, "message": "Post retrieved successfully", "data": { "post": { /* post */ } } }
```

### Update Post
- `PUT /api/posts/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Body (any of):
```
{ "title": "Updated title", "content": "Updated content" }
```
- Response `200`:
```
{ "success": true, "message": "Post updated successfully", "data": { "post": { /* post */ } } }
```

### Delete Post
- `DELETE /api/posts/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Post deleted successfully" }
```

### Vote on Post
- `POST /api/posts/{id}/vote`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "voteType": "upvote" } // or "downvote"
```
- Response `200`:
```
{ "success": true, "message": "Vote recorded successfully" }
```

### Add Comment
- `POST /api/posts/{id}/comments`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "content": "Great post!", "parentComment": "60d0fe4f5311236168a109cf" }
```
- Response `201`:
```
{ "success": true, "message": "Comment added successfully", "data": { "comment": { /* comment */ } } }
```

### Get Comments
- `GET /api/posts/{id}/comments?page=1`
- Response `200`:
```
{ "success": true, "message": "Comments retrieved successfully", "data": { "comments": [/* ... */] } }
```

### Share Post
- `POST /api/posts/{id}/share`
- Response `200`:
```
{ "success": true, "message": "Share count incremented successfully" }
```

---

---

## Poll Endpoints

### Create Poll
- `POST /api/polls`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "question": "Will ETH reach $8000 in 2024?",
  "options": ["Yes", "No", "Maybe"],
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "community": "60d0fe4f5311236168a109d1" // optional
}
```
- Response `201`:
```
{ "success": true, "message": "Poll created successfully", "data": { "poll": { /* poll */ } } }
```

### Get Polls (with filters)
- `GET /api/polls`
- Query params:
  - `page`: integer, default 1
  - `limit`: integer, default 10
  - `sort`: `latest | popular | endingSoon`, default `latest`
  - `status`: `active | ended`
- Response `200`: paginated format.

### Get Poll by ID
- `GET /api/polls/{id}`
- Response `200`:
```
{ "success": true, "message": "Poll retrieved successfully", "data": { "poll": { /* poll */ } } }
```

### Update Poll
- `PUT /api/polls/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Body (any of):
```
{ "question": "Updated question?", "expiresAt": "2025-01-15T23:59:59.000Z" }
```
- Response `200`:
```
{ "success": true, "message": "Poll updated successfully", "data": { "poll": { /* poll */ } } }
```

### Delete Poll
- `DELETE /api/polls/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Poll deleted successfully" }
```

### Vote on Poll
- `POST /api/polls/{id}/vote`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "optionIndex": 0 } // 0-3
```
- Response `200`:
```
{ "success": true, "message": "Vote recorded successfully" }
```

---

## Community Endpoints

### Create Community
- `POST /api/communities`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "name": "crypto_talk",
  "displayName": "Crypto Talk",
  "description": "A place to discuss crypto"
}
```
- Response `201`:
```
{ "success": true, "message": "Community created successfully", "data": { "community": { /* community */ } } }
```

### Get Communities
- `GET /api/communities?page=1&limit=10`
- Response `200`: paginated format.

### Get Community by ID
- `GET /api/communities/{id}`
- Path `id`: community ID or name
- Response `200`:
```
{ "success": true, "message": "Community retrieved successfully", "data": { "community": { /* community */ } } }
```

### Update Community
- `PUT /api/communities/{id}`
- Headers: `Authorization: Bearer <accessToken>`
- Body (any of):
```
{ "displayName": "New Name", "description": "New desc", "icon": "https://...", "banner": "https://..." }
```
- Response `200`:
```
{ "success": true, "message": "Community updated successfully", "data": { "community": { /* community */ } } }
```

### Join Community
- `POST /api/communities/{id}/join`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Joined community successfully" }
```

### Leave Community
- `DELETE /api/communities/{id}/leave`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Left community successfully" }
```

### Get Community Posts
- `GET /api/communities/{id}/posts?page=1`
- Response `200`:
```
{ "success": true, "message": "Posts retrieved successfully", "data": { "posts": [/* posts */] } }
```

---

## Company Endpoints

### Create Company
- `POST /api/companies`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "name": "Ethereum Foundation",
  "ticker": "ETH",
  "description": "Decentralized smart contract platform"
}
```
- Response `201`:
```
{ "success": true, "message": "Company created successfully", "data": { "company": { /* company */ } } }
```

### Get Companies
- `GET /api/companies`
- Query params:
  - `page`: integer, default 1
  - `limit`: integer, default 10
  - `search`: string, search by name or ticker
- Response `200`: paginated format.

### Get Company by ID
- `GET /api/companies/{id}`
- Path `id`: company ID or ticker
- Response `200`:
```
{ "success": true, "message": "Company retrieved successfully", "data": { "company": { /* company */ } } }
```

### Add Sentiment
- `POST /api/companies/{id}/sentiment`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "type": "bullish" } // or "bearish"
```
- Response `200`:
```
{ "success": true, "message": "Sentiment added successfully" }
```

### Get Company Posts
- `GET /api/companies/{id}/posts?page=1`
- Response `200`:
```
{ "success": true, "message": "Posts retrieved successfully", "data": { "posts": [/* posts */] } }
```

### Create Prediction Market
- `POST /api/companies/{id}/markets`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "question": "Will price reach $100?",
  "expiresAt": "2025-06-01T00:00:00.000Z"
}
```
- Response `201`:
```
{ "success": true, "message": "Market created successfully", "data": { "market": { /* market */ } } }
```

### Get Company Markets
- `GET /api/companies/{id}/markets`
- Response `200`:
```
{ "success": true, "message": "Markets retrieved successfully", "data": { "markets": [/* markets */] } }
```

### Trade on Market
- `POST /api/companies/{id}/markets/{marketId}/trade`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "outcome": "YES", // or "NO"
  "amount": 100,
  "side": "buy" // or "sell"
}
```
- Response `200`:
```
{ "success": true, "message": "Trade executed successfully", "data": { "trade": { /* trade */ } } }
```

---

## Feed Endpoints

### Get Recommended Feed
- `GET /api/feed/recommended?page=1&limit=10`
- Response `200`: paginated format with posts/polls.

### Get Following Feed
- `GET /api/feed/following?page=1&limit=10`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`: paginated format with posts/polls from followed users.

### Get For You Feed
- `GET /api/feed/for-you?page=1&limit=10`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`: paginated personalized feed.

---

## Notification Endpoints

### Get Notifications
- `GET /api/notifications?page=1&limit=20`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`: paginated format.

### Mark Notification as Read
- `PUT /api/notifications/{id}/read`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Notification marked as read" }
```

### Mark All Notifications as Read
- `PUT /api/notifications/read-all`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "All notifications marked as read" }
```

### Subscribe Device for Push
- `POST /api/notifications/device-token`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "token": "FCM_DEVICE_TOKEN_STRING",
  "platform": "ios" // or "android", "web"
}
```
- Response `200`:
```
{ "success": true, "message": "Device subscribed successfully" }
```

### Unsubscribe Device
- `DELETE /api/notifications/device-token`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "token": "FCM_DEVICE_TOKEN_STRING" }
```
- Response `200`:
```
{ "success": true, "message": "Device unsubscribed successfully" }
```

### Update Notification Settings
- `PUT /api/notifications/settings`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "emailNotifications": true,
  "pushNotifications": true,
  "types": { "comments": true, "follows": true, "mentions": true }
}
```
- Response `200`:
```
{ "success": true, "message": "Settings updated successfully" }
```

---

## Bowl Endpoints

### Create Bowl
- `POST /api/bowls`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "name": "defi_degen",
  "displayName": "DeFi Degen",
  "description": "High risk, high reward DeFi strategies"
}
```
- Response `201`:
```
{ "success": true, "message": "Bowl created successfully", "data": { "bowl": { /* bowl */ } } }
```

### Get Bowls
- `GET /api/bowls?page=1&limit=10`
- Response `200`: paginated format.

### Get Bowl by ID
- `GET /api/bowls/{id}`
- Path `id`: bowl ID or name
- Response `200`:
```
{ "success": true, "message": "Bowl retrieved successfully", "data": { "bowl": { /* bowl */ } } }
```

### Join Bowl
- `POST /api/bowls/{id}/join`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Joined bowl successfully" }
```

### Leave Bowl
- `DELETE /api/bowls/{id}/leave`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Left bowl successfully" }
```

---

## Wallet Endpoints

### Link Wallet
- `POST /api/wallet/link`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "chain": "ethereum", // or "polygon", "binance", "solana", "arbitrum", "optimism"
  "signature": "0xSignatureString..."
}
```
- Response `200`:
```
{ "success": true, "message": "Wallet linked successfully" }
```

### Unlink Wallet
- `DELETE /api/wallet/{id}/unlink`
- Headers: `Authorization: Bearer <accessToken>`
- Path `id`: wallet ID
- Response `200`:
```
{ "success": true, "message": "Wallet unlinked successfully" }
```

### Get All Linked Wallets
- `GET /api/wallet`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Wallets retrieved successfully", "data": { "wallets": [/* wallets */] } }
```

### Get Wallet Balance
- `GET /api/wallet/{id}/balance`
- Headers: `Authorization: Bearer <accessToken>`
- Response `200`:
```
{ "success": true, "message": "Balance retrieved successfully", "data": { "balance": "1234.56" } }
```

### Sign Transaction (Placeholder)
- `POST /api/wallet/sign`
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```
{ "transaction": { /* transaction object */ } }
```
- Response `200`:
```
{ "success": true, "message": "Transaction signed successfully", "data": { "signedTx": "..." } }
```

### Verify Signature
- `POST /api/wallet/verify`
- Body:
```
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "signature": "0xSignatureString...",
  "message": "Sign this message"
}
```
- Response `200`:
```
{ "success": true, "message": "Signature verified successfully", "data": { "valid": true } }
```

---

## Error Codes

Complete list of `errorCode` values that may appear in error responses:

**Authentication Errors:**
- `AUTH_INVALID_TOKEN`: invalid JWT
- `AUTH_TOKEN_EXPIRED`: expired JWT
- `AUTH_MISSING_TOKEN`: missing authorization header
- `AUTH_INVALID_CREDENTIALS`: wrong email/password
- `AUTH_USER_NOT_FOUND`: user doesn't exist
- `AUTH_WALLET_VERIFICATION_FAILED`: wallet signature verification failed

**Validation Errors:**
- `VALIDATION_ERROR`: input validation failed
- `INVALID_INPUT`: malformed input
- `MISSING_REQUIRED_FIELD`: required field missing

**Resource Errors:**
- `RESOURCE_NOT_FOUND`: resource not found (404)
- `RESOURCE_ALREADY_EXISTS`: duplicate resource (e.g., username)
- `RESOURCE_ACCESS_DENIED`: insufficient permissions (403)

**Server Errors:**
- `INTERNAL_SERVER_ERROR`: unexpected server error (500)
- `DATABASE_ERROR`: database operation failed
- `SERVICE_UNAVAILABLE`: service temporarily unavailable (503)

**Rate Limiting:**
- `RATE_LIMIT_EXCEEDED`: too many requests

## Examples (curl)

**Register:**
```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice_trader","email":"alice@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
```

**Create post:**
```bash
curl -X POST "http://localhost:8000/api/posts" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","content":"World"}'
```

**Get posts:**
```bash
curl "http://localhost:8000/api/posts?page=1&limit=10&sort=latest"
```

**Vote on post:**
```bash
curl -X POST "http://localhost:8000/api/posts/{postId}/vote" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"voteType":"upvote"}'
```

**Create poll:**
```bash
curl -X POST "http://localhost:8000/api/polls" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"question":"Will ETH reach $8000?","options":["Yes","No","Maybe"],"expiresAt":"2024-12-31T23:59:59.000Z"}'
```

**Vote on poll:**
```bash
curl -X POST "http://localhost:8000/api/polls/{pollId}/vote" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"optionIndex":0}'
```

**Join community:**
```bash
curl -X POST "http://localhost:8000/api/communities/{communityId}/join" \
  -H "Authorization: Bearer <accessToken>"
```

**Add sentiment to company:**
```bash
curl -X POST "http://localhost:8000/api/companies/{companyId}/sentiment" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"type":"bullish"}'
```

**Trade on market:**
```bash
curl -X POST "http://localhost:8000/api/companies/{companyId}/markets/{marketId}/trade" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"YES","amount":100,"side":"buy"}'
```

**Add bookmark:**
```bash
curl -X POST "http://localhost:8000/api/users/bookmarks" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"type":"post","itemId":"60d0fe4f5311236168a109cd"}'
```

**Follow user:**
```bash
curl -X POST "http://localhost:8000/api/users/{userId}/follow" \
  -H "Authorization: Bearer <accessToken>"
```

**Get notifications:**
```bash
curl "http://localhost:8000/api/notifications?page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

**Subscribe device for push:**
```bash
curl -X POST "http://localhost:8000/api/notifications/device-token" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"token":"FCM_DEVICE_TOKEN","platform":"ios"}'
```

**Get recommended feed:**
```bash
curl "http://localhost:8000/api/feed/recommended?page=1&limit=10"
```

**Link wallet:**
```bash
curl -X POST "http://localhost:8000/api/wallet/link" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"address":"0x1234...","chain":"ethereum","signature":"0xSig..."}'
```

## Notes

- Fields validated by backend: usernames (3–30 chars, alphanumeric + underscore), emails, URLs for avatars, vote types.
- Some routes allow unauthenticated access but return additional data when authenticated (e.g., posts with `optionalAuth`).
- See Swagger UI at `/api/docs` if enabled in server.
