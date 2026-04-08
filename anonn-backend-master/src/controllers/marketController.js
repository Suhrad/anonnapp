import mongoose from 'mongoose';
import ExternalMarket from '../models/ExternalMarket.js';
import MarketDiscussionMessage from '../models/MarketDiscussionMessage.js';
import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import User from '../models/User.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { getSupabase, queryMarkets, queryEvents, getTrending } from '../db/supabase.js';

const POLYMARKET_BASE_URL = process.env.POLYMARKET_BASE_URL || 'https://gamma-api.polymarket.com';

const parseNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizeProbability = (value) => {
    if (value === null || value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    if (n > 1) return Math.min(1, Math.max(0, n / 100));
    return Math.min(1, Math.max(0, n));
};

const extractPolymarketSlugFromUrl = (urlString = '') => {
    try {
        const url = new URL(urlString);
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 0) return null;
        const eventIndex = parts.findIndex((part) => part === 'event');
        if (eventIndex !== -1 && parts[eventIndex + 1]) return parts[eventIndex + 1];
        return parts[parts.length - 1];
    } catch {
        return null;
    }
};

const mapPolymarketMarket = (raw, fallback = {}) => {
    const outcomesRaw = raw.outcomes || raw.tokens || [];
    const outcomes = Array.isArray(outcomesRaw)
        ? outcomesRaw.map((outcome) => ({
            label: String(
                outcome.outcome ??
                outcome.name ??
                outcome.label ??
                ''
            ).trim(),
            probability: normalizeProbability(outcome.probability ?? outcome.price ?? outcome.lastPrice),
            price: normalizeProbability(outcome.price ?? outcome.lastPrice ?? outcome.probability),
        })).filter((o) => o.label)
        : [];

    const yesOutcome = outcomes.find((o) => o.label.toLowerCase() === 'yes');

    const rawTitle = String(raw.question ?? raw.title ?? fallback.title ?? '');
    const rawDesc  = String(raw.description || fallback.description || '');
    return {
        source: 'polymarket',
        externalId: String(raw.id ?? raw.conditionId ?? raw.questionID ?? fallback.externalId ?? fallback.slug),
        slug: String(raw.slug ?? fallback.slug ?? ''),
        url: raw.url || fallback.url || (raw.slug ? `https://polymarket.com/event/${raw.slug}` : undefined),
        title: rawTitle.slice(0, 490),
        description: rawDesc.slice(0, 4900),
        outcomes,
        probabilityYes: yesOutcome?.probability,
        liquidity: parseNumber(raw.liquidity ?? raw.liquidityNum),
        volume24h: parseNumber(raw.volume24hr ?? raw.oneDayVolume ?? raw.volume24h),
        totalVolume: parseNumber(raw.volume ?? raw.totalVolume),
        closeTime: raw.endDate || raw.endDateIso || raw.closedTime || raw.closeTime,
        status: raw.closed || raw.active === false ? 'closed' : 'active',
        raw,
    };
};

const fetchPolymarketById = async (externalId) => {
    const response = await fetch(`${POLYMARKET_BASE_URL}/markets/${encodeURIComponent(externalId)}`);
    if (!response.ok) return null;
    return response.json();
};

const fetchPolymarketBySlug = async (slug) => {
    const response = await fetch(`${POLYMARKET_BASE_URL}/markets?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
};

const fetchPolymarketEventBySlug = async (slug) => {
    const response = await fetch(`${POLYMARKET_BASE_URL}/events?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
};

const resolvePolymarketImport = async ({ externalId, slug, url, title, description }) => {
    const effectiveSlug = slug || extractPolymarketSlugFromUrl(url || '');
    let raw = null;

    if (externalId) {
        raw = await fetchPolymarketById(externalId);
    }

    if (!raw && effectiveSlug) {
        raw = await fetchPolymarketBySlug(effectiveSlug);
    }

    if (!raw && effectiveSlug) {
        const event = await fetchPolymarketEventBySlug(effectiveSlug);
        raw = event?.markets?.[0] || event;
    }

    if (!raw) {
        return {
            source: 'polymarket',
            externalId: String(externalId || effectiveSlug || `manual-${Date.now()}`),
            slug: effectiveSlug || '',
            url: url || (effectiveSlug ? `https://polymarket.com/event/${effectiveSlug}` : undefined),
            title: title || '',
            description: description || '',
            outcomes: [],
            probabilityYes: undefined,
            liquidity: 0,
            volume24h: 0,
            totalVolume: 0,
            closeTime: undefined,
            status: 'active',
            raw: null,
        };
    }

    return mapPolymarketMarket(raw, { externalId, slug: effectiveSlug, url, title, description });
};

export const importMarket = async (req, res, next) => {
    try {
        const {
            source = 'polymarket',
            externalId,
            slug,
            url,
            title,
            description,
            outcomes,
            probabilityYes,
            liquidity,
            volume24h,
            totalVolume,
            closeTime,
            status,
            icon,
        } = req.body || {};

        if (!['polymarket', 'manifold', 'kalshi', 'manual'].includes(source)) {
            return errorResponse(res, 400, 'Unsupported market source');
        }

        let normalized;

        if (source === 'polymarket') {
            normalized = await resolvePolymarketImport({ externalId, slug, url, title, description });
        } else {
            normalized = {
                source,
                externalId: String(externalId || slug || `manual-${Date.now()}`),
                slug: slug || '',
                url,
                title: title || '',
                description: description || '',
                outcomes: Array.isArray(outcomes) ? outcomes : [],
                probabilityYes: normalizeProbability(probabilityYes),
                liquidity: parseNumber(liquidity),
                volume24h: parseNumber(volume24h),
                totalVolume: parseNumber(totalVolume),
                closeTime,
                status: status || 'active',
                raw: null,
            };
        }

        if (!normalized.externalId || !normalized.title) {
            return errorResponse(res, 400, 'Unable to import market. Provide a valid market URL/ID or title.');
        }

        // Merge caller-supplied metadata as fallbacks when the live API couldn't supply them.
        // This ensures Supabase-sourced markets (passed in via the quote flow) retain their
        // probabilityYes, volume24h, and icon even when the Gamma API is unreachable.
        const mergedNormalized = {
            ...normalized,
            probabilityYes: normalized.probabilityYes ?? normalizeProbability(probabilityYes),
            volume24h:      normalized.volume24h      || parseNumber(volume24h),
            liquidity:      normalized.liquidity      || parseNumber(liquidity),
            totalVolume:    normalized.totalVolume    || parseNumber(totalVolume),
            closeTime:      normalized.closeTime      || closeTime,
            // icon comes from raw Gamma data (m.icon) — add it explicitly
            icon: (normalized.raw && normalized.raw.icon) || icon || undefined,
        };

        const market = await ExternalMarket.findOneAndUpdate(
            { source: mergedNormalized.source, externalId: mergedNormalized.externalId },
            {
                $set: {
                    ...mergedNormalized,
                    lastSyncedAt: new Date(),
                    isActive: true,
                },
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        return successResponse(res, 200, { market }, 'Market imported successfully');
    } catch (error) {
        next(error);
    }
};

export const searchMarkets = async (req, res, next) => {
    try {
        const {
            q = '',
            source,
            status = 'active',
            page = 1,
            limit = 100,
        } = req.query;

        const pageNum  = Number(page);
        const limitNum = Number(limit);
        const offset   = (pageNum - 1) * limitNum;

        // ── Try Supabase first ───────────────────────────────────────────────
        const result = await queryMarkets({
            source: source || 'polymarket',
            search: q ? q.trim() : '',
            limit: limitNum,
            offset,
        });

        if (result && result.markets && result.markets.length > 0) {
            return paginatedResponse(res, result.markets, pageNum, limitNum, result.total);
        }

        // ── Fall back to MongoDB ─────────────────────────────────────────────
        const skip  = offset;
        const query = { isActive: true };
        if (source) query.source = source;
        if (status && status !== 'all') query.status = status;
        if (q && q.trim()) {
            query.$or = [
                { title:       { $regex: q.trim(), $options: 'i' } },
                { description: { $regex: q.trim(), $options: 'i' } },
                { slug:        { $regex: q.trim(), $options: 'i' } },
            ];
        }

        const markets = await ExternalMarket.find(query)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limitNum);
        const total = await ExternalMarket.countDocuments(query);

        return paginatedResponse(res, markets, pageNum, limitNum, total);
    } catch (error) {
        next(error);
    }
};

export const getMarket = async (req, res, next) => {
    try {
        const market = await ExternalMarket.findById(req.params.id);
        if (!market || !market.isActive) {
            return errorResponse(res, 404, 'Market not found');
        }

        const [postCount, pollCount, discussionCount, followerCount] = await Promise.all([
            Post.countDocuments({ attachedMarket: market._id, isActive: true }),
            Poll.countDocuments({ attachedMarket: market._id, isActive: true }),
            MarketDiscussionMessage.countDocuments({ market: market._id, isActive: true }),
            User.countDocuments({ followedMarkets: market._id }),
        ]);

        return successResponse(res, 200, {
            market,
            stats: { postCount, pollCount, discussionCount, followerCount },
        }, 'Market retrieved');
    } catch (error) {
        next(error);
    }
};

export const getMarketPosts = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const posts = await Post.find({
            attachedMarket: req.params.id,
            isActive: true,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('author', 'username avatar')
            .populate('community', 'name displayName avatar')
            .populate('companyTags', 'name ticker logo')
            .populate('attachedMarket');

        const total = await Post.countDocuments({
            attachedMarket: req.params.id,
            isActive: true,
        });

        return paginatedResponse(res, posts, Number(page), Number(limit), total);
    } catch (error) {
        next(error);
    }
};

export const getMarketPolls = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const polls = await Poll.find({
            attachedMarket: req.params.id,
            isActive: true,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('author', 'username avatar')
            .populate('community', 'name displayName')
            .populate('company', 'name ticker logo')
            .populate('attachedMarket');

        const total = await Poll.countDocuments({
            attachedMarket: req.params.id,
            isActive: true,
        });

        const pollsWithResults = polls.map((poll) => ({
            ...poll.toObject(),
            results: poll.getResults(),
            totalVotes: poll.totalVotes,
        }));

        return paginatedResponse(res, pollsWithResults, Number(page), Number(limit), total);
    } catch (error) {
        next(error);
    }
};

export const getMarketDiscussion = async (req, res, next) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const messages = await MarketDiscussionMessage.find({
            market: req.params.id,
            isActive: true,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('author', 'username avatar');

        const total = await MarketDiscussionMessage.countDocuments({
            market: req.params.id,
            isActive: true,
        });

        return paginatedResponse(res, messages, Number(page), Number(limit), total);
    } catch (error) {
        next(error);
    }
};

export const createMarketDiscussionMessage = async (req, res, next) => {
    try {
        const { content, parentMessage } = req.body;
        if (!content || !content.trim()) {
            return errorResponse(res, 400, 'Message content is required');
        }

        const marketExists = await ExternalMarket.findById(req.params.id).select('_id');
        if (!marketExists) {
            return errorResponse(res, 404, 'Market not found');
        }

        let parentMessageId = null;
        if (parentMessage) {
            if (!mongoose.Types.ObjectId.isValid(parentMessage)) {
                return errorResponse(res, 400, 'Invalid parent message ID');
            }

            const existingParent = await MarketDiscussionMessage.findById(parentMessage).select('_id market');
            if (!existingParent || existingParent.market.toString() !== req.params.id) {
                return errorResponse(res, 400, 'Invalid parent message');
            }
            parentMessageId = existingParent._id;
        }

        const message = await MarketDiscussionMessage.create({
            market: req.params.id,
            author: req.user._id,
            content: content.trim(),
            parentMessage: parentMessageId,
        });

        const populatedMessage = await MarketDiscussionMessage.findById(message._id)
            .populate('author', 'username avatar');

        return successResponse(res, 201, { message: populatedMessage }, 'Discussion message created');
    } catch (error) {
        next(error);
    }
};

export const getTrendingMarkets = async (req, res, next) => {
    try {
        // ── Try Supabase first ───────────────────────────────────────────────
        const markets = await getTrending(20);
        if (markets.length > 0) {
            return successResponse(res, 200, { markets }, 'Trending markets fetched');
        }

        // ── Fall back: call Gamma API directly ───────────────────────────────
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let response;
        try {
            response = await fetch(
                `${POLYMARKET_BASE_URL}/markets?active=true&closed=false&limit=20&order=volume24hr&ascending=false`,
                { signal: controller.signal }
            );
        } finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            return successResponse(res, 200, { markets: [] }, 'No trending markets available');
        }
        const raw = await response.json();
        const rawList = Array.isArray(raw) ? raw : (raw.markets || raw.data || []);
        const normalized = rawList.slice(0, 20).map((m) => ({
            id:             m.id || m.conditionId,
            title:          m.question || m.title || '',
            slug:           m.slug || '',
            icon:           m.image || m.icon || null,
            probabilityYes: normalizeProbability(
                m.outcomePrices
                    ? JSON.parse(m.outcomePrices)[0]
                    : (m.bestBid ?? m.lastTradedPrice ?? m.probability)
            ),
            volume24h:      parseNumber(m.volume24hr ?? m.oneDayVolume ?? m.volume24h),
            liquidity:      parseNumber(m.liquidity ?? m.liquidityNum),
            endDate:        m.endDate || m.endDateIso || null,
            url:            m.url || (m.slug ? `https://polymarket.com/event/${m.slug}` : null),
        }));
        return successResponse(res, 200, { markets: normalized }, 'Trending markets fetched');
    } catch (error) {
        next(error);
    }
};

export const followMarket = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return errorResponse(res, 400, 'Invalid market ID');
        }

        const market = await ExternalMarket.findById(req.params.id).select('_id isActive');
        if (!market || !market.isActive) {
            return errorResponse(res, 404, 'Market not found');
        }

        const user = await User.findById(req.user._id).select('followedMarkets');
        const isFollowing = user.followedMarkets.some((id) => id.toString() === req.params.id);

        if (isFollowing) {
            await User.findByIdAndUpdate(req.user._id, {
                $pull: { followedMarkets: req.params.id },
            });
            return successResponse(res, 200, { following: false }, 'Market unfollowed');
        }

        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { followedMarkets: req.params.id },
        });
        return successResponse(res, 200, { following: true }, 'Market followed');
    } catch (error) {
        next(error);
    }
};

export const searchEvents = async (req, res, next) => {
    try {
        const {
            q = '',
            page = 1,
            limit = 50,
        } = req.query;

        const pageNum  = Number(page);
        const limitNum = Number(limit);
        const offset   = (pageNum - 1) * limitNum;

        const result = await queryEvents({
            search: q ? q.trim() : '',
            limit:  limitNum,
            offset,
        });

        return paginatedResponse(res, result.events, pageNum, limitNum, result.total);
    } catch (error) {
        next(error);
    }
};
