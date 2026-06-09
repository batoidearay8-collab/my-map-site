/**
 * FloorPlanEditor
 *
 * A lightweight, in-app floor-plan drawing tool (Level 1: rectangles).
 * Lets a non-technical user lay out rooms as labelled rectangles, edit them
 * (move / resize / rotate / reorder layers), then export the result as a PNG
 * File via the HTML Canvas API.
 *
 * Design intent: produce a usable floor image WITHOUT any external software.
 * The output File is handed back through `onComplete(file, widthPx, heightPx)`
 * so the caller can feed it straight into the EXISTING floor-image pipeline
 * (setBuilderAsset("floor", ...) + indoor.imageWidthPx/HeightPx). Nothing in
 * the viewer or exporter needs to change.
 *
 * Coordinates inside the editor are stored in "canvas pixels" (the output
 * resolution); the on-screen SVG is a scaled view of that space. Each room may
 * be rotated about its own center by `rotation` degrees. Array order is the
 * stacking order (later = on top), controlled via the layer buttons.
 */
import { useRef, useState } from "react";
import type { UiLang } from "../lib/i18n";

type Rect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degrees, about center
  label: string;
  color: string;
};

/** Grid step in canvas pixels used for snapping. */
const GRID = 50;
const MIN_SIZE = 40;

/** Color presets for rooms. fill is the interior, stroke is the border. */
const ROOM_COLORS: { key: string; ja: string; en: string; fill: string; stroke: string }[] = [
  { key: "default",  ja: "標準",   en: "Default",   fill: "#eef4fb", stroke: "#2e6db4" },
  { key: "class",    ja: "教室",   en: "Classroom", fill: "#ff7a2f", stroke: "#c85a18" },
  { key: "water",    ja: "水回り", en: "Restroom",  fill: "#4f7dd6", stroke: "#2e4f8f" },
  { key: "special",  ja: "特別室", en: "Special",   fill: "#3fae6b", stroke: "#247a47" },
  { key: "facility", ja: "施設",   en: "Facility",  fill: "#b8c0cc", stroke: "#6b7280" },
];
const DEFAULT_FILL = ROOM_COLORS[0].fill;
const strokeFor = (fill: string) => ROOM_COLORS.find((c) => c.fill === fill)?.stroke ?? "#2e6db4";

type Props = {
  uiLang: UiLang;
  outWidth?: number;
  outHeight?: number;
  onComplete: (file: File, widthPx: number, heightPx: number) => void;
  onCancel: () => void;
};

const T = (lang: UiLang, ja: string, en: string) => (lang === "ja" ? ja : en);

/** The four corner handles for resize, by name. */
type Corner = "nw" | "ne" | "se" | "sw";

/** Active pointer gesture on an existing room. */
type Gesture =
  | { kind: "draw"; sx: number; sy: number; cur: Rect }
  | { kind: "move"; id: string; ox: number; oy: number; startX: number; startY: number }
  | { kind: "resize"; id: string; corner: Corner; base: Rect }
  | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; baseRot: number }
  | null;

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

  const VIEW_W = 720;
  const scale = VIEW_W / outWidth;
  const VIEW_H = Math.round(outHeight * scale);

  const gesture = useRef<Gesture>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const snapVal = (v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));
  const clampX = (v: number) => Math.max(0, Math.min(outWidth, v));
  const clampY = (v: number) => Math.max(0, Math.min(outHeight, v));

  /** Convert a client point to canvas coords (no snap; snap applied where needed). */
  const toCanvasRaw = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };

  const updateRect = (id: string, patch: Partial<Rect>) =>
    setRects((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteRect = (id: string) =>
    setRects((rs) => rs.filter((r) => r.id !== id));

  const selected = rects.find((r) => r.id === selectedId) || null;

  /* ── Layer ordering (array order = stacking; later = on top) ── */
  const moveLayer = (id: string, where: "front" | "back" | "up" | "down") => {
    setRects((rs) => {
      const i = rs.findIndex((r) => r.id === id);
      if (i < 0) return rs;
      const next = rs.slice();
      const [item] = next.splice(i, 1);
      if (where === "front") next.push(item);
      else if (where === "back") next.unshift(item);
      else if (where === "up") next.splice(Math.min(next.length, i + 1), 0, item);
      else next.splice(Math.max(0, i - 1), 0, item);
      return next;
    });
  };

  /* ── Pointer handlers ── */

  // Start drawing a new rectangle on empty canvas.
  const onCanvasDown = (e: React.MouseEvent) => {
    const { x, y } = toCanvasRaw(e.clientX, e.clientY);
    const sx = snapVal(clampX(x)), sy = snapVal(clampY(y));
    gesture.current = {
      kind: "draw", sx, sy,
      cur: { id: "tmp", x: sx, y: sy, w: 0, h: 0, rotation: 0, label: "", color: DEFAULT_FILL },
    };
    setSelectedId(null);
    rerender();
  };

  // Begin moving an existing room.
  const startMove = (e: React.MouseEvent, r: Rect) => {
    e.stopPropagation();
    setSelectedId(r.id);
    const { x, y } = toCanvasRaw(e.clientX, e.clientY);
    gesture.current = { kind: "move", id: r.id, ox: x - r.x, oy: y - r.y, startX: r.x, startY: r.y };
  };

  // Begin resizing from a corner handle.
  const startResize = (e: React.MouseEvent, r: Rect, corner: Corner) => {
    e.stopPropagation();
    setSelectedId(r.id);
    gesture.current = { kind: "resize", id: r.id, corner, base: { ...r } };
  };

  // Begin rotating via the rotation handle.
  const startRotate = (e: React.MouseEvent, r: Rect) => {
    e.stopPropagation();
    setSelectedId(r.id);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const { x, y } = toCanvasRaw(e.clientX, e.clientY);
    const startAngle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    gesture.current = { kind: "rotate", id: r.id, cx, cy, startAngle, baseRot: r.rotation };
  };

  const onMove = (e: React.MouseEvent) => {
    const g = gesture.current;
    if (!g) return;
    const { x, y } = toCanvasRaw(e.clientX, e.clientY);

    if (g.kind === "draw") {
      const ex = snapVal(clampX(x)), ey = snapVal(clampY(y));
      g.cur = {
        id: "tmp",
        x: Math.min(g.sx, ex), y: Math.min(g.sy, ey),
        w: Math.abs(ex - g.sx), h: Math.abs(ey - g.sy),
        rotation: 0, label: "", color: DEFAULT_FILL,
      };
      rerender();
    } else if (g.kind === "move") {
      const nx = snapVal(clampX(x - g.ox));
      const ny = snapVal(clampY(y - g.oy));
      updateRect(g.id, { x: nx, y: ny });
    } else if (g.kind === "resize") {
      const b = g.base;
      let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
      const px = snapVal(clampX(x)), py = snapVal(clampY(y));
      if (g.corner === "nw") { x1 = px; y1 = py; }
      else if (g.corner === "ne") { x2 = px; y1 = py; }
      else if (g.corner === "se") { x2 = px; y2 = py; }
      else { x1 = px; y2 = py; }
      const nx = Math.min(x1, x2), ny = Math.min(y1, y2);
      const nw = Math.max(MIN_SIZE, Math.abs(x2 - x1)), nh = Math.max(MIN_SIZE, Math.abs(y2 - y1));
      updateRect(g.id, { x: nx, y: ny, w: nw, h: nh });
    } else if (g.kind === "rotate") {
      const ang = Math.atan2(y - g.cy, x - g.cx) * 180 / Math.PI;
      let rot = g.baseRot + (ang - g.startAngle);
      // snap rotation to 15° steps when grid snapping is on
      if (snap) rot = Math.round(rot / 15) * 15;
      rot = ((rot % 360) + 360) % 360;
      updateRect(g.id, { rotation: Math.round(rot) });
    }
  };

  const onUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g && g.kind === "draw") {
      const c = g.cur;
      if (c.w >= MIN_SIZE && c.h >= MIN_SIZE) {
        const id = "r" + Date.now();
        setRects((rs) => [...rs, { ...c, id, label: T(uiLang, "部屋", "Room") + (rs.length + 1) }]);
        setSelectedId(id);
      }
    }
    rerender();
  };

  /** Render rooms to an offscreen canvas and export as a PNG File. */
  const exportPng = () => {
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);

    ctx.strokeStyle = "#eef1f5";
    ctx.lineWidth = 1;
    const grid = 100;
    for (let gx = 0; gx <= outWidth; gx += grid) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, outHeight); ctx.stroke(); }
    for (let gy = 0; gy <= outHeight; gy += grid) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(outWidth, gy); ctx.stroke(); }

    // Rooms in array order (later = on top), each rotated about its center.
    for (const r of rects) {
      ctx.save();
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((r.rotation || 0) * Math.PI / 180);
      ctx.fillStyle = r.color || DEFAULT_FILL;
      ctx.strokeStyle = strokeFor(r.color || DEFAULT_FILL);
      ctx.lineWidth = 4;
      ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
      if (r.label) {
        ctx.fillStyle = "#1f3a5f";
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(r.label, 0, 0, r.w - 16);
      }
      ctx.restore();
    }

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

  const drawing = gesture.current?.kind === "draw" ? gesture.current.cur : null;

  // Corner handle positions in local (unrotated) rect space.
  const cornerPts = (r: Rect): Record<Corner, { x: number; y: number }> => ({
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    se: { x: r.x + r.w, y: r.y + r.h },
    sw: { x: r.x, y: r.y + r.h },
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "var(--card, #fff)", color: "var(--text, #222)", borderRadius: 16,
        padding: 18, maxWidth: 1000, width: "100%", maxHeight: "92vh", overflow: "auto",
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
            "何もない所をドラッグで部屋を追加。部屋を選んでドラッグで移動、四隅で拡大縮小、上の丸で回転できます。完成したら「この画像を使う」を押してください。",
            "Drag empty space to add a room. Select a room then drag to move, use corners to resize, the top circle to rotate. Click 'Use this image' when done."
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
              {T(uiLang, "グリッドに揃える（移動50px・回転15°）", "Snap to grid (move 50px / rotate 15°)")}
            </label>
            <svg
              ref={svgRef}
              width={VIEW_W} height={VIEW_H}
              style={{ border: "1px solid var(--line, #ccc)", borderRadius: 10, background: "#fff", cursor: "crosshair", touchAction: "none", maxWidth: "100%" }}
              onMouseDown={onCanvasDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            >
              {/* grid */}
              {Array.from({ length: Math.floor(outWidth / 100) + 1 }).map((_, i) => (
                <line key={"v" + i} x1={i * 100 * scale} y1={0} x2={i * 100 * scale} y2={VIEW_H} stroke="#eef1f5" />
              ))}
              {Array.from({ length: Math.floor(outHeight / 100) + 1 }).map((_, i) => (
                <line key={"h" + i} x1={0} y1={i * 100 * scale} x2={VIEW_W} y2={i * 100 * scale} stroke="#eef1f5" />
              ))}

              {/* rooms (array order = stacking) */}
              {rects.map((r) => {
                const isSel = r.id === selectedId;
                const cx = (r.x + r.w / 2) * scale, cy = (r.y + r.h / 2) * scale;
                return (
                  <g key={r.id} transform={`rotate(${r.rotation || 0} ${cx} ${cy})`}>
                    <rect
                      x={r.x * scale} y={r.y * scale} width={r.w * scale} height={r.h * scale}
                      fill={r.color || DEFAULT_FILL}
                      stroke={isSel ? "#e0533d" : strokeFor(r.color || DEFAULT_FILL)}
                      strokeWidth={isSel ? 3 : 2}
                      style={{ cursor: "move" }}
                      onMouseDown={(e) => startMove(e, r)}
                    />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize={13} fontWeight={700} fill="#1f3a5f" style={{ pointerEvents: "none" }}>
                      {r.label}
                    </text>
                    {isSel ? (
                      <>
                        {/* resize handles */}
                        {(Object.entries(cornerPts(r)) as [Corner, { x: number; y: number }][]).map(([c, p]) => (
                          <rect key={c} x={p.x * scale - 5} y={p.y * scale - 5} width={10} height={10}
                            fill="#fff" stroke="#e0533d" strokeWidth={2}
                            style={{ cursor: "nwse-resize" }}
                            onMouseDown={(e) => startResize(e, r, c)} />
                        ))}
                        {/* rotation handle (above top edge) */}
                        <line x1={cx} y1={r.y * scale} x2={cx} y2={r.y * scale - 22} stroke="#e0533d" strokeWidth={1.5} />
                        <circle cx={cx} cy={r.y * scale - 26} r={6} fill="#e0533d"
                          style={{ cursor: "grab" }} onMouseDown={(e) => startRotate(e, r)} />
                      </>
                    ) : null}
                  </g>
                );
              })}

              {/* live drawing rectangle */}
              {drawing && drawing.w > 0 ? (
                <rect x={drawing.x * scale} y={drawing.y * scale} width={drawing.w * scale} height={drawing.h * scale}
                  fill="rgba(46,109,180,.15)" stroke="#2e6db4" strokeDasharray="4 3" />
              ) : null}
            </svg>
            <div className="hint" style={{ marginTop: 6 }}>
              {T(uiLang, `出力サイズ: ${outWidth}×${outHeight}px ・ 部屋数: ${rects.length}`,
                `Output: ${outWidth}×${outHeight}px · Rooms: ${rects.length}`)}
            </div>
          </div>

          {/* Side panel */}
          <div style={{ flex: "0 0 250px", minWidth: 230 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{T(uiLang, "選択中の部屋", "Selected room")}</div>
            {selected ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  {T(uiLang, "名前", "Name")}
                  <input value={selected.label} onChange={(e) => updateRect(selected.id, { label: e.target.value })} />
                </label>

                {/* color */}
                <div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{T(uiLang, "色", "Color")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ROOM_COLORS.map((c) => (
                      <button key={c.key} type="button" title={T(uiLang, c.ja, c.en)}
                        onClick={() => updateRect(selected.id, { color: c.fill })}
                        style={{
                          width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: c.fill,
                          border: selected.color === c.fill ? "3px solid #e0533d" : `2px solid ${c.stroke}`,
                        }} />
                    ))}
                  </div>
                </div>

                {/* size (resize via numbers) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ fontSize: 13 }}>
                    {T(uiLang, "幅", "Width")}
                    <input type="number" value={Math.round(selected.w)} min={MIN_SIZE}
                      onChange={(e) => updateRect(selected.id, { w: Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE) })} />
                  </label>
                  <label style={{ fontSize: 13 }}>
                    {T(uiLang, "高さ", "Height")}
                    <input type="number" value={Math.round(selected.h)} min={MIN_SIZE}
                      onChange={(e) => updateRect(selected.id, { h: Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE) })} />
                  </label>
                </div>

                {/* rotation */}
                <label style={{ fontSize: 13 }}>
                  {T(uiLang, "角度", "Angle")}（{selected.rotation}°）
                  <input type="range" min={0} max={359} value={selected.rotation}
                    onChange={(e) => updateRect(selected.id, { rotation: Number(e.target.value) })}
                    style={{ width: "100%" }} />
                </label>

                {/* layer order */}
                <div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{T(uiLang, "重なり順（レイヤー）", "Layer order")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button className="btn soft" onClick={() => moveLayer(selected.id, "front")}>{T(uiLang, "最前面", "To front")}</button>
                    <button className="btn soft" onClick={() => moveLayer(selected.id, "back")}>{T(uiLang, "最背面", "To back")}</button>
                    <button className="btn soft" onClick={() => moveLayer(selected.id, "up")}>{T(uiLang, "前へ", "Forward")}</button>
                    <button className="btn soft" onClick={() => moveLayer(selected.id, "down")}>{T(uiLang, "後ろへ", "Backward")}</button>
                  </div>
                </div>

                <button className="btn soft" onClick={() => { deleteRect(selected.id); setSelectedId(null); }}>
                  {T(uiLang, "この部屋を削除", "Delete this room")}
                </button>
              </div>
            ) : (
              <div className="hint">{T(uiLang, "部屋をクリックすると、移動・拡大縮小・回転・重なり順・色・名前を編集できます。", "Click a room to move, resize, rotate, reorder, recolor, or rename it.")}</div>
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
