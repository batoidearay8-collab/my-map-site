import { useEffect, useState } from "react";
import { getConsentState, setConsent } from "../lib/researchLog";

type Props = {
  uiLang: "ja" | "en";
  /** Configured research settings from AppConfig.research */
  projectName?: string;
  contactEmail?: string;
  collectLogs?: boolean;
  /** Called after the user makes a decision */
  onDecision?: (consented: boolean) => void;
};

/**
 * Research consent dialog — shown on first visit when research mode is enabled.
 *
 * Decision is stored in localStorage; subsequent visits don't show the dialog
 * unless the user clears storage.
 */
export function ConsentDialog(props: Props) {
  const { uiLang, projectName, contactEmail, collectLogs, onDecision } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const state = getConsentState();
    if (!state.decided) {
      // Slight delay so the page renders first, then dialog appears
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  if (!open) return null;

  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  const handle = (consented: boolean) => {
    setConsent(consented);
    setOpen(false);
    onDecision?.(consented);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "var(--surface-1)",
          color: "var(--text)",
          maxWidth: 520,
          width: "100%",
          padding: 24,
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--line-strong)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">📋</div>
        <h2 id="consent-title" style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600 }}>
          {t("研究へのご協力のお願い", "Research Participation Notice")}
        </h2>

        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", margin: "0 0 16px" }}>
          {projectName ? (
            <strong style={{ color: "var(--text)" }}>{projectName}<br /></strong>
          ) : null}
          {t(
            "このマップは学術研究の一環として運営されています。皆様の利用方法を分析し、より使いやすいマップツールの開発に役立てます。",
            "This map is part of an academic research study. We analyze how it is used to develop more usable mapping tools."
          )}
        </p>

        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: 14,
            margin: "0 0 16px",
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <strong style={{ display: "block", marginBottom: 6 }}>
            {t("ご協力いただく場合に収集するデータ", "Data we collect with your consent")}
          </strong>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>{t("地点（POI）の閲覧履歴 — 地点IDと時刻のみ", "POI views — only the POI ID and timestamp")}</li>
            <li>{t("検索キーワード", "Search keywords")}</li>
            <li>{t("フロアやカテゴリの切替操作", "Floor and category filter changes")}</li>
            <li>{t("ルート検索の操作（出発・目的のID）", "Route searches (POI IDs only)")}</li>
          </ul>
          <strong style={{ display: "block", marginTop: 10, marginBottom: 6 }}>
            {t("収集しないデータ", "What we do NOT collect")}
          </strong>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>{t("お名前・メールアドレス・連絡先", "Name, email, or contact info")}</li>
            <li>{t("個人を特定できる情報", "Personally identifiable information")}</li>
            <li>{t("デバイスのフィンガープリント", "Device fingerprints")}</li>
          </ul>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 16px" }}>
          {t(
            "ご協力いただかなくても、マップの全機能はそのままお使いいただけます。後で同意を撤回することもできます。",
            "Declining will not affect any map functionality. You may withdraw consent at any time."
          )}
          {contactEmail ? (
            <>
              <br />
              {t("お問い合わせ: ", "Contact: ")}
              <a href={`mailto:${contactEmail}`} style={{ color: "var(--accent)" }}>{contactEmail}</a>
            </>
          ) : null}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn"
            onClick={() => handle(false)}
            style={{ minWidth: 140 }}
          >
            {t("協力しない", "Decline")}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => handle(true)}
            style={{ minWidth: 140 }}
          >
            {t("協力する（同意）", "Consent")}
          </button>
        </div>
      </div>
    </div>
  );
}
