# Anonn Backend

A comprehensive Node.js + Express backend for a Web3-enabled social and prediction platform, combining features similar to Reddit and Polymarket.

## Features

### Core Modules

- **Authentication & Authorization** - JWT-based auth with access/refresh tokens
- **User Profiles** - Full profile management, follow/unfollow, bookmarks
- **Posts & Polls** - Create posts, polls (2-4 options), voting, commenting
- **Communities & Bowls** - Reddit-style communities with moderation
- **Companies** - Track companies, add sentiment (bullish/bearish)
- **Prediction Markets** - Create and trade on prediction markets
- **Notifications** - Real-time notifications with device token support
- **Feed Algorithms** - Recommended, following, and personalized feeds
- **Web3 Wallet Integration** - Link wallets, verify signatures, fetch balances

### Technical Highlights

- ✅ ES6 modules with import/export
- ✅ MongoDB with Mongoose ODM
- ✅ JWT authentication middleware
- ✅ Input validation with express-validator
- ✅ Comprehensive error handling
- ✅ RESTful API design
- ✅ Web3 integration with ethers.js
- ✅ Modular folder structure

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/                   # Mongoose schemas
│   │   ├── User.js
│   │   ├── Post.js
│   │   ├── Poll.js
│   │   ├── Comment.js
│   │   ├── Community.js
│   │   ├── Bowl.js
│   │   ├── Company.js
│   │   ├── Market.js
│   │   ├── Notification.js
│   │   └── Wallet.js
│   ├── routes/                   # Express routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── posts.js
│   │   ├── polls.js
│   │   ├── communities.js
│   │   ├── companies.js
│   │   ├── notifications.js
│   │   ├── feed.js
│   │   └── wallet.js
│   ├── controllers/              # Route handlers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── postController.js
│   │   ├── pollController.js
│   │   ├── communityController.js
│   │   ├── companyController.js
│   │   ├── notificationController.js
│   │   ├── feedController.js
│   │   └── walletController.js
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   ├── validation.js         # Request validation
│   │   └── errorHandler.js       # Global error handler
│   ├── utils/
│   │   ├── response.js           # Response formatters
│   │   ├── jwt.js                # JWT utilities
│   │   └── password.js           # Password hashing
│   └── server.js                 # Main application entry
├── scripts/
│   └── seed.js                   # Database seeding
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Installation

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)

### Steps

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configurations:
   ```env
   PORT=8000
   MONGODB_URI=mongodb://localhost:27017/web3-social-platform
   JWT_SECRET=your_secret_key_here
   JWT_REFRESH_SECRET=your_refresh_secret_here
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Seed the database** (optional)
   ```bash
   npm run seed
   ```
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile
- `POST /api/users/:id/follow` - Follow user
- `DELETE /api/users/:id/follow` - Unfollow user
- `POST /api/users/bookmarks` - Add bookmark
- `GET /api/users/bookmarks` - Get bookmarks

### Posts
- `POST /api/posts` - Create post
- `GET /api/posts` - Get posts (with filters)
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/vote` - Vote on post
- `POST /api/posts/:id/comments` - Add comment
- `GET /api/posts/:id/comments` - Get comments
- `GET /api/posts/search` - Search posts

### Polls
- `POST /api/polls` - Create poll
- `GET /api/polls` - Get polls
- `GET /api/polls/:id` - Get poll with results
- `POST /api/polls/:id/vote` - Vote on poll

### Communities
- `POST /api/communities` - Create community
- `GET /api/communities` - List communities
- `GET /api/communities/:id` - Get community
- `PUT /api/communities/:id` - Update community
- `POST /api/communities/:id/join` - Join community
- `DELETE /api/communities/:id/leave` - Leave community

### Companies
- `POST /api/companies` - Create company
- `GET /api/companies` - List companies
- `GET /api/companies/:id` - Get company
- `POST /api/companies/:id/sentiment` - Add sentiment (bullish/bearish)
- `GET /api/companies/:id/posts` - Get company posts
- `POST /api/companies/:id/markets` - Create market
- `POST /api/companies/:id/markets/:marketId/trade` - Trade market

### Notifications
- `GET /api/notifications` - Fetch notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `POST /api/notifications/device-token` - Subscribe device
- `PUT /api/notifications/settings` - Update settings

### Feed
- `GET /api/feed/recommended` - Recommended feed
- `GET /api/feed/following` - Following feed
- `GET /api/feed/for-you` - Personalized feed

### Wallet
- `POST /api/wallet/link` - Link wallet
- `DELETE /api/wallet/:id/unlink` - Unlink wallet
- `GET /api/wallet` - Get wallet info
- `GET /api/wallet/:id/balance` - Get balance
- `POST /api/wallet/verify` - Verify signature

## Testing

Test credentials (after running seed):
- **Email:** alice@example.com
- **Password:** password123

Use Postman, cURL, or any HTTP client to test endpoints.

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Get tokens by calling `/api/auth/login` or `/api/auth/register`.

## Web3 Integration

The wallet module supports:
- Multi-chain wallet linking (Ethereum, Polygon, etc.)
- Signature verification for wallet ownership
- Balance fetching from blockchain
- On-chain market data integration
## License

MIT

## Author

Built for a Web3 social + prediction platform

---

**Happy Coding! 🚀**
