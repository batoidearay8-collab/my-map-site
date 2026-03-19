import React, { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAppStore } from "../state/store";
import { t } from "../lib/i18n";

export function PrivacyBanner() {
  const cfg = useAppStore(s => s.config);
  const uiLang = useAppStore(s => s.uiLang);
  const location = useLocation();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("msf.privacyDismissed") === "1";
    } catch {
      return false;
    }
  });

  const onDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem("msf.privacyDismissed", "1");
    } catch {}
  }, []);

  if (!cfg) return null;

  // In viewer (non-builder), hide after first dismiss
  const isBuilder = location.pathname.startsWith("/builder");
  if (!isBuilder && dismissed) return null;

  return (
    <div className="privacyBanner" role="alert">
      <div className="danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "privacy_title")}</div>
          <div className="hint">{t(uiLang, "privacy_body")}</div>
        </div>
        {!isBuilder ? (
          <button
            className="dismissBtn"
            onClick={onDismiss}
            aria-label={t(uiLang, "privacy_dismiss")}
            title={t(uiLang, "privacy_dismiss")}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
