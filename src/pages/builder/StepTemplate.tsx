import { useState } from "react";
import type { AppConfig } from "../../lib/schema";
import { t, langLabel } from "../../lib/i18n";
import type { BuilderContext } from "./types";
import { TEMPLATE_PREVIEWS } from "./utils";

export function StepTemplate(props: BuilderContext) {
  const { cfg, uiLang, importFlow, effectiveContentLang, defaultLang, supportedLangs, setBuilderConfig, setStep } = props;

  const [selectedTemplate, setSelectedTemplate] = useState<string>(cfg.template ?? "tourism");

  const applyTemplate = (tmpl: string) => {
    setSelectedTemplate(tmpl);
    const info = TEMPLATE_PREVIEWS[tmpl];
    if (!info) return;
    setBuilderConfig({ ...cfg, template: tmpl as AppConfig["template"], reco: { needs: info.needs, rules: (cfg.reco?.rules ?? {}) } });
  };

  const editingLangLabel = langLabel(effectiveContentLang, uiLang);
  const titleEditing = (effectiveContentLang === defaultLang) ? cfg.title : ((cfg.titleI18n ?? {})[effectiveContentLang] ?? "");
  const subtitleEditing = (effectiveContentLang === defaultLang) ? (cfg.subtitle ?? "") : ((cfg.subtitleI18n ?? {})[effectiveContentLang] ?? "");

  return (
    <div className="cards">
      {/* Basic settings */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "template_title")}</div>
        <div className="grid2">
          <label>
            {t(uiLang, "mode")}
            <select value={cfg.mode} onChange={(e) => {
              const mode = e.target.value as any;
              if (mode === "indoor") setBuilderConfig({ ...cfg, mode: "indoor", indoor: { ...cfg.indoor } });
              else setBuilderConfig({ ...cfg, mode: "outdoor" });
            }}>
              <option value="outdoor">{t(uiLang, "mode_outdoor")}</option>
              <option value="indoor">{t(uiLang, "mode_indoor")}</option>
            </select>
          </label>

          <label>
            {t(uiLang, "default_lang")}
            <select value={cfg.i18n.defaultLang} onChange={(e) => setBuilderConfig({ ...cfg, i18n: { ...cfg.i18n, defaultLang: e.target.value } })}>
              {supportedLangs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>

          <label>
            {t(uiLang, "title")} <span className="badge">({editingLangLabel})</span>
            <input value={titleEditing} onChange={(e) => {
              const v = e.target.value;
              if (effectiveContentLang === defaultLang) setBuilderConfig({ ...cfg, title: v });
              else setBuilderConfig({ ...cfg, titleI18n: { ...(cfg.titleI18n ?? {}), [effectiveContentLang]: v } });
            }} />
          </label>

          <label>
            {t(uiLang, "subtitle")} <span className="badge">({editingLangLabel})</span>
            <input value={subtitleEditing} onChange={(e) => {
              const v = e.target.value;
              if (effectiveContentLang === defaultLang) setBuilderConfig({ ...cfg, subtitle: v });
              else setBuilderConfig({ ...cfg, subtitleI18n: { ...(cfg.subtitleI18n ?? {}), [effectiveContentLang]: v } });
            }} />
          </label>

          <label>
            {t(uiLang, "tab_title")}
            <input
              value={cfg.ui?.tabTitle ?? "AtlasKobo — 地図サイト制作キット"}
              onChange={(e) => setBuilderConfig({ ...cfg, ui: { ...(cfg.ui ?? {}), tabTitle: e.target.value } })}
            />
          </label>

          {cfg.mode === "indoor" ? (
            <div className="hint" style={{ gridColumn: "1 / -1" }}>
              {uiLang === "ja"
                ? "屋内画像のサイズ（横幅/縦幅）は、フロア画像をアップロードしたときに自動で読み取ります。"
                : "Indoor image size (width/height) will be detected automatically when you upload the floor image."}
            </div>
          ) : null}
        </div>

        <div className="row" style={{ marginTop: 10, justifyContent: importFlow ? "space-between" : "flex-end" }}>
          {importFlow ? (
            <button className="btn soft" onClick={() => setStep(0)}>{t(uiLang, "back")}（{t(uiLang, "step_import")}）</button>
          ) : <span />}
          <button className="btn primary" onClick={() => setStep(2)}>{t(uiLang, "next_assets")}</button>
        </div>
      </div>

      {/* Hint */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "template_hint_title")}</div>
        <div className="hint">{t(uiLang, "template_hint_body")}</div>
      </div>

      {/* Template preview cards */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 4 }}>
          {uiLang === "ja" ? "用途テンプレートを選ぶ" : "Choose a purpose template"}
        </div>
        <div className="hint" style={{ marginBottom: 12 }}>
          {uiLang === "ja"
            ? "テンプレートを選ぶと、おすすめ表示の初期設定が自動で入ります。あとから変更できます。"
            : "Selecting a template auto-fills the recommended spots settings. You can change them later."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
          {Object.entries(TEMPLATE_PREVIEWS).map(([key, info]) => {
            const label = uiLang === "ja" ? info.ja : info.en;
            const isActive = selectedTemplate === key;
            return (
              <button key={key} type="button" onClick={() => applyTemplate(key)} style={{
                border: `2px solid ${isActive ? "var(--accent)" : "var(--line)"}`,
                background: isActive ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : "var(--card)",
                borderRadius: 14, padding: "14px 10px 12px", cursor: "pointer",
                textAlign: "center", color: "var(--text)", transition: "all .15s",
              }}>
                <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>{info.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? "var(--accent)" : "var(--text)" }}>{label}</div>
                {info.needs.length > 0 ? (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                    {info.needs.slice(0, 2).join(" · ")}{info.needs.length > 2 ? " …" : ""}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
        {selectedTemplate && TEMPLATE_PREVIEWS[selectedTemplate] ? (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--card2)", borderRadius: 12, border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              {uiLang === "ja" ? "このテンプレートのおすすめ表示:" : "Recommended spots for this template:"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TEMPLATE_PREVIEWS[selectedTemplate].needs.length > 0
                ? TEMPLATE_PREVIEWS[selectedTemplate].needs.map(n => (
                    <span key={n} className="badge">{n}</span>
                  ))
                : <span style={{ fontSize: 12, color: "var(--muted)" }}>{uiLang === "ja" ? "（なし）" : "(none)"}</span>
              }
            </div>
          </div>
        ) : null}
      </div>

      {/* Reco settings */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 4 }}>
          {uiLang === "ja" ? "おすすめ表示の設定" : "Recommended Spots Settings"}
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          {uiLang === "ja"
            ? "公開サイトの上部に「おすすめ」セクションを表示します。カテゴリ名をカンマ区切りで入力してください。"
            : "Shows a 'Recommended' section at the top of the published site. Enter category names separated by commas."}
        </div>
        <label>
          {uiLang === "ja" ? "おすすめカテゴリ（カンマ区切り）" : "Recommended categories (comma-separated)"}
          <input
            placeholder={uiLang === "ja" ? "例: お土産, 駅, 飯屋" : "e.g. souvenir, station, restaurant"}
            value={(cfg.reco?.needs ?? []).join(", ")}
            onChange={(e) => {
              const needs = e.target.value.split(/[,、，]/).map(s => s.trim()).filter(Boolean);
              setBuilderConfig({ ...cfg, reco: { needs, rules: (cfg.reco?.rules ?? {}) } });
            }}
          />
        </label>
        {(cfg.reco?.needs ?? []).length > 0 ? (
          <div className="hint" style={{ marginTop: 8 }}>
            {uiLang === "ja" ? "設定済み: " : "Set: "}
            {(cfg.reco?.needs ?? []).map(n => (
              <span key={n} className="badge" style={{ marginRight: 4 }}>{n}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
