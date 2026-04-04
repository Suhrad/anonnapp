import PointEvent, { POINT_RULES, PointEventType } from '../models/PointEvent.js';
import User from '../models/User.js';

/**
 * Creates a point event and updates the user's points
 * @param {string} eventType - The type of event (from PointEventType)
 * @param {string|mongoose.Types.ObjectId} userId - The user ID
 * @param {string} referenceId - Optional reference ID (postId, pollId, commentId, etc.)
 * @returns {Promise<Object>} The created point event
 * @throws {Error} If event type is invalid, user not found, or database operation fails
 */
export async function createPointEvent(eventType, userId, referenceId = null) {
    // Validate event type
    if (!Object.values(PointEventType).includes(eventType)) {
        throw new Error(`Invalid event type: ${eventType}`);
    }

    // Get points value from rules
    const points = POINT_RULES[eventType];
    if (points === undefined) {
        throw new Error(`No point rule defined for event type: ${eventType}`);
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
    }

    // Create point event
    const pointEvent = new PointEvent({
        userId,
        type: eventType,
        referenceId: referenceId || undefined,
        points,
    });

    // Save point event and update user points atomically
    await pointEvent.save();
    
    // Update user points (increment or decrement based on points value)
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { points: points } },
        { new: true }
    );
    return pointEvent;
}

