import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../components/ToastHost";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../state/store";
import { MapView } from "../components/MapView";
import { FloorSelector } from "../components/FloorSelector";
import { DetailsModal } from "../components/DetailsModal";
import { type Poi } from "../lib/schema";
import { pickPoiName, pickPoiDescription, pickCategoryLabel } from "../lib/contentText";
import { t } from "../lib/i18n";
import { getOpenStatus, hasBusinessInfo } from "../lib/openStatus";
import { fetchRoute, formatDuration, formatDistance, type RouteResult } from "../lib/route";
import { RouteToolbar } from "../components/RouteToolbar";
import { findIndoorRoute, describeRoute, type IndoorRoute } from "../lib/indoorRoute";
import { ConsentDialog } from "../components/ConsentDialog";
import { logEvent, getConsentState, installUnloadFlusher, loadLogs, logsToCsv, clearLogs } from "../lib/researchLog";
import { decodeEndpoint, isMasterUnlocked, unlockMaster } from "../lib/masterMode";

export function ViewerPage() {
  const { isLoaded, loadFromPublic, config, pois, categories, uiLang, contentLang, previewFloorUrl, previewFloorUrls } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Poi | null>(null);
  const [activeFloor, setActiveFloor] = useState("");

  const [copied, setCopied] = useState(false);

  // Route navigation state
  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>();
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Indoor multi-floor route state
  const [indoorRoute, setIndoorRoute] = useState<IndoorRoute | null>(null);
  const [indoorRouteFromId, setIndoorRouteFromId] = useState<string>("");
  const [indoorRouteToId, setIndoorRouteToId] = useState<string>("");

  const clearRoute = useCallback(() => {
    setRouteCoords(undefined);
    setRouteInfo(null);
    setIndoorRoute(null);
    setIndoorRouteFromId("");
    setIndoorRouteToId("");
  }, []);

  // ─── Master mode researcher panel (shown only when ?master=1 in URL) ───
  // The viewer normally hides researcher tools from end users (high schoolers, visitors).
  // The researcher accesses by adding ?master=1 to the URL. They must then enter the
  // master password to actually unlock the panel.
  const [masterPanelOpen, setMasterPanelOpen] = useState<boolean>(() => {
    try {
      // URLSearchParams works on hash fragments by extracting the query part
      const hash = window.location.hash; // e.g. "#/?master=1"
      const qIdx = hash.indexOf("?");
      if (qIdx < 0) return false;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      return params.get("master") === "1";
    } catch { return false; }
  });
  const [masterPanelUnlocked, setMasterPanelUnlocked] = useState<boolean>(() => isMasterUnlocked());
  const [masterPwInput, setMasterPwInput] = useState("");
  const [masterPwError, setMasterPwError] = useState("");

  const handleMasterUnlock = async () => {
    setMasterPwError("");
    const ok = await unlockMaster(masterPwInput);
    if (!ok) {
      setMasterPwError(uiLang === "ja" ? "パスワードが違います" : "Incorrect password");
      return;
    }
    setMasterPanelUnlocked(true);
    setMasterPwInput("");
  };

  const exportLogsAsCsv = () => {
    const events = loadLogs();
    if (events.length === 0) {
      toast.info(uiLang === "ja" ? "ログがまだありません" : "No logs yet");
      return;
    }
    const csv = logsToCsv(events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `atlaskobo_logs_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    if (!window.confirm(uiLang === "ja"
      ? "このデバイスのログをすべて削除しますか？（送信先サーバーのデータは消えません）"
      : "Delete all logs on this device? (Server data is unaffected)")) return;
    clearLogs();
    toast.success(uiLang === "ja" ? "ログを削除しました" : "Logs deleted");
  };


  const onRoute = useCallback(async (poi: Poi) => {
    if (typeof poi.lat !== "number" || typeof poi.lng !== "number") return;
    if (!navigator.geolocation) {
      toast.info(uiLang === "ja" ? "この端末ではGPSが利用できません。" : "Geolocation is not available on this device.");
      return;
    }
    setRouteLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      const from: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      const to: [number, number] = [poi.lat, poi.lng];
      const lang = uiLang === "ja" ? "ja" : "en";
      const result = await fetchRoute(from, to, { profile: "foot" });
      setRouteCoords(result.coordinates);
      setRouteInfo({
        distance: formatDistance(result.distanceMeters, lang),
        duration: formatDuration(result.durationSeconds, lang),
      });
      setPicked(null); // close modal to see route
    } catch (err: any) {
      const msg = err?.code === 1
        ? (uiLang === "ja" ? "位置情報の取得が拒否されました。" : "Location access was denied.")
        : (uiLang === "ja" ? "ルート取得に失敗しました。" : "Failed to get route.");
      toast.info(msg);
    } finally {
      setRouteLoading(false);
    }
  }, [uiLang]);

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

  // ─────────────────────────────────────────────
  // Research mode: install log flusher on unload
  // ─────────────────────────────────────────────
  const researchEnabled = !!config?.research?.enabled;
  const researchSurveyUrl = config?.research?.surveyUrl ?? "";
  const researchCollectLogs = !!config?.research?.collectLogs;
  const researchLogEndpoint = (() => {
    const raw = config?.research?.logEndpoint ?? "";
    if (!raw) return "";
    // Endpoints saved by the master mode are encoded with "ENC:" prefix.
    // Decoding happens transparently here so the actual fetch uses the real URL.
    if (raw.startsWith("ENC:")) return decodeEndpoint(raw);
    return raw;
  })();

  useEffect(() => {
    if (!researchEnabled || !researchCollectLogs) return;
    return installUnloadFlusher(researchLogEndpoint);
  }, [researchEnabled, researchCollectLogs, researchLogEndpoint]);

  // Log POI view events when the user opens a marker detail
  useEffect(() => {
    if (!picked || !researchEnabled || !researchCollectLogs) return;
    logEvent("poi_view", { poiId: picked.id, name: picked.name, floor: picked.floor || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.id]);

  // Log search and floor change events
  useEffect(() => {
    if (!researchEnabled || !researchCollectLogs) return;
    if (q && q.length >= 2) {
      logEvent("search", { query: q });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!researchEnabled || !researchCollectLogs || !activeFloor) return;
    logEvent("floor_change", { floor: activeFloor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor]);

  // Initialize active floor to first floor when config loads
  useEffect(() => {
    if (!config) return;
    const floors = config.indoor?.floors ?? [];
    if (floors.length >= 2 && !activeFloor) {
      setActiveFloor(floors[0].id);
    }
  }, [config, activeFloor]);

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
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
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
      const showBiz = mode === "outdoor" && hasBusinessInfo(p);
      if (!showBiz) return false;
      const st = getOpenStatus(p, now);
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
    <main className={"layout" + (mapOnly ? " mapOnly" : "")} role="main">
      {/* Skip links for keyboard/screen reader users */}
      <nav className="skipLinks" aria-label="Skip navigation">
        <a href="#msf-map" className="skipLink">{t(uiLang, "skip_to_map")}</a>
        {!mapOnly ? <a href="#msf-list" className="skipLink">{t(uiLang, "skip_to_list")}</a> : null}
      </nav>

      <section className="pane" aria-label={t(uiLang, "map_region")}>
        {!mapOnly ? (
          <div className="paneHeader" style={{ alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row">
                <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t(uiLang, "all")}>
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
                {config?.mode === "outdoor" ? (
                  <RouteToolbar
                    uiLang={uiLang === "en" ? "en" : "ja"}
                    contentLang={contentLang}
                    pois={pois}
                    hasRoute={!!routeCoords}
                    routeInfo={routeInfo}
                    onRoute={async (from, to, info) => {
                      setRouteLoading(true);
                      try {
                        const lang = uiLang === "ja" ? "ja" : "en";
                        const result = await fetchRoute(from, to, { profile: "foot" });
                        setRouteCoords(result.coordinates);
                        setRouteInfo({
                          distance: formatDistance(result.distanceMeters, lang),
                          duration: formatDuration(result.durationSeconds, lang),
                        });
                        setPicked(null);
                      } catch (err: any) {
                        // BUG #4 fix: surface routing errors so user knows
                        toast.error(uiLang === "ja"
                          ? `ルート取得に失敗しました: ${err?.message ?? err}`
                          : `Failed to fetch route: ${err?.message ?? err}`);
                      } finally {
                        setRouteLoading(false);
                      }
                    }}
                    onClear={clearRoute}
                  />
                ) : null}
                {/* Indoor route picker (only when 2+ floors) */}
                {config?.mode === "indoor" && (config.indoor?.floors ?? []).length >= 2 ? (
                  <div className="indoorRouteSelect" style={{ display: "inline-flex", gap: 6 }}>
                    <select
                      value={indoorRouteFromId}
                      onChange={(e) => setIndoorRouteFromId(e.target.value)}
                      style={{ fontSize: 12, padding: "6px 8px" }}
                      aria-label={uiLang === "ja" ? "出発地点" : "From"}
                    >
                      <option value="">{uiLang === "ja" ? "出発…" : "From…"}</option>
                      {pois.filter(p => typeof p.x === "number" && typeof p.y === "number").map(p => (
                        <option key={p.id} value={p.id}>{pickPoiName(p, contentLang)} ({p.floor || "?"})</option>
                      ))}
                    </select>
                    <select
                      value={indoorRouteToId}
                      onChange={(e) => setIndoorRouteToId(e.target.value)}
                      style={{ fontSize: 12, padding: "6px 8px" }}
                      aria-label={uiLang === "ja" ? "目的地" : "To"}
                    >
                      <option value="">{uiLang === "ja" ? "目的…" : "To…"}</option>
                      {pois.filter(p => typeof p.x === "number" && typeof p.y === "number").map(p => (
                        <option key={p.id} value={p.id}>{pickPoiName(p, contentLang)} ({p.floor || "?"})</option>
                      ))}
                    </select>
                    <button
                      className="btn primary"
                      style={{ fontSize: 12, padding: "6px 12px" }}
                      disabled={!indoorRouteFromId || !indoorRouteToId || indoorRouteFromId === indoorRouteToId}
                      onClick={() => {
                        const from = pois.find(p => p.id === indoorRouteFromId);
                        const to = pois.find(p => p.id === indoorRouteToId);
                        if (!from || !to) return;
                        const route = findIndoorRoute(from, to, pois);
                        if (!route) {
                          toast.error(uiLang === "ja"
                            ? "経路が見つかりませんでした。階段/EVが両フロアに正しく設定されているか確認してください。"
                            : "No route found. Check that stairs/elevators are set up on both floors.");
                          return;
                        }
                        setIndoorRoute(route);
                        // Auto-switch to start floor
                        if (route.startFloor) setActiveFloor(route.startFloor);
                      }}
                    >
                      {uiLang === "ja" ? "🗺️ 経路" : "🗺️ Route"}
                    </button>
                    {indoorRoute ? (
                      <button
                        className="btn soft"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={clearRoute}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
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

        <div className="mapWrap" id="msf-map">
          {config.mode === "indoor" && (config.indoor.floors ?? []).length >= 2 ? (
            <div style={{ position: "absolute", top: 10, right: 10, zIndex: 500 }}>
              <FloorSelector
                config={config}
                activeFloor={activeFloor || (config.indoor.floors?.[0]?.id ?? "")}
                onChange={setActiveFloor}
                contentLang={contentLang}
                uiLang={uiLang}
              />
            </div>
          ) : null}
          <MapView
            config={config}
            mapOnly={mapOnly}
            openOnly={openOnly}
            pois={pois}
            categories={categories}
            activeCategory={cat}
            activeFloor={activeFloor || undefined}
            routeCoords={routeCoords}
            query={q}
            contentLang={contentLang}
            uiLang={uiLang}
            now={nowTick}
            indoorImageOverrideUrl={(() => {
              // Use uploaded preview URLs (for builder → viewer transition without export)
              if (config.mode !== "indoor") return undefined;
              const floors = config.indoor.floors ?? [];
              if (floors.length >= 2) {
                const fid = activeFloor || floors[0]?.id || "";
                return previewFloorUrls?.[fid] || undefined;
              }
              return previewFloorUrl || undefined;
            })()}
            onPickPoi={(p) => { setPicked(p); clearRoute(); }}
          />
          {/* Route info banner */}
          {routeInfo ? (
            <div style={{
              position: "absolute", bottom: 10, left: 10, right: 10, zIndex: 500,
              background: "var(--card)", borderRadius: 14, padding: "10px 14px",
              border: "1px solid var(--line)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>🧭 {routeInfo.distance} · {routeInfo.duration}</div>
                <div className="hint" style={{ fontSize: 11 }}>{uiLang === "ja" ? "徒歩ルート（OSRM）" : "Walking route (OSRM)"}</div>
              </div>
              <button className="btn soft" onClick={clearRoute} style={{ fontSize: 12 }}>✕</button>
            </div>
          ) : null}
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
        <aside className="pane" id="msf-list" aria-label={t(uiLang, "list_region")}>
          <div className="paneHeader">
            <div style={{ fontWeight: 900 }}>{t(uiLang, "list")}</div>
            <div className="badge">{t(uiLang, "click_for_details")}</div>
          </div>
          <div className="paneBody">
            <div className="cards" role="list">
              {filtered.map(p => {
                const c = catMap.get(p.category);
                const showBiz = config.mode === "outdoor" && hasBusinessInfo(p);
                const st = showBiz ? getOpenStatus(p, new Date(nowTick)) : "unknown";
                const stIcon = !showBiz ? "" : (st === "open" ? "🟢" : st === "closed" ? "🔴" : "⏰");
                return (
                  <div key={p.id} className="listItem" role="listitem" tabIndex={0} onClick={() => { setPicked(p); clearRoute(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(p); clearRoute(); } }}>
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
          onRoute={config.mode === "outdoor" ? onRoute : undefined}
          routeLoading={routeLoading}
        />
      ) : null}

      {/* Indoor route directions panel */}
      {indoorRoute ? (
        <div className="indoorRoutePanel">
          <div className="indoorRoutePanelHeader">
            <strong>{uiLang === "ja" ? "🗺️ 経路案内" : "🗺️ Route"}</strong>
            <button
              className="btn soft"
              onClick={clearRoute}
              aria-label={uiLang === "ja" ? "閉じる" : "Close"}
              style={{ padding: "2px 8px", fontSize: 12 }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div className="indoorRouteSummary">
            {indoorRoute.startFloor === indoorRoute.endFloor ? (
              <span>
                {uiLang === "ja"
                  ? `${indoorRoute.startFloor || "現在のフロア"} 内のみ`
                  : `Within ${indoorRoute.startFloor || "current floor"}`}
              </span>
            ) : (
              <span>
                {indoorRoute.startFloor || "?"}
                <span className="indoorRouteArrow"> → </span>
                {indoorRoute.endFloor || "?"}
              </span>
            )}
          </div>
          {(() => {
            const lines = describeRoute(indoorRoute, uiLang === "ja" ? "ja" : "en");
            if (lines.length === 0) return null;
            return (
              <ol className="indoorRouteSteps">
                {lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            );
          })()}
          {/* Floor jumper buttons */}
          <div className="indoorRouteFloors">
            {Array.from(new Set([
              indoorRoute.startFloor,
              ...indoorRoute.steps
                .filter(s => s.kind === "connector")
                .map(s => (s as any).toFloor),
              indoorRoute.endFloor,
            ].filter(Boolean))).map(fid => (
              <button
                key={fid}
                className={"btn " + (activeFloor === fid ? "primary" : "soft")}
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setActiveFloor(fid)}
              >
                {fid}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────
          Research mode: consent dialog and survey button
          ───────────────────────────────────────────── */}
      {researchEnabled ? (
        <ConsentDialog
          uiLang={uiLang === "en" ? "en" : "ja"}
          projectName={config?.research?.projectName}
          contactEmail={config?.research?.contactEmail}
          collectLogs={researchCollectLogs}
        />
      ) : null}

      {researchEnabled && researchSurveyUrl ? (
        <a
          href={researchSurveyUrl}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => {
            if (researchCollectLogs) logEvent("survey_open");
          }}
          className="surveyFab"
          aria-label={uiLang === "ja" ? "アンケートに回答する" : "Open survey"}
          title={uiLang === "ja" ? "アンケートに回答する" : "Open survey"}
        >
          <span aria-hidden="true">📝</span>
          <span>{uiLang === "ja" ? "アンケート" : "Survey"}</span>
        </a>
      ) : null}

      {/* ───────────────────────────────────────
          Researcher master panel (?master=1 URL flag)
          Hidden from regular viewers. Requires password unlock.
          ─────────────────────────────────────── */}
      {masterPanelOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={uiLang === "ja" ? "研究者パネル" : "Researcher Panel"}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setMasterPanelOpen(false)}
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
            <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">🔬</div>
            <h2 style={{ fontSize: 18, margin: "0 0 16px", fontWeight: 600 }}>
              {uiLang === "ja" ? "研究者パネル" : "Researcher Panel"}
            </h2>

            {!masterPanelUnlocked ? (
              <>
                <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  {uiLang === "ja"
                    ? "マスターパスワードを入力してください。研究者専用機能（収集ログのエクスポート等）にアクセスできます。"
                    : "Enter the master password to access researcher features (log export, etc.)."}
                </p>
                <input
                  type="password"
                  value={masterPwInput}
                  onChange={(e) => setMasterPwInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleMasterUnlock(); }}
                  autoFocus
                  placeholder={uiLang === "ja" ? "パスワード" : "Password"}
                  style={{ width: "100%", marginBottom: 12 }}
                />
                {masterPwError ? (
                  <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
                    {masterPwError}
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn" onClick={() => setMasterPanelOpen(false)}>
                    {uiLang === "ja" ? "キャンセル" : "Cancel"}
                  </button>
                  <button className="btn primary" onClick={handleMasterUnlock} disabled={!masterPwInput}>
                    {uiLang === "ja" ? "ロック解除" : "Unlock"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  ✓ {uiLang === "ja"
                    ? "ロック解除されました。このデバイスに保存された匿名ログを管理できます。"
                    : "Unlocked. You can now manage anonymous logs stored on this device."}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <button className="btn primary" onClick={exportLogsAsCsv}>
                    📥 {uiLang === "ja" ? "ログをCSVでエクスポート" : "Export logs as CSV"}
                  </button>
                  <button className="btn" onClick={() => {
                    const events = loadLogs();
                    toast.info(uiLang === "ja"
                      ? `現在 ${events.length} 件のイベントが保存されています`
                      : `${events.length} events stored`);
                  }}>
                    📊 {uiLang === "ja" ? "保存件数を確認" : "Check event count"}
                  </button>
                  <button className="btn danger" onClick={handleClearLogs}>
                    🗑️ {uiLang === "ja" ? "このデバイスのログを削除" : "Delete logs on this device"}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => setMasterPanelOpen(false)}>
                    {uiLang === "ja" ? "閉じる" : "Close"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
