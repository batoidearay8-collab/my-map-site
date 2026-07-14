import React, { useState } from "react";
import {
  hasMasterPassword,
  setMasterPassword,
  unlockMaster,
  isMasterUnlocked,
  lockMaster,
  clearMasterPassword,
} from "../lib/masterMode";

type Mode = "setup" | "unlock" | "manage";

type Props = {
  uiLang: "ja" | "en";
  onClose: () => void;
  onUnlocked?: () => void;
};

export function MasterModeDialog(props: Props) {
  const { uiLang, onClose, onUnlocked } = props;
  const [mode, setMode] = useState<Mode>(() => {
    if (isMasterUnlocked()) return "manage";
    if (hasMasterPassword()) return "unlock";
    return "setup";
  });

  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("マスターモード", "Master Mode")}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480, width: "100%",
          background: "var(--surface-1)",
          border: "1px solid var(--line-strong)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">🔐</div>
        <h2 style={{ fontSize: 18, margin: "0 0 16px", fontWeight: 600 }}>
          {t("マスターモード（研究者専用）", "Master Mode (Researcher Only)")}
        </h2>

        {mode === "setup" ? (
          <SetupView uiLang={uiLang} onDone={() => setMode("manage")} onCancel={onClose} />
        ) : mode === "unlock" ? (
          <UnlockView
            uiLang={uiLang}
            onUnlocked={() => {
              setMode("manage");
              onUnlocked?.();
            }}
            onCancel={onClose}
          />
        ) : (
          <ManageView
            uiLang={uiLang}
            onLock={() => { lockMaster(); onClose(); }}
            onReset={() => {
              if (window.confirm(t(
                "マスターパスワードを完全に削除しますか？保存された保護情報も読めなくなります。",
                "Delete the master password? Protected data will become unreadable."
              ))) {
                clearMasterPassword();
                setMode("setup");
              }
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// Setup: first-time password creation
// ────────────────────────────────────────
function SetupView(props: { uiLang: "ja" | "en"; onDone: () => void; onCancel: () => void }) {
  const { uiLang, onDone, onCancel } = props;
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  const submit = async () => {
    setErr("");
    if (pw.length < 4) { setErr(t("パスワードは4文字以上にしてください", "Password must be at least 4 characters")); return; }
    if (pw !== pw2) { setErr(t("パスワードが一致しません", "Passwords do not match")); return; }
    setBusy(true);
    try {
      await setMasterPassword(pw);
      // Auto-unlock after setup
      await unlockMaster(pw);
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        {t(
          "研究者専用機能（収集ログの閲覧・送信先URLの設定など）を保護するためのマスターパスワードを設定してください。一度設定すると、このパスワードは端末に保存され、次回以降の操作に必要になります。",
          "Set a master password to protect researcher-only features (viewing collected logs, configuring endpoint URLs). Once set, this password is stored on this device and required for subsequent access."
        )}
      </p>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
          {t("マスターパスワード", "Master password")}
        </label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
          {t("もう一度入力", "Confirm password")}
        </label>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ width: "100%" }}
        />
      </div>
      {err ? <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div> : null}
      <div style={{ background: "var(--accent-soft)", padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
        ⚠️ {t(
          "このパスワードを忘れると、保護されたデータは復元できません。",
          "If you forget this password, protected data cannot be recovered."
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={onCancel} disabled={busy}>
          {t("キャンセル", "Cancel")}
        </button>
        <button className="btn primary" onClick={submit} disabled={busy || !pw || !pw2}>
          {busy ? t("設定中…", "Setting…") : t("パスワードを設定", "Set password")}
        </button>
      </div>
    </>
  );
}

// ────────────────────────────────────────
// Unlock: enter password to unlock
// ────────────────────────────────────────
function UnlockView(props: { uiLang: "ja" | "en"; onUnlocked: () => void; onCancel: () => void }) {
  const { uiLang, onUnlocked, onCancel } = props;
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const ok = await unlockMaster(pw);
      if (!ok) {
        setErr(t("パスワードが違います", "Incorrect password"));
        return;
      }
      onUnlocked();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        {t(
          "マスターパスワードを入力してください。研究者専用機能のロックが解除されます（このタブを閉じるまで有効）。",
          "Enter the master password to unlock researcher-only features (effective until this tab closes)."
        )}
      </p>
      <div style={{ marginBottom: 16 }}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          autoFocus
          placeholder={t("パスワード", "Password")}
          style={{ width: "100%" }}
        />
      </div>
      {err ? <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={onCancel} disabled={busy}>
          {t("キャンセル", "Cancel")}
        </button>
        <button className="btn primary" onClick={submit} disabled={busy || !pw}>
          {busy ? t("確認中…", "Verifying…") : t("ロック解除", "Unlock")}
        </button>
      </div>
    </>
  );
}

// ────────────────────────────────────────
// Manage: when already unlocked
// ────────────────────────────────────────
function ManageView(props: {
  uiLang: "ja" | "en";
  onLock: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { uiLang, onLock, onReset, onClose } = props;
  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  return (
    <>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        ✓ {t(
          "マスターモードがロック解除されています。研究設定とデータ管理にアクセスできます。",
          "Master mode is unlocked. You have access to research settings and data management."
        )}
      </p>
      <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
        💡 {t(
          "STEP 4 の研究モードカードに、ロックされた設定項目が表示されるようになります。",
          "Locked settings will appear in the research mode card on STEP 4."
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button className="btn danger" onClick={onReset}>
          {t("パスワードをリセット", "Reset password")}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onLock}>
            🔒 {t("ロックする", "Lock now")}
          </button>
          <button className="btn primary" onClick={onClose}>
            {t("閉じる", "Close")}
          </button>
        </div>
      </div>
    </>
  );
}
