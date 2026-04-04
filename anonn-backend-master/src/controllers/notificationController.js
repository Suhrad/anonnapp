import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Notification Controller
 * Handles notifications and device token management
 */

export const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const skip = (page - 1) * limit;

        let query = { recipient: req.user._id };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('sender', 'username avatar');

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false,
        });

        return successResponse(res, 200, {
            notifications,
            total,
            unreadCount
        }, 'Notifications retrieved');
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return errorResponse(res, 404, 'Notification not found');
        }

        if (notification.recipient.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'Not authorized');
        }

        await notification.markAsRead();

        return successResponse(res, 200, {}, 'Notification marked as read');
    } catch (error) {
        next(error);
    }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        return successResponse(res, 200, {}, 'All notifications marked as read');
    } catch (error) {
        next(error);
    }
};

export const subscribeDevice = async (req, res, next) => {
    try {
        const { deviceToken } = req.body;

        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { deviceTokens: deviceToken }
        });

        return successResponse(res, 200, {}, 'Device token subscribed');
    } catch (error) {
        next(error);
    }
};

export const unsubscribeDevice = async (req, res, next) => {
    try {
        const { deviceToken } = req.body;

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { deviceTokens: deviceToken }
        });

        return successResponse(res, 200, {}, 'Device token unsubscribed');
    } catch (error) {
        next(error);
    }
};

export const updateSettings = async (req, res, next) => {
    try {
        const { settings } = req.body;

        await User.findByIdAndUpdate(req.user._id, {
            notificationSettings: settings
        });

        return successResponse(res, 200, {}, 'Settings updated');
    } catch (error) {
        next(error);
    }
};
