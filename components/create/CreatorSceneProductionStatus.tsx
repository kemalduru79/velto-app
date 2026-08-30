import type { ReactNode } from "react";

export type CreatorSceneTriageStatus =
  | "ready"
  | "needs_action"
  | "generating"
  | "review";

export type CreatorSceneProductionSummary = {
  id: number;
  number: number;
  title: string;
  status: CreatorSceneTriageStatus;
  readySteps: number;
  totalSteps: 3;
  durationSec: number;
  outputType: "image" | "video";
  productionTreatment?: string;
  productionExplanation?: string;
};

export const deriveCreatorSceneTriageStatus = ({
  generating,
  failed,
  stale,
  hasContinuityWarning,
  scriptNeedsReview,
  scriptReady,
  visualReady,
  voiceReady,
  motionRequired,
  motionReady,
}: {
  generating: boolean;
  failed: boolean;
  stale: boolean;
  hasContinuityWarning: boolean;
  scriptNeedsReview: boolean;
  scriptReady: boolean;
  visualReady: boolean;
  voiceReady: boolean;
  motionRequired: boolean;
  motionReady: boolean;
}): CreatorSceneTriageStatus => {
  if (generating) return "generating";
  if (failed || stale || hasContinuityWarning || scriptNeedsReview) return "review";
  if (scriptReady && visualReady && voiceReady && (!motionRequired || motionReady)) {
    return "ready";
  }
  return "needs_action";
};

export const getCreatorSceneTriageLabel = (
  status: CreatorSceneTriageStatus,
  language: "en" | "tr",
) => {
  const labels = {
    ready: language === "en" ? "Ready" : "Hazır",
    needs_action: language === "en" ? "Needs action" : "Aksiyon gerekli",
    generating: language === "en" ? "Generating" : "Üretiliyor",
    review: language === "en" ? "Review" : "Kontrol et",
  } satisfies Record<CreatorSceneTriageStatus, string>;
  return labels[status];
};

export default function CreatorSceneProductionStatus({
  scenes,
  focusedSceneId,
  onFocusScene,
  language,
  contextualAction,
  selectedSceneIds,
  onToggleSceneSelection,
}: {
  scenes: readonly CreatorSceneProductionSummary[];
  focusedSceneId: number | null;
  onFocusScene: (sceneId: number) => void;
  language: "en" | "tr";
  contextualAction?: ReactNode;
  selectedSceneIds: ReadonlySet<number>;
  onToggleSceneSelection: (sceneId: number) => void;
}) {
  const counts = scenes.reduce(
    (summary, scene) => ({
      ...summary,
      [scene.status]: summary[scene.status] + 1,
    }),
    { ready: 0, needs_action: 0, generating: 0, review: 0 },
  );

  return (
    <section
      className="creatorlab-p2c-scene-operations"
      aria-labelledby="creatorlab-scene-production-title"
      data-scene-production-overview="true"
    >
      <div className="creatorlab-p2c-scene-operations-heading">
        <div>
          <h2 id="creatorlab-scene-production-title">
            {language === "en" ? "Scene Production" : "Sahne Üretimi"}
          </h2>
          <p>
            <strong>{scenes.length}</strong> {language === "en" ? "scenes" : "sahne"}
            <span>·</span>
            <strong>{counts.ready}</strong> {language === "en" ? "ready" : "hazır"}
            <span>·</span>
            <strong>{counts.needs_action}</strong> {language === "en" ? "need action" : "aksiyon gerekli"}
            {counts.generating > 0 && (
              <><span>·</span><strong>{counts.generating}</strong> {language === "en" ? "generating" : "üretiliyor"}</>
            )}
            {counts.review > 0 && (
              <><span>·</span><strong>{counts.review}</strong> {language === "en" ? "to review" : "kontrol edilecek"}</>
            )}
          </p>
        </div>
        {contextualAction && (
          <div className="creatorlab-p2c-scene-operations-action">{contextualAction}</div>
        )}
      </div>

      <div className="creatorlab-p2c-scene-navigator-label">
        <strong>{language === "en" ? "Scenes" : "Sahneler"}</strong>
        <span>{language === "en" ? "Select a scene to review" : "İncelemek için sahne seç"}</span>
      </div>
      <ol
        className="creatorlab-p2c-scene-operations-list"
        aria-label={language === "en" ? "Production scene navigator" : "Üretim sahnesi navigasyonu"}
      >
          {scenes.map((scene) => {
            const focused = focusedSceneId === scene.id;
            return (
              <li key={scene.id}>
                <div
                  data-status={scene.status}
                  data-focused={focused ? "true" : "false"}
                  className="creatorlab-p2c-scene-operation-row"
                >
                  <input
                    type="checkbox"
                    checked={selectedSceneIds.has(scene.id)}
                    onChange={() => onToggleSceneSelection(scene.id)}
                    aria-label={language === "en" ? `Select scene ${scene.number}` : `Sahne ${scene.number} seç`}
                    className="creatorlab-p2c-scene-operation-select"
                  />
                  <button
                    type="button"
                    aria-current={focused ? "true" : undefined}
                    onClick={() => onFocusScene(scene.id)}
                    className="creatorlab-p2c-scene-operation-focus"
                  >
                  <span className="creatorlab-p2c-scene-operation-number">
                    {String(scene.number).padStart(2, "0")}
                  </span>
                  <span className="creatorlab-p2c-scene-operation-copy">
                    <strong>{scene.title}</strong>
                    <small>
                      {scene.durationSec.toFixed(0)}s · {scene.outputType === "video" ? "Video" : language === "en" ? "Image" : "Görsel"} · {getCreatorSceneTriageLabel(scene.status, language)}
                    </small>
                  </span>
                  <span className="creatorlab-p2c-scene-operation-progress" aria-hidden="true">
                    {Array.from({ length: scene.totalSteps }, (_, index) => (
                      <i key={index} data-ready={index < scene.readySteps ? "true" : "false"} />
                    ))}
                  </span>
                  <span className="creatorlab-p2c-scene-operation-status">
                    {getCreatorSceneTriageLabel(scene.status, language)}
                  </span>
                  </button>
                </div>
              </li>
            );
          })}
      </ol>
    </section>
  );
}
