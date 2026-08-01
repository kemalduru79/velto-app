import { NextResponse } from "next/server";
import { createCreatorPublishReadyPackageReport } from "@/lib/creator/publishReadyPackage";
import {
  createCreatorProjectPerformanceReportHtml,
  isCreatorProjectPerformanceReport,
} from "@/lib/creator/projectPerformanceReport";

// 3R PUBLISH-READY PACKAGE

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ASSET_TIMEOUT_MS = 45_000;

type ZipEntry = {
  name: string;
  data: Buffer;
};

type PackageAssetResult = {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
};

type CaptionCue = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
};

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
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
  const match = text.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);

  if (!match) return null;

  const extension = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");

  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;

  return {
    buffer,
    extension,
    contentType: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
  };
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    /^127\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^169\.254\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

function resolveAssetUrl(value: string, requestUrl: string) {
  const resolved = new URL(value, requestUrl);
  const requestOrigin = new URL(requestUrl).origin;
  const isSameOrigin = resolved.origin === requestOrigin;

  if (resolved.protocol !== "https:" && !(isSameOrigin && resolved.protocol === "http:")) {
    throw new Error("Only HTTPS package assets are supported.");
  }

  if (!isSameOrigin && isPrivateHostname(resolved.hostname)) {
    throw new Error("Private network package assets are not supported.");
  }

  return resolved;
}

async function fetchPackageAsset(
  value: string,
  requestUrl: string,
  maxBytes: number,
): Promise<PackageAssetResult> {
  const resolved = resolveAssetUrl(value, requestUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);

  try {
    const response = await fetch(resolved, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Asset download failed with HTTP ${response.status}.`);
    }

    const finalUrl = response.url || resolved.toString();
    const finalResolved = new URL(finalUrl);
    const requestOrigin = new URL(requestUrl).origin;

    if (finalResolved.origin !== requestOrigin && isPrivateHostname(finalResolved.hostname)) {
      throw new Error("Asset redirect to a private network was blocked.");
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);

    if (declaredLength > maxBytes) {
      throw new Error("Asset exceeds the Creator Package size limit.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!buffer.length) {
      throw new Error("Downloaded package asset is empty.");
    }

    if (buffer.length > maxBytes) {
      throw new Error("Asset exceeds the Creator Package size limit.");
    }

    return {
      buffer,
      contentType: response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream",
      finalUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function imageExtension(contentType: string, url: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (/\.png(?:$|\?)/i.test(url)) return "png";
  if (/\.webp(?:$|\?)/i.test(url)) return "webp";
  return "jpg";
}

function videoExtension(contentType: string, url: string) {
  if (contentType === "video/webm" || /\.webm(?:$|\?)/i.test(url)) return "webm";
  return "mp4";
}

function getSceneDuration(
  scene: Record<string, any>,
  index: number,
  productionPackage: Record<string, any>,
  timelineSyncPlan: Record<string, any>,
) {
  const timelineScene = Array.isArray(timelineSyncPlan?.scenes)
    ? timelineSyncPlan.scenes.find(
        (item: Record<string, any>) => Number(item?.id) === Number(scene?.id ?? index + 1),
      )
    : null;
  // VELTO_VOICE_P1C: measured exact timing must win over the original
  // production budget so captions/package metadata match final render timing.
  const candidates = [
    scene?.timing?.targetSceneDuration,
    scene?.durationSec,
    timelineScene?.durationMatch?.targetDurationSec,
    timelineScene?.targetVisualSeconds,
    scene?.timing?.plannedSceneDuration,
    scene?.videoDurationSeconds,
    productionPackage?.targetSceneDurationSec,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }

  return 5;
}

function getSceneCaptionText(scene: Record<string, any>) {
  return [safeString(scene?.narration), safeString(scene?.dialogue)]
    .filter(Boolean)
    .join("\n") || safeString(scene?.text);
}

function createCaptionCues(
  scenes: Record<string, any>[],
  productionPackage: Record<string, any>,
  timelineSyncPlan: Record<string, any>,
): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let cursor = 0;

  scenes.forEach((scene, index) => {
    const duration = Math.max(
      0.5,
      getSceneDuration(scene, index, productionPackage, timelineSyncPlan),
    );
    const text = getSceneCaptionText(scene);

    if (text) {
      cues.push({
        index: cues.length + 1,
        startSec: cursor,
        endSec: cursor + duration,
        text,
      });
    }

    cursor += duration;
  });

  return cues;
}

function formatTimestamp(seconds: number, separator: "," | ".") {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`;
}

function createSrt(cues: CaptionCue[]) {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${formatTimestamp(cue.startSec, ",")} --> ${formatTimestamp(cue.endSec, ",")}\n${cue.text}\n`,
    )
    .join("\n");
}

function createVtt(cues: CaptionCue[]) {
  return `WEBVTT\n\n${cues
    .map(
      (cue) =>
        `${formatTimestamp(cue.startSec, ".")} --> ${formatTimestamp(cue.endSec, ".")}\n${cue.text}\n`,
    )
    .join("\n")}`;
}

function createProductionSummary(input: {
  title: string;
  recommendedTitle: string;
  description: string;
  language: string;
  format: string;
  qualityMode: string;
  scenes: Record<string, any>[];
  cues: CaptionCue[];
  includedVideoFile: string;
  includedThumbnailFile: string;
  targetPlatforms: string[];
}) {
  const totalDuration = input.cues.length
    ? input.cues[input.cues.length - 1].endSec
    : 0;

  return [
    "VELTO Creator Package",
    "",
    `Project: ${input.title}`,
    `Publishing title: ${input.recommendedTitle}`,
    `Language: ${input.language || "not specified"}`,
    `Format: ${input.format || "not specified"}`,
    `Production quality: ${input.qualityMode || "not specified"}`,
    `Scene count: ${input.scenes.length}`,
    `Caption timeline duration: ${totalDuration.toFixed(1)} seconds`,
    `Final video asset: ${input.includedVideoFile || "link fallback only"}`,
    `Thumbnail asset: ${input.includedThumbnailFile || "not included"}`,
    `Target platforms: ${input.targetPlatforms.join(", ") || "not specified"}`,
    "",
    "Description",
    input.description || "No description was generated.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const publishReadyReport = createCreatorPublishReadyPackageReport({
      productionPackage: body?.productionPackage,
      videoUrl: body?.videoUrl,
      thumbnail: body?.thumbnail,
      metadata: body?.metadata,
      scenes: body?.scenes,
      targetPlatforms: body?.targetPlatforms,
      releaseChecklist: body?.releaseChecklist,
    });

    if (!publishReadyReport.canExport) {
      return NextResponse.json(
        {
          ok: false,
          error: "Creator Package is not publish-ready.",
          publishReadyReport,
        },
        { status: 409 },
      );
    }

    const productionPackage = safeObject(body?.productionPackage);
    const metadata = safeObject(body?.metadata);
    const thumbnail = safeObject(body?.thumbnail);
    const creatorIntelligence = safeObject(body?.creatorIntelligence);
    const performanceReport = isCreatorProjectPerformanceReport(
      body?.performanceReport,
    )
      ? body.performanceReport
      : null;
    const thumbnailDesign = safeObject(body?.thumbnailDesign || thumbnail?.design);
    const releaseChecklist = safeObject(body?.releaseChecklist);
    const targetPlatforms = safeArray(body?.targetPlatforms);
    const releaseSystemChecks = Array.isArray(releaseChecklist?.systemChecks)
      ? releaseChecklist.systemChecks.filter((item: unknown) => item && typeof item === "object")
      : [];
    const releaseUserConfirmations = safeObject(releaseChecklist?.userConfirmations);
    const releaseChecklistText = [
      "VELTO Creator Release Checklist",
      "",
      "System checks",
      ...releaseSystemChecks.map((item: Record<string, any>) =>
        `- [${item?.ready ? "x" : " "}] ${safeString(item?.label, safeString(item?.key, "System check"))}`,
      ),
      "",
      "Creator confirmations",
      ...Object.entries(releaseUserConfirmations).map(
        ([key, confirmed]) => `- [${confirmed ? "x" : " "}] ${key}`,
      ),
      "",
      `Ready to export: ${releaseChecklist?.readyToExport ? "yes" : "no"}`,
    ].join("\n");
    const timelineSyncPlan = safeObject(
      body?.timelineSyncPlan || productionPackage?.timelineSyncPlan,
    );
    const scenes = Array.isArray(body?.scenes)
      ? (body.scenes as Record<string, any>[])
      : [];
    const title = safeString(
      body?.title,
      safeString(productionPackage?.title, "VELTO Creator Package"),
    );
    const safeTitle = sanitizeFileName(title);
    const videoUrl = safeString(body?.videoUrl);
    const thumbnailUrl = safeString(thumbnail?.imageUrl);
    const thumbnailSourceUrl = safeString(thumbnail?.sourceImageUrl);
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
    const hookAlternatives = safeArray(metadata?.hookAlternatives);
    const chapters = safeArray(metadata?.chapters);
    const uploadChecklist = safeArray(metadata?.uploadChecklist);
    const publishingNotes = safeArray(metadata?.publishingNotes);
    const shortCaption = safeString(metadata?.shortCaption);
    const linkedInCaption = safeString(metadata?.linkedInCaption);
    const cues = createCaptionCues(scenes, productionPackage, timelineSyncPlan);
    const warnings: string[] = [];
    const entries: ZipEntry[] = [];
    let includedVideoFile = "";
    let includedThumbnailFile = "";
    let includedThumbnailSourceFile = "";

    if (videoUrl) {
      try {
        const videoAsset = await fetchPackageAsset(videoUrl, req.url, MAX_VIDEO_BYTES);
        const extension = videoExtension(videoAsset.contentType, videoAsset.finalUrl);
        includedVideoFile = `final-video.${extension}`;
        entries.push({ name: includedVideoFile, data: videoAsset.buffer });
      } catch (error) {
        warnings.push(
          `The final video could not be embedded: ${error instanceof Error ? error.message : "download failed"}`,
        );
        entries.push({
          name: "final-video-link.txt",
          data: Buffer.from(videoUrl, "utf8"),
        });
      }
    } else {
      warnings.push("No final video URL was provided.");
    }

    const dataThumbnail = decodeDataImage(thumbnailUrl);

    if (dataThumbnail) {
      includedThumbnailFile = `thumbnail.${dataThumbnail.extension}`;
      entries.push({ name: includedThumbnailFile, data: dataThumbnail.buffer });
    } else if (thumbnailUrl) {
      try {
        const thumbnailAsset = await fetchPackageAsset(
          thumbnailUrl,
          req.url,
          MAX_IMAGE_BYTES,
        );
        const extension = imageExtension(
          thumbnailAsset.contentType,
          thumbnailAsset.finalUrl,
        );
        includedThumbnailFile = `thumbnail.${extension}`;
        entries.push({ name: includedThumbnailFile, data: thumbnailAsset.buffer });
      } catch (error) {
        warnings.push(
          `The thumbnail could not be embedded: ${error instanceof Error ? error.message : "download failed"}`,
        );
        entries.push({
          name: "thumbnail-link.txt",
          data: Buffer.from(thumbnailUrl, "utf8"),
        });
      }
    } else {
      warnings.push("No thumbnail image was provided.");
    }

    if (thumbnailSourceUrl && thumbnailSourceUrl !== thumbnailUrl) {
      const dataThumbnailSource = decodeDataImage(thumbnailSourceUrl);
      if (dataThumbnailSource) {
        includedThumbnailSourceFile = `thumbnail-source.${dataThumbnailSource.extension}`;
        entries.push({ name: includedThumbnailSourceFile, data: dataThumbnailSource.buffer });
      } else {
        try {
          const thumbnailSourceAsset = await fetchPackageAsset(
            thumbnailSourceUrl,
            req.url,
            MAX_IMAGE_BYTES,
          );
          const extension = imageExtension(
            thumbnailSourceAsset.contentType,
            thumbnailSourceAsset.finalUrl,
          );
          includedThumbnailSourceFile = `thumbnail-source.${extension}`;
          entries.push({ name: includedThumbnailSourceFile, data: thumbnailSourceAsset.buffer });
        } catch (error) {
          warnings.push(
            `The clean thumbnail source could not be embedded: ${error instanceof Error ? error.message : "download failed"}`,
          );
        }
      }
    }

    entries.push(
      {
        name: "publishing/title.txt",
        data: Buffer.from(recommendedTitle, "utf8"),
      },
      {
        name: "publishing/title-options.txt",
        data: Buffer.from(titleOptions.join("\n") || recommendedTitle, "utf8"),
      },
      {
        name: "publishing/description.txt",
        data: Buffer.from(description, "utf8"),
      },
      {
        name: "publishing/hashtags.txt",
        data: Buffer.from(hashtags.join(" "), "utf8"),
      },
      {
        name: "publishing/first-comment.txt",
        data: Buffer.from(firstComment, "utf8"),
      },
      {
        name: "publishing/short-caption.txt",
        data: Buffer.from(shortCaption, "utf8"),
      },
      {
        name: "publishing/linkedin-caption.txt",
        data: Buffer.from(linkedInCaption, "utf8"),
      },
      {
        name: "publishing/chapters.txt",
        data: Buffer.from(chapters.join("\n"), "utf8"),
      },
      {
        name: "publishing/hook-alternatives.txt",
        data: Buffer.from(hookAlternatives.join("\n"), "utf8"),
      },
      {
        name: "publishing/seo-keywords.txt",
        data: Buffer.from(seoKeywords.join(", "), "utf8"),
      },
      {
        name: "publishing/thumbnail-text-ideas.txt",
        data: Buffer.from(thumbnailTextIdeas.join("\n"), "utf8"),
      },
      {
        name: "publishing/ai-upload-checklist.txt",
        data: Buffer.from(uploadChecklist.map((item) => `- ${item}`).join("\n"), "utf8"),
      },
      {
        name: "publishing/target-platforms.txt",
        data: Buffer.from(targetPlatforms.join("\n"), "utf8"),
      },
      {
        name: "publishing/checklist.txt",
        data: Buffer.from(releaseChecklistText, "utf8"),
      },
      {
        name: "publishing/release-checklist.json",
        data: Buffer.from(JSON.stringify(releaseChecklist, null, 2), "utf8"),
      },
      {
        name: "publishing/thumbnail-design.json",
        data: Buffer.from(JSON.stringify(thumbnailDesign, null, 2), "utf8"),
      },
      {
        name: "publishing/notes.txt",
        data: Buffer.from(publishingNotes.map((item) => `- ${item}`).join("\n"), "utf8"),
      },
      {
        name: "captions/captions.srt",
        data: Buffer.from(createSrt(cues), "utf8"),
      },
      {
        name: "captions/captions.vtt",
        data: Buffer.from(createVtt(cues), "utf8"),
      },
      {
        name: "project/production-package.json",
        data: Buffer.from(JSON.stringify(productionPackage, null, 2), "utf8"),
      },
      {
        name: "project/scenes.json",
        data: Buffer.from(JSON.stringify(scenes, null, 2), "utf8"),
      },
      {
        name: "project/metadata.json",
        data: Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      },
    );

    if (Object.keys(creatorIntelligence).length) {
      entries.push({
        name: "project/creator-intelligence.json",
        data: Buffer.from(JSON.stringify(creatorIntelligence, null, 2), "utf8"),
      });
    }

    if (performanceReport) {
      entries.push(
        {
          name: "project/project-performance-report.json",
          data: Buffer.from(
            JSON.stringify(performanceReport, null, 2),
            "utf8",
          ),
        },
        {
          name: "project/project-performance-report.html",
          data: Buffer.from(
            createCreatorProjectPerformanceReportHtml(performanceReport),
            "utf8",
          ),
        },
      );
    }

    if (Object.keys(timelineSyncPlan).length) {
      entries.push({
        name: "project/timeline-sync-plan.json",
        data: Buffer.from(JSON.stringify(timelineSyncPlan, null, 2), "utf8"),
      });
    }

    const summary = createProductionSummary({
      title,
      recommendedTitle,
      description,
      language: safeString(body?.language),
      format: safeString(body?.creatorFormat),
      qualityMode: safeString(body?.qualityMode, safeString(productionPackage?.qualityMode)),
      scenes,
      cues,
      includedVideoFile,
      includedThumbnailFile,
      targetPlatforms,
    });

    entries.push({
      name: "project/production-summary.txt",
      data: Buffer.from(summary, "utf8"),
    });

    const readme = [
      "VELTO Creator Package",
      "",
      "Main release assets",
      `- ${includedVideoFile || "final-video-link.txt"}`,
      `- ${includedThumbnailFile || "thumbnail-link.txt / not available"}`,
      ...(includedThumbnailSourceFile ? [`- ${includedThumbnailSourceFile}`] : []),
      "",
      "Publishing copy is under /publishing.",
      "Captions are under /captions in SRT and VTT formats.",
      "Editable production data is under /project.",
      ...(performanceReport
        ? [
            "Project performance report is included as JSON and printable HTML under /project.",
          ]
        : []),
      warnings.length ? "" : "Package completed without asset warnings.",
      ...warnings.map((warning) => `Warning: ${warning}`),
    ].join("\n");

    entries.unshift({
      name: "README.txt",
      data: Buffer.from(readme, "utf8"),
    });

    const manifest = {
      version: "3R-publish-ready-v1",
      publishReadyReport,
      generatedAt: new Date().toISOString(),
      projectTitle: title,
      publishingTitle: recommendedTitle,
      includedVideoFile: includedVideoFile || null,
      includedThumbnailFile: includedThumbnailFile || null,
      includedThumbnailSourceFile: includedThumbnailSourceFile || null,
      captionFormats: ["srt", "vtt"],
      targetPlatforms,
      releaseReady: Boolean(releaseChecklist?.readyToExport),
      performanceReportVersion: performanceReport?.version || null,
      warnings,
      files: entries.map((entry) => entry.name),
    };

    entries.push({
      name: "package-manifest.json",
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    });

    const zipBuffer = createZip(entries);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "Cache-Control": "no-store",
        "X-Velto-Package-Warnings": String(warnings.length),
        "X-Velto-Publish-Ready": "true",
        "X-Velto-Package-Version": "3R",
        "X-Velto-Report-Version": performanceReport?.version || "none",
      },
    });
  } catch (error) {
    console.error("export-creator-package error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          (error instanceof Error ? error.message : "") ||
          "Creator package export failed.",
      },
      { status: 500 },
    );
  }
}
