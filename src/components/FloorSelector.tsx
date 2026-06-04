import React from "react";
import type { AppConfig, FloorDef } from "../lib/schema";
import type { UiLang } from "../lib/i18n";

function pickFloorLabel(floor: FloorDef, lang: string): string {
  const i18n = (floor.labelI18n?.[lang] ?? "").trim();
  if (i18n) return i18n;
  return (floor.label ?? "").trim() || floor.id;
}

export function FloorSelector(props: {
  config: AppConfig;
  activeFloor: string;
  onChange: (floorId: string) => void;
  contentLang?: string;
  uiLang?: UiLang;
}) {
  const { config, activeFloor, onChange, contentLang } = props;
  const lang = contentLang ?? config.i18n?.defaultLang ?? "ja";
  const floors = config.indoor.floors ?? [];

  // Single floor or no floors defined: nothing to show
  if (floors.length < 2) return null;

  return (
    <div className="msf-floorSelector" role="tablist" aria-label="Floor selector">
      {floors.map((f) => {
        const isActive = f.id === activeFloor;
        return (
          <button
            key={f.id}
            role="tab"
            aria-selected={isActive}
            className={"msf-floorBtn" + (isActive ? " active" : "")}
            onClick={() => onChange(f.id)}
            type="button"
          >
            {pickFloorLabel(f, lang)}
          </button>
        );
      })}
    </div>
  );
}
