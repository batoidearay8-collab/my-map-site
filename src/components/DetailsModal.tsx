import React from "react";
import { type Poi, type Category } from "../lib/schema";
import { pickPoiName, pickPoiDescription, pickCategoryLabel } from "../lib/contentText";
import { t, type UiLang } from "../lib/i18n";
import { publicUrl } from "../lib/publicUrl";
import { getOpenStatus, hasBusinessInfo } from "../lib/openStatus";

export function DetailsModal(props: {
  poi: Poi;
  category?: Category;
  onClose: () => void;
  contentLang: string;
  uiLang: UiLang;
  mode?: "outdoor" | "indoor";
  now?: number;
  /** Called when user requests route to this POI. Undefined = hide button. */
  onRoute?: (poi: Poi) => void;
  /** If a route is currently loading. */
  routeLoading?: boolean;
}) {
  const { poi, category, contentLang, uiLang } = props;
  const name = pickPoiName(poi, contentLang);
  const desc = pickPoiDescription(poi, contentLang);
  const catLabel = category ? pickCategoryLabel(category, contentLang) : poi.category;

  const showBiz = props.mode === "outdoor" && hasBusinessInfo(poi);
  const now = new Date(props.now ?? Date.now());
  const st = showBiz ? getOpenStatus(poi, now) : "unknown";
  const stIcon = !showBiz ? "" : (st === "open" ? "🟢" : st === "closed" ? "🔴" : "⏰");
  const stLabel = !showBiz ? "" : (st === "open" ? t(uiLang, "open_now") : st === "closed" ? t(uiLang, "closed_now") : t(uiLang, "hours_unknown"));
  const hours = String(poi.hours ?? "").trim();
  const closed = String(poi.closed ?? "").trim();

  return (
    <div className="modalBackdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{category?.icon ? `${category.icon} ` : ""}{name}</div>
          <button className="btn" onClick={props.onClose}>{t(uiLang, "close")}</button>
        </div>

        <div className="hint">{catLabel}</div>

        {showBiz ? (
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            <div>{stIcon} {stLabel}</div>
            {hours ? <div>{t(uiLang, "hours_label")}: {hours}</div> : null}
            {closed ? <div>{t(uiLang, "closed_label")}: {closed}</div> : null}
          </div>
        ) : null}

        {poi.image ? (
          <img
            alt=""
            src={publicUrl(poi.image)}
            style={{ width: "100%", borderRadius: 14, border: "1px solid var(--line)", margin: "10px 0" }}
          />
        ) : null}

        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{desc}</div>

        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
          {poi.url ? (
            <a className="btn primary" href={poi.url} target="_blank" rel="noreferrer noopener">{t(uiLang, "external_link")}</a>
          ) : null}
          {props.onRoute && props.mode === "outdoor" && typeof poi.lat === "number" && typeof poi.lng === "number" ? (
            <button
              className="btn"
              disabled={props.routeLoading}
              onClick={() => props.onRoute?.(poi)}
            >
              {props.routeLoading
                ? (uiLang === "ja" ? "計算中…" : "Calculating…")
                : (uiLang === "ja" ? "🧭 ここへのルート" : "🧭 Route here")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
