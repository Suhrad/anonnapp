import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Comprehensive API Test Suite
 * Tests all 52 endpoints across 10 modules
 * 
 * Usage: npm run test:api
 * 
 * This script structure is designed to be easily adaptable for Next.js frontend:
 * - Each module can become a separate API service file
 * - Test functions can be converted to actual API calls
 * - Response validation logic can be reused
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
let authToken = null;
let refreshToken = null;
let testUserId = null;
let testPostId = null;
let testPollId = null;
let testCommunityId = null;
let testBowlId = null;
let testCompanyId = null;
let testMarketId = null;

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

// Test statistics
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
};

/**
 * Helper: Make HTTP request
 * This pattern can be directly used in Next.js API routes or client components
 */
async function makeRequest(method, endpoint, data = null, useAuth = false) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };

    if (useAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
        method,
        headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        const responseData = await response.json();

        return {
            status: response.status,
            ok: response.ok,
            data: responseData,
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message,
        };
    }
}

/**
 * Test runner with colored output
 */
async function runTest(name, testFn, skip = false) {
    stats.total++;

    if (skip) {
        console.log(`${colors.yellow}⊘ SKIP${colors.reset} ${name}`);
        stats.skipped++;
        return;
    }

    try {
        await testFn();
        console.log(`${colors.green}✓ PASS${colors.reset} ${name}`);
        stats.passed++;
    } catch (error) {
        console.log(`${colors.red}✗ FAIL${colors.reset} ${name}`);
        console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
        stats.failed++;
    }
}

/**
 * Assertion helpers
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
    }
}

// ============================================
// MODULE 1: AUTHENTICATION TESTS
// ============================================
async function testAuthModule() {
    console.log(`\n${colors.cyan}━━━ Authentication Module (8 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Register new user
    await runTest('POST /api/auth/register - Create new user', async () => {
        const response = await makeRequest('POST', '/api/auth/register', {
            username: `testuser_${Date.now()}`,
            email: `test${Date.now()}@example.com`,
            password: 'testpass123',
        });

        assert(response.ok, `Registration failed: ${response.data.message}`);
        assert(response.data.success, 'Response should indicate success');
        assert(response.data.data.accessToken, 'Should return access token');
        assert(response.data.data.refreshToken, 'Should return refresh token');

        authToken = response.data.data.accessToken;
        refreshToken = response.data.data.refreshToken;
        testUserId = response.data.data.user._id;
    });

    // Test 2: Login with existing user
    await runTest('POST /api/auth/login - Login with credentials', async () => {
        const response = await makeRequest('POST', '/api/auth/login', {
            email: 'alice@example.com',
            password: 'password123',
        });

        assert(response.ok, `Login failed: ${response.data.message}`);
        assert(response.data.data.accessToken, 'Should return access token');

        // Use Alice's token for subsequent tests
        authToken = response.data.data.accessToken;
        refreshToken = response.data.data.refreshToken;
        testUserId = response.data.data.user._id;
    });

    // Test 3: Get current user
    await runTest('GET /api/auth/me - Get authenticated user', async () => {
        const response = await makeRequest('GET', '/api/auth/me', null, true);

        assert(response.ok, 'Should get current user');
        assert(response.data.data.user.email === 'alice@example.com', 'Should return correct user');
    });

    // Test 4: Refresh token
    await runTest('POST /api/auth/refresh - Refresh access token', async () => {
        const response = await makeRequest('POST', '/api/auth/refresh', {
            refreshToken: refreshToken,
        });

        assert(response.ok, 'Should refresh token');
        assert(response.data.data.accessToken, 'Should return new access token');
    });

    // Test 5: Request wallet nonce
    await runTest('POST /api/auth/wallet/nonce - Request nonce for wallet auth', async () => {
        const response = await makeRequest('POST', '/api/auth/wallet/nonce', {
            publicKey: '7xKzL3vQr8mN9pXqB2wY5tH6jK4sL1mR',
        });

        assert(response.ok, 'Should return nonce');
        assert(response.data.data.nonce, 'Should include nonce');
    });

    // Test 6: Wallet verification (skip - requires signature)
    await runTest('POST /api/auth/wallet/verify - Verify wallet signature', async () => {
        // This requires actual wallet signature, skip in automated tests
        throw new Error('Requires wallet signature - test manually');
    }, true);

    // Test 7: Link wallet (skip - requires signature)
    await runTest('POST /api/auth/wallet/link - Link wallet to account', async () => {
        // This requires actual wallet signature, skip in automated tests
        throw new Error('Requires wallet signature - test manually');
    }, true);

    // Test 8: Logout
    await runTest('POST /api/auth/logout - Logout user', async () => {
        const response = await makeRequest('POST', '/api/auth/logout', null, true);

        assert(response.ok, 'Should logout successfully');
    });
}

// ============================================
// MODULE 2: USER TESTS
// ============================================
async function testUserModule() {
    console.log(`\n${colors.cyan}━━━ User Module (7 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get user profile
    await runTest('GET /api/users/:id - Get user profile', async () => {
        const response = await makeRequest('GET', `/api/users/${testUserId}`);

        assert(response.ok, 'Should get user profile');
        assert(response.data.data.user._id === testUserId, 'Should return correct user');
    });

    // Test 2: Update user profile
    await runTest('PUT /api/users/:id - Update user profile', async () => {
        const response = await makeRequest('PUT', `/api/users/${testUserId}`, {
            bio: 'Updated bio from test script',
        }, true);

        assert(response.ok, 'Should update profile');
        assert(response.data.data.user.bio === 'Updated bio from test script', 'Bio should be updated');
    });

    // Test 3: Follow user
    await runTest('POST /api/users/:id/follow - Follow a user', async () => {
        // Get another user ID from seeded data
        const usersResponse = await makeRequest('GET', '/api/users/alice_crypto');
        const targetUserId = usersResponse.data.data.user._id;

        if (targetUserId === testUserId) {
            throw new Error('Cannot test follow on same user');
        }

        const response = await makeRequest('POST', `/api/users/${targetUserId}/follow`, null, true);
        assert(response.ok || response.status === 400, 'Should follow user or already following');
    });

    // Test 4: Unfollow user
    await runTest('DELETE /api/users/:id/follow - Unfollow a user', async () => {
        const usersResponse = await makeRequest('GET', '/api/users/alice_crypto');
        const targetUserId = usersResponse.data.data.user._id;

        const response = await makeRequest('DELETE', `/api/users/${targetUserId}/follow`, null, true);
        assert(response.ok || response.status === 400, 'Should unfollow user');
    });

    // Test 5: Get bookmarks
    await runTest('GET /api/users/bookmarks - Get user bookmarks', async () => {
        const response = await makeRequest('GET', '/api/users/bookmarks', null, true);

        assert(response.ok, 'Should get bookmarks');
        assert(Array.isArray(response.data.data.bookmarks), 'Should return array');
    });

    // Test 6: Add bookmark
    await runTest('POST /api/users/bookmarks - Add bookmark', async () => {
        // Get a post to bookmark
        const postsResponse = await makeRequest('GET', '/api/posts');
        if (postsResponse.data.data.posts.length > 0) {
            const postId = postsResponse.data.data.posts[0]._id;

            const response = await makeRequest('POST', '/api/users/bookmarks', {
                itemId: postId,
                itemType: 'post',
            }, true);

            assert(response.ok || response.status === 400, 'Should add bookmark');
        }
    });

    // Test 7: Remove bookmark
    await runTest('DELETE /api/users/bookmarks/:id - Remove bookmark', async () => {
        const postsResponse = await makeRequest('GET', '/api/posts');
        if (postsResponse.data.data.posts.length > 0) {
            const postId = postsResponse.data.data.posts[0]._id;

            const response = await makeRequest('DELETE', `/api/users/bookmarks/${postId}`, null, true);
            assert(response.ok || response.status === 404, 'Should remove bookmark');
        }
    });
}

// ============================================
// MODULE 3: POST TESTS
// ============================================
async function testPostModule() {
    console.log(`\n${colors.cyan}━━━ Post Module (10 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get all posts
    await runTest('GET /api/posts - Get all posts', async () => {
        const response = await makeRequest('GET', '/api/posts');

        assert(response.ok, 'Should get posts');
        assert(Array.isArray(response.data.data.posts), 'Should return array of posts');

        if (response.data.data.posts.length > 0) {
            testPostId = response.data.data.posts[0]._id;
        }
    });

    // Test 2: Search posts
    await runTest('GET /api/posts/search - Search posts', async () => {
        const response = await makeRequest('GET', '/api/posts/search?q=solana');

        assert(response.ok, 'Should search posts');
        assert(Array.isArray(response.data.data.posts), 'Should return array');
    });

    // Test 3: Get single post
    await runTest('GET /api/posts/:id - Get single post', async () => {
        if (!testPostId) {
            throw new Error('No test post ID available');
        }

        const response = await makeRequest('GET', `/api/posts/${testPostId}`);

        assert(response.ok, 'Should get post');
        assert(response.data.data.post._id === testPostId, 'Should return correct post');
    });

    // Test 4: Create post
    await runTest('POST /api/posts - Create new post', async () => {
        const response = await makeRequest('POST', '/api/posts', {
            title: 'Test post from automated script',
            content: 'This is a test post created by the API test script.',
            type: 'text',
        }, true);

        assert(response.ok, 'Should create post');
        assert(response.data.data.post.title === 'Test post from automated script', 'Should have correct title');

        testPostId = response.data.data.post._id;
    });

    // Test 5: Update post
    await runTest('PUT /api/posts/:id - Update post', async () => {
        const response = await makeRequest('PUT', `/api/posts/${testPostId}`, {
            title: 'Updated test post',
            content: 'Updated content',
        }, true);

        assert(response.ok, 'Should update post');
    });

    // Test 6: Vote on post
    await runTest('POST /api/posts/:id/vote - Vote on post', async () => {
        const response = await makeRequest('POST', `/api/posts/${testPostId}/vote`, {
            voteType: 'upvote',
        }, true);

        assert(response.ok, 'Should vote on post');
    });

    // Test 7: Get comments
    await runTest('GET /api/posts/:id/comments - Get post comments', async () => {
        const response = await makeRequest('GET', `/api/posts/${testPostId}/comments`);

        assert(response.ok, 'Should get comments');
        assert(Array.isArray(response.data.data.comments), 'Should return array');
    });

    // Test 8: Add comment
    await runTest('POST /api/posts/:id/comments - Add comment', async () => {
        const response = await makeRequest('POST', `/api/posts/${testPostId}/comments`, {
            content: 'Test comment from automated script',
        }, true);

        assert(response.ok, 'Should add comment');
    });

    // Test 9: Share post
    await runTest('POST /api/posts/:id/share - Increment share count', async () => {
        const response = await makeRequest('POST', `/api/posts/${testPostId}/share`);

        assert(response.ok, 'Should increment share count');
    });

    // Test 10: Delete post
    await runTest('DELETE /api/posts/:id - Delete post', async () => {
        const response = await makeRequest('DELETE', `/api/posts/${testPostId}`, null, true);

        assert(response.ok, 'Should delete post');
    });
}

// ============================================
// MODULE 4: POLL TESTS
// ============================================
async function testPollModule() {
    console.log(`\n${colors.cyan}━━━ Poll Module (6 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get all polls
    await runTest('GET /api/polls - Get all polls', async () => {
        const response = await makeRequest('GET', '/api/polls');

        assert(response.ok, 'Should get polls');
        assert(Array.isArray(response.data.data.polls), 'Should return array');

        if (response.data.data.polls.length > 0) {
            testPollId = response.data.data.polls[0]._id;
        }
    });

    // Test 2: Get single poll
    await runTest('GET /api/polls/:id - Get single poll', async () => {
        if (!testPollId) {
            throw new Error('No test poll ID available');
        }

        const response = await makeRequest('GET', `/api/polls/${testPollId}`);

        assert(response.ok, 'Should get poll');
    });

    // Test 3: Create poll
    await runTest('POST /api/polls - Create new poll', async () => {
        const response = await makeRequest('POST', '/api/polls', {
            question: 'Test poll from automated script?',
            options: [
                { text: 'Yes' },
                { text: 'No' },
                { text: 'Maybe' },
            ],
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, true);

        assert(response.ok, 'Should create poll');
        testPollId = response.data.data.poll._id;
    });

    // Test 4: Vote on poll
    await runTest('POST /api/polls/:id/vote - Vote on poll', async () => {
        const response = await makeRequest('POST', `/api/polls/${testPollId}/vote`, {
            optionIndex: 0,
        }, true);

        assert(response.ok, 'Should vote on poll');
    });

    // Test 5: Update poll
    await runTest('PUT /api/polls/:id - Update poll', async () => {
        const response = await makeRequest('PUT', `/api/polls/${testPollId}`, {
            question: 'Updated test poll?',
        }, true);

        assert(response.ok, 'Should update poll');
    });

    // Test 6: Delete poll
    await runTest('DELETE /api/polls/:id - Delete poll', async () => {
        const response = await makeRequest('DELETE', `/api/polls/${testPollId}`, null, true);

        assert(response.ok, 'Should delete poll');
    });
}

// ============================================
// MODULE 5: COMMUNITY TESTS
// ============================================
async function testCommunityModule() {
    console.log(`\n${colors.cyan}━━━ Community Module (7 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get all communities
    await runTest('GET /api/communities - Get all communities', async () => {
        const response = await makeRequest('GET', '/api/communities');

        assert(response.ok, 'Should get communities');
        assert(Array.isArray(response.data.data.communities), 'Should return array');

        if (response.data.data.communities.length > 0) {
            testCommunityId = response.data.data.communities[0]._id;
        }
    });

    // Test 2: Get single community
    await runTest('GET /api/communities/:id - Get single community', async () => {
        if (!testCommunityId) {
            throw new Error('No test community ID available');
        }

        const response = await makeRequest('GET', `/api/communities/${testCommunityId}`);

        assert(response.ok, 'Should get community');
    });

    // Test 3: Create community
    await runTest('POST /api/communities - Create new community', async () => {
        const response = await makeRequest('POST', '/api/communities', {
            name: `test_community_${Date.now()}`,
            displayName: 'Test Community',
            description: 'A test community created by automated script',
        }, true);

        assert(response.ok, 'Should create community');
        testCommunityId = response.data.data.community._id;
    });

    // Test 4: Update community
    await runTest('PUT /api/communities/:id - Update community', async () => {
        const response = await makeRequest('PUT', `/api/communities/${testCommunityId}`, {
            description: 'Updated description',
        }, true);

        assert(response.ok, 'Should update community');
    });

    // Test 5: Join community
    await runTest('POST /api/communities/:id/join - Join community', async () => {
        const response = await makeRequest('POST', `/api/communities/${testCommunityId}/join`, null, true);

        assert(response.ok || response.status === 400, 'Should join community');
    });

    // Test 6: Get community posts
    await runTest('GET /api/communities/:id/posts - Get community posts', async () => {
        const response = await makeRequest('GET', `/api/communities/${testCommunityId}/posts`);

        assert(response.ok, 'Should get community posts');
    });

    // Test 7: Leave community
    await runTest('DELETE /api/communities/:id/leave - Leave community', async () => {
        const response = await makeRequest('DELETE', `/api/communities/${testCommunityId}/leave`, null, true);

        assert(response.ok, 'Should leave community');
    });
}

// ============================================
// MODULE 6: BOWL TESTS
// ============================================
async function testBowlModule() {
    console.log(`\n${colors.cyan}━━━ Bowl Module (5 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get all bowls
    await runTest('GET /api/bowls - Get all bowls', async () => {
        const response = await makeRequest('GET', '/api/bowls');

        assert(response.ok, 'Should get bowls');
        assert(Array.isArray(response.data.data.bowls), 'Should return array');

        if (response.data.data.bowls.length > 0) {
            testBowlId = response.data.data.bowls[0]._id;
        }
    });

    // Test 2: Get single bowl
    await runTest('GET /api/bowls/:id - Get single bowl', async () => {
        if (!testBowlId) {
            throw new Error('No test bowl ID available');
        }

        const response = await makeRequest('GET', `/api/bowls/${testBowlId}`);

        assert(response.ok, 'Should get bowl');
    });

    // Test 3: Create bowl
    await runTest('POST /api/bowls - Create new bowl', async () => {
        const response = await makeRequest('POST', '/api/bowls', {
            name: `test_bowl_${Date.now()}`,
            displayName: 'Test Bowl',
            description: 'A test bowl created by automated script',
            category: 'crypto',
        }, true);

        assert(response.ok, 'Should create bowl');
        testBowlId = response.data.data.bowl._id;
    });

    // Test 4: Join bowl
    await runTest('POST /api/bowls/:id/join - Join bowl', async () => {
        const response = await makeRequest('POST', `/api/bowls/${testBowlId}/join`, null, true);

        assert(response.ok || response.status === 400, 'Should join bowl');
    });

    // Test 5: Leave bowl
    await runTest('DELETE /api/bowls/:id/leave - Leave bowl', async () => {
        const response = await makeRequest('DELETE', `/api/bowls/${testBowlId}/leave`, null, true);

        assert(response.ok, 'Should leave bowl');
    });
}

// ============================================
// MODULE 7: COMPANY TESTS
// ============================================
async function testCompanyModule() {
    console.log(`\n${colors.cyan}━━━ Company Module (8 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get all companies
    await runTest('GET /api/companies - Get all companies', async () => {
        const response = await makeRequest('GET', '/api/companies');

        assert(response.ok, 'Should get companies');
        assert(Array.isArray(response.data.data.companies), 'Should return array');

        if (response.data.data.companies.length > 0) {
            testCompanyId = response.data.data.companies[0]._id;
        }
    });

    // Test 2: Get single company
    await runTest('GET /api/companies/:id - Get single company', async () => {
        if (!testCompanyId) {
            throw new Error('No test company ID available');
        }

        const response = await makeRequest('GET', `/api/companies/${testCompanyId}`);

        assert(response.ok, 'Should get company');
    });

    // Test 3: Create company
    await runTest('POST /api/companies - Create new company', async () => {
        const response = await makeRequest('POST', '/api/companies', {
            name: `Test Company ${Date.now()}`,
            ticker: `TST${Date.now().toString().slice(-3)}`,
            description: 'A test company created by automated script',
            sector: 'technology',
        }, true);

        assert(response.ok, 'Should create company');
        testCompanyId = response.data.data.company._id;
    });

    // Test 4: Add sentiment
    await runTest('POST /api/companies/:id/sentiment - Add sentiment', async () => {
        const response = await makeRequest('POST', `/api/companies/${testCompanyId}/sentiment`, {
            sentiment: 'bullish',
        }, true);

        assert(response.ok, 'Should add sentiment');
    });

    // Test 5: Get company posts
    await runTest('GET /api/companies/:id/posts - Get company posts', async () => {
        const response = await makeRequest('GET', `/api/companies/${testCompanyId}/posts`);

        assert(response.ok, 'Should get company posts');
    });

    // Test 6: Get company markets
    await runTest('GET /api/companies/:id/markets - Get company markets', async () => {
        const response = await makeRequest('GET', `/api/companies/${testCompanyId}/markets`);

        assert(response.ok, 'Should get company markets');
    });

    // Test 7: Create market
    await runTest('POST /api/companies/:id/markets - Create prediction market', async () => {
        const response = await makeRequest('POST', `/api/companies/${testCompanyId}/markets`, {
            question: 'Test market question?',
            description: 'Test market description',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, true);

        assert(response.ok, 'Should create market');

        if (response.ok && response.data.data.market) {
            testMarketId = response.data.data.market._id;
        }
    });

    // Test 8: Trade on market
    await runTest('POST /api/companies/:id/markets/:marketId/trade - Trade on market', async () => {
        if (!testMarketId) {
            throw new Error('No test market ID available');
        }

        const response = await makeRequest('POST', `/api/companies/${testCompanyId}/markets/${testMarketId}/trade`, {
            option: 'yes',
            amount: 10,
        }, true);

        assert(response.ok, 'Should trade on market');
    });
}

// ============================================
// MODULE 8: NOTIFICATION TESTS
// ============================================
async function testNotificationModule() {
    console.log(`\n${colors.cyan}━━━ Notification Module (6 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get notifications
    await runTest('GET /api/notifications - Get user notifications', async () => {
        const response = await makeRequest('GET', '/api/notifications', null, true);

        assert(response.ok, 'Should get notifications');
        assert(Array.isArray(response.data.data.notifications), 'Should return array');
    });

    // Test 2: Mark as read (skip if no notifications)
    await runTest('PUT /api/notifications/:id/read - Mark notification as read', async () => {
        const notifs = await makeRequest('GET', '/api/notifications', null, true);

        if (notifs.data.data.notifications.length > 0) {
            const notifId = notifs.data.data.notifications[0]._id;
            const response = await makeRequest('PUT', `/api/notifications/${notifId}/read`, null, true);
            assert(response.ok, 'Should mark as read');
        } else {
            throw new Error('No notifications to test');
        }
    }, true);

    // Test 3: Mark all as read
    await runTest('PUT /api/notifications/read-all - Mark all as read', async () => {
        const response = await makeRequest('PUT', '/api/notifications/read-all', null, true);

        assert(response.ok, 'Should mark all as read');
    });

    // Test 4: Subscribe device
    await runTest('POST /api/notifications/device-token - Subscribe device', async () => {
        const response = await makeRequest('POST', '/api/notifications/device-token', {
            deviceToken: 'test-device-token-123',
        }, true);

        assert(response.ok, 'Should subscribe device');
    });

    // Test 5: Update settings
    await runTest('PUT /api/notifications/settings - Update notification settings', async () => {
        const response = await makeRequest('PUT', '/api/notifications/settings', {
            email: true,
            push: true,
            comments: true,
        }, true);

        assert(response.ok, 'Should update settings');
    });

    // Test 6: Unsubscribe device
    await runTest('DELETE /api/notifications/device-token - Unsubscribe device', async () => {
        const response = await makeRequest('DELETE', '/api/notifications/device-token', {
            deviceToken: 'test-device-token-123',
        }, true);

        assert(response.ok, 'Should unsubscribe device');
    });
}

// ============================================
// MODULE 9: FEED TESTS
// ============================================
async function testFeedModule() {
    console.log(`\n${colors.cyan}━━━ Feed Module (3 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get recommended feed
    await runTest('GET /api/feed/recommended - Get recommended feed', async () => {
        const response = await makeRequest('GET', '/api/feed/recommended');

        assert(response.ok, 'Should get recommended feed');
        assert(Array.isArray(response.data.data.posts), 'Should return array');
    });

    // Test 2: Get following feed
    await runTest('GET /api/feed/following - Get following feed', async () => {
        const response = await makeRequest('GET', '/api/feed/following', null, true);

        assert(response.ok, 'Should get following feed');
        assert(Array.isArray(response.data.data.posts), 'Should return array');
    });

    // Test 3: Get for-you feed
    await runTest('GET /api/feed/for-you - Get personalized feed', async () => {
        const response = await makeRequest('GET', '/api/feed/for-you', null, true);

        assert(response.ok, 'Should get for-you feed');
        assert(Array.isArray(response.data.data.posts), 'Should return array');
    });
}

// ============================================
// MODULE 10: WALLET TESTS
// ============================================
async function testWalletModule() {
    console.log(`\n${colors.cyan}━━━ Wallet Module (6 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Get wallets
    await runTest('GET /api/wallet - Get linked wallets', async () => {
        const response = await makeRequest('GET', '/api/wallet', null, true);

        assert(response.ok, 'Should get wallets');
        assert(Array.isArray(response.data.data.wallets), 'Should return array');
    });

    // Test 2: Link wallet (skip - requires signature)
    await runTest('POST /api/wallet/link - Link new wallet', async () => {
        throw new Error('Requires wallet signature - test manually');
    }, true);

    // Test 3: Get wallet balance (skip if no wallets)
    await runTest('GET /api/wallet/:id/balance - Get wallet balance', async () => {
        const walletsResponse = await makeRequest('GET', '/api/wallet', null, true);

        if (walletsResponse.data.data.wallets.length > 0) {
            const walletId = walletsResponse.data.data.wallets[0]._id;
            const response = await makeRequest('GET', `/api/wallet/${walletId}/balance`, null, true);
            assert(response.ok, 'Should get balance');
        } else {
            throw new Error('No wallets to test');
        }
    }, true);

    // Test 4: Sign transaction (placeholder)
    await runTest('POST /api/wallet/sign - Sign transaction', async () => {
        const response = await makeRequest('POST', '/api/wallet/sign', {
            transaction: 'test-transaction-data',
        }, true);

        // This is a placeholder endpoint
        assert(response.status === 501 || response.ok, 'Should handle sign request');
    });

    // Test 5: Verify signature
    await runTest('POST /api/wallet/verify - Verify signature', async () => {
        const response = await makeRequest('POST', '/api/wallet/verify', {
            message: 'test message',
            signature: 'test-signature',
            publicKey: 'test-public-key',
        });

        // This will likely fail validation, but should return proper error
        assert(response.status === 400 || response.ok, 'Should handle verify request');
    });

    // Test 6: Unlink wallet (skip if no wallets)
    await runTest('DELETE /api/wallet/:id/unlink - Unlink wallet', async () => {
        throw new Error('Skip to preserve test data');
    }, true);
}

// ============================================
// SYSTEM TESTS
// ============================================
async function testSystemEndpoints() {
    console.log(`\n${colors.cyan}━━━ System Endpoints (4 endpoints) ━━━${colors.reset}\n`);

    // Test 1: Root endpoint
    await runTest('GET / - API welcome message', async () => {
        const response = await makeRequest('GET', '/');

        assert(response.ok, 'Should get welcome message');
        assert(response.data.success, 'Should indicate success');
    });

    // Test 2: Health check
    await runTest('GET /health - Health check', async () => {
        const response = await makeRequest('GET', '/health');

        assert(response.ok, 'Should be healthy');
        assert(response.data.success, 'Should indicate success');
    });

    // Test 3: Swagger JSON
    await runTest('GET /api-docs/swagger.json - Get OpenAPI spec', async () => {
        const response = await fetch(`${BASE_URL}/api-docs/swagger.json`);
        const data = await response.json();

        assert(response.ok, 'Should get swagger spec');
        assert(data.openapi, 'Should have OpenAPI version');
    });

    // Test 4: Swagger UI (just check it loads)
    await runTest('GET /api-docs - Swagger UI page', async () => {
        const response = await fetch(`${BASE_URL}/api-docs`);

        assert(response.ok, 'Should load Swagger UI');
    });
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
    console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║         ANONN BACKEND API - COMPREHENSIVE TEST SUITE      ║${colors.reset}`);
    console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`\nBase URL: ${BASE_URL}`);
    console.log(`Started: ${new Date().toLocaleString()}\n`);

    const startTime = Date.now();

    try {
        await testSystemEndpoints();
        await testAuthModule();
        await testUserModule();
        await testPostModule();
        await testPollModule();
        await testCommunityModule();
        await testBowlModule();
        await testCompanyModule();
        await testNotificationModule();
        await testFeedModule();
        await testWalletModule();
    } catch (error) {
        console.error(`\n${colors.red}Fatal error during test execution:${colors.reset}`, error);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}                        TEST SUMMARY                        ${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`\nTotal Tests:    ${stats.total}`);
    console.log(`${colors.green}Passed:         ${stats.passed}${colors.reset}`);
    console.log(`${colors.red}Failed:         ${stats.failed}${colors.reset}`);
    console.log(`${colors.yellow}Skipped:        ${stats.skipped}${colors.reset}`);
    console.log(`\nDuration:       ${duration}s`);
    console.log(`Completed:      ${new Date().toLocaleString()}`);

    const successRate = ((stats.passed / (stats.total - stats.skipped)) * 100).toFixed(1);
    console.log(`Success Rate:   ${successRate}%`);

    console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);

    // Exit with appropriate code
    process.exit(stats.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
