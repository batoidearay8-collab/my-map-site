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
}) {
  const { poi, category, contentLang, uiLang } = props;
  const name = pickPoiName(poi, contentLang);
  const desc = pickPoiDescription(poi, contentLang);
  const catLabel = category ? pickCategoryLabel(category, contentLang) : poi.category;

  const showBiz = props.mode === "outdoor" && hasBusinessInfo(poi as any);
  const now = new Date(props.now ?? Date.now());
  const st = showBiz ? getOpenStatus(poi as any, now) : "unknown";
  const stIcon = !showBiz ? "" : (st === "open" ? "🟢" : st === "closed" ? "🔴" : "⏰");
  const stLabel = !showBiz ? "" : (st === "open" ? t(uiLang, "open_now") : st === "closed" ? t(uiLang, "closed_now") : t(uiLang, "hours_unknown"));
  const hours = String((poi as any).hours ?? "").trim();
  const closed = String((poi as any).closed ?? "").trim();

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

        {poi.url ? (
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn primary" href={poi.url} target="_blank" rel="noreferrer noopener">{t(uiLang, "external_link")}</a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
