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
}: {
  scenes: readonly CreatorSceneProductionSummary[];
  focusedSceneId: number | null;
  onFocusScene: (sceneId: number) => void;
  language: "en" | "tr";
  contextualAction?: ReactNode;
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

      <details className="creatorlab-p2c-all-scenes">
        <summary>
          {language === "en" ? "All scenes" : "Tüm sahneler"}
          <span>{language === "en" ? "Overview and management" : "Genel görünüm ve yönetim"}</span>
        </summary>
        <ol
          className="creatorlab-p2c-scene-operations-list"
          aria-label={language === "en" ? "All production scenes" : "Tüm üretim sahneleri"}
        >
          {scenes.map((scene) => {
            const focused = focusedSceneId === scene.id;
            return (
              <li key={scene.id}>
                <button
                  type="button"
                  aria-current={focused ? "true" : undefined}
                  data-status={scene.status}
                  data-focused={focused ? "true" : "false"}
                  onClick={() => onFocusScene(scene.id)}
                  className="creatorlab-p2c-scene-operation-row"
                >
                  <span className="creatorlab-p2c-scene-operation-number">
                    {String(scene.number).padStart(2, "0")}
                  </span>
                  <span className="creatorlab-p2c-scene-operation-copy">
                    <strong>{scene.title}</strong>
                    <small>
                      {getCreatorSceneTriageLabel(scene.status, language)} · {scene.readySteps}/{scene.totalSteps} {language === "en" ? "steps ready" : "adım hazır"}
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
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
