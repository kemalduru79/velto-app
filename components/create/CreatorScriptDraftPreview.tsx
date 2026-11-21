"use client";
import type { CreatorScript } from "@/lib/creator/creatorScript";
/** A generated candidate is not installed into the project or autosave state. */
export function CreatorScriptDraftPreview({ script, onClose }: {
    script: CreatorScript;
    onClose: () => void;
}) {
    return <section aria-label="Unsaved script draft" className="rounded border p-6">
    <h2>Script draft — not installed</h2>
    <p>Your saved script, research history and production assets remain unchanged.
      This candidate has no script approval and cannot create scenes from this preview.</p>
    <p>Target: {script.targetDurationSec} seconds · {script.sections.length} sections</p>
    {script.sections.map(section => <article key={section.id}>
      <h3>{section.heading || section.id}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{section.text}</p>
    </article>)}
    <button type="button" onClick={onClose}>Close unsaved draft</button>
  </section>;
}
