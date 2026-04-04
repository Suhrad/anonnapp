import Company from '../models/Company.js';
import Market from '../models/Market.js';
import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { createPointEvent } from '../utils/points.js';
import { PointEventType } from '../models/PointEvent.js';

/**
 * Company Controller  
 * Handles company CRUD, sentiment tracking, and market management
 */

export const createCompany = async (req, res, next) => {
    try {
        const { name, ticker, description, logo, sector, website } = req.body;

        const company = await Company.create({
            name,
            ticker,
            description,
            logo,
            sector,
            website,
        });

        return successResponse(res, 201, { company }, 'Company created');
    } catch (error) {
        next(error);
    }
};

export const getCompanies = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, sector, search } = req.query;
        const skip = (page - 1) * limit;

        let query = { isActive: true };
        if (sector) query.sector = sector;
        
        // Add search functionality - search by name or ticker (case-insensitive)
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { ticker: { $regex: search, $options: 'i' } }
            ];
        }

        const companies = await Company.find(query)
            .sort({ followerCount: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Company.countDocuments(query);

        // Calculate actual postCount, pollCount, sentiment stats, and author count for each company
        const companiesWithStats = await Promise.all(
            companies.map(async (company) => {
                const companyObj = company.toObject();
                
                // Calculate actual counts from database
                const postCount = await Post.countDocuments({ 
                    companyTags: company._id, 
                    isActive: true 
                });
                
                const pollCount = await Poll.countDocuments({ 
                    company: company._id, 
                    isActive: true 
                });

                // Calculate positive and negative post counts
                const positivePosts = await Post.countDocuments({
                    companyTags: company._id,
                    bias: 'positive',
                    isActive: true,
                });

                const negativePosts = await Post.countDocuments({
                    companyTags: company._id,
                    bias: 'negative',
                    isActive: true,
                });

                // Calculate unique author count
                const distinctAuthors = await Post.distinct('author', {
                    companyTags: company._id,
                    isActive: true,
                });
                const authorCount = distinctAuthors.length;

                companyObj.postCount = postCount;
                companyObj.pollCount = pollCount;
                companyObj.positivePosts = positivePosts;
                companyObj.negativePosts = negativePosts;
                companyObj.authorCount = authorCount;
                
                return companyObj;
            })
        );

        return successResponse(res, 200, { companies: companiesWithStats, total }, 'Companies retrieved');
    } catch (error) {
        next(error);
    }
};

export const getCompany = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id)
            .populate('insiders.user', 'username avatar');

        if (!company) {
            return errorResponse(res, 404, 'Company not found');
        }

        // Calculate actual counts from database
        const postCount = await Post.countDocuments({ 
            companyTags: company._id, 
            isActive: true 
        });
        
        const pollCount = await Poll.countDocuments({ 
            company: company._id, 
            isActive: true 
        });

        // Calculate positive and negative post counts
        const positivePosts = await Post.countDocuments({
            companyTags: company._id,
            bias: 'positive',
            isActive: true,
        });

        const negativePosts = await Post.countDocuments({
            companyTags: company._id,
            bias: 'negative',
            isActive: true,
        });

        // Calculate unique author count
        const distinctAuthors = await Post.distinct('author', {
            companyTags: company._id,
            isActive: true,
        });
        const authorCount = distinctAuthors.length;

        // Create company object with calculated counts
        const companyObj = company.toObject();
        companyObj.postCount = postCount;
        companyObj.pollCount = pollCount;
        companyObj.positivePosts = positivePosts;
        companyObj.negativePosts = negativePosts;
        companyObj.authorCount = authorCount;
        // followerCount is maintained as a stored field, so we keep the existing value

        return successResponse(res, 200, { company: companyObj }, 'Company retrieved');
    } catch (error) {
        next(error);
    }
};

export const addSentiment = async (req, res, next) => {
    try {
        const { sentiment } = req.body; // 'bullish' or 'bearish'
        const company = await Company.findById(req.params.id);

        if (!company) {
            return errorResponse(res, 404, 'Company not found');
        }

        let newRatingAdded = false;
        if (sentiment === 'bullish') {
            if (!company.bullishUsers.includes(req.user._id)) {
                company.bullishUsers.push(req.user._id);
                company.bullishCount += 1;
                newRatingAdded = true;
                // Remove from bearish if exists
                company.bearishUsers = company.bearishUsers.filter(
                    id => id.toString() !== req.user._id.toString()
                );
                if (company.bearishCount > 0) company.bearishCount -= 1;
            }
        } else if (sentiment === 'bearish') {
            if (!company.bearishUsers.includes(req.user._id)) {
                company.bearishUsers.push(req.user._id);
                company.bearishCount += 1;
                newRatingAdded = true;
                // Remove from bullish if exists
                company.bullishUsers = company.bullishUsers.filter(
                    id => id.toString() !== req.user._id.toString()
                );
                if (company.bullishCount > 0) company.bullishCount -= 1;
            }
        } else {
            return errorResponse(res, 400, 'Invalid sentiment');
        }

        await company.save();

        // Award points for rating a company (only if a new rating was actually added)
        if (newRatingAdded) {
            try {
                await createPointEvent(PointEventType.COMPANY_RATED, req.user._id, company._id.toString());
            } catch (error) {
                console.error('Error creating point event for company rating:', error);
            }
        }

        return successResponse(res, 200, {
            sentimentScore: company.sentimentScore,
            bullishCount: company.bullishCount,
            bearishCount: company.bearishCount,
        }, 'Sentiment recorded');
    } catch (error) {
        next(error);
    }
};

export const getCompanyPosts = async (req, res, next) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            sort = 'createdAt-desc',
            minUpvotes 
        } = req.query;
        const skip = (page - 1) * limit;

        const mongoose = (await import('mongoose')).default;
        const companyId = mongoose.Types.ObjectId.isValid(req.params.id) 
            ? new mongoose.Types.ObjectId(req.params.id) 
            : req.params.id;
        const needsAggregation = sort.includes('upvotes') || minUpvotes !== undefined;

        let posts, total;

        if (needsAggregation) {
            // Use aggregation when sorting by upvotes or filtering by minUpvotes
            const pipeline = [
                {
                    $match: {
                        companyTags: companyId,
                        isActive: true
                    }
                },
                {
                    $addFields: {
                        upvoteCount: { $size: { $ifNull: ['$upvotes', []] } },
                        downvoteCount: { $size: { $ifNull: ['$downvotes', []] } }
                    }
                }
            ];

            // Add minUpvotes filter if specified
            if (minUpvotes !== undefined) {
                const minUpvotesNum = parseInt(minUpvotes);
                if (!isNaN(minUpvotesNum)) {
                    pipeline.push({
                        $match: {
                            upvoteCount: { $gte: minUpvotesNum }
                        }
                    });
                }
            }

            // Add sorting
            let sortStage = {};
            if (sort === 'upvotes-desc' || sort === 'upvotes') {
                sortStage = { upvoteCount: -1, createdAt: -1 };
            } else if (sort === 'upvotes-asc') {
                sortStage = { upvoteCount: 1, createdAt: -1 };
            } else if (sort === 'createdAt-asc') {
                sortStage = { createdAt: 1 };
            } else {
                sortStage = { createdAt: -1 };
            }
            pipeline.push({ $sort: sortStage });

            // Get total count
            const countPipeline = [...pipeline, { $count: 'total' }];
            const countResult = await Post.aggregate(countPipeline);
            total = countResult.length > 0 ? countResult[0].total : 0;

            // Add pagination
            pipeline.push({ $skip: skip });
            pipeline.push({ $limit: parseInt(limit) });

            // Execute aggregation
            const postsData = await Post.aggregate(pipeline);

            // Get post IDs for population
            const postIds = postsData.map(p => p._id);
            posts = await Post.find({ _id: { $in: postIds } })
                .populate('author', 'username avatar')
                .populate('community', 'name displayName avatar')
                .populate('companyTags', 'name ticker logo')
                .populate('attachedMarket');

            // Maintain sort order from aggregation
            const postMap = new Map(posts.map(p => [p._id.toString(), p]));
            posts = postIds.map(id => postMap.get(id.toString())).filter(Boolean);
        } else {
            // Use regular find for simple queries
            let matchQuery = { 
                companyTags: companyId, 
                isActive: true 
            };

            let sortOption = {};
            if (sort === 'createdAt-asc') {
                sortOption = { createdAt: 1 };
            } else {
                sortOption = { createdAt: -1 };
            }

            posts = await Post.find(matchQuery)
                .sort(sortOption)
                .limit(parseInt(limit))
                .skip(skip)
                .populate('author', 'username avatar')
                .populate('community', 'name displayName avatar')
                .populate('companyTags', 'name ticker logo')
                .populate('attachedMarket');

            total = await Post.countDocuments(matchQuery);
        }

        // Calculate vote scores
        const postsWithScores = posts.map(post => {
            const postObj = post.toObject();
            const upvoteCount = post.upvotes ? post.upvotes.length : 0;
            const downvoteCount = post.downvotes ? post.downvotes.length : 0;
            postObj.voteScore = upvoteCount - downvoteCount;
            postObj.upvoteCount = upvoteCount;
            postObj.downvoteCount = downvoteCount;
            return postObj;
        });

        return paginatedResponse(res, postsWithScores, parseInt(page), parseInt(limit), total);
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/companies/:id/feed
 * @desc    Get combined feed for a company (top posts, all polls, all posts)
 * @access  Public
 */
export const getCompanyFeed = async (req, res, next) => {
    try {
        const mongoose = (await import('mongoose')).default;
        const companyId = mongoose.Types.ObjectId.isValid(req.params.id) 
            ? new mongoose.Types.ObjectId(req.params.id) 
            : req.params.id;

        // Get top posts (sorted by upvotes-desc, limit 2)
        const topPostsPipeline = [
            {
                $match: {
                    companyTags: companyId,
                    isActive: true
                }
            },
            {
                $addFields: {
                    upvoteCount: { $size: { $ifNull: ['$upvotes', []] } },
                    downvoteCount: { $size: { $ifNull: ['$downvotes', []] } }
                }
            },
            {
                $sort: { upvoteCount: -1, createdAt: -1 }
            },
            {
                $limit: 2
            }
        ];

        const topPostsData = await Post.aggregate(topPostsPipeline);
        const topPostIds = topPostsData.map(p => p._id);
        const topPosts = await Post.find({ _id: { $in: topPostIds } })
            .populate('author', 'username avatar')
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        // Maintain sort order from aggregation
        const topPostMap = new Map(topPosts.map(p => [p._id.toString(), p]));
        const topPostsOrdered = topPostIds.map(id => topPostMap.get(id.toString())).filter(Boolean);

        const topPostsWithScores = topPostsOrdered.map(post => {
            const postObj = post.toObject();
            const upvoteCount = post.upvotes ? post.upvotes.length : 0;
            const downvoteCount = post.downvotes ? post.downvotes.length : 0;
            postObj.voteScore = upvoteCount - downvoteCount;
            postObj.upvoteCount = upvoteCount;
            postObj.downvoteCount = downvoteCount;
            return postObj;
        });

        // Get all polls for the company
        const polls = await Poll.find({
            company: companyId,
            isActive: true
        })
            .sort({ createdAt: -1 })
            .populate('author', 'username avatar')
            .populate('community', 'name displayName')
            .populate('company', 'name ticker logo')
            .populate('attachedMarket');

        const pollsWithResults = polls.map(poll => {
            const pollObj = poll.toObject();
            pollObj.results = poll.getResults();
            pollObj.totalVotes = poll.totalVotes;
            return pollObj;
        });

        const pollsTotal = await Poll.countDocuments({
            company: companyId,
            isActive: true
        });

        // Get all posts for the company
        const allPosts = await Post.find({
            companyTags: companyId,
            isActive: true
        })
            .sort({ createdAt: -1 })
            .populate('author', 'username avatar')
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        const allPostsWithScores = allPosts.map(post => {
            const postObj = post.toObject();
            const upvoteCount = post.upvotes ? post.upvotes.length : 0;
            const downvoteCount = post.downvotes ? post.downvotes.length : 0;
            postObj.voteScore = upvoteCount - downvoteCount;
            postObj.upvoteCount = upvoteCount;
            postObj.downvoteCount = downvoteCount;
            return postObj;
        });

        const postsTotal = await Post.countDocuments({
            companyTags: companyId,
            isActive: true
        });

        return res.status(200).json({
            success: true,
            data: {
                topPosts: topPostsWithScores,
                polls: pollsWithResults,
                posts: allPostsWithScores,
                pagination: {
                    polls: {
                        totalItems: pollsTotal,
                        totalPages: 1,
                    },
                    posts: {
                        totalItems: postsTotal,
                        totalPages: 1,
                    },
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getCompanyPostStats = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);

        if (!company) {
            return errorResponse(res, 404, 'Company not found');
        }

        // Count posts by bias for this company
        const positiveCount = await Post.countDocuments({
            companyTags: req.params.id,
            bias: 'positive',
            isActive: true,
        });

        const negativeCount = await Post.countDocuments({
            companyTags: req.params.id,
            bias: 'negative',
            isActive: true,
        });

        const neutralCount = await Post.countDocuments({
            companyTags: req.params.id,
            bias: 'neutral',
            isActive: true,
        });

        const totalCount = await Post.countDocuments({
            companyTags: req.params.id,
            isActive: true,
        });

        return successResponse(res, 200, {
            positive: positiveCount,
            negative: negativeCount,
            neutral: neutralCount,
            total: totalCount,
        }, 'Post statistics retrieved');
    } catch (error) {
        next(error);
    }
};

export const getCompanyPostAuthorsCount = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);

        if (!company) {
            return errorResponse(res, 404, 'Company not found');
        }

        // Get distinct author IDs from posts tagged with this company
        const distinctAuthors = await Post.distinct('author', {
            companyTags: req.params.id,
            isActive: true,
        });

        const authorCount = distinctAuthors.length;

        return successResponse(res, 200, {
            authorCount,
        }, 'Post authors count retrieved');
    } catch (error) {
        next(error);
    }
};

export const createMarket = async (req, res, next) => {
    try {
        const { question, description, expiresAt } = req.body;

        const market = await Market.create({
            company: req.params.id,
            creator: req.user._id,
            question,
            description,
            expiresAt,
            type: 'binary',
            options: [
                { label: 'Yes', totalShares: 0 },
                { label: 'No', totalShares: 0 }
            ],
        });

        // Add to company's markets
        await Company.findByIdAndUpdate(req.params.id, {
            $push: { markets: market._id }
        });

        return successResponse(res, 201, { market }, 'Market created');
    } catch (error) {
        next(error);
    }
};

export const getCompanyMarkets = async (req, res, next) => {
    try {
        const markets = await Market.find({
            company: req.params.id,
            isActive: true
        })
            .sort({ createdAt: -1 })
            .populate('creator', 'username avatar');

        return successResponse(res, 200, { markets }, 'Markets retrieved');
    } catch (error) {
        next(error);
    }
};

export const tradeMarket = async (req, res, next) => {
    try {
        const { option, shares, action } = req.body; // option: 'yes'/'no', action: 'buy'/'sell'
        const market = await Market.findById(req.params.marketId);

        if (!market) {
            return errorResponse(res, 404, 'Market not found');
        }

        if (market.isExpired || market.isResolved) {
            return errorResponse(res, 400, 'Market is closed');
        }

        // Simplified trading logic
        if (action === 'buy') {
            const price = option === 'yes' ? market.yesPrice : market.noPrice;
            const cost = shares * price;

            market.positions.push({
                user: req.user._id,
                option,
                shares,
                averagePrice: price,
                investedAmount: cost,
            });

            market.totalVolume += cost;
            market.updatePrices();
        }

        await market.save();

        return successResponse(res, 200, { market }, 'Trade executed');
    } catch (error) {
        next(error);
    }
};

export const getAllCompaniesPostStats = async (req, res, next) => {
    try {
        // Get all active companies
        const companies = await Company.find({ isActive: true })
            .select('_id name ticker')
            .lean();

        // Use aggregation to efficiently count positive and negative posts for all companies
        const postStats = await Post.aggregate([
            {
                $match: {
                    isActive: true,
                    bias: { $in: ['positive', 'negative'] }
                }
            },
            {
                $unwind: '$companyTags'
            },
            {
                $group: {
                    _id: {
                        company: '$companyTags',
                        bias: '$bias'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Create a map for quick lookup
        const statsMap = new Map();
        postStats.forEach(stat => {
            const companyId = stat._id.company.toString();
            if (!statsMap.has(companyId)) {
                statsMap.set(companyId, { positive: 0, negative: 0 });
            }
            if (stat._id.bias === 'positive') {
                statsMap.get(companyId).positive = stat.count;
            } else if (stat._id.bias === 'negative') {
                statsMap.get(companyId).negative = stat.count;
            }
        });

        // Combine companies with their stats
        const companiesWithStats = companies.map(company => {
            const companyId = company._id.toString();
            const stats = statsMap.get(companyId) || { positive: 0, negative: 0 };
            return {
                _id: company._id,
                name: company.name,
                ticker: company.ticker,
                positivePosts: stats.positive,
                negativePosts: stats.negative,
                totalPosts: stats.positive + stats.negative
            };
        });

        return successResponse(res, 200, { companies: companiesWithStats }, 'Company post statistics retrieved');
    } catch (error) {
        next(error);
    }
};
