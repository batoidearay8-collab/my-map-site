import React from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ViewerPage } from "./pages/ViewerPage";
import { BuilderPage } from "./pages/BuilderPage";
import { useAppStore } from "./state/store";
import { PrivacyBanner } from "./components/PrivacyBanner";
import { t, langLabel, type UiLang } from "./lib/i18n";
import { pickConfigTitle, pickConfigSubtitle } from "./lib/contentText";
import { publicUrl } from "./lib/publicUrl";

function applyTheme(theme: "dark" | "light" | "system") {
  const root = document.documentElement;
  const set = (v: "dark" | "light") => root.setAttribute("data-theme", v);

  if (theme === "dark") return set("dark");
  if (theme === "light") return set("light");

  // system
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  set(mq?.matches ? "dark" : "light");
}

export function App() {
  const loc = useLocation();
  const navigate = useNavigate();
  const cfg = useAppStore(s => s.config);
  const isPublish = (import.meta as any).env?.VITE_PUBLISH === "1";

  // Show the logo if it exists.
  // Prefer raster first because some browsers restrict external resources referenced inside SVGs
  // when the SVG is loaded via <img> (which can lead to a blank image even though the request
  // succeeds). If a user provides only SVG, we still fall back to it.
  const logoCandidates = [
    "brand/logo.png",
    "brand/logo.webp",
    "brand/logo.jpg",
    "brand/logo.jpeg",
    "brand/logo.svg",
  ];
  const [logoIdx, setLogoIdx] = React.useState(0);


  const uiLang = useAppStore(s => s.uiLang);
  const startNewMap = useAppStore(s => s.startNewMap);
  const contentLang = useAppStore(s => s.contentLang);
  const setUiLang = useAppStore(s => s.setUiLang);
  const setContentLang = useAppStore(s => s.setContentLang);

  const uiTheme = useAppStore(s => s.uiTheme);
  const setUiTheme = useAppStore(s => s.setUiTheme);

  React.useEffect(() => {
    applyTheme(uiTheme);
    if (uiTheme === "system") {
      const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
      const on = () => applyTheme("system");
      mq?.addEventListener?.("change", on);
      return () => mq?.removeEventListener?.("change", on);
    }
    return;
  }, [uiTheme]);

  const supportedLangs = cfg?.i18n?.supportedLangs?.length ? cfg.i18n.supportedLangs : ["ja", "en"];

  const frameworkName = uiLang === "ja" ? "AtlasKobo — 地図サイト制作キット" : "AtlasKobo — Map Site Builder Kit";
  const title = cfg ? pickConfigTitle(cfg, contentLang) : frameworkName;
  // Show subtitle only if user configured it (avoid fixed marketing copy in the template).
  const subtitle = cfg ? (pickConfigSubtitle(cfg, contentLang) || "") : "";

  React.useEffect(() => {
    document.title = frameworkName;
  }, [frameworkName, title]);

  function setLangBoth(lang: string) {
    setContentLang(lang);
    const nextUi: UiLang = lang.toLowerCase().startsWith("en") ? "en" : "ja";
    setUiLang(nextUi);
  }

  return (
    <>
      <header className="topbar">
        <div className="brand" aria-label={title}>
          {logoIdx < logoCandidates.length ? (
            <img
              className="brandLogo"
              src={publicUrl(logoCandidates[logoIdx])}
              alt={title}
              onError={() => setLogoIdx((i) => i + 1)}
            />
          ) : (
            <div>
              <div className="title">{title}</div>
              {subtitle ? <div className="subtitle">{subtitle}</div> : null}
            </div>
          )}
        </div>

        <div className="controls">
          <label className="inlineLabel">
            {t(uiLang, "language")}
            <select value={contentLang} onChange={(e) => setLangBoth(e.target.value)}>
              {supportedLangs.map(l => (
                <option key={l} value={l}>{langLabel(l, uiLang)}</option>
              ))}
            </select>
          </label>

          <label className="inlineLabel">
            {t(uiLang, "theme")}
            <select value={uiTheme} onChange={(e) => setUiTheme(e.target.value as any)}>
              <option value="system">{t(uiLang, "theme_system")}</option>
              <option value="dark">{t(uiLang, "theme_dark")}</option>
              <option value="light">{t(uiLang, "theme_light")}</option>
            </select>
          </label>

          {!isPublish ? (
            <button
              className="btn soft"
              onClick={() => {
                if (!window.confirm(t(uiLang, "confirm_new_map"))) return;
                startNewMap();
                navigate("/builder");
              }}
            >
              {t(uiLang, "new_map")}
            </button>
          ) : null}

          <Link className={"btn " + (loc.pathname.startsWith("/builder") ? "" : "primary")} to="/">{t(uiLang, "viewer")}</Link>
          {!isPublish ? (
            <Link className={"btn " + (loc.pathname.startsWith("/builder") ? "primary" : "")} to="/builder">{t(uiLang, "builder")}</Link>
          ) : null}

          {!isPublish ? (
            <Link className="btn" to="/builder?mode=import">{t(uiLang, "edit_map")}</Link>
          ) : null}
        </div>
      </header>

      <PrivacyBanner />

      <Routes>
        <Route path="/" element={<ViewerPage />} />
        {!isPublish ? (
        <Route path="/builder" element={<BuilderPage />} />
        ) : null}
        <Route path="*" element={<div style={{ padding: 12 }}>Not found</div>} />
      </Routes>
    </>
  );
}