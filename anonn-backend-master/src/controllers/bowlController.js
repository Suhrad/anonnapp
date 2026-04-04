import Bowl from '../models/Bowl.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

/**
 * Bowl Controller
 * Similar to communities but for different categorization (like cross-community topics)
 */

export const createBowl = async (req, res, next) => {
    try {
        const { name, displayName, description, icon, banner, category } = req.body;

        const bowl = await Bowl.create({
            name,
            displayName,
            description,
            icon,
            banner,
            category,
            creator: req.user._id,
        });

        return successResponse(res, 201, { bowl }, 'Bowl created');
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            return errorResponse(res, 400, null, 'A bowl with this name already exists', 'RESOURCE_ALREADY_EXISTS');
        }
        next(error);
    }
};

export const getBowls = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, category } = req.query;
        const skip = (page - 1) * limit;

        let query = { isActive: true };
        if (category) query.category = category;

        const bowls = await Bowl.find(query)
            .sort({ memberCount: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('creator', 'username avatar');

        const total = await Bowl.countDocuments(query);

        return successResponse(res, 200, { bowls, total }, 'Bowls retrieved');
    } catch (error) {
        next(error);
    }
};

export const getBowl = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if id is a valid MongoDB ObjectId or a name
        const mongoose = await import('mongoose');
        const isValidObjectId = mongoose.default.Types.ObjectId.isValid(id);

        // Query by _id if valid ObjectId, otherwise query by name
        const query = isValidObjectId ? { _id: id } : { name: id };

        const bowl = await Bowl.findOne(query)
            .populate('creator', 'username avatar')
            .populate('moderators', 'username avatar')
            .populate('communities', 'name displayName avatar');

        if (!bowl) {
            return errorResponse(res, 404, 'Bowl not found');
        }

        return successResponse(res, 200, { bowl }, 'Bowl retrieved');
    } catch (error) {
        next(error);
    }
};

export const joinBowl = async (req, res, next) => {
    try {
        const bowl = await Bowl.findById(req.params.id);

        if (!bowl) {
            return errorResponse(res, 404, 'Bowl not found');
        }

        if (bowl.members.includes(req.user._id)) {
            return errorResponse(res, 400, 'Already a member');
        }

        bowl.members.push(req.user._id);
        bowl.memberCount += 1;
        await bowl.save();

        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { joinedBowls: req.params.id }
        });

        return successResponse(res, 200, {}, 'Joined bowl');
    } catch (error) {
        next(error);
    }
};

export const leaveBowl = async (req, res, next) => {
    try {
        const bowl = await Bowl.findById(req.params.id);

        if (!bowl) {
            return errorResponse(res, 404, 'Bowl not found');
        }

        bowl.members = bowl.members.filter(
            id => id.toString() !== req.user._id.toString()
        );
        bowl.memberCount = Math.max(0, bowl.memberCount - 1);
        await bowl.save();

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { joinedBowls: req.params.id }
        });

        return successResponse(res, 200, {}, 'Left bowl');
    } catch (error) {
        next(error);
    }
};

export const getBowlPosts = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20, sort = 'new' } = req.query;
        const skip = (page - 1) * limit;

        // Check if id is a valid MongoDB ObjectId or a name
        const mongoose = await import('mongoose');
        const isValidObjectId = mongoose.default.Types.ObjectId.isValid(id);

        // Query by _id if valid ObjectId, otherwise query by name
        const bowlQuery = isValidObjectId ? { _id: id } : { name: id };

        // Verify bowl exists
        const bowl = await Bowl.findOne(bowlQuery);
        if (!bowl) {
            return errorResponse(res, 404, 'Bowl not found');
        }

        // Build query for posts
        const query = {
            bowl: bowl._id,
            isActive: true,
        };

        // For sorting by upvotes, we need to use aggregation
        const needsAggregation = sort === 'upvotes_desc' || sort === 'upvotes_asc';
        
        if (needsAggregation) {
            // Use aggregation pipeline to calculate vote score and sort
            const sortDirection = sort === 'upvotes_desc' ? -1 : 1;
            
            const aggregationPipeline = [
                { $match: query },
                {
                    $addFields: {
                        voteScore: {
                            $subtract: [
                                { $size: { $ifNull: ['$upvotes', []] } },
                                { $size: { $ifNull: ['$downvotes', []] } }
                            ]
                        },
                        upvoteCount: { $size: { $ifNull: ['$upvotes', []] } }
                    }
                },
                { $sort: { voteScore: sortDirection, createdAt: -1 } },
                { $skip: skip },
                { $limit: parseInt(limit) },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'author',
                        foreignField: '_id',
                        as: 'authorData'
                    }
                },
                {
                    $lookup: {
                        from: 'communities',
                        localField: 'community',
                        foreignField: '_id',
                        as: 'communityData'
                    }
                },
                {
                    $lookup: {
                        from: 'bowls',
                        localField: 'bowl',
                        foreignField: '_id',
                        as: 'bowlData'
                    }
                },
                {
                    $lookup: {
                        from: 'companies',
                        localField: 'companyTags',
                        foreignField: '_id',
                        as: 'companyTagsData'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        content: 1,
                        author: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: '$authorData',
                                        as: 'author',
                                        in: {
                                            _id: '$$author._id',
                                            username: '$$author.username',
                                            avatar: '$$author.avatar'
                                        }
                                    }
                                },
                                0
                            ]
                        },
                        community: {
                            $cond: {
                                if: { $eq: [{ $size: '$communityData' }, 0] },
                                then: null,
                                else: {
                                    $arrayElemAt: [
                                        {
                                            $map: {
                                                input: '$communityData',
                                                as: 'comm',
                                                in: {
                                                    _id: '$$comm._id',
                                                    name: '$$comm.name',
                                                    displayName: '$$comm.displayName',
                                                    avatar: '$$comm.avatar'
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            }
                        },
                        bowl: {
                            $cond: {
                                if: { $eq: [{ $size: '$bowlData' }, 0] },
                                then: null,
                                else: {
                                    $arrayElemAt: [
                                        {
                                            $map: {
                                                input: '$bowlData',
                                                as: 'bowlItem',
                                                in: {
                                                    _id: '$$bowlItem._id',
                                                    name: '$$bowlItem.name',
                                                    displayName: '$$bowlItem.displayName',
                                                    icon: '$$bowlItem.icon'
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            }
                        },
                        companyTags: {
                            $map: {
                                input: '$companyTagsData',
                                as: 'company',
                                in: {
                                    _id: '$$company._id',
                                    name: '$$company.name',
                                    ticker: '$$company.ticker',
                                    logo: '$$company.logo'
                                }
                            }
                        },
                        upvotes: 1,
                        downvotes: 1,
                        voteScore: 1,
                        viewCount: 1,
                        shareCount: 1,
                        bookmarkCount: 1,
                        commentCount: 1,
                        type: 1,
                        mediaUrl: 1,
                        linkUrl: 1,
                        bias: 1,
                        isPinned: 1,
                        isLocked: 1,
                        createdAt: 1,
                        updatedAt: 1
                    }
                }
            ];

            const [posts, totalResult] = await Promise.all([
                Post.aggregate(aggregationPipeline),
                Post.countDocuments(query)
            ]);

            return paginatedResponse(res, posts, parseInt(page), parseInt(limit), totalResult);
        } else {
            // Use regular find for other sort options
            let sortOption = {};
            if (sort === 'hot') {
                sortOption = { createdAt: -1 };
            } else if (sort === 'trending') {
                sortOption = { createdAt: -1 };
            } else if (sort === 'new') {
                sortOption = { createdAt: -1 };
            } else if (sort === 'top') {
                sortOption = { createdAt: -1 };
            }

            // Fetch posts
            const posts = await Post.find(query)
                .sort(sortOption)
                .limit(parseInt(limit))
                .skip(skip)
                .populate('author', 'username avatar')
                .populate('community', 'name displayName avatar')
                .populate('bowl', 'name displayName icon')
                .populate('companyTags', 'name ticker logo');

            const total = await Post.countDocuments(query);

            // Calculate vote scores
            const postsWithScores = posts.map(post => {
                const postObj = post.toObject();
                postObj.voteScore = post.upvotes.length - post.downvotes.length;
                return postObj;
            });

            return paginatedResponse(res, postsWithScores, parseInt(page), parseInt(limit), total);
        }
    } catch (error) {
        next(error);
    }
};
