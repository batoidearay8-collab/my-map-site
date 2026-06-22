import { useState } from "react";
import type { AppConfig } from "../../lib/schema";
import { t, langLabel } from "../../lib/i18n";
import type { BuilderContext } from "./types";
import { TEMPLATE_PREVIEWS } from "./utils";
import { TEMPLATE_SAMPLES } from "./sampleData";

export function StepTemplate(props: BuilderContext) {
  const { cfg, uiLang, importFlow, effectiveContentLang, defaultLang, supportedLangs, builderPois, setBuilderConfig, setBuilderData, setStep } = props;
  const ja = uiLang === "ja";

  // Template currently applied to the config.
  const [selectedTemplate, setSelectedTemplate] = useState<string>(cfg.template ?? "tourism");
  // Template clicked but NOT yet confirmed. null = no pending change.
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  // Whether to also load sample points/categories on confirm.
  const [withSample, setWithSample] = useState<boolean>(true);
  // Brief loading state while applying.
  const [applying, setApplying] = useState<boolean>(false);

  /** Mode a template implies (from its sample data), defaulting to current cfg. */
  const templateMode = (tmpl: string): AppConfig["mode"] => {
    const sample = TEMPLATE_SAMPLES[tmpl];
    return sample ? sample.mode : cfg.mode;
  };

  /** Click a template card → stage it as pending and show the change preview. */
  const pickTemplate = (tmpl: string) => {
    setPendingTemplate(tmpl);
    setWithSample(true);
  };
  const cancelPending = () => setPendingTemplate(null);

  /** Apply the pending template: switch mode, set reco, optionally load sample. */
  const confirmTemplate = () => {
    const tmpl = pendingTemplate;
    if (!tmpl) return;
    const info = TEMPLATE_PREVIEWS[tmpl];
    const sample = TEMPLATE_SAMPLES[tmpl];
    const mode = templateMode(tmpl);

    // Warn if loading sample would overwrite existing points.
    if (withSample && sample && builderPois.length > 0) {
      const msg = ja
        ? "現在の地点データをサンプルで置き換えます。よろしいですか？（今ある地点は消えます）"
        : "This will replace your current points with the sample. Continue? (existing points will be removed)";
      if (!window.confirm(msg)) return;
    }

    setApplying(true);
    // Short, visible "loading" so the change feels deliberate.
    setTimeout(() => {
      // Switch mode to match the template; keep indoor sub-config if present.
      const baseCfg: AppConfig =
        mode === "indoor"
          ? { ...cfg, template: tmpl as AppConfig["template"], mode: "indoor", indoor: { ...cfg.indoor } }
          : { ...cfg, template: tmpl as AppConfig["template"], mode: "outdoor" };
      const nextCfg: AppConfig = { ...baseCfg, reco: { needs: info?.needs ?? [], rules: (cfg.reco?.rules ?? {}) } };
      setBuilderConfig(nextCfg);

      if (withSample && sample) {
        setBuilderData(structuredClone(sample.pois), structuredClone(sample.categories));
      }

      setSelectedTemplate(tmpl);
      setPendingTemplate(null);
      setApplying(false);
    }, 450);
  };

  const editingLangLabel = langLabel(effectiveContentLang, uiLang);
  const titleEditing = (effectiveContentLang === defaultLang) ? cfg.title : ((cfg.titleI18n ?? {})[effectiveContentLang] ?? "");
  const subtitleEditing = (effectiveContentLang === defaultLang) ? (cfg.subtitle ?? "") : ((cfg.subtitleI18n ?? {})[effectiveContentLang] ?? "");

  // Details for the pending-change preview panel.
  const pInfo = pendingTemplate ? TEMPLATE_PREVIEWS[pendingTemplate] : null;
  const pSample = pendingTemplate ? TEMPLATE_SAMPLES[pendingTemplate] : null;
  const pMode = pendingTemplate ? templateMode(pendingTemplate) : cfg.mode;
  const modeChanges = pendingTemplate ? pMode !== cfg.mode : false;
  const modeLabel = (m: AppConfig["mode"]) => (m === "indoor" ? (ja ? "屋内" : "Indoor") : (ja ? "屋外" : "Outdoor"));

  return (
    <div className="cards">
      {/* Basic settings */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "template_title")}</div>
        <div className="grid2">
          <label>
            {t(uiLang, "mode")}
            <select value={cfg.mode} onChange={(e) => {
              const mode = e.target.value as AppConfig["mode"];
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
          {ja ? "用途テンプレートを選ぶ" : "Choose a purpose template"}
        </div>
        <div className="hint" style={{ marginBottom: 12 }}>
          {ja
            ? "テンプレートを選ぶと、変更内容のプレビューが表示されます。確認して「このテンプレートにする」を押すと反映されます。"
            : "Pick a template to preview what will change. Press confirm to apply it."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
          {Object.entries(TEMPLATE_PREVIEWS).map(([key, info]) => {
            const label = ja ? info.ja : info.en;
            const isActive = selectedTemplate === key && !pendingTemplate;
            const isPending = pendingTemplate === key;
            const m = templateMode(key);
            return (
              <button key={key} type="button" onClick={() => pickTemplate(key)} style={{
                border: `2px solid ${isPending ? "#e0533d" : isActive ? "var(--accent)" : "var(--line)"}`,
                background: isPending
                  ? "color-mix(in srgb, #e0533d 10%, var(--card))"
                  : isActive ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : "var(--card)",
                borderRadius: 14, padding: "14px 10px 12px", cursor: "pointer",
                textAlign: "center", color: "var(--text)", transition: "all .15s", position: "relative",
              }}>
                <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>{info.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: isPending ? "#e0533d" : isActive ? "var(--accent)" : "var(--text)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  {m === "indoor" ? (ja ? "屋内" : "Indoor") : (ja ? "屋外" : "Outdoor")}
                </div>
                {isActive ? (
                  <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>{ja ? "● 適用中" : "● Applied"}</div>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Pending-change preview + confirm */}
        {pendingTemplate && pInfo ? (
          <div style={{ marginTop: 14, padding: 16, background: "var(--card2)", borderRadius: 14, border: "2px solid #e0533d" }}>
            <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 15 }}>
              {ja ? `「${pInfo.ja}」にすると、次の変更が行われます` : `Applying "${pInfo.en}" will make these changes`}
            </div>

            {/* mode change */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>{ja ? "表示モード" : "Map mode"}</div>
              {modeChanges ? (
                <div style={{ fontSize: 14 }}>
                  <span className="badge">{modeLabel(cfg.mode)}</span>
                  <span style={{ margin: "0 8px", color: "#e0533d", fontWeight: 700 }}>→</span>
                  <span className="badge" style={{ background: "color-mix(in srgb, #e0533d 16%, var(--card))" }}>{modeLabel(pMode)}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{ja ? "に切り替わります" : "will switch"}</span>
                </div>
              ) : (
                <div style={{ fontSize: 14 }}>
                  <span className="badge">{modeLabel(pMode)}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{ja ? "（変更なし）" : "(no change)"}</span>
                </div>
              )}
            </div>

            {/* recommended */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>{ja ? "おすすめ表示" : "Recommended spots"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pInfo.needs.length > 0
                  ? pInfo.needs.map(n => <span key={n} className="badge">{n}</span>)
                  : <span style={{ fontSize: 13, color: "var(--muted)" }}>{ja ? "なし（設定されません）" : "None"}</span>}
              </div>
            </div>

            {/* sample data */}
            {pSample ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginBottom: 6 }}>
                  <input type="checkbox" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} />
                  {ja ? `サンプルデータを入れる（${pSample.pois.length}地点・${pSample.categories.length}カテゴリ）` : `Load sample data (${pSample.pois.length} points, ${pSample.categories.length} categories)`}
                </label>
                {withSample ? (
                  <div style={{ paddingLeft: 26 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{ja ? "追加されるカテゴリ:" : "Categories added:"}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                      {pSample.categories.map(c => (
                        <span key={c.category} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>{c.icon}</span>{ja ? c.label : (c.labelI18n?.en ?? c.label)}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{ja ? "追加される地点（例）:" : "Sample points:"}</div>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>
                      {pSample.pois.map(p => (ja ? p.name : (p.nameI18n?.en ?? p.name))).join(" / ")}
                    </div>
                    {builderPois.length > 0 ? (
                      <div className="hint" style={{ marginTop: 6, color: "#c0392b" }}>
                        {ja ? `※ 今ある ${builderPois.length} 件の地点は置き換えられます。` : `※ Your current ${builderPois.length} point(s) will be replaced.`}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="hint" style={{ paddingLeft: 26 }}>
                    {ja ? "チェックを外すと、地点・カテゴリは追加されません（モードとおすすめ表示だけ変更）。" : "Unchecked: only mode and recommended spots change; no points/categories are added."}
                  </div>
                )}
              </div>
            ) : (
              <div className="hint" style={{ marginBottom: 12 }}>
                {ja ? "このテンプレートにはサンプルデータがありません。" : "No sample data for this template."}
              </div>
            )}

            {/* actions */}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn soft" onClick={cancelPending} disabled={applying}>
                {ja ? "キャンセル" : "Cancel"}
              </button>
              <button type="button" className="btn primary" onClick={confirmTemplate} disabled={applying}>
                {applying ? (ja ? "適用中…" : "Applying…") : (ja ? "このテンプレートにする" : "Use this template")}
              </button>
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
