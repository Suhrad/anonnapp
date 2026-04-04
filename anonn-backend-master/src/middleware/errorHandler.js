import { ErrorCodes, ErrorMessages } from '../utils/errorCodes.js';

/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent error response
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log to console for dev
    console.error(err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = `Resource not found`;
        error = {
            success: false,
            statusCode: 404,
            message,
            errorCode: ErrorCodes.RESOURCE_NOT_FOUND
        };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = {
            success: false,
            statusCode: 400,
            message,
            errorCode: ErrorCodes.RESOURCE_ALREADY_EXISTS
        };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = {
            success: false,
            statusCode: 400,
            message,
            errorCode: ErrorCodes.VALIDATION_ERROR
        };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Server Error',
        errorCode: error.errorCode || ErrorCodes.INTERNAL_SERVER_ERROR,
        requestId: req.id, // Include Request ID
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

export default errorHandler;
