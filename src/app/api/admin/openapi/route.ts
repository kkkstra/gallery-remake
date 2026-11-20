import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Gallery Admin & Agent Full-Control API",
      version: "2.0.0",
      description:
        "Complete programmatic REST API covering 100% of Admin UI capabilities for AI Agents and CLIs: photos & multi-frame groups, homepage curation & ordering, collections & monograph spreads, EXIF uploads & S3 presigned uploads, server-side sharp image crop/mask for favicon & avatar, gear management & EXIF sync, forward/reverse geocoding, and site/about settings. Authenticate via `Authorization: Bearer <API_KEY>` or `X-API-Key: <API_KEY>`.",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
      schemas: {
        MonographBlock: {
          oneOf: [
            {
              type: "object",
              required: ["id", "kind", "style"],
              properties: {
                id: { type: "string" },
                kind: { type: "string", const: "cover" },
                style: { type: "string", enum: ["full", "split", "minimal"] },
                imageUrl: { type: "string" },
                eyebrow: { type: "string" },
                eyebrowEn: { type: "string" },
                title: { type: "string" },
                titleEn: { type: "string" },
                body: { type: "string" },
                bodyEn: { type: "string" },
              },
            },
            {
              type: "object",
              required: ["id", "kind", "photoId"],
              properties: {
                id: { type: "string" },
                kind: { type: "string", const: "photo" },
                photoId: { type: "integer" },
                sideNote: { type: "string" },
                sideNoteEn: { type: "string" },
                noteAlign: { type: "string", enum: ["left", "right"] },
              },
            },
          ],
        },
      },
    },
    paths: {
      "/api/admin/homepage": {
        get: {
          summary:
            "Get homepage curation config & effective ordered IDs for Featured Hero, Series/Collections, and Gallery Mosaic",
        },
        put: {
          summary:
            "Customize which items appear on the homepage and their exact display order (pass null for any field to reset to automatic default, or [] to hide that section)",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    featuredIds: {
                      type: ["array", "null"],
                      items: { type: "integer" },
                      description: "Ordered photo IDs for Homepage Hero Carousel (null = auto from featured flag)",
                    },
                    collectionIds: {
                      type: ["array", "null"],
                      items: { type: "integer" },
                      description: "Ordered collection IDs for Homepage Series section (null = all collections, [] = hide section)",
                    },
                    galleryIds: {
                      type: ["array", "null"],
                      items: { type: "integer" },
                      description: "Ordered photo IDs for Homepage Gallery Mosaic (null = auto latest 8 cards, [] = hide section)",
                    },
                  },
                },
              },
            },
          },
        },
        patch: {
          summary: "Partially update homepage curation (featuredIds, collectionIds, or galleryIds)",
        },
      },
      "/api/admin/photos": {
        get: {
          summary: "List all photos (including hidden) with full smart-filter support",
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "hidden", in: "query", schema: { type: "boolean" } },
            { name: "featured", in: "query", schema: { type: "boolean" } },
            { name: "groupId", in: "query", schema: { type: "string" } },
            { name: "nogps", in: "query", schema: { type: "boolean" } },
            { name: "unassigned", in: "query", schema: { type: "boolean" } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
        },
        post: {
          summary: "Create a photo entry from URL & metadata (supports groupId/groupOrder/groupExpanded)",
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
                    groupId: { type: "string", description: "Shared photo-group ID for multi-frame series" },
                    groupOrder: { type: "integer", description: "1-based frame index inside group" },
                    groupExpanded: { type: "boolean", description: "Whether group defaults to flat expanded in gallery" },
                    sortOrder: { type: "integer" },
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
          summary: "Reorder global photo display sequence",
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
          summary:
            "Batch update, delete, or manage photo groups (merge into numbered series, reorder frames, detach frame, or dissolve group)",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["action"],
                  properties: {
                    ids: { type: "array", items: { type: "integer" } },
                    groupId: { type: "string" },
                    metadataFromId: {
                      type: "integer",
                      description:
                        "For group_merge: ID of the photo whose title, description, category, and location/GPS should be kept across the merged group (defaults to ids[0]).",
                    },
                    action: {
                      type: "string",
                      enum: [
                        "category",
                        "featured",
                        "hidden",
                        "collection",
                        "delete",
                        "group_merge",
                        "group_reorder",
                        "group_remove",
                        "group_ungroup",
                      ],
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
        patch: {
          summary:
            "Update any subset of photo fields (if photo belongs to a groupId, shared fields title/description/category/location/lat/lng/groupExpanded/collectionIds automatically sync across all group siblings)",
        },
        delete: { summary: "Delete a photo and auto-normalize remaining group frame numbers" },
      },
      "/api/admin/upload": {
        post: {
          summary:
            "Upload binary image file (auto-extracts EXIF, dimensions & 24px WebP LQIP; supports groupId/groupOrder/groupExpanded for multi-photo series upload)",
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
                    groupId: { type: "string" },
                    groupOrder: { type: "string" },
                    groupExpanded: { type: "string", enum: ["true", "false"] },
                    location: { type: "string" },
                    locationEn: { type: "string" },
                    lat: { type: "string" },
                    lng: { type: "string" },
                    overrideExif: { type: "string", enum: ["true", "false"] },
                    collectionId: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/presign": {
        post: {
          summary: "Generate direct S3/R2 presigned PUT upload URL for large raw/high-res files",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["filename"],
                  properties: {
                    filename: { type: "string" },
                    contentType: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/asset": {
        post: {
          summary:
            "Upload or crop static brand asset (favicon / avatar) without polluting gallery photos. Supports server-side sharp crop, rotation, rounded/circle/square mask, and 1-step apply to site settings via multipart/form-data OR JSON sourceUrl.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sourceUrl"],
                  properties: {
                    sourceUrl: { type: "string", description: "Existing local path (/samples/...) or HTTPS image URL" },
                    target: { type: "string", enum: ["favicon", "avatar", "raw"] },
                    shape: { type: "string", enum: ["rounded", "circle", "square"] },
                    rotate: { type: "integer", enum: [0, 90, 180, 270] },
                    crop: {
                      type: "object",
                      properties: {
                        left: { type: "integer" },
                        top: { type: "integer" },
                        width: { type: "integer" },
                        height: { type: "integer" },
                      },
                    },
                    apply: { type: "boolean", description: "If true, directly updates faviconUrl or avatarUrl in site settings" },
                  },
                },
              },
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    target: { type: "string", enum: ["favicon", "avatar", "raw"] },
                    shape: { type: "string", enum: ["rounded", "circle", "square"] },
                    rotate: { type: "string" },
                    cropLeft: { type: "string" },
                    cropTop: { type: "string" },
                    cropWidth: { type: "string" },
                    cropHeight: { type: "string" },
                    apply: { type: "string", enum: ["true", "false"] },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/collections": {
        get: { summary: "List all collections with photos and monograph blocksJson" },
        post: {
          summary: "Create a new collection / monograph",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug", "title"],
                  properties: {
                    slug: { type: "string" },
                    title: { type: "string" },
                    titleEn: { type: "string" },
                    period: { type: "string" },
                    coverUrl: { type: "string" },
                    description: { type: "string" },
                    descriptionEn: { type: "string" },
                    photoIds: { type: "array", items: { type: "integer" } },
                    blocksJson: {
                      type: "string",
                      description: "JSON-serialized array of MonographBlock items",
                    },
                  },
                },
              },
            },
          },
        },
        put: { summary: "Reorder collections ({ orderedIds: number[] })" },
      },
      "/api/admin/collections/{id}": {
        get: { summary: "Get collection details" },
        patch: { summary: "Update collection metadata, photoIds, or monograph blocksJson" },
        delete: { summary: "Delete collection (preserves underlying photos)" },
      },
      "/api/admin/gear": {
        get: { summary: "List camera & lens gear items with photo usage counts" },
        post: {
          summary:
            "Add a gear item ({ type, brand, name, specs, note, noteEn }) OR pass { action: 'sync_from_exif' } to auto-import all cameras & lenses from photo EXIF",
        },
        put: { summary: "Reorder gear items ({ orderedIds: number[] })" },
        patch: { summary: "Partially update a gear item ({ id, ...fields })" },
        delete: { summary: "Delete a gear item (?id=<id> or JSON { id })" },
      },
      "/api/admin/geocode": {
        get: {
          summary: "Forward city geocoding (?q=京都) OR reverse coordinate geocoding (?lat=35.01&lng=135.76)",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "lat", in: "query", schema: { type: "number" } },
            { name: "lng", in: "query", schema: { type: "number" } },
          ],
        },
      },
      "/api/admin/settings": {
        get: { summary: "Read all site, branding, homepage & about settings" },
        put: {
          summary:
            "Update any site settings (e.g. siteTitle, siteDescription, faviconUrl, avatarUrl, photographerName, photographerNameEn, bio, tagline, email, copyrightGuard, showShootingStats, homeFeaturedIds, homeCollectionIds, homeGalleryIds, aboutFocus / aboutFocusJson, aboutMilestones / aboutMilestonesJson, apiKey)",
        },
        patch: { summary: "Alias for PUT — partially update site settings" },
      },
    },
  });
}
