import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { t, type UiLang } from "../lib/i18n";

export function QrModal(props: { url: string; onClose: () => void; uiLang: UiLang }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      const u = await QRCode.toDataURL(props.url, { margin: 1, scale: 8 });
      setDataUrl(u);
    })();
  }, [props.url]);

  return (
    <div className="modalBackdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{t(props.uiLang, "qr_title")}</div>
          <button className="btn" onClick={props.onClose}>{t(props.uiLang, "qr_close")}</button>
        </div>

        <div className="card">
          <div className="hint">{t(props.uiLang, "qr_public_url")}</div>
          <div style={{ fontWeight: 800, wordBreak: "break-all" }}>{props.url}</div>
        </div>

        <div className="card" style={{ display: "grid", placeItems: "center" }}>
          {dataUrl ? <img alt="QR" src={dataUrl} style={{ width: 320, height: 320 }} /> : <div className="hint">{t(props.uiLang, "qr_generating")}</div>}
        </div>
      </div>
    </div>
  );
}
