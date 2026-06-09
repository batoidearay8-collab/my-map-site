/**
 * FloorPlanEditor
 *
 * A lightweight, in-app floor-plan drawing tool (Level 1: rectangles only).
 * Lets a non-technical user lay out rooms as labelled rectangles on a grid,
 * then exports the result as a PNG File via the HTML Canvas API.
 *
 * Design intent: produce a usable floor image WITHOUT any external software.
 * The output File is handed back through `onComplete(file, widthPx, heightPx)`
 * so the caller can feed it straight into the EXISTING floor-image pipeline
 * (setBuilderAsset("floor", ...) + indoor.imageWidthPx/HeightPx). Nothing in
 * the viewer or exporter needs to change.
 *
 * Coordinates inside the editor are stored in "canvas pixels" (the output
 * resolution), and the on-screen SVG is just a scaled view of that space.
 */
import { useRef, useState } from "react";
import type { UiLang } from "../lib/i18n";

type Rect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
};

/** Grid step in canvas pixels used for snapping. */
const GRID = 50;

/** Color presets for rooms. fill is the interior, stroke is the border. */
const ROOM_COLORS: { key: string; ja: string; en: string; fill: string; stroke: string }[] = [
  { key: "default",  ja: "標準",   en: "Default",   fill: "#eef4fb", stroke: "#2e6db4" },
  { key: "class",    ja: "教室",   en: "Classroom", fill: "#ff7a2f", stroke: "#c85a18" },
  { key: "water",    ja: "水回り", en: "Restroom",  fill: "#4f7dd6", stroke: "#2e4f8f" },
  { key: "special",  ja: "特別室", en: "Special",   fill: "#3fae6b", stroke: "#247a47" },
  { key: "facility", ja: "施設",   en: "Facility",  fill: "#b8c0cc", stroke: "#6b7280" },
];
const DEFAULT_FILL = ROOM_COLORS[0].fill;
/** Look up the stroke color that pairs with a given fill. */
const strokeFor = (fill: string) => ROOM_COLORS.find((c) => c.fill === fill)?.stroke ?? "#2e6db4";

type Props = {
  uiLang: UiLang;
  /** Output canvas size in pixels. Defaults to a landscape floor sheet. */
  outWidth?: number;
  outHeight?: number;
  onComplete: (file: File, widthPx: number, heightPx: number) => void;
  onCancel: () => void;
};

const T = (lang: UiLang, ja: string, en: string) => (lang === "ja" ? ja : en);

export function FloorPlanEditor({
  uiLang,
  outWidth = 2000,
  outHeight = 1400,
  onComplete,
  onCancel,
}: Props) {
  const [rects, setRects] = useState<Rect[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [floorName, setFloorName] = useState("");
  const [snap, setSnap] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // On-screen view scale: fit outWidth into ~720px wide editor.
  const VIEW_W = 720;
  const scale = VIEW_W / outWidth;
  const VIEW_H = Math.round(outHeight * scale);

  // Drag-to-draw state
  const draw = useRef<{ active: boolean; sx: number; sy: number; cur?: Rect } | null>(null);
  const [, force] = useState(0);

  /** Snap a canvas coordinate to the grid when snapping is enabled. */
  const snapVal = (v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));

  const toCanvas = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const vx = (clientX - r.left) / scale;
    const vy = (clientY - r.top) / scale;
    return {
      x: snapVal(Math.max(0, Math.min(outWidth, vx))),
      y: snapVal(Math.max(0, Math.min(outHeight, vy))),
    };
  };

  const onDown = (e: React.MouseEvent) => {
    // Only start drawing on empty canvas (not when clicking an existing rect handled below)
    const { x, y } = toCanvas(e.clientX, e.clientY);
    draw.current = { active: true, sx: x, sy: y, cur: { id: "tmp", x, y, w: 0, h: 0, label: "", color: DEFAULT_FILL } };
    setSelectedId(null);
  };
  const onMove = (e: React.MouseEvent) => {
    if (!draw.current?.active) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    const sx = draw.current.sx, sy = draw.current.sy;
    draw.current.cur = {
      id: "tmp",
      x: Math.min(sx, x),
      y: Math.min(sy, y),
      w: Math.abs(x - sx),
      h: Math.abs(y - sy),
      label: "",
      color: DEFAULT_FILL,
    };
    force((n) => n + 1);
  };
  const onUp = () => {
    const cur = draw.current?.cur;
    draw.current = null;
    if (!cur || cur.w < 40 || cur.h < 40) { force((n) => n + 1); return; } // ignore tiny drags
    const id = "r" + Date.now();
    const rect: Rect = { ...cur, id, label: T(uiLang, "部屋", "Room") + (rects.length + 1), color: DEFAULT_FILL };
    setRects((rs) => [...rs, rect]);
    setSelectedId(id);
  };

  const updateRect = (id: string, patch: Partial<Rect>) =>
    setRects((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteRect = (id: string) =>
    setRects((rs) => rs.filter((r) => r.id !== id));

  const selected = rects.find((r) => r.id === selectedId) || null;

  /** Render the rooms to an offscreen canvas and export as a PNG File. */
  const exportPng = () => {
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);

    // Light grid for visual reference
    ctx.strokeStyle = "#eef1f5";
    ctx.lineWidth = 1;
    const grid = 100;
    for (let gx = 0; gx <= outWidth; gx += grid) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, outHeight); ctx.stroke();
    }
    for (let gy = 0; gy <= outHeight; gy += grid) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(outWidth, gy); ctx.stroke();
    }

    // Rooms
    for (const r of rects) {
      ctx.fillStyle = r.color || DEFAULT_FILL;
      ctx.strokeStyle = strokeFor(r.color || DEFAULT_FILL);
      ctx.lineWidth = 4;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      // Label centered
      if (r.label) {
        ctx.fillStyle = "#1f3a5f";
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2, r.w - 16);
      }
    }

    // Floor name (title) top-left
    if (floorName) {
      ctx.fillStyle = "#1f3a5f";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(floorName, 24, 24);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const safe = (floorName || "floor").replace(/[^\w.-]+/g, "_");
      const file = new File([blob], `${safe || "floor"}.png`, { type: "image/png" });
      onComplete(file, outWidth, outHeight);
    }, "image/png");
  };

  const cur = draw.current?.cur;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "var(--card, #fff)", color: "var(--text, #222)", borderRadius: 16,
        padding: 18, maxWidth: 980, width: "100%", maxHeight: "92vh", overflow: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {T(uiLang, "簡易フロア作成", "Simple Floor Plan Editor")}
          </div>
          <button className="btn soft" onClick={onCancel}>{T(uiLang, "閉じる", "Close")}</button>
        </div>

        <div className="hint" style={{ marginBottom: 12 }}>
          {T(uiLang,
            "キャンバス上をドラッグして部屋（長方形）を追加します。部屋を選ぶと名前の変更・削除ができます。完成したら「この画像を使う」を押すと、フロア画像として取り込まれます。",
            "Drag on the canvas to add a room (rectangle). Select a room to rename or delete it. When done, click 'Use this image' to import it as your floor image."
          )}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {/* Canvas */}
          <div style={{ flex: "1 1 auto" }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              {T(uiLang, "フロア名（任意）", "Floor name (optional)")}
              <input value={floorName} onChange={(e) => setFloorName(e.target.value)}
                placeholder={T(uiLang, "例: 1階", "e.g. 1F")} style={{ width: "100%" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              {T(uiLang, "グリッドに揃える（部屋をきれいに整列）", "Snap to grid (align rooms neatly)")}
            </label>
            <svg
              ref={svgRef}
              width={VIEW_W} height={VIEW_H}
              style={{ border: "1px solid var(--line, #ccc)", borderRadius: 10, background: "#fff", cursor: "crosshair", touchAction: "none", maxWidth: "100%" }}
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            >
              {/* grid */}
              {Array.from({ length: Math.floor(outWidth / 100) + 1 }).map((_, i) => (
                <line key={"v" + i} x1={i * 100 * scale} y1={0} x2={i * 100 * scale} y2={VIEW_H} stroke="#eef1f5" />
              ))}
              {Array.from({ length: Math.floor(outHeight / 100) + 1 }).map((_, i) => (
                <line key={"h" + i} x1={0} y1={i * 100 * scale} x2={VIEW_W} y2={i * 100 * scale} stroke="#eef1f5" />
              ))}
              {/* rooms */}
              {rects.map((r) => (
                <g key={r.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedId(r.id); }} style={{ cursor: "pointer" }}>
                  <rect
                    x={r.x * scale} y={r.y * scale} width={r.w * scale} height={r.h * scale}
                    fill={r.color || DEFAULT_FILL}
                    stroke={r.id === selectedId ? "#e0533d" : strokeFor(r.color || DEFAULT_FILL)}
                    strokeWidth={r.id === selectedId ? 3 : 2}
                  />
                  <text x={(r.x + r.w / 2) * scale} y={(r.y + r.h / 2) * scale}
                    textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="#1f3a5f">
                    {r.label}
                  </text>
                </g>
              ))}
              {/* live drawing rectangle */}
              {cur && cur.w > 0 ? (
                <rect x={cur.x * scale} y={cur.y * scale} width={cur.w * scale} height={cur.h * scale}
                  fill="rgba(46,109,180,.15)" stroke="#2e6db4" strokeDasharray="4 3" />
              ) : null}
            </svg>
            <div className="hint" style={{ marginTop: 6 }}>
              {T(uiLang, `出力サイズ: ${outWidth}×${outHeight}px ・ 部屋数: ${rects.length}`,
                `Output: ${outWidth}×${outHeight}px · Rooms: ${rects.length}`)}
            </div>
          </div>

          {/* Side panel: selected room editing */}
          <div style={{ flex: "0 0 240px", minWidth: 220 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{T(uiLang, "選択中の部屋", "Selected room")}</div>
            {selected ? (
              <div style={{ display: "grid", gap: 8 }}>
                <label>
                  {T(uiLang, "名前", "Name")}
                  <input value={selected.label} onChange={(e) => updateRect(selected.id, { label: e.target.value })} />
                </label>
                <div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{T(uiLang, "色", "Color")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ROOM_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        title={T(uiLang, c.ja, c.en)}
                        onClick={() => updateRect(selected.id, { color: c.fill })}
                        style={{
                          width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                          background: c.fill,
                          border: selected.color === c.fill ? "3px solid #e0533d" : `2px solid ${c.stroke}`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <button className="btn soft" onClick={() => { deleteRect(selected.id); setSelectedId(null); }}>
                  {T(uiLang, "この部屋を削除", "Delete this room")}
                </button>
              </div>
            ) : (
              <div className="hint">{T(uiLang, "部屋をクリックすると、ここで名前の変更や削除ができます。", "Click a room to rename or delete it here.")}</div>
            )}

            <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid var(--line, #ddd)" }} />

            <div style={{ display: "grid", gap: 8 }}>
              <button className="btn soft" onClick={() => { setRects([]); setSelectedId(null); }}>
                {T(uiLang, "すべてクリア", "Clear all")}
              </button>
              <button className="btn primary" disabled={rects.length === 0} onClick={exportPng}>
                {T(uiLang, "この画像を使う", "Use this image")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
