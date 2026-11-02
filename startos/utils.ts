import { configJson } from './fileModels/config.json'
import { catalogToEditor, editorToCatalog } from './actions/shoppingCatalog'
import { exampleChores } from './actions/choreExamples'

// Constants and helper functions shared across this package's startos/ code go
// here. `uiPort` is the port the example daemon serves on: main.ts health-checks
// it, and you bind it from an interface in interfaces.ts once you add one. Change
// it to whatever your service listens on.
export const uiPort = 80

// Persist the editor's starter preview on install/upgrade so the frame can
// consume it before Edit Shopping is first saved. Never reset a saved bank.
export async function initializeShoppingDefaults(
  effects: Parameters<typeof configJson.merge>[0],
) {
  const cfg = await configJson.read().once()
  if (cfg?.shopping.defaults) return
  const editor = catalogToEditor(
    cfg?.shopping || { stores: [], categories: [], items: [] },
  )
  const { defaults } = editorToCatalog(editor)
  await configJson.merge(effects, { shopping: { defaults } })
}

// Persist the editable example chores once. An absent key is seeded; a saved
// empty list or edited bank is authoritative and must never be reseeded.
export async function initializeChores(
  effects: Parameters<typeof configJson.merge>[0],
) {
  const cfg = await configJson.read().once()
  if (cfg?.chores !== undefined) return
  await configJson.merge(effects, { chores: exampleChores() })
}
