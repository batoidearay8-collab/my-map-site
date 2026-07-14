import { useEffect, useRef, useState } from "react";
import type { UiLang } from "../lib/i18n";
import {
  isMetricsEnabled,
  resumeMetricsIfConsented,
  startMetrics,
  stopMetricsAndErase,
  metricsSetContext,
  installMetricsListeners,
  getMetricsData,
  getParticipantId,
  currentTotalActiveMs,
  formatDuration,
  metricsToCsv,
} from "../lib/builderMetrics";

/**
 * ResearchPanel — the ONLY visible surface of the builder research mode.
 *
 * Invisible to normal users. It appears only when:
 *   a) the builder URL contains `research=1` (e.g. `#/builder?research=1`), or
 *   b) a previous consent for this browser exists (measurement resumes).
 *
 * Flow: consent dialog (with anonymous participant id) → floating widget
 * showing live active time → export JSON/CSV → optional end-and-erase.
 * All data is localStorage-only; this component performs no network I/O.
 */

type Props = {
  uiLang: UiLang;
  /** Current builder step (0–4). */
  step: number;
  /** Whether the FloorPlanEditor modal is open (overrides step attribution). */
  floorEditorOpen: boolean;
};

const T = (lang: UiLang, ja: string, en: string) => (lang === "ja" ? ja : en);

function hashHasResearchParam(): boolean {
  try {
    const q = window.location.hash.split("?")[1] ?? "";
    return new URLSearchParams(q).get("research") === "1";
  } catch {
    return false;
  }
}

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResearchPanel({ uiLang, step, floorEditorOpen }: Props) {
  const [running, setRunning] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [pid, setPid] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [, tick] = useState(0);
  const uninstall = useRef<(() => void) | null>(null);

  // Decide on mount: resume previous consent, or show the dialog if ?research=1.
  useEffect(() => {
    if (resumeMetricsIfConsented()) {
      setRunning(true);
    } else if (hashHasResearchParam()) {
      setAskConsent(true);
    }
  }, []);

  // Install/remove global listeners with the running state.
  useEffect(() => {
    if (running) {
      uninstall.current = installMetricsListeners();
      const iv = setInterval(() => tick((n) => n + 1), 1000);
      return () => {
        uninstall.current?.();
        uninstall.current = null;
        clearInterval(iv);
      };
    }
  }, [running]);

  // Report the current context (floor editor wins over the step).
  useEffect(() => {
    if (!running) return;
    metricsSetContext(floorEditorOpen ? "floorEditor" : `step${step}`);
  }, [running, step, floorEditorOpen]);

  const onConsent = () => {
    startMetrics(pid || "P??");
    setAskConsent(false);
    setRunning(true);
  };

  const exportJson = () => {
    const d = getMetricsData();
    if (!d) return;
    download(`atlaskobo-metrics-${d.participantId}.json`, JSON.stringify(d, null, 2), "application/json");
  };
  const exportCsv = () => {
    const d = getMetricsData();
    if (!d) return;
    download(`atlaskobo-metrics-${d.participantId}.csv`, metricsToCsv(d), "text/csv");
  };
  const endAndErase = () => {
    stopMetricsAndErase();
    setRunning(false);
    setConfirmEnd(false);
  };

  /* ── Consent dialog ── */
  if (askConsent) {
    return (
      <div role="dialog" aria-modal="true" style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
        <div style={{
          background: "var(--card, #fff)", color: "var(--text, #222)", borderRadius: 16,
          padding: 20, maxWidth: 520, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,.3)",
        }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
            🔬 {T(uiLang, "研究モード（作業時間の計測）", "Research mode (work-time measurement)")}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
            {T(uiLang,
              "地図作成にかかる時間を調べる研究のため、次のデータをこのパソコンの中だけに記録します。",
              "For a study on map-creation time, the following is recorded on this computer only.")}
            <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
              <li>{T(uiLang, "作業時間（画面のどのステップで何分作業したか）", "Active work time per builder step")}</li>
              <li>{T(uiLang, "操作の回数（元に戻すの回数、エラー表示の回数など）", "Operation counts (undo, error messages, etc.)")}</li>
            </ul>
            {T(uiLang,
              "名前などの個人情報は記録しません。データはどこにも送信されず、「書き出す」ボタンを押してファイルを渡さない限り外に出ることはありません。参加は任意で、いつでもやめて記録を消せます。",
              "No personal information is recorded. Nothing is transmitted anywhere; data leaves this computer only when you press Export and hand over the file. Participation is voluntary; you can quit and erase the records at any time.")}
          </div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 14 }}>
            {T(uiLang, "参加者ID（例: P01）", "Participant ID (e.g. P01)")}
            <input value={pid} onChange={(e) => setPid(e.target.value)}
              placeholder="P01" style={{ width: "100%", marginTop: 4 }} />
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn soft" onClick={() => setAskConsent(false)}>
              {T(uiLang, "参加しない", "Do not participate")}
            </button>
            <button className="btn primary" onClick={onConsent} disabled={!pid.trim()}>
              {T(uiLang, "同意して計測を始める", "Consent and start")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!running || !isMetricsEnabled()) return null;

  /* ── Floating status widget ── */
  return (
    <div style={{
      position: "fixed", left: 12, bottom: 12, zIndex: 950,
      background: "var(--card, #fff)", color: "var(--text, #222)",
      border: "2px solid #7c5cd6", borderRadius: 12, padding: "8px 10px",
      boxShadow: "0 6px 20px rgba(0,0,0,.2)", fontSize: 12, maxWidth: 240,
    }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>
        🔬 {T(uiLang, "計測中", "Measuring")}: {getParticipantId()} ・ {formatDuration(currentTotalActiveMs())}
      </div>
      {!confirmEnd ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button className="btn soft" style={{ fontSize: 11, padding: "2px 8px" }} onClick={exportCsv}>CSV</button>
          <button className="btn soft" style={{ fontSize: 11, padding: "2px 8px" }} onClick={exportJson}>JSON</button>
          <button className="btn soft" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setConfirmEnd(true)}>
            {T(uiLang, "終了", "End")}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 6 }}>
            {T(uiLang, "計測を終了して記録を全て削除しますか？（書き出しがまだなら先にCSV/JSONを保存してください）",
              "End measurement and erase all records? (Export CSV/JSON first if you haven't.)")}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn soft" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setConfirmEnd(false)}>
              {T(uiLang, "戻る", "Back")}
            </button>
            <button className="btn primary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={endAndErase}>
              {T(uiLang, "削除して終了", "Erase and end")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
