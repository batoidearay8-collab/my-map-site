import React from "react";
import { useAppStore } from "../state/store";
import { t } from "../lib/i18n";

export function PrivacyBanner() {
  const cfg = useAppStore(s => s.config);
  const uiLang = useAppStore(s => s.uiLang);
  if (!cfg) return null;

  return (
    <div style={{ padding: "10px 12px" }}>
      <div className="danger">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "privacy_title")}</div>
        <div className="hint">{t(uiLang, "privacy_body")}</div>
      </div>
    </div>
  );
}
