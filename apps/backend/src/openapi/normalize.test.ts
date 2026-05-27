import { describe, expect, it } from "vitest";

import { normalizeOpenApiDocumentForGitBook } from "./normalize.js";

describe("normalizeOpenApiDocumentForGitBook", () => {
  it("converts JSON Schema null unions to OpenAPI 3 nullable schemas", () => {
    const document = {
      paths: {
        "/v1/example": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        id: { type: ["string", "null"], format: "uuid" },
                        count: { type: ["integer", "null"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(normalizeOpenApiDocumentForGitBook(document)).toEqual({
      paths: {
        "/v1/example": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          format: "uuid",
                          nullable: true,
                        },
                        count: {
                          type: "integer",
                          nullable: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it("converts JSON Schema const to OpenAPI-compatible enum values", () => {
    const document = {
      schema: {
        type: "object",
        properties: {
          accepted: { type: "boolean", const: true },
          schema_version: { type: "integer", const: 1, default: 1 },
        },
      },
    };

    expect(normalizeOpenApiDocumentForGitBook(document)).toEqual({
      schema: {
        type: "object",
        properties: {
          accepted: { type: "boolean", enum: [true] },
          schema_version: { type: "integer", enum: [1], default: 1 },
        },
      },
    });
  });
});
