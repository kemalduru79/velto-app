import fs from "node:fs";

const pagePath = "app/create/page.tsx";
const source = fs.readFileSync(pagePath, "utf8");
let next = source;

const importAnchor = 'import CreatorEditor from "@/components/create/CreatorEditor";\n';
const cleanupImport = 'import CreatorVisualAssetCleanupAction from "@/components/create/CreatorVisualAssetCleanupAction";\n';

if (!next.includes(cleanupImport)) {
  const importMatches = next.split(importAnchor).length - 1;
  if (importMatches !== 1) {
    throw new Error(`Expected exactly one CreatorEditor import anchor, found ${importMatches}.`);
  }
  next = next.replace(importAnchor, `${importAnchor}${cleanupImport}`);
}

const restoreAnchor = 'onClick={() => restoreCreatorSceneAsset(scene.id, asset)}';
const restoreIndex = next.indexOf(restoreAnchor);
if (restoreIndex < 0) {
  throw new Error("Could not find the Visual tab asset-version restore action.");
}
if (next.indexOf(restoreAnchor, restoreIndex + restoreAnchor.length) >= 0) {
  throw new Error("Visual tab restore anchor is unexpectedly ambiguous.");
}

const cleanupMarker = 'data-visual-media-cleanup="asset-version"';
if (!next.includes(cleanupMarker)) {
  const actionGridClose = '\n                                                    </div>\n                                                  </div>\n                                                </article>';
  const closeIndex = next.indexOf(actionGridClose, restoreIndex);
  if (closeIndex < 0) {
    throw new Error("Could not locate the end of the Visual tab asset-version action grid.");
  }

  const gridClosingTag = '\n                                                    </div>';
  const insertAt = closeIndex + gridClosingTag.length;
  const cleanupAction = `\n                                                    <div data-visual-media-cleanup="asset-version">\n                                                      <CreatorVisualAssetCleanupAction\n                                                        mediaUrl={asset.url}\n                                                        projectId={currentProjectId}\n                                                        language={uiLanguage === "en" ? "en" : "tr"}\n                                                        getAccessToken={getAccessTokenOrThrow}\n                                                        onHistoryRemoved={removeCreatorProjectHistoryUrl}\n                                                      />\n                                                    </div>`;
  next = `${next.slice(0, insertAt)}${cleanupAction}${next.slice(insertAt)}`;
}

if (next === source) {
  console.log("VISUAL_MEDIA_CLEANUP_PATCH=ALREADY_APPLIED");
  process.exit(0);
}

if (!next.includes(cleanupImport) || !next.includes(cleanupMarker)) {
  throw new Error("Visual media cleanup patch did not establish all required invariants.");
}

fs.writeFileSync(pagePath, next);
console.log("VISUAL_MEDIA_CLEANUP_PATCH=PASS");
