import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import CreatorVoiceLibrarySession, { type CreatorVoiceApplyOutcome, type CreatorVoiceCatalogPage, type CreatorVoiceCatalogQuery, type CreatorVoiceLibrarySessionHandle } from "@/components/create/CreatorVoiceLibrarySession";
import type { CreatorVoiceLibraryVoice } from "@/lib/creator/voiceLibrary";
import type { CreatorVoicePickerTarget } from "@/components/create/createWorkspacePanelTypes";

// Mounted React acceptance fixture only. No authentication, providers or database.
const voice = (n: number): CreatorVoiceLibraryVoice => ({ voiceId: `synthetic-${n}`, name: `Synthetic voice ${n}`, source: "available", previewUrl: "/unused-synthetic-preview", language: "en", gender: "female" });
const test = {
  reads: [] as CreatorVoiceCatalogQuery[], applies: [] as CreatorVoicePickerTarget[], clears: [] as CreatorVoicePickerTarget[],
  dismisses: 0, holdApply: false, failApply: false,
  pendingReads: [] as Array<() => void>, pendingApplies: [] as Array<() => void>,
  audio: [] as Array<{ paused: boolean; onended: (() => void) | null; onerror: (() => void) | null; pause: () => void }>,
};
Object.defineProperty(window, "__voiceSessionTest", { value: test });
Object.defineProperty(window, "Audio", { value: class {
  paused = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { test.audio.push(this); }
  pause() { this.paused = true; }
  play() { return Promise.resolve(); }
} });
function Fixture() {
  const ref = useRef<CreatorVoiceLibrarySessionHandle | null>(null);
  const [mounted, setMounted] = useState(true);
  const [uiLanguage, setUiLanguage] = useState("en");
  const [renderCount, setRenderCount] = useState(0);
  const targets: CreatorVoicePickerTarget[] = [{scope:"project_narrator"},{scope:"project_dialogue"},{scope:"scene_narrator",sceneId:1},{scope:"scene_dialogue",sceneId:1},{scope:"character",characterId:"synthetic-character"}];
  const readCatalog = async (query: CreatorVoiceCatalogQuery, signal: AbortSignal): Promise<CreatorVoiceCatalogPage> => {
    test.reads.push({...query});
    signal.throwIfAborted();
    if(query.search === "failure") throw new Error("Synthetic catalog failure");
    if(query.search === "defer") return new Promise(resolve => { test.pendingReads.push(() => resolve({voices:[{...voice(999),name:"Obsolete catalog voice"}],hasMore:false,nextPageToken:""})); });
    return {voices:Array.from({length:24},(_,n)=>({...voice(n + Number(query.pageToken || 0)),source:query.source})),hasMore:true,nextPageToken:String(Number(query.pageToken || 0)+24)};
  };
  const onApply = async (target: CreatorVoicePickerTarget, selected: CreatorVoiceLibraryVoice, active: () => boolean): Promise<CreatorVoiceApplyOutcome> => {
    test.applies.push(target);
    if(test.holdApply) return new Promise(resolve => { test.pendingApplies.push(() => resolve(active() ? {status:"applied",selection:{...selected,selectedAt:"2026-01-01T00:00:00Z"}} : {status:"stale"})); });
    if(test.failApply) return {status:"error",message:"Synthetic apply failure"};
    return {status:"applied",selection:{...selected,selectedAt:"2026-01-01T00:00:00Z"}};
  };
  return <>
    {targets.map(target=><button key={target.scope} onClick={()=>ref.current?.open(target)}>Open {target.scope}</button>)}
    <button onClick={()=>ref.current?.close()}>Close imperatively</button>
    <button onClick={()=>setMounted(value=>!value)}>Toggle mount</button>
    <button onClick={()=>setUiLanguage(value=>value==="en"?"tr":"en")}>Toggle language</button>
    <button onClick={()=>setRenderCount(value=>value+1)}>Rerender {renderCount}</button>
    {mounted && <CreatorVoiceLibrarySession ref={ref} language="en" uiLanguage={uiLanguage} readCatalog={readCatalog}
      getSelection={()=>({...voice(1000),selectedAt:"2026-01-01T00:00:00Z"})} onApply={onApply}
      onClear={target=>{test.clears.push(target);return true;}} onDismiss={()=>{test.dismisses++;}} />}
  </>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
