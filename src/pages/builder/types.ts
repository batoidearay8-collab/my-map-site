/**
 * Shared types for Builder step components.
 *
 * Each step receives a `BuilderContext` via props so it can read/write
 * the builder state without importing the full Zustand store directly.
 */
import type { AppConfig, Poi, Category } from "../../lib/schema";
import type { ThemePreset } from "../../lib/export";
import type { UiLang } from "../../lib/i18n";

export type Step = 0 | 1 | 2 | 3 | 4;
export type EditorMode = "easy" | "csv";
export type ApplyState = "idle" | "pending" | "applied";

export type BuilderAssets = {
  floorFile?: File;
  images: Record<string, File>;
};

/** Props shared by all step components. */
export type BuilderContext = {
  cfg: AppConfig;
  builderPois: Poi[];
  builderCategories: Category[];
  builderAssets: BuilderAssets;

  setBuilderConfig: (cfg: AppConfig) => void;
  setBuilderData: (pois: Poi[], categories: Category[]) => void;
  updateBuilderPoi: (poi: Poi) => void;
  setBuilderAsset: (kind: "floor" | "image", key: string, file: File) => void;
  removeBuilderAsset: (kind: "floor" | "image", key?: string) => void;

  previewBuilder: () => void;

  uiLang: UiLang;
  contentLang: string;
  effectiveContentLang: string;
  supportedLangs: string[];
  defaultLang: string;

  setStep: (step: Step) => void;
  importFlow: boolean;
};
