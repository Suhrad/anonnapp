import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * Swagger/OpenAPI Configuration
 * Simple, working setup for API documentation
 */

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Anonn Backend API',
            version: '1.0.0',
            description: 'Web3 Social + Prediction Market Platform API',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: 'http://localhost:8000',
                description: 'Development server',
            },
            {
                url: 'https://your-production-url.com',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token',
                },
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentication required or invalid token',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', example: false },
                                    message: { type: 'string', example: 'Unauthorized' },
                                    errorCode: { type: 'string', example: 'UNAUTHORIZED' },
                                },
                            },
                        },
                    },
                },
                ValidationError: {
                    description: 'Validation failed',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', example: false },
                                    message: { type: 'string', example: 'Validation failed' },
                                    errorCode: { type: 'string', example: 'VALIDATION_ERROR' },
                                    errors: {
                                        type: 'object',
                                        additionalProperties: { type: 'string' },
                                        example: { name: 'Name is required' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false,
                        },
                        message: {
                            type: 'string',
                            example: 'Error message',
                        },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        message: {
                            type: 'string',
                        },
                        data: {
                            type: 'object',
                        },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
                        username: { type: 'string', example: 'john_doe' },
                        email: { type: 'string', example: 'john@example.com' },
                        authMethod: { type: 'string', example: 'email' },
                        primaryWallet: { type: 'string', example: 'wallet_address' },
                        avatar: { type: 'string', example: 'https://example.com/avatar.png' },
                        bio: { type: 'string', example: 'Web3 enthusiast' },
                        walletAddresses: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    address: { type: 'string', example: 'wallet_address' },
                                    chain: { type: 'string', example: 'solana' },
                                    isPrimary: { type: 'boolean', example: true },
                                    verified: { type: 'boolean', example: false },
                                },
                            },
                        },
                        followers: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109cb' },
                        },
                        following: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109cc' },
                        },
                        bookmarkedPosts: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109cd' },
                        },
                        bookmarkedPolls: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109ce' },
                        },
                        bookmarkedComments: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109cf' },
                        },
                        bookmarkedUsers: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109d0' },
                        },
                        joinedCommunities: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109d1' },
                        },
                        joinedBowls: {
                            type: 'array',
                            items: { type: 'string', example: '60d0fe4f5311236168a109d2' },
                        },
                        notificationSettings: {
                            type: 'object',
                            properties: {
                                email: { type: 'boolean', example: true },
                                push: { type: 'boolean', example: true },
                                comments: { type: 'boolean', example: true },
                                follows: { type: 'boolean', example: true },
                                mentions: { type: 'boolean', example: true },
                            },
                        },
                        deviceTokens: {
                            type: 'array',
                            items: { type: 'string', example: 'device_token' },
                        },
                        isActive: { type: 'boolean', example: true },
                        isVerified: { type: 'boolean', example: false },
                        createdAt: { type: 'string', format: 'date-time', example: '2023-01-01T00:00:00.000Z' },
                        updatedAt: { type: 'string', format: 'date-time', example: '2023-01-01T00:00:00.000Z' },
                    },
                },
                ValidationError: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Validation failed' },
                        errors: {
                            type: 'object',
                            additionalProperties: { type: 'string' },
                            example: { email: 'Email is invalid', username: 'Username already exists' },
                        },
                    },
                },
            },
        },
        tags: [
            { name: 'System', description: 'System health and info endpoints' },
            { name: 'Authentication', description: 'User authentication and authorization' },
            { name: 'Users', description: 'User profile and social features' },
            { name: 'Posts', description: 'Post creation and management' },
            { name: 'Polls', description: 'Poll creation and voting' },
            { name: 'Communities', description: 'Community management' },
            { name: 'Bowls', description: 'Bowl (category) management' },
            { name: 'Companies', description: 'Company tracking and markets' },
            { name: 'Markets', description: 'External market import and market discussions' },
            { name: 'Feed', description: 'Content feed endpoints' },
            { name: 'Notifications', description: 'User notifications' },
            { name: 'Wallet', description: 'Web3 wallet integration' },
        ],
    },
    apis: ['./src/routes/*.js', './src/server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

// Swagger UI options
const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Anonn API Docs',
};

export { swaggerSpec, swaggerUi, swaggerUiOptions };
