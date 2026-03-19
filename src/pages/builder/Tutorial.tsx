import { useState } from "react";
import type { UiLang } from "../../lib/i18n";
import type { Step } from "./types";

const TUTORIAL_STEPS = [
  {
    ja: { title: "AtlasKoboへようこそ 🗺️", body: "このツールでは、地図サイトを3ステップで作れます。まずはテンプレート（目的）を選びましょう。" },
    en: { title: "Welcome to AtlasKobo 🗺️", body: "Build a map site in 3 steps. First, pick a template that fits your purpose." },
    target: 1,
  },
  {
    ja: { title: "地点を追加しよう 📍", body: "「2.データ・画像」でスポット（マーカー）を追加します。「地点を追加」ボタンを押してみましょう。" },
    en: { title: "Add places 📍", body: "Go to '2.Data & images' and press 'Add place' to add your first spot." },
    target: 2,
  },
  {
    ja: { title: "完成イメージを確認 👀", body: "「3.できあがり確認」で公開サイトのプレビューが見られます。OKなら「4.公開」でZIPをダウンロードして完成！" },
    en: { title: "Preview & publish 👀", body: "Check '3.Check' to preview the published site. When ready, go to '4.Publish' to download the ZIP." },
    target: 3,
  },
] as const;

export function Tutorial(props: {
  uiLang: UiLang;
  setStep: (step: Step) => void;
}) {
  const { uiLang, setStep } = props;

  const [step, setTutorialStep] = useState<number>(() => {
    try { return localStorage.getItem("atlaskobo_tutorial_done") === "1" ? -1 : 0; } catch { return 0; }
  });

  const dismiss = () => {
    try { localStorage.setItem("atlaskobo_tutorial_done", "1"); } catch {}
    setTutorialStep(-1);
  };

  if (step < 0 || step >= TUTORIAL_STEPS.length) return null;

  const ts = TUTORIAL_STEPS[step];
  const txt = uiLang === "ja" ? ts.ja : ts.en;
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--card)", borderRadius: 20, padding: "28px 28px 22px",
        maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{txt.title}</div>
          <button onClick={dismiss} style={{
            background: "transparent", border: "none", color: "var(--muted)",
            fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px",
          }}>✕</button>
        </div>
        <div style={{ color: "var(--muted)", lineHeight: 1.7, marginBottom: 20, fontSize: 14 }}>{txt.body}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {TUTORIAL_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 8, height: 8, borderRadius: 999,
              background: i === step ? "var(--accent)" : "var(--line)",
              transition: "all .2s",
            }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button className="btn soft" onClick={dismiss} style={{ fontSize: 13 }}>
            {uiLang === "ja" ? "スキップ" : "Skip"}
          </button>
          <button className="btn primary" onClick={() => {
            if (isLast) { dismiss(); setStep(ts.target as Step); }
            else { setTutorialStep(s => s + 1); setStep(ts.target as Step); }
          }}>
            {isLast
              ? (uiLang === "ja" ? "はじめる 🚀" : "Let's go 🚀")
              : (uiLang === "ja" ? "次へ →" : "Next →")}
          </button>
        </div>
      </div>
    </div>
  );
}
