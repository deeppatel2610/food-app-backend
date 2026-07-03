const swaggerJSDoc = require("swagger-jsdoc");
const envVariables = require("../utils/envVariables");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Food App Backend API Documentation",
      version: "1.0.0",
      description:
        "Comprehensive API Documentation for Food App Backend including Authentication, User Management, Rate Limiting, and Standardized Responses.",
    },
    servers: [
      {
        url: `http://${envVariables.HOST}:${envVariables.PORT}/api`,
        description: "Network Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        RegisterRequest: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            first_name: { type: "string", example: "John" },
            last_name: { type: "string", example: "Doe" },
            username: { type: "string", example: "johndoe" },
            email: { type: "string", example: "john@example.com" },
            password: { type: "string", example: "secret123" },
            age: { type: "integer", example: 25 },
            weight: { type: "number", format: "float", example: 70.5 },
            height: { type: "number", format: "float", example: 175.0 },
            blood_group: { type: "string", example: "O+" },
            health_problem: { type: "string", example: "None" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["password"],
          properties: {
            identifier: {
              type: "string",
              example: "johndoe",
              description: "Username or Email",
            },
            password: { type: "string", example: "secret123" },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Operation completed successfully",
            },
            data: { type: "object", nullable: true },
            timestamp: { type: "string", example: "2026-06-29T15:58:00.000Z" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./src/controller/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
