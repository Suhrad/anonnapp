import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../src/config/database.js';
import User from '../src/models/User.js';
import Post from '../src/models/Post.js';
import Poll from '../src/models/Poll.js';
import Community from '../src/models/Community.js';
import Bowl from '../src/models/Bowl.js';
import Company from '../src/models/Company.js';
import Comment from '../src/models/Comment.js';
import Market from '../src/models/Market.js';

// Load environment variables
dotenv.config();

/**
 * Database Seeder
 * Populates the database with sample data for testing
 */

const seedData = async () => {
    try {
        console.log('🌱 Starting database seeding...\n');

        // Connect to database
        await connectDB();

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Post.deleteMany({}),
            Poll.deleteMany({}),
            Community.deleteMany({}),
            Bowl.deleteMany({}),
            Company.deleteMany({}),
            Comment.deleteMany({}),
            Market.deleteMany({}),
        ]);
        console.log('✅ Existing data cleared\n');

        // ========================================
        // 1. Create Users
        // ========================================
        console.log('👥 Creating users...');
        const hashedPassword = await bcrypt.hash('password123', 10);

        const users = await User.create([
            {
                username: 'alice_crypto',
                email: 'alice@example.com',
                password: hashedPassword,
                authMethod: 'email',
                bio: 'Crypto enthusiast and DeFi researcher. Bullish on Web3! 🚀',
                avatar: 'https://i.pravatar.cc/150?img=1',
                isVerified: true,
            },
            {
                username: 'bob_trader',
                email: 'bob@example.com',
                password: hashedPassword,
                authMethod: 'email',
                bio: 'Day trader | Market analyst | Sharing my insights',
                avatar: 'https://i.pravatar.cc/150?img=2',
                isVerified: true,
            },
            {
                username: 'charlie_dev',
                email: 'charlie@example.com',
                password: hashedPassword,
                authMethod: 'email',
                bio: 'Full-stack developer building on Solana',
                avatar: 'https://i.pravatar.cc/150?img=3',
            },
            {
                username: 'diana_nft',
                email: 'diana@example.com',
                password: hashedPassword,
                authMethod: 'email',
                bio: 'NFT collector and digital artist',
                avatar: 'https://i.pravatar.cc/150?img=4',
            },
            {
                username: 'eve_whale',
                email: 'eve@example.com',
                password: hashedPassword,
                authMethod: 'both',
                primaryWallet: '7xKzL3vQr8mN9pXqB2wY5tH6jK4sL1mR',
                bio: 'Whale investor | Early adopter | HODL',
                avatar: 'https://i.pravatar.cc/150?img=5',
                walletAddresses: [{
                    address: '7xKzL3vQr8mN9pXqB2wY5tH6jK4sL1mR',
                    chain: 'solana',
                    isPrimary: true,
                    verified: true,
                }],
                isVerified: true,
            },
        ]);

        // Create social connections
        users[0].following.push(users[1]._id, users[2]._id, users[4]._id);
        users[1].following.push(users[0]._id, users[4]._id);
        users[2].following.push(users[0]._id, users[1]._id);
        users[3].following.push(users[0]._id, users[4]._id);
        users[4].following.push(users[0]._id, users[1]._id, users[2]._id);

        users[0].followers.push(users[1]._id, users[2]._id, users[3]._id, users[4]._id);
        users[1].followers.push(users[0]._id, users[2]._id, users[4]._id);
        users[2].followers.push(users[0]._id, users[4]._id);
        users[4].followers.push(users[0]._id, users[1]._id, users[3]._id);

        await Promise.all(users.map(user => user.save()));
        console.log(`✅ Created ${users.length} users\n`);

        // ========================================
        // 2. Create Communities
        // ========================================
        console.log('🏘️  Creating communities...');
        const communities = await Community.create([
            {
                name: 'crypto_general',
                displayName: 'Crypto General',
                description: 'General cryptocurrency discussion and news',
                creator: users[0]._id,
                avatar: 'https://picsum.photos/seed/crypto/200',
                banner: 'https://picsum.photos/seed/crypto-banner/1200/300',
                memberCount: 3,
                members: [users[0]._id, users[1]._id, users[4]._id],
            },
            {
                name: 'defi',
                displayName: 'DeFi Hub',
                description: 'Decentralized Finance protocols, yields, and strategies',
                creator: users[1]._id,
                avatar: 'https://picsum.photos/seed/defi/200',
                banner: 'https://picsum.photos/seed/defi-banner/1200/300',
                memberCount: 4,
                members: [users[0]._id, users[1]._id, users[2]._id, users[4]._id],
            },
            {
                name: 'nft_marketplace',
                displayName: 'NFT Marketplace',
                description: 'NFT drops, collections, and trading',
                creator: users[3]._id,
                avatar: 'https://picsum.photos/seed/nft/200',
                banner: 'https://picsum.photos/seed/nft-banner/1200/300',
                memberCount: 2,
                members: [users[0]._id, users[3]._id],
            },
        ]);
        console.log(`✅ Created ${communities.length} communities\n`);

        // ========================================
        // 3. Create Bowls
        // ========================================
        console.log('🎯 Creating bowls...');
        const bowls = await Bowl.create([
            {
                name: 'crypto_markets',
                displayName: 'Crypto Markets',
                description: 'General cryptocurrency market discussions, analysis and trading signals',
                creator: users[0]._id,
                category: 'crypto',
                memberCount: 3,
                members: [users[0]._id, users[2]._id, users[4]._id],
            },
            {
                name: 'technology_trends',
                displayName: 'Technology Trends',
                description: 'Latest tech innovations, AI developments, and industry news',
                creator: users[2]._id,
                category: 'technology',
                memberCount: 4,
                members: [users[0]._id, users[1]._id, users[2]._id, users[4]._id],
            },
            {
                name: 'defi_degen',
                displayName: 'DeFi Degen',
                description: 'High-risk DeFi plays, yield farming strategies and degen alpha',
                creator: users[1]._id,
                category: 'crypto',
                memberCount: 5,
                members: [users[0]._id, users[1]._id, users[2]._id, users[3]._id, users[4]._id],
            },
            {
                name: 'nft_culture',
                displayName: 'NFT Culture',
                description: 'NFT drops, digital art, collections and trading discussions',
                creator: users[3]._id,
                category: 'crypto',
                memberCount: 3,
                members: [users[0]._id, users[3]._id, users[4]._id],
            },
        ]);
        console.log(`✅ Created ${bowls.length} bowls\n`);

        // ========================================
        // 4. Create Companies
        // ========================================
        console.log('🏢 Creating companies...');
        const companies = await Company.create([
            {
                name: 'Polygon',
                ticker: 'MATIC',
                description: 'Ethereum scaling solution with fast and cheap transactions',
                website: 'https://polygon.technology',
                logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
                sector: 'crypto',
                bullishCount: 99,
                bearishCount: 66,
                followerCount: 1250,
            },
            {
                name: 'Ethereum',
                ticker: 'ETH',
                description: 'Decentralized blockchain platform for smart contracts',
                website: 'https://ethereum.org',
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
                sector: 'crypto',
                bullishCount: 61,
                bearishCount: 54,
                followerCount: 3450,
            },
            {
                name: 'Chainlink',
                ticker: 'LINK',
                description: 'Decentralized oracle network for smart contracts',
                website: 'https://chain.link',
                logo: 'https://cryptologos.cc/logos/chainlink-link-logo.png',
                sector: 'crypto',
                bullishCount: 99,
                bearishCount: 39,
                followerCount: 890,
            },
            {
                name: 'Uniswap',
                ticker: 'UNI',
                description: 'Leading decentralized exchange protocol on Ethereum',
                website: 'https://uniswap.org',
                logo: 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
                sector: 'crypto',
                bullishCount: 99,
                bearishCount: 41,
                followerCount: 2100,
            },
            {
                name: 'Solana',
                ticker: 'SOL',
                description: 'High-performance blockchain platform',
                website: 'https://solana.com',
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
                sector: 'crypto',
                bullishCount: 85,
                bearishCount: 32,
                followerCount: 2800,
            },
        ]);
        console.log(`✅ Created ${companies.length} companies\n`);

        // ========================================
        // 5. Create Posts
        // ========================================
        console.log('📝 Creating posts...');
        const posts = await Post.create([
            {
                title: 'Solana hits new all-time high! 🚀',
                content: 'Solana just broke through $200! The ecosystem is thriving with new projects launching daily. What are your price predictions for EOY?',
                author: users[0]._id,
                community: communities[0]._id,
                companyTags: [companies[0]._id],
                type: 'text',
                upvotes: [users[1]._id, users[2]._id, users[4]._id],
                downvotes: [],
                viewCount: 156,
                shareCount: 12,
            },
            {
                title: 'Best DeFi yields right now?',
                content: 'Looking for safe DeFi protocols with good yields. Currently farming on Uniswap but want to diversify. Any recommendations?',
                author: users[1]._id,
                community: communities[1]._id,
                companyTags: [companies[1]._id],
                type: 'text',
                upvotes: [users[0]._id, users[2]._id],
                downvotes: [],
                viewCount: 89,
                shareCount: 5,
            },
            {
                title: 'New NFT collection dropping tomorrow',
                content: 'Excited to announce my new generative art collection! 1000 unique pieces. Mint price: 0.5 SOL. Check out the preview!',
                author: users[3]._id,
                community: communities[2]._id,
                type: 'image',
                mediaUrl: 'https://picsum.photos/seed/nft-drop/800/600',
                upvotes: [users[0]._id, users[4]._id],
                downvotes: [],
                viewCount: 234,
                shareCount: 18,
            },
            {
                title: 'Chainlink integration guide for developers',
                content: 'Just published a comprehensive guide on integrating Chainlink oracles into your smart contracts. Link in comments!',
                author: users[2]._id,
                community: communities[1]._id,
                bowl: bowls[0]._id,
                companyTags: [companies[2]._id],
                type: 'link',
                linkUrl: 'https://docs.chain.link',
                upvotes: [users[0]._id, users[1]._id],
                downvotes: [],
                viewCount: 67,
                shareCount: 8,
            },
            {
                title: 'Whale alert: 10M USDC moved to Uniswap',
                content: 'Just spotted a massive USDC transfer to Uniswap. Could be a big trade incoming. Thoughts?',
                author: users[4]._id,
                community: communities[1]._id,
                companyTags: [companies[1]._id],
                type: 'text',
                upvotes: [users[0]._id, users[1]._id, users[2]._id],
                downvotes: [],
                viewCount: 312,
                shareCount: 24,
            },
        ]);
        console.log(`✅ Created ${posts.length} posts\n`);

        // ========================================
        // 6. Create Comments
        // ========================================
        console.log('💬 Creating comments...');
        const comments = await Comment.create([
            {
                content: 'This is huge! SOL to $500 by EOY 🚀',
                author: users[1]._id,
                post: posts[0]._id,
                upvotes: [users[0]._id, users[4]._id],
                downvotes: [],
            },
            {
                content: 'I think we might see some consolidation first, but long-term bullish!',
                author: users[2]._id,
                post: posts[0]._id,
                upvotes: [users[0]._id],
                downvotes: [],
            },
            {
                content: 'Check out Aave and Compound. Both have solid track records.',
                author: users[0]._id,
                post: posts[1]._id,
                upvotes: [users[1]._id, users[2]._id],
                downvotes: [],
            },
            {
                content: 'Love the art style! Will definitely mint 🎨',
                author: users[0]._id,
                post: posts[2]._id,
                upvotes: [users[3]._id, users[4]._id],
                downvotes: [],
            },
        ]);

        // Update comment counts
        posts[0].commentCount = 2;
        posts[1].commentCount = 1;
        posts[2].commentCount = 1;
        await Promise.all(posts.map(post => post.save()));
        console.log(`✅ Created ${comments.length} comments\n`);

        // ========================================
        // 7. Create Polls
        // ========================================
        console.log('📊 Creating polls...');
        const polls = await Poll.create([
            {
                question: 'Will ETH reach $10,000 by end of 2024?',
                options: [
                    { text: 'Yes, definitely', voteCount: 45 },
                    { text: 'Maybe, 50/50', voteCount: 32 },
                    { text: 'No way', voteCount: 18 },
                ],
                author: users[0]._id,
                community: communities[0]._id,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                totalVotes: 95,
                voters: [users[1]._id, users[2]._id, users[3]._id, users[4]._id],
            },
            {
                question: 'Best blockchain for NFTs?',
                options: [
                    { text: 'Ethereum', voteCount: 67 },
                    { text: 'Solana', voteCount: 89 },
                    { text: 'Polygon', voteCount: 34 },
                    { text: 'Other', voteCount: 12 },
                ],
                author: users[3]._id,
                community: communities[2]._id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                totalVotes: 202,
                voters: [users[0]._id, users[1]._id, users[2]._id, users[4]._id],
            },
        ]);
        console.log(`✅ Created ${polls.length} polls\n`);

        // ========================================
        // 8. Create Markets
        // ========================================
        console.log('📈 Creating prediction markets...');
        const markets = await Market.create([
            {
                question: 'Will Bitcoin reach $100,000 in 2024?',
                description: 'Market resolves YES if BTC hits $100k at any point in 2024',
                company: companies[0]._id,
                creator: users[4]._id,
                type: 'binary',
                yesPrice: 0.65,
                noPrice: 0.35,
                totalVolume: 15000,
                totalLiquidity: 10000,
                expiresAt: new Date('2024-12-31'),
                isActive: true,
                isResolved: false,
                traderCount: 12,
            },
            {
                question: 'Solana TVL to exceed $10B by Q2 2024?',
                description: 'Market resolves based on DefiLlama data',
                company: companies[0]._id,
                creator: users[1]._id,
                type: 'binary',
                yesPrice: 0.72,
                noPrice: 0.28,
                totalVolume: 8500,
                totalLiquidity: 6000,
                expiresAt: new Date('2024-06-30'),
                isActive: true,
                isResolved: false,
                traderCount: 8,
            },
        ]);
        console.log(`✅ Created ${markets.length} prediction markets\n`);

        // ========================================
        // 9. Update User Bookmarks
        // ========================================
        console.log('🔖 Adding bookmarks...');
        users[0].bookmarkedPosts.push(posts[1]._id, posts[3]._id);
        users[1].bookmarkedPosts.push(posts[0]._id, posts[4]._id);
        users[2].bookmarkedPolls.push(polls[0]._id);
        await Promise.all(users.map(user => user.save()));
        console.log('✅ Bookmarks added\n');

        // ========================================
        // Summary
        // ========================================
        console.log('═══════════════════════════════════════');
        console.log('🎉 Database seeding completed!\n');
        console.log('Summary:');
        console.log(`  👥 Users: ${users.length}`);
        console.log(`  🏘️  Communities: ${communities.length}`);
        console.log(`  🎯 Bowls: ${bowls.length}`);
        console.log(`  🏢 Companies: ${companies.length}`);
        console.log(`  📝 Posts: ${posts.length}`);
        console.log(`  💬 Comments: ${comments.length}`);
        console.log(`  📊 Polls: ${polls.length}`);
        console.log(`  📈 Markets: ${markets.length}`);
        console.log('═══════════════════════════════════════\n');

        console.log('📋 Test Credentials:');
        console.log('  Email: alice@example.com');
        console.log('  Password: password123\n');

        console.log('🔗 API Endpoints:');
        console.log('  Health: http://localhost:8000/health');
        console.log('  Swagger: http://localhost:8000/api-docs');
        console.log('  Login: POST http://localhost:8000/api/auth/login\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

// Run seeder
seedData();
