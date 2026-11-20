import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Gallery Admin & Agent Management API",
      version: "1.0.0",
      description:
        "Programmatic REST API for AI Agents and CLIs to manage photos, uploads, collections, gear, and site settings. Authenticate via `Authorization: Bearer <API_KEY>` or `X-API-Key: <API_KEY>`.",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
    paths: {
      "/api/admin/photos": {
        get: {
          summary: "List all photos (including hidden)",
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "hidden", in: "query", schema: { type: "boolean" } },
            { name: "featured", in: "query", schema: { type: "boolean" } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
        },
        post: {
          summary: "Create a photo entry from URL & metadata",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "url"],
                  properties: {
                    title: { type: "string" },
                    titleEn: { type: "string" },
                    description: { type: "string" },
                    descriptionEn: { type: "string" },
                    url: { type: "string" },
                    width: { type: "integer" },
                    height: { type: "integer" },
                    ambient: { type: "string" },
                    blurData: { type: "string" },
                    category: { type: "string" },
                    featured: { type: "boolean" },
                    hidden: { type: "boolean" },
                    takenAt: { type: "string" },
                    location: { type: "string" },
                    locationEn: { type: "string" },
                    lat: { type: "number", nullable: true },
                    lng: { type: "number", nullable: true },
                    camera: { type: "string" },
                    lens: { type: "string" },
                    focalMm: { type: "integer", nullable: true },
                    aperture: { type: "string" },
                    shutter: { type: "string" },
                    iso: { type: "integer", nullable: true },
                    collectionIds: { type: "array", items: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
        put: {
          summary: "Reorder photos",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["orderedIds"],
                  properties: { orderedIds: { type: "array", items: { type: "integer" } } },
                },
              },
            },
          },
        },
        patch: {
          summary: "Batch update or delete photos",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ids", "action"],
                  properties: {
                    ids: { type: "array", items: { type: "integer" } },
                    action: {
                      type: "string",
                      enum: ["category", "featured", "hidden", "collection", "delete"],
                    },
                    value: {},
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/photos/{id}": {
        get: { summary: "Get single photo details & collectionIds" },
        patch: { summary: "Update any subset of photo fields (including hidden, lat, lng, collectionIds)" },
        delete: { summary: "Delete a photo" },
      },
      "/api/admin/upload": {
        post: {
          summary: "Upload binary image file (auto-extracts EXIF, dimensions & 24px WebP LQIP)",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    title: { type: "string" },
                    titleEn: { type: "string" },
                    description: { type: "string" },
                    descriptionEn: { type: "string" },
                    category: { type: "string" },
                    featured: { type: "string", enum: ["true", "false"] },
                    hidden: { type: "string", enum: ["true", "false"] },
                    collectionId: { type: "string" },
                    location: { type: "string" },
                    locationEn: { type: "string" },
                    lat: { type: "string" },
                    lng: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/presign": {
        post: { summary: "Generate presigned S3/R2 PUT URL for large direct uploads" },
      },
      "/api/admin/collections": {
        get: { summary: "List all series collections with photos" },
        post: { summary: "Create a series collection" },
        put: { summary: "Reorder collections via orderedIds" },
      },
      "/api/admin/collections/{id}": {
        get: { summary: "Get single collection details" },
        patch: { summary: "Update collection metadata, photoIds, or monograph blocksJson" },
        delete: { summary: "Delete collection" },
      },
      "/api/admin/gear": {
        get: { summary: "List all camera & lens gear items" },
        post: { summary: "Add gear item" },
        patch: { summary: "Update gear item" },
        delete: { summary: "Delete gear item via ?id=" },
      },
      "/api/admin/settings": {
        get: { summary: "Get all site & about page settings" },
        put: { summary: "Update site & about page key-value settings" },
      },
      "/api/admin/geocode": {
        get: { summary: "Geocode a place name via ?q=" },
      },
    },
  });
}
