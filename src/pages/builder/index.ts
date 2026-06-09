/**
 * Builder sub-components — barrel export.
 *
 * CURRENT STATUS: These components are extracted reference implementations
 * of the corresponding sections in BuilderPage.tsx. They are NOT yet
 * imported by BuilderPage.tsx — the main file still contains inline code.
 *
 * MIGRATION PLAN:
 * 1. Each step component receives a `BuilderContext` via props
 * 2. Shared utilities and constants are in ./utils.ts
 * 3. To connect: import into BuilderPage.tsx, replace inline JSX sections
 *    with the component, and pass the BuilderContext props
 *
 * NOTE: After significant changes to BuilderPage.tsx (e.g. multi-floor),
 * these sub-components may be out of sync. Re-sync before connecting.
 */
export { StepImport } from "./StepImport";
export { StepTemplate } from "./StepTemplate";
export { StepPublish } from "./StepPublish";
export { Tutorial } from "./Tutorial";
export type { BuilderContext, Step, EditorMode, ApplyState } from "./types";
export {
  nextSequentialPoiId, clamp01, round4, round6,
  csvEscape, poisToCsv, categoriesToCsv,
  ensureDefaultCategory, hashString,
  MARKER_TYPES, TEMPLATE_PREVIEWS,
} from "./utils";
