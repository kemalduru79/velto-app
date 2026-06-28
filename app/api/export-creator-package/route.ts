import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ZipEntry = {
  name: string;
  data: Buffer;
};

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  return {} as Record<string, any>;
}

function createTimelineWarningsText(timelineSyncPlan: Record<string, any>) {
  const warnings = Array.isArray(timelineSyncPlan?.warnings)
    ? timelineSyncPlan.warnings.filter(
        (item: unknown) => typeof item === "string",
      )
    : [];
  const sceneWarnings = Array.isArray(timelineSyncPlan?.scenes)
    ? timelineSyncPlan.scenes
        .filter((scene: any) => scene?.speechFit && scene.speechFit !== "safe")
        .map(
          (scene: any) =>
            `Scene ${scene?.id ?? "?"}: speechFit=${scene.speechFit}, audioMismatch=${scene?.audioMismatch ?? "?"}, visualAction=${scene?.visualAction ?? "?"}, estimatedSpeech=${scene?.estimatedSpeechSeconds ?? "?"}s, recommendation=${scene?.productionRecommendation ?? "review"}`,
        )
    : [];

  const lines = [
    "VELTO Timeline Sync Notes",
    "",
    `Timeline mode: ${timelineSyncPlan?.timelineMode || "not provided"}`,
    `Quality tier: ${timelineSyncPlan?.qualityTier || "not provided"}`,
    `Estimated speech: ${timelineSyncPlan?.estimatedSpeechSeconds ?? "?"}s`,
    `Recommended clip seconds: ${timelineSyncPlan?.recommendedClipSeconds ?? "?"}`,
    "",
    "Warnings:",
    ...(warnings.length
      ? warnings.map((warning: string) => `- ${warning}`)
      : ["- No global warnings."]),
    "",
    "Scene review:",
    ...(sceneWarnings.length
      ? sceneWarnings.map((warning: string) => `- ${warning}`)
      : ["- All scenes are marked safe or no scene-level plan was provided."]),
  ];

  return lines.join("\n");
}

function createTimelineScenesCsv(timelineSyncPlan: Record<string, any>) {
  const scenes = Array.isArray(timelineSyncPlan?.scenes)
    ? timelineSyncPlan.scenes
    : [];
  const rows: unknown[][] = [
    [
      "scene_id",
      "speech_fit",
      "estimated_speech_seconds",
      "target_visual_seconds",
      "recommended_clip_seconds",
      "freeze_padding_seconds",
      "audio_mismatch",
      "visual_action",
      "production_recommendation",
      "visual_blocks",
    ],
    ...scenes.map((scene: any) => [
      scene?.id ?? "",
      scene?.speechFit ?? "",
      scene?.estimatedSpeechSeconds ?? "",
      scene?.targetVisualSeconds ?? "",
      scene?.recommendedClipSeconds ?? "",
      scene?.freezePaddingSeconds ?? "",
      scene?.audioMismatch ?? "",
      scene?.visualAction ?? "",
      scene?.productionRecommendation ?? "",
      Array.isArray(scene?.visualBlocks)
        ? scene.visualBlocks
            .map(
              (block: any) =>
                `${block?.type || "block"}:${block?.startSec ?? "?"}-${block?.endSec ?? "?"}s:${block?.source || "source"}:${block?.motionPreset || "motion"}`,
            )
            .join(" | ")
        : "",
    ]),
  ];

  return rows
    .map((row) =>
      row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function createVisualBlockPlan(timelineSyncPlan: Record<string, any>) {
  const scenes = Array.isArray(timelineSyncPlan?.scenes)
    ? timelineSyncPlan.scenes
    : [];

  return scenes.map((scene: any) => ({
    sceneId: scene?.id ?? null,
    speechFit: scene?.speechFit ?? null,
    audioMismatch: scene?.audioMismatch ?? null,
    visualAction: scene?.visualAction ?? null,
    estimatedSpeechSeconds: scene?.estimatedSpeechSeconds ?? null,
    targetVisualSeconds: scene?.targetVisualSeconds ?? null,
    blocks: Array.isArray(scene?.visualBlocks)
      ? scene.visualBlocks.map((block: any, index: number) => ({
          index: index + 1,
          type: block?.type ?? "unknown",
          startSec: block?.startSec ?? null,
          endSec: block?.endSec ?? null,
          durationSec: block?.durationSec ?? null,
          source: block?.source ?? null,
          motionPreset: block?.motionPreset ?? null,
          reason: block?.reason ?? "",
        }))
      : [],
  }));
}

function createVisualBlocksCsv(timelineSyncPlan: Record<string, any>) {
  const blockPlan = createVisualBlockPlan(timelineSyncPlan);
  const rows: unknown[][] = [
    [
      "scene_id",
      "block_index",
      "block_type",
      "start_sec",
      "end_sec",
      "duration_sec",
      "source",
      "motion_preset",
      "reason",
    ],
    ...blockPlan.flatMap((scene: any) =>
      Array.isArray(scene.blocks) && scene.blocks.length
        ? scene.blocks.map((block: any) => [
            scene.sceneId ?? "",
            block.index ?? "",
            block.type ?? "",
            block.startSec ?? "",
            block.endSec ?? "",
            block.durationSec ?? "",
            block.source ?? "",
            block.motionPreset ?? "",
            block.reason ?? "",
          ])
        : [[scene.sceneId ?? "", "", "", "", "", "", "", "", ""]],
    ),
  ];

  return rows
    .map((row) =>
      row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "velto-creator-package";
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosTime, dosDate };
}

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, end]);
}

function decodeDataImage(value: unknown) {
  const text = safeString(value);

  if (!text.startsWith("data:image/")) {
    return null;
  }

  const match = text.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);

  if (!match) {
    return null;
  }

  const ext =
    match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");

  return { ext, buffer };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title = safeString(
      body?.title,
      safeString(body?.productionPackage?.title, "VELTO Creator Package"),
    );
    const safeTitle = sanitizeFileName(title);
    const videoUrl = safeString(body?.videoUrl);
    const productionPackage = body?.productionPackage || {};
    const metadata = body?.metadata || {};
    const thumbnail = body?.thumbnail || {};
    const scenes = Array.isArray(body?.scenes) ? body.scenes : [];
    const timelineSyncPlan = safeObject(
      body?.timelineSyncPlan ||
        body?.productionPackage?.timelineSyncPlan ||
        productionPackage?.timelineSyncPlan,
    );
    const hasTimelineSyncPlan = Object.keys(timelineSyncPlan).length > 0;

    const recommendedTitle = safeString(
      metadata?.recommendedTitle,
      safeString(productionPackage?.youtubeTitle, title),
    );

    const description = safeString(
      metadata?.description,
      safeString(productionPackage?.caption),
    );

    const hashtags = safeArray(metadata?.hashtags);
    const firstComment = safeString(metadata?.firstComment);
    const titleOptions = safeArray(metadata?.titleOptions);
    const thumbnailTextIdeas = safeArray(metadata?.thumbnailTextIdeas);
    const seoKeywords = safeArray(metadata?.seoKeywords);
    const uploadChecklist = safeArray(metadata?.uploadChecklist);
    const publishingNotes = safeArray(metadata?.publishingNotes);
    const shortCaption = safeString(metadata?.shortCaption);

    const entries: ZipEntry[] = [
      {
        name: "video_link.txt",
        data: Buffer.from(videoUrl || "No video URL available.", "utf8"),
      },
      {
        name: "title.txt",
        data: Buffer.from(recommendedTitle, "utf8"),
      },
      {
        name: "title_options.txt",
        data: Buffer.from(titleOptions.join("\n") || recommendedTitle, "utf8"),
      },
      {
        name: "description.txt",
        data: Buffer.from(description || "No description available.", "utf8"),
      },
      {
        name: "short_caption.txt",
        data: Buffer.from(shortCaption || description || "", "utf8"),
      },
      {
        name: "hashtags.txt",
        data: Buffer.from(hashtags.join(" "), "utf8"),
      },
      {
        name: "first_comment.txt",
        data: Buffer.from(firstComment || "", "utf8"),
      },
      {
        name: "seo_keywords.txt",
        data: Buffer.from(seoKeywords.join(", "), "utf8"),
      },
      {
        name: "thumbnail_text_ideas.txt",
        data: Buffer.from(thumbnailTextIdeas.join("\n"), "utf8"),
      },
      {
        name: "thumbnail_prompt.txt",
        data: Buffer.from(
          safeString(
            thumbnail?.prompt,
            safeString(productionPackage?.thumbnailIdea),
          ),
          "utf8",
        ),
      },
      {
        name: "production_package.json",
        data: Buffer.from(JSON.stringify(productionPackage, null, 2), "utf8"),
      },
      {
        name: "scenes.json",
        data: Buffer.from(JSON.stringify(scenes, null, 2), "utf8"),
      },
      {
        name: "metadata.json",
        data: Buffer.from(JSON.stringify(metadata || {}, null, 2), "utf8"),
      },
    ];

    if (hasTimelineSyncPlan) {
      entries.push(
        {
          name: "timeline_sync_plan.json",
          data: Buffer.from(JSON.stringify(timelineSyncPlan, null, 2), "utf8"),
        },
        {
          name: "timeline_sync_notes.txt",
          data: Buffer.from(
            createTimelineWarningsText(timelineSyncPlan),
            "utf8",
          ),
        },
        {
          name: "timeline_scenes.csv",
          data: Buffer.from(createTimelineScenesCsv(timelineSyncPlan), "utf8"),
        },
        {
          name: "visual_block_plan.json",
          data: Buffer.from(
            JSON.stringify(createVisualBlockPlan(timelineSyncPlan), null, 2),
            "utf8",
          ),
        },
        {
          name: "visual_blocks.csv",
          data: Buffer.from(createVisualBlocksCsv(timelineSyncPlan), "utf8"),
        },
      );
    }

    const decodedThumbnail = decodeDataImage(thumbnail?.imageUrl);

    if (decodedThumbnail) {
      entries.push({
        name: `thumbnail.${decodedThumbnail.ext}`,
        data: decodedThumbnail.buffer,
      });
    } else if (safeString(thumbnail?.imageUrl)) {
      entries.push({
        name: "thumbnail_link.txt",
        data: Buffer.from(safeString(thumbnail?.imageUrl), "utf8"),
      });
    }

    const zipBuffer = createZip(entries);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("export-creator-package error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Creator package export failed.",
      },
      { status: 500 },
    );
  }
}
