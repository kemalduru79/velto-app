import assert from "node:assert/strict";
import { resolveCreatorScriptNaturalRefinementIntent as resolve } from "../lib/creator/creatorScriptNaturalRefinementIntent.ts";

let checks = 0;
function check(instruction, selected, expected) {
  assert.deepEqual(resolve(instruction, selected), expected, instruction);
  checks++;
}
const ready = (scope, mode) => ({ status: "ready", scope, mode });
check("", false, {status:"empty"});
check("Make the opening more compelling without changing facts.", false, ready("opening","focused_edit"));
check("Strengthen the hook without inventing a scene.", false, ready("opening","focused_edit"));
check("Açılışı daha güçlü hale getir.", false, ready("opening","focused_edit"));
check("İlk paragrafı kısalt.", false, ready("opening","focused_edit"));
check("Improve this passage.", true, ready("selection","focused_edit"));
check("Seçili metni daha açık yaz.", true, ready("selection","focused_edit"));
check("Refine the selected text.", false, {status:"clarify",reason:"selection_required"});
check("Strengthen the second section's opposing argument.", false, ready("whole_script","editorial_rewrite"));
check("Rewrite the conclusion with a stronger closing question.", false, ready("whole_script","editorial_rewrite"));
check("Senaryonun tamamındaki tekrarları azalt.", false, ready("whole_script","editorial_rewrite"));
check("Improve the script's flow.", false, ready("whole_script","editorial_rewrite"));
check("Make transitions more natural.", false, ready("whole_script","editorial_rewrite"));
check("Improve the conclusion but don't change the opening.", false, ready("whole_script","editorial_rewrite"));
check("Revise the opening and the conclusion.", false, {status:"clarify",reason:"conflicting_targets"});
check("Rewrite the whole script.", true, {status:"clarify",reason:"conflicting_targets"});
check("Add new sources for the script's evidence.", false, ready("whole_script","research_backed_rewrite"));
check("Find additional studies and add verified evidence.", false, ready("whole_script","research_backed_rewrite"));
check("Strengthen the opening with new research.", false, ready("whole_script","research_backed_rewrite"));
check("Improve the whole script without adding new sources.", false, ready("whole_script","editorial_rewrite"));
check("Açılışı yeni kaynak eklemeden iyileştir.", false, ready("opening","focused_edit"));
console.log(JSON.stringify({status:"ISSUE50_SINGLE_PROMPT_INTENT_OFFLINE_PASS",checks,providerCalls:0,productionGateChanged:false}));
