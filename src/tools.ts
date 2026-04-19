/**
 * Shared tool definitions and implementations for both stdio and HTTP transports.
 * The apiKey is per-request in HTTP mode, per-process in stdio mode.
 */

import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export const BASE_URL = process.env.KLAMDO_BASE_URL ?? "https://klamdo.app";

export async function klamdo<T>(
  path: string,
  apiKey: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/mcp${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Invalid API key. Get your key at https://klamdo.app/profile"
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Klamdo API error ${res.status}: ${text.slice(0, 200)}`
    );
  }

  return res.json() as Promise<T>;
}

export const TOOLS = [
  {
    name: "generate_image",
    description:
      "Generate a 4K identity-locked image using the user's reference photo on Klamdo. " +
      "Returns a job ID — use check_job to poll for the result. Costs 3 credits.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Describe the content you want to generate. Be specific about setting, mood, style, and purpose."
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16"],
          description: "Output aspect ratio. Default: 1:1 (square).",
          default: "1:1"
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generate_video",
    description:
      "Generate a 5-second vertical identity-locked video on Klamdo. " +
      "Requires a startFrameAssetId from upload_start_frame. If omitted, falls back to image generation. Costs 6 credits.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Describe the video content with motion cues for best results."
        },
        startFrameAssetId: {
          type: "string",
          description: "Asset ID returned by upload_start_frame. Required for video; without it an image is generated instead."
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "upload_start_frame",
    description:
      "Upload a start-frame image for video generation. Provide a public HTTPS image URL — " +
      "Klamdo fetches it, stores it, and returns an assetId you pass to generate_video.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: {
          type: "string",
          description: "Public HTTPS URL of the image to use as the video start frame. Max 10MB."
        }
      },
      required: ["imageUrl"]
    }
  },
  {
    name: "check_job",
    description: "Check the status of a Klamdo generation job. Returns status and download URLs when complete.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID returned from generate_image or generate_video." }
      },
      required: ["jobId"]
    }
  },
  {
    name: "get_account",
    description: "Get current Klamdo account status: credit balance, plan tier, and free sample eligibility.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false }
  },
  {
    name: "list_jobs",
    description: "List recent Klamdo generation jobs for this account, ordered newest first.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of jobs to return. Default: 10, max: 50.",
          default: 10
        }
      }
    }
  },
  {
    name: "list_packages",
    description: "List Klamdo's available agentic packages, including expected deliverables and required plan tier.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        accessibleOnly: {
          type: "boolean",
          description: "When true, returns only packages accessible on the user's current plan tier. Default: false (returns all packages with an 'accessible' flag on each).",
          default: false
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "create_package",
    description: "Create a Klamdo agentic package job from a business prompt and get back a package ID plus manifest URL.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        packageType: {
          type: "string",
          enum: ["digital-marketing", "social-media", "ugc-ad", "coaching-brand", "product-launch", "content-repurpose", "motion-control", "faceless-content", "build-your-own-ai"],
          description: "The Klamdo package to create."
        },
        prompt: {
          type: "string",
          description: "High-level business prompt describing the package goal."
        },
        niche: {
          type: "string",
          description: "Optional niche or audience hint."
        },
        aspectRatio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1"],
          description: "Preferred output aspect ratio. Packages currently support 16:9 and 9:16."
        },
        avatarDurationSeconds: {
          type: "number",
          enum: [30, 60, 90, 180],
          description: "Optional avatar-video duration for packages that include avatar outputs."
        },
        characterType: {
          type: "string",
          enum: ["realistic", "anime", "cartoon", "fantasy", "cyber", "3d"],
          description: "Required for build-your-own-ai packages. Controls the character style and image model."
        },
        uploadedAssetIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional Klamdo asset IDs or URLs to feed into the package."
        },
        options: {
          type: "object",
          properties: {
            useReferencePack: { type: "boolean" },
            skipVoiceover: { type: "boolean" }
          }
        }
      },
      required: ["packageType", "prompt"]
    }
  },
  {
    name: "get_package",
    description: "Get the status, progress, and deliverable counts for a Klamdo package job.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        packageId: { type: "string", description: "The package ID returned by create_package." }
      },
      required: ["packageId"]
    }
  },
  {
    name: "get_package_manifest",
    description: "Fetch the structured package manifest for downstream agent execution.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        packageId: { type: "string", description: "The package ID returned by create_package." }
      },
      required: ["packageId"]
    }
  }
];

export function registerHandlers(server: Server, getApiKey: () => string) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const input = (args ?? {}) as Record<string, unknown>;
    const apiKey = getApiKey();

    if (!apiKey) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "No API key provided. Set KLAMDO_API_KEY or pass it via Authorization header."
      );
    }

    try {
      switch (name) {
        case "generate_image": {
          const result = await klamdo<{ jobId: string; status: string; creditsReserved: number }>(
            "/jobs",
            apiKey,
            { prompt: input.prompt, mode: "image", aspectRatio: input.aspectRatio ?? "1:1" }
          );
          return {
            content: [
              {
                type: "text",
                text: `Image generation started.\n\nJob ID: ${result.jobId}\nStatus: ${result.status}\nCredits reserved: ${result.creditsReserved}\n\nUse check_job("${result.jobId}") to get the result. Images typically complete in 30–90 seconds.`
              }
            ]
          };
        }

        case "generate_video": {
          const startFrameAssetId = input.startFrameAssetId ? String(input.startFrameAssetId) : "";
          const isRealVideo = !!startFrameAssetId;

          const result = await klamdo<{ jobId: string; status: string; creditsReserved: number }>(
            "/jobs",
            apiKey,
            {
              prompt: input.prompt,
              mode: isRealVideo ? "video" : "image",
              aspectRatio: "9:16",
              ...(isRealVideo ? { startFrameAssetId } : {}),
            }
          );

          const modeLabel = isRealVideo ? "Video" : "Image (no start frame provided)";
          const timing = isRealVideo
            ? "Videos typically complete in 2–5 minutes."
            : "Images typically complete in 30–90 seconds. To generate a video, use upload_start_frame first.";

          return {
            content: [
              {
                type: "text",
                text: `${modeLabel} generation started.\n\nJob ID: ${result.jobId}\nStatus: ${result.status}\nCredits reserved: ${result.creditsReserved}\n\n${timing}\n\nUse check_job("${result.jobId}") to get the result.`
              }
            ]
          };
        }

        case "upload_start_frame": {
          const imageUrl = String(input.imageUrl ?? "");
          if (!imageUrl) throw new McpError(ErrorCode.InvalidParams, "imageUrl is required");

          const result = await klamdo<{ assetId: string; url: string; fileName: string }>(
            "/upload-frame",
            apiKey,
            { imageUrl }
          );

          return {
            content: [
              {
                type: "text",
                text: `Start frame uploaded.\n\nAsset ID: ${result.assetId}\nFile: ${result.fileName}\n\nPass this assetId to generate_video:\n  generate_video({ prompt: "...", startFrameAssetId: "${result.assetId}" })`
              }
            ]
          };
        }

        case "check_job": {
          const jobId = String(input.jobId ?? "");
          if (!jobId) throw new McpError(ErrorCode.InvalidParams, "jobId is required");

          const result = await klamdo<{
            status: string;
            assets: Array<{ kind: string; url: string }>;
            errorMessage?: string;
            caption?: string;
          }>(`/jobs/${jobId}`, apiKey);

          if (result.status === "completed") {
            const imageAsset = result.assets.find((a) => a.kind === "image");
            const videoAsset = result.assets.find((a) => a.kind === "video");
            const lines = [
              `Job ${jobId} — Completed ✓`,
              "",
              imageAsset ? `Image URL: ${imageAsset.url}` : null,
              videoAsset ? `Video URL: ${videoAsset.url}` : null,
              result.caption ? `\nSuggested caption:\n${result.caption}` : null,
              "",
              `Share page: ${BASE_URL}/share/${jobId}`
            ].filter(Boolean);
            return { content: [{ type: "text", text: lines.join("\n") }] };
          }

          if (result.status === "failed") {
            return {
              content: [
                {
                  type: "text",
                  text: `Job ${jobId} failed: ${result.errorMessage ?? "Unknown error"}. Credits have been refunded.`
                }
              ]
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `Job ${jobId} is still running (status: ${result.status}). Check again in 15–30 seconds.`
              }
            ]
          };
        }

        case "get_account": {
          const result = await klamdo<{
            name: string;
            email: string;
            availableCredits: number;
            planTier: string;
            freeSampleEligible: boolean;
          }>("/account", apiKey);
          return {
            content: [
              {
                type: "text",
                text: [
                  `Klamdo Account: ${result.name} (${result.email})`,
                  `Plan: ${result.planTier}`,
                  `Credits: ${result.availableCredits}`,
                  result.freeSampleEligible ? "Free sample: available" : ""
                ].filter(Boolean).join("\n")
              }
            ]
          };
        }

        case "list_jobs": {
          const limit = Math.min(Number(input.limit ?? 10), 50);
          const result = await klamdo<{
            jobs: Array<{ id: string; status: string; mode: string; prompt: string; createdAt: string }>;
          }>(`/jobs?limit=${limit}`, apiKey);
          const lines = result.jobs.map(
            (j) => `[${j.status}] ${j.id} — ${j.mode} — "${j.prompt.slice(0, 60)}" (${j.createdAt.slice(0, 10)})`
          );
          return {
            content: [{ type: "text", text: lines.length ? lines.join("\n") : "No jobs found." }]
          };
        }

        case "list_packages": {
          const result = await klamdo<{
            planTier: string;
            subscriptionActive: boolean;
            packages: Array<{
              id: string;
              label: string;
              minTier: string;
              estimatedCredits: number;
              accessible: boolean;
              expectedOutputs: {
                textRoles: string[];
                mediaRoles: string[];
                documentRoles: string[];
              };
            }>;
          }>("/packages", apiKey);

          const accessibleOnly = input.accessibleOnly === true;
          const packages = accessibleOnly
            ? result.packages.filter((pkg) => pkg.accessible)
            : result.packages;

          const lines = [
            `Plan: ${result.planTier}`,
            `Subscription active: ${result.subscriptionActive ? "yes" : "no"}`,
            accessibleOnly ? `Showing: accessible packages only` : `Showing: all packages (${result.packages.filter((p) => p.accessible).length} accessible on your plan)`,
            "",
            ...packages.map(
              (pkg) =>
                `${pkg.accessible ? "[available]" : "[locked]"} ${pkg.id} — ${pkg.label}\n` +
                `  Min tier: ${pkg.minTier}\n` +
                `  Estimated credits: ${pkg.estimatedCredits}\n` +
                `  Text outputs: ${pkg.expectedOutputs.textRoles.join(", ") || "none"}\n` +
                `  Media outputs: ${pkg.expectedOutputs.mediaRoles.join(", ") || "none"}\n` +
                `  Document outputs: ${pkg.expectedOutputs.documentRoles.join(", ") || "none"}`
            ),
          ];
          return {
            content: [{ type: "text", text: lines.join("\n") }]
          };
        }

        case "create_package": {
          const result = await klamdo<{
            id: string;
            status: string;
            packageType: string;
            progress: { completed: number; total: number };
            manifestUrl: string;
          }>("/packages", apiKey, {
            packageType: input.packageType,
            prompt: input.prompt,
            niche: input.niche,
            aspectRatio: input.aspectRatio,
            avatarDurationSeconds: input.avatarDurationSeconds,
            characterType: input.characterType,
            uploadedAssetIds: input.uploadedAssetIds,
            options: input.options,
          });

          return {
            content: [
              {
                type: "text",
                text:
                  `Package started.\n\nPackage ID: ${result.id}\nType: ${result.packageType}\n` +
                  `Status: ${result.status}\nProgress: ${result.progress.completed}/${result.progress.total}\n` +
                  `Manifest URL: ${BASE_URL}${result.manifestUrl}\n\n` +
                  `Use get_package("${result.id}") for status or get_package_manifest("${result.id}") for the structured deliverables contract.`
              }
            ]
          };
        }

        case "get_package": {
          const packageId = String(input.packageId ?? "");
          if (!packageId) throw new McpError(ErrorCode.InvalidParams, "packageId is required");

          const result = await klamdo<{
            id: string;
            packageType: string;
            status: string;
            niche: string;
            tier: string;
            progress: { completed: number; total: number };
            deliverableCounts: { text: number; media: number; documents: number; errors: number };
            manifestUrl: string;
          }>(`/packages/${packageId}`, apiKey);

          return {
            content: [
              {
                type: "text",
                text: [
                  `Package ${result.id}`,
                  `Type: ${result.packageType}`,
                  `Status: ${result.status}`,
                  `Niche: ${result.niche}`,
                  `Tier: ${result.tier}`,
                  `Progress: ${result.progress.completed}/${result.progress.total}`,
                  `Deliverables: text=${result.deliverableCounts.text}, media=${result.deliverableCounts.media}, documents=${result.deliverableCounts.documents}, errors=${result.deliverableCounts.errors}`,
                  `Manifest URL: ${BASE_URL}${result.manifestUrl}`
                ].join("\n")
              }
            ]
          };
        }

        case "get_package_manifest": {
          const packageId = String(input.packageId ?? "");
          if (!packageId) throw new McpError(ErrorCode.InvalidParams, "packageId is required");

          const result = await klamdo<Record<string, unknown>>(`/packages/${packageId}/manifest`, apiKey);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (err) {
      if (err instanceof McpError) throw err;
      throw new McpError(ErrorCode.InternalError, err instanceof Error ? err.message : String(err));
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "klamdo://docs",
        name: "Klamdo API Documentation",
        description: "How to use Klamdo's MCP tools",
        mimeType: "text/plain"
      }
    ]
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === "klamdo://docs") {
      return {
        contents: [
          {
            uri: "klamdo://docs",
            mimeType: "text/plain",
            text: `# Klamdo MCP Server v1.4.1\n\nTools: generate_image, generate_video, upload_start_frame, check_job, get_account, list_jobs, list_packages, create_package, get_package, get_package_manifest\n\nHTTP endpoint: https://mcp.klamdo.app/mcp\nstdio: npx klamdo-mcp (set KLAMDO_API_KEY env var)\n\nImage/video workflow:\n1. upload_start_frame({ imageUrl: "https://..." }) → assetId\n2. generate_video({ prompt: "...", startFrameAssetId: "asset_xxx" }) → jobId\n3. check_job({ jobId: "job_xxx" }) → status + download URL\n\nPackage workflow:\n1. list_packages({ accessibleOnly: true })\n2. create_package({ packageType: "coaching-brand", prompt: "Create a coaching launch package for my offer" })\n3. get_package({ packageId: "pkg_xxx" })\n4. get_package_manifest({ packageId: "pkg_xxx" })\n\nGet your API key at https://klamdo.app/profile\nSee current plans and credits at https://klamdo.app/pricing\nSource: https://github.com/klamdo-app/klamdo-mcp\n`
          }
        ]
      };
    }
    throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${request.params.uri}`);
  });
}
