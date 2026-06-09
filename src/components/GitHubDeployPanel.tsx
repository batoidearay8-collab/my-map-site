import { useState } from "react";
import { toast } from "./ToastHost";
import { verifyToken, deployToGitHub } from "../lib/githubDeploy";
import type { ExportSiteInput } from "../lib/export";

const TOKEN_KEY = "atlaskobo_github_token_v1";
const OWNER_KEY = "atlaskobo_github_owner_v1";
const REPO_KEY = "atlaskobo_github_repo_v1";

type Props = {
  uiLang: "ja" | "en";
  exportInput: ExportSiteInput;
};

export function GitHubDeployPanel({ uiLang, exportInput }: Props) {
  const t = (ja: string, en: string) => (uiLang === "ja" ? ja : en);

  const [token, setToken] = useState<string>(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  });
  const [owner, setOwner] = useState<string>(() => {
    try { return localStorage.getItem(OWNER_KEY) || ""; } catch { return ""; }
  });
  const [repo, setRepo] = useState<string>(() => {
    try { return localStorage.getItem(REPO_KEY) || ""; } catch { return ""; }
  });
  const [remember, setRemember] = useState<boolean>(() => {
    try { return !!localStorage.getItem(TOKEN_KEY); } catch { return false; }
  });

  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [verifiedLogin, setVerifiedLogin] = useState("");

  const persist = () => {
    try {
      if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(OWNER_KEY, owner);
        localStorage.setItem(REPO_KEY, repo);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.setItem(OWNER_KEY, owner);
        localStorage.setItem(REPO_KEY, repo);
      }
    } catch { /* ignore */ }
  };

  const handleVerify = async () => {
    if (!token) {
      toast.error(t("トークンを入力してください", "Please enter a token"));
      return;
    }
    setBusy(true);
    try {
      const r = await verifyToken(token);
      if (r.ok && r.login) {
        setVerifiedLogin(r.login);
        if (!owner) setOwner(r.login);
        toast.success(t(`認証成功: ${r.login}`, `Verified: ${r.login}`));
      } else {
        toast.error(t(`認証失敗: ${r.error}`, `Verification failed: ${r.error}`));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeploy = async () => {
    if (!token) { toast.error(t("トークンを入力してください", "Please enter a token")); return; }
    if (!repo) { toast.error(t("リポジトリ名を入力してください", "Please enter a repository name")); return; }
    // Validate repo name (GitHub allows alphanumerics, -, _, .)
    if (!/^[A-Za-z0-9._-]+$/.test(repo)) {
      toast.error(t("リポジトリ名に使用できない文字が含まれています", "Repository name contains invalid characters"));
      return;
    }

    setBusy(true);
    setResultUrl("");
    setRepoUrl("");
    setProgressPct(0);
    persist();

    try {
      const result = await deployToGitHub({
        token,
        owner,
        repo,
        exportInput,
        onProgress: (msg, pct) => {
          setProgressMsg(msg);
          if (typeof pct === "number") setProgressPct(pct);
        },
      });

      if (result.ok && result.url) {
        setResultUrl(result.url);
        setRepoUrl(result.repoUrl || "");
        toast.success(t("公開しました！", "Published!"));
      } else {
        toast.error(t(`公開に失敗しました: ${result.error}`, `Deploy failed: ${result.error}`));
      }
    } catch (err: any) {
      toast.error(t(`エラー: ${err?.message ?? err}`, `Error: ${err?.message ?? err}`));
    } finally {
      setBusy(false);
      setProgressMsg("");
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-2)" }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>
        🚀 {t("GitHubに直接公開", "Publish directly to GitHub")}
      </div>
      <div className="hint" style={{ marginBottom: 12 }}>
        {t(
          "Personal Access Token (PAT) を使って、ブラウザから直接GitHub Pagesに公開します。ZIPのダウンロードも引き続き利用できます。",
          "Publishes directly to GitHub Pages from your browser using a Personal Access Token (PAT). ZIP download remains available."
        )}
      </div>

      {/* PAT help */}
      <details style={{ marginBottom: 12, fontSize: 13 }}>
        <summary style={{ cursor: "pointer", color: "var(--accent)" }}>
          {t("PATの取得方法（クリックで開く）", "How to get a PAT (click to expand)")}
        </summary>
        <ol style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.7 }}>
          <li>{t("GitHubにログイン", "Sign in to GitHub")}</li>
          <li>{t("Settings → Developer settings → Personal access tokens → Tokens (classic)", "Settings → Developer settings → Personal access tokens → Tokens (classic)")}</li>
          <li>{t("「Generate new token (classic)」をクリック", "Click \"Generate new token (classic)\"")}</li>
          <li>{t("スコープ（権限）で「repo」にチェック", "Check the \"repo\" scope")}</li>
          <li>{t("トークンを生成し、コピーして下に貼り付け", "Generate, copy, and paste below")}</li>
        </ol>
        <a href="https://github.com/settings/tokens/new?scopes=repo&description=AtlasKobo"
           target="_blank" rel="noopener noreferrer"
           style={{ color: "var(--accent)" }}>
          {t("→ トークン作成ページを開く（repo権限が選択済み）", "→ Open token creation page (repo scope pre-selected)")}
        </a>
      </details>

      {/* Inputs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            {t("Personal Access Token", "Personal Access Token")}
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setVerifiedLogin(""); }}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{ flex: 1 }}
              autoComplete="off"
            />
            <button className="btn" onClick={handleVerify} disabled={busy || !token}>
              {t("確認", "Verify")}
            </button>
          </div>
          {verifiedLogin ? (
            <div style={{ fontSize: 12, color: "var(--ok, #2a8)", marginTop: 4 }}>
              ✓ {t(`認証済み: ${verifiedLogin}`, `Verified: ${verifiedLogin}`)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              {t("GitHubユーザー名", "GitHub username")}
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={verifiedLogin || "username"}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              {t("リポジトリ名", "Repository name")}
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="school-festival-map"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {t("このブラウザにトークンを保存する", "Remember token in this browser")}
        </label>
        {remember ? (
          <div style={{ fontSize: 11, color: "var(--warn, #b80)", paddingLeft: 24 }}>
            ⚠️ {t(
              "共有PCでは保存しないでください。トークンは他人のリポジトリも操作できます。",
              "Do not save on shared computers. The token can modify your repositories."
            )}
          </div>
        ) : null}

        {/* Progress */}
        {busy && progressMsg ? (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{progressMsg}</div>
            <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", transition: "width .3s" }} />
            </div>
          </div>
        ) : null}

        {/* Result */}
        {resultUrl ? (
          <div style={{ marginTop: 8, padding: 12, background: "var(--surface-1)", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              ✅ {t("公開完了", "Published")}
            </div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              {t("公開URL（反映まで1〜3分かかります）:", "Published URL (takes 1–3 min to go live):")}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <a href={resultUrl} target="_blank" rel="noopener noreferrer"
                 style={{ color: "var(--accent)", wordBreak: "break-all" }}>
                {resultUrl}
              </a>
              <button className="btn" style={{ padding: "2px 10px", fontSize: 12 }}
                onClick={() => { navigator.clipboard?.writeText(resultUrl); toast.success(t("コピーしました", "Copied")); }}>
                {t("コピー", "Copy")}
              </button>
            </div>
            {repoUrl ? (
              <div style={{ fontSize: 12, marginTop: 6 }}>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)" }}>
                  {t("リポジトリを開く", "Open repository")} →
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <button className="btn primary" onClick={handleDeploy} disabled={busy}
          style={{ marginTop: 4 }}>
          {busy ? t("公開中…", "Publishing…") : t("🚀 GitHubに公開する", "🚀 Publish to GitHub")}
        </button>
      </div>
    </div>
  );
}
