# klamdo-mcp

MCP server for [Klamdo](https://klamdo.app) — connect your AI agent to Klamdo's creative engine to generate images, videos, and full agentic content packages.

## What this does

Klamdo is a structured content generation backend. This MCP server exposes its capabilities so any MCP-compatible AI agent (Claude, GPT-4o, custom agents) can:

- Generate identity-locked 4K images and 5-second vertical videos from a single reference photo
- Create **agentic packages** — structured bundles of scripts, captions, images, videos, voiceovers, ebooks, and slide decks generated in one shot
- Receive machine-readable deliverables via the **package manifest** — a typed contract your agent uses to build landing pages, schedule posts, assemble ebooks, and distribute content downstream

## Quick start

### stdio (Claude Desktop, local agents)

```bash
npx klamdo-mcp
```

Set your API key via environment variable:

```bash
KLAMDO_API_KEY=your_api_key npx klamdo-mcp
```

Get your key at [klamdo.app/profile](https://klamdo.app/profile).

### Claude Desktop config

```json
{
  "mcpServers": {
    "klamdo": {
      "command": "npx",
      "args": ["klamdo-mcp"],
      "env": {
        "KLAMDO_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### HTTP (Smithery / remote agents)

Available at `https://mcp.klamdo.app/mcp` — connect via Smithery or any HTTP MCP client with your API key as the `Authorization: Bearer` header.

## Tools

| Tool | Description |
|---|---|
| `get_account` | Credit balance, plan tier, free sample eligibility |
| `list_jobs` | Recent generation jobs, newest first |
| `generate_image` | Start a 4K image generation job (3 credits) |
| `generate_video` | Start a 5-second vertical video job (6 credits) |
| `upload_start_frame` | Upload a reference image for video generation |
| `check_job` | Poll a job for status and download URLs |
| `list_packages` | List available agentic packages with deliverable breakdown |
| `create_package` | Start an agentic package job from a business prompt |
| `get_package` | Poll a package for status and progress |
| `get_package_manifest` | Fetch the structured deliverables manifest for downstream agent use |

## Image / video workflow

```
1. upload_start_frame({ imageUrl: "https://your-cdn.com/photo.jpg" })
   → { assetId: "asset_xxx" }

2. generate_video({ prompt: "...", startFrameAssetId: "asset_xxx" })
   → { jobId: "job_xxx" }

3. check_job({ jobId: "job_xxx" })
   → { status: "completed", assets: [{ kind: "video", url: "..." }] }
```

## Agentic package workflow

Packages generate a full content bundle in one call — scripts, images, videos, voiceover, ebook outline, slide deck, captions — and return a typed manifest your agent can use to build and distribute.

```
1. list_packages({ accessibleOnly: true })
   → see what's available on your plan

2. create_package({
     packageType: "coaching-brand",
     prompt: "Launch package for my 90-day coaching offer targeting new entrepreneurs",
     niche: "business coaching",
     avatarDurationSeconds: 60
   })
   → { id: "pkg_xxx", manifestUrl: "/api/mcp/packages/pkg_xxx/manifest" }

3. get_package({ packageId: "pkg_xxx" })
   → { status: "processing", progress: { completed: 4, total: 11 } }

4. get_package_manifest({ packageId: "pkg_xxx" })
   → structured manifest with text[], media[], documents[], buildHints
```

### Package manifest

The manifest is a machine-readable contract — not just a list of files. Each deliverable has a typed `role` so your agent knows what to do with it:

```json
{
  "outputs": {
    "text": [
      { "role": "script", "text": "..." },
      { "role": "landing_page_copy", "text": "..." },
      { "role": "email_sequence", "text": "..." }
    ],
    "media": [
      { "role": "hero_image", "url": "https://..." },
      { "role": "avatar_video", "url": "https://..." }
    ],
    "documents": [
      { "role": "slide_deck", "url": "https://..." },
      { "role": "pdf_ebook", "url": "https://..." }
    ]
  },
  "buildHints": {
    "primaryOffer": "...",
    "primaryCTA": "...",
    "recommendedExecutionOrder": ["landing_page_copy", "hero_image", "avatar_video", ...],
    "heroAssetIds": ["..."],
    "landingPageSourceIds": ["..."]
  }
}
```

Your agent fans out: builds the landing page from `landing_page_copy`, populates the ebook from `ebook_outline`, schedules the `avatar_video`, posts the `hero_image` — all from a single manifest.

## Package types

| Package | Min tier | Key outputs |
|---|---|---|
| `digital-marketing` | Starter | scripts, images, video, avatar video, voiceover |
| `social-media` | Starter | captions, content calendar, images, avatar video |
| `ugc-ad` | Creator | UGC scripts, ad images, ad video |
| `coaching-brand` | Creator | scripts, avatar video, slide deck, PDF lead magnet |
| `product-launch` | Pro | landing page copy, email sequence, images, avatar video, slide deck |
| `content-repurpose` | Starter | repurposed text, images, video, slide deck |
| `motion-control` | Creator | motion-controlled video |
| `faceless-content` | Creator | faceless video with voiceover |
| `build-your-own-ai` | Starter | 10 AI character images (realistic/anime/cartoon/fantasy/cyber/3D) |

## Auth

All tools require a Klamdo API key. Get yours at [klamdo.app/profile](https://klamdo.app/profile).

- **stdio**: set `KLAMDO_API_KEY` environment variable
- **HTTP**: pass `Authorization: Bearer <key>` header

## Requirements

- Node.js ≥ 18
- A Klamdo account with an agentic plan tier for package tools (free sample available for image/video)

## Issues

[github.com/klamdo-app/klamdo-mcp/issues](https://github.com/klamdo-app/klamdo-mcp/issues)
