import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../state/store";
import { MapView } from "../components/MapView";
import { DetailsModal } from "../components/DetailsModal";
import { type Poi } from "../lib/schema";
import { pickPoiName, pickPoiDescription, pickCategoryLabel } from "../lib/contentText";
import { t } from "../lib/i18n";
import { getOpenStatus, hasBusinessInfo } from "../lib/openStatus";

export function ViewerPage() {
  const { isLoaded, loadFromPublic, config, pois, categories, uiLang, contentLang } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Poi | null>(null);

  const [copied, setCopied] = useState(false);

  const mapOnly = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("map") === "1";
  }, [location.search]);


  const openOnly = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("open") === "1";
  }, [location.search]);

  // Re-render every minute so the "open/closed" indicator stays current.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => { if (!isLoaded) void loadFromPublic(); }, [isLoaded, loadFromPublic]);

  const copyText = async (text: string) => {
    // Prefer the modern clipboard API
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    // Fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  };

  const onCopyUrl = async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  const onShare = async () => {
    const url = window.location.href;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: document.title, url });
        return;
      }
    } catch {
      // fall back to copy
    }
    await onCopyUrl();
  };

  const toggleMapOnly = () => {
    const sp = new URLSearchParams(location.search);
    if (sp.get("map") === "1") sp.delete("map");
    else sp.set("map", "1");
    const nextSearch = sp.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
  };


  const toggleOpenOnly = () => {
    const sp = new URLSearchParams(location.search);
    if (sp.get("open") === "1") sp.delete("open");
    else sp.set("open", "1");
    const nextSearch = sp.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
  };


  const filtered = useMemo(() => {
  const qq = q.trim().toLowerCase();
  const mode = config?.mode ?? "outdoor";
  const now = new Date(nowTick);
  return pois.filter(p => {
    const okCat = !cat || p.category === cat;

    const name = pickPoiName(p, contentLang);
    const desc = pickPoiDescription(p, contentLang);
    const txt = `${p.name} ${p.description} ${name} ${desc}`.toLowerCase();
    const okQ = !qq || txt.includes(qq);

    if (openOnly) {
      const showBiz = mode === "outdoor" && hasBusinessInfo(p as any);
      if (!showBiz) return false;
      const st = getOpenStatus(p as any, now);
      if (st !== "open") return false;
    }

    return okCat && okQ;
  });
}, [pois, cat, q, contentLang, openOnly, nowTick, config?.mode]);


  const catList = useMemo(() => {
    const extra = new Set(categories.map(c => c.category));
    for (const p of pois) if (p.category && !extra.has(p.category)) extra.add(p.category);
    return Array.from(extra);
  }, [pois, categories]);

  const catMap = useMemo(() => {
    const m = new Map(categories.map(c => [c.category, c]));
    return m;
  }, [categories]);

  if (!config) return <div style={{ padding: 12 }} className="hint">…</div>;

  const categoryObj = picked ? categories.find(c => c.category === picked.category) : undefined;

  return (
    <main className={"layout" + (mapOnly ? " mapOnly" : "")}>
      <section className="pane">
        {!mapOnly ? (
          <div className="paneHeader" style={{ alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row">
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">{t(uiLang, "all")}</option>
                  {catList.map(key => {
                    const c = catMap.get(key);
                    const label = c ? pickCategoryLabel(c, contentLang) : key;
                    return (
                      <option key={key} value={key}>{(c?.icon ?? "")} {label}</option>
                    );
                  })}
                </select>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(uiLang, "search_placeholder")} />
                {config?.mode === "outdoor" ? (
                  <button className={"btn " + (openOnly ? "primary" : "soft")} onClick={toggleOpenOnly} title={t(uiLang, "open_only")} style={{ whiteSpace: "nowrap" }}>
                    🟢 {t(uiLang, "open_only")}
                  </button>
                ) : null}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn soft" onClick={onCopyUrl}>
                  {copied ? `✓ ${t(uiLang, "copied")}` : t(uiLang, "copy_url")}
                </button>
                <button className="btn soft" onClick={onShare}>{t(uiLang, "share")}</button>
                <button className={"btn " + (mapOnly ? "primary" : "")} onClick={toggleMapOnly}>{t(uiLang, "map_only")}</button>
              </div>
            </div>
            <div className="badge" style={{ alignSelf: "flex-start" }}>{filtered.length} {t(uiLang, "items_count")}</div>
          </div>
        ) : null}

        <div className="mapWrap">
          <MapView
            config={config}
            mapOnly={mapOnly}
            openOnly={openOnly}
            pois={pois}
            categories={categories}
            activeCategory={cat}
            query={q}
            contentLang={contentLang}
            uiLang={uiLang}
            now={nowTick}
            onPickPoi={(p) => setPicked(p)}
          />
          {mapOnly ? (
            <div className="msf-mapOnlyBar">
              <button className="btn" onClick={toggleMapOnly}>{t(uiLang, "exit_map_only")}</button>
              {config?.mode === "outdoor" ? (
                <button className={"btn " + (openOnly ? "primary" : "soft")} onClick={toggleOpenOnly} title={t(uiLang, "open_only")}>
                  🟢 {t(uiLang, "open_only")}
                </button>
              ) : null}
              <button className="btn soft" onClick={onCopyUrl}>{copied ? `✓ ${t(uiLang, "copied")}` : t(uiLang, "copy_url")}</button>
              <button className="btn soft" onClick={onShare}>{t(uiLang, "share")}</button>
            </div>
          ) : null}
        </div>
      </section>

      {!mapOnly ? (
        <aside className="pane">
          <div className="paneHeader">
            <div style={{ fontWeight: 900 }}>{t(uiLang, "list")}</div>
            <div className="badge">{t(uiLang, "click_for_details")}</div>
          </div>
          <div className="paneBody">
            <div className="cards">
              {filtered.map(p => {
                const c = catMap.get(p.category);
                const showBiz = config.mode === "outdoor" && hasBusinessInfo(p as any);
                const st = showBiz ? getOpenStatus(p as any, new Date(nowTick)) : "unknown";
                const stIcon = !showBiz ? "" : (st === "open" ? "🟢" : st === "closed" ? "🔴" : "⏰");
                return (
                  <div key={p.id} className="listItem" onClick={() => setPicked(p)}>
                    <div className="name">{stIcon ? <span className="bizIcon" aria-hidden="true">{stIcon}</span> : null} {(c?.icon ?? "")} {pickPoiName(p, contentLang)}</div>
                    <div className="meta">{c ? pickCategoryLabel(c, contentLang) : p.category}</div>
                    <div className="meta">{(pickPoiDescription(p, contentLang) ?? "").slice(0, 60)}{(pickPoiDescription(p, contentLang) ?? "").length > 60 ? "…" : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      ) : null}

      {picked ? (
        <DetailsModal
          poi={picked}
          category={categoryObj}
          onClose={() => setPicked(null)}
          contentLang={contentLang}
          uiLang={uiLang}
          mode={config.mode}
          now={nowTick}
        />
      ) : null}
    </main>
  );
}
