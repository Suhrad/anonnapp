/**
 * Standardized API Response Utilities
 * Provides consistent response format across all endpoints
 */

/**
 * Send successful response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {Object} data - Response data
 * @param {String} message - Optional success message
 */
export const successResponse = (res, statusCode = 200, data = {}, message = 'Success') => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Error message
 * @param {Object} errors - Optional validation errors
 */
export const errorResponse = (res, statusCode = 500, message = 'Internal Server Error', errors = null) => {
    const response = {
        success: false,
        message,
    };

    if (errors) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @param {Number} total - Total count
 */
export const paginatedResponse = (res, data, page, limit, total) => {
    return res.status(200).json({
        success: true,
        data: {
            posts: data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        },
    });
};
