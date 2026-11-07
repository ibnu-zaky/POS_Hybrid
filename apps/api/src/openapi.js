const { z } = require("zod");
const { createTransactionSchema } = require("./schemas/pos.schema");

function getOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "POS Hybrid API",
      version: "1.0.0",
    },
    paths: {
      "/auth/login": {
        post: {
          summary: "Login",
          responses: { "200": { description: "OK" } },
        },
      },
      "/pos/transactions": {
        post: {
          summary: "Create transaction",
          requestBody: {
            content: {
              "application/json": {
                schema: z.toJSONSchema(createTransactionSchema),
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/admin/inventory": {
        get: {
          summary: "List inventory",
          responses: { "200": { description: "OK" } },
        },
        post: {
          summary: "Create inventory",
          responses: { "201": { description: "Created" } },
        },
      },
    },
  };
}

module.exports = { getOpenApiSpec };
