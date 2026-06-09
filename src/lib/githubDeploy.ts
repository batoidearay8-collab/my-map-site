/**
 * githubDeploy.ts — Publish the built site directly to GitHub Pages
 * using a Personal Access Token (PAT), entirely from the browser.
 *
 * Why PAT (not OAuth):
 *   OAuth requires a client_secret which cannot be safely embedded in a
 *   static browser app. PAT keeps AtlasKobo fully backend-free: the token
 *   lives only in the user's browser and is sent directly to api.github.com.
 *
 * What it does:
 *   1. Verifies the token & resolves the authenticated user.
 *   2. Creates the repository if it does not exist.
 *   3. Commits all site files to the `gh-pages` branch in ONE commit
 *      (using the Git Data API: blobs → tree → commit → ref update).
 *   4. Enables GitHub Pages (source: gh-pages branch).
 *   5. Returns the published URL.
 *
 * Using a single tree/commit avoids the per-file rate-limit problems of the
 * Contents API and is far faster for sites with many images.
 *
 * SECURITY NOTE (shown to the user in the UI):
 *   The PAT is stored in localStorage only if the user opts in. A token with
 *   `repo` scope can modify the user's repositories, so we warn accordingly.
 */

import { buildSiteFileMap, type ExportSiteInput, type SiteFile } from "./export";

const GH_API = "https://api.github.com";

export type DeployProgress = (msg: string, pct?: number) => void;

export type DeployParams = {
  token: string;
  owner: string;        // GitHub username (resolved from token if empty)
  repo: string;         // repository name, e.g. "school-festival-map"
  exportInput: ExportSiteInput;
  onProgress?: DeployProgress;
};

export type DeployResult = {
  ok: boolean;
  url?: string;         // published GitHub Pages URL
  repoUrl?: string;     // repository URL
  error?: string;
};

// ──────────────────────────────────────────────
// Low-level GitHub API helper
// ──────────────────────────────────────────────
async function gh(
  token: string,
  path: string,
  init?: RequestInit & { rawBody?: boolean }
): Promise<any> {
  const res = await fetch(GH_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }

  if (!res.ok) {
    const msg = json?.message || res.statusText || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

// ──────────────────────────────────────────────
// Base64 encoding for blob upload (handles binary safely)
// ──────────────────────────────────────────────
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

function textToBase64(s: string): string {
  // UTF-8 safe
  return btoa(unescape(encodeURIComponent(s)));
}

// ──────────────────────────────────────────────
// Token verification — returns the authenticated username
// ──────────────────────────────────────────────
export async function verifyToken(token: string): Promise<{ ok: boolean; login?: string; error?: string }> {
  try {
    const user = await gh(token, "/user");
    return { ok: true, login: user.login };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ──────────────────────────────────────────────
// Main deploy routine
// ──────────────────────────────────────────────
export async function deployToGitHub(params: DeployParams): Promise<DeployResult> {
  const { token, repo, exportInput, onProgress } = params;
  const progress = onProgress || (() => {});
  const BRANCH = "gh-pages";

  try {
    // 1. Resolve owner from token
    progress("認証を確認中…", 5);
    const user = await gh(token, "/user");
    const owner: string = params.owner || user.login;

    // 2. Ensure repo exists (create if missing)
    progress("リポジトリを確認中…", 10);
    let repoExists = false;
    try {
      await gh(token, `/repos/${owner}/${repo}`);
      repoExists = true;
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }

    if (!repoExists) {
      progress("リポジトリを作成中…", 15);
      await gh(token, "/user/repos", {
        method: "POST",
        body: JSON.stringify({
          name: repo,
          description: "Published with AtlasKobo",
          auto_init: true,       // create an initial commit so we have a base
          private: false,        // GitHub Pages on free plan needs public repo
        }),
      });
      // Give GitHub a moment to initialize
      await sleep(2000);
    }

    // 3. Build the site files
    progress("サイトファイルを生成中…", 25);
    const files = await buildSiteFileMap(exportInput);

    // 4. Get the base commit SHA to branch from.
    //    Prefer existing gh-pages; else fall back to the default branch.
    progress("ブランチ情報を取得中…", 35);
    let baseCommitSha: string | undefined;
    let baseTreeSha: string | undefined;

    const branchSha = await tryGetRef(token, owner, repo, `heads/${BRANCH}`);
    if (branchSha) {
      baseCommitSha = branchSha;
    } else {
      // Determine default branch
      const repoInfo = await gh(token, `/repos/${owner}/${repo}`);
      const defBranch = repoInfo.default_branch || "main";
      const defSha = await tryGetRef(token, owner, repo, `heads/${defBranch}`);
      baseCommitSha = defSha || undefined;
    }

    if (baseCommitSha) {
      const commit = await gh(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
      baseTreeSha = commit.tree?.sha;
    }

    // 5. Create blobs for each file
    progress("ファイルをアップロード中…", 45);
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    let done = 0;
    for (const f of files) {
      const blobSha = await createBlob(token, owner, repo, f);
      treeItems.push({ path: f.path, mode: "100644", type: "blob", sha: blobSha });
      done++;
      progress(`ファイルをアップロード中… (${done}/${files.length})`, 45 + Math.round((done / files.length) * 30));
    }

    // 6. Create a tree
    progress("ツリーを作成中…", 80);
    const tree = await gh(token, `/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        tree: treeItems,
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
      }),
    });

    // 7. Create a commit
    progress("コミットを作成中…", 88);
    const commit = await gh(token, `/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `Deploy with AtlasKobo — ${new Date().toISOString()}`,
        tree: tree.sha,
        ...(baseCommitSha ? { parents: [baseCommitSha] } : {}),
      }),
    });

    // 8. Update (or create) the gh-pages ref
    progress("ブランチを更新中…", 92);
    if (branchSha) {
      await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${BRANCH}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: true }),
      });
    } else {
      await gh(token, `/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }),
      });
    }

    // 9. Enable GitHub Pages (gh-pages branch, root)
    progress("GitHub Pagesを有効化中…", 96);
    await enablePages(token, owner, repo, BRANCH);

    const url = `https://${owner}.github.io/${repo}/`;
    const repoUrl = `https://github.com/${owner}/${repo}`;
    progress("完了", 100);
    return { ok: true, url, repoUrl };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryGetRef(token: string, owner: string, repo: string, ref: string): Promise<string | null> {
  try {
    const data = await gh(token, `/repos/${owner}/${repo}/git/ref/${ref}`);
    return data?.object?.sha || null;
  } catch (err: any) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function createBlob(token: string, owner: string, repo: string, file: SiteFile): Promise<string> {
  const content = file.kind === "text"
    ? textToBase64(file.data)
    : arrayBufferToBase64(file.data);
  const blob = await gh(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "base64" }),
  });
  return blob.sha;
}

async function enablePages(token: string, owner: string, repo: string, branch: string): Promise<void> {
  // Try to create Pages config; if it already exists, update it.
  const body = JSON.stringify({ source: { branch, path: "/" } });
  try {
    await gh(token, `/repos/${owner}/${repo}/pages`, { method: "POST", body });
  } catch (err: any) {
    if (err.status === 409 || err.status === 422) {
      // Already enabled — update the source
      try {
        await gh(token, `/repos/${owner}/${repo}/pages`, { method: "PUT", body });
      } catch { /* non-fatal */ }
    } else if (err.status === 403) {
      // Pages may require manual enable on some accounts; non-fatal
    } else {
      // Non-fatal: deployment succeeded, Pages can be enabled manually
    }
  }
}
