/**
 * Multi-floor indoor path finding.
 *
 * Approach: simple graph-based Dijkstra where nodes are POIs (regular + connectors)
 * and edges are:
 *   - Within-floor edges: every pair of POIs on the same floor (Euclidean distance)
 *   - Between-floor edges: pairs of connectors with same connectorGroup (constant cost)
 *
 * This is the "minimal" approach (no obstacle avoidance, no corridor graph).
 * Sufficient for displaying step-by-step floor traversal without external
 * routing infrastructure.
 */

import type { Poi } from "./schema";

/** A single segment on the planned route (within one floor or a connector hop). */
export type RouteStep =
  | { kind: "move"; floor: string; from: Poi; to: Poi }       // walk on the same floor
  | { kind: "connector"; via: Poi; toFloor: string; toPoi: Poi };  // take stairs/EV/etc.

export type IndoorRoute = {
  steps: RouteStep[];
  totalCost: number;
  startFloor: string;
  endFloor: string;
};

const CONNECTOR_COST = 50;  // arbitrary cost for each between-floor hop

function distance(a: Poi, b: Poi): number {
  const ax = a.x ?? 0, ay = a.y ?? 0;
  const bx = b.x ?? 0, by = b.y ?? 0;
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function neighbours(node: Poi, all: Poi[]): Array<{ node: Poi; cost: number; viaConnector: boolean }> {
  const out: Array<{ node: Poi; cost: number; viaConnector: boolean }> = [];
  const myFloor = node.floor || "";

  // Same-floor neighbours (full graph: any same-floor POI is reachable)
  for (const p of all) {
    if (p === node) continue;
    if ((p.floor || "") !== myFloor) continue;
    out.push({ node: p, cost: distance(node, p), viaConnector: false });
  }

  // Connector hops (if this node IS a connector, find its pair on another floor)
  if (node.connectorType && node.connectorGroup) {
    for (const p of all) {
      if (p === node) continue;
      if (p.connectorGroup !== node.connectorGroup) continue;
      if ((p.floor || "") === myFloor) continue;
      out.push({ node: p, cost: CONNECTOR_COST, viaConnector: true });
    }
  }

  return out;
}

/**
 * Find the shortest path from `start` to `end` POI, possibly across floors.
 * Returns null if no path exists.
 */
export function findIndoorRoute(start: Poi, end: Poi, allPois: Poi[]): IndoorRoute | null {
  if (start.id === end.id) {
    return { steps: [], totalCost: 0, startFloor: start.floor || "", endFloor: end.floor || "" };
  }

  // Build node lookup
  const nodes = allPois.filter(p => typeof p.x === "number" && typeof p.y === "number");
  const byId = new Map(nodes.map(p => [p.id, p]));
  if (!byId.has(start.id) || !byId.has(end.id)) return null;

  // Dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<string, { id: string; viaConnector: boolean } | null>();
  const visited = new Set<string>();
  for (const n of nodes) dist.set(n.id, Infinity);
  dist.set(start.id, 0);
  prev.set(start.id, null);

  while (visited.size < nodes.length) {
    // pick unvisited node with smallest distance
    let curId: string | null = null;
    let curDist = Infinity;
    for (const n of nodes) {
      if (visited.has(n.id)) continue;
      const d = dist.get(n.id) ?? Infinity;
      if (d < curDist) { curDist = d; curId = n.id; }
    }
    if (curId === null || curDist === Infinity) break;
    visited.add(curId);
    if (curId === end.id) break;

    const cur = byId.get(curId)!;
    for (const nb of neighbours(cur, nodes)) {
      const newDist = curDist + nb.cost;
      if (newDist < (dist.get(nb.node.id) ?? Infinity)) {
        dist.set(nb.node.id, newDist);
        prev.set(nb.node.id, { id: curId, viaConnector: nb.viaConnector });
      }
    }
  }

  // Reconstruct path
  if (!prev.has(end.id) || dist.get(end.id) === Infinity) return null;

  const pathIds: Array<{ id: string; viaConnector: boolean }> = [];
  let cur: { id: string; viaConnector: boolean } | null = { id: end.id, viaConnector: false };
  while (cur) {
    pathIds.unshift(cur);
    const p = prev.get(cur.id) ?? null;
    cur = p;
  }

  // Build steps
  const steps: RouteStep[] = [];
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = byId.get(pathIds[i].id)!;
    const b = byId.get(pathIds[i + 1].id)!;
    const viaConn = pathIds[i + 1].viaConnector;
    if (viaConn) {
      // a is the connector entry on previous floor; b is exit on next floor
      steps.push({ kind: "connector", via: a, toFloor: b.floor || "", toPoi: b });
    } else {
      steps.push({ kind: "move", floor: a.floor || "", from: a, to: b });
    }
  }

  return {
    steps,
    totalCost: dist.get(end.id) ?? 0,
    startFloor: start.floor || "",
    endFloor: end.floor || "",
  };
}

/** Generate a human-readable directions list. */
export function describeRoute(route: IndoorRoute, lang: "ja" | "en" = "ja"): string[] {
  const out: string[] = [];
  if (route.steps.length === 0) {
    out.push(lang === "ja" ? "出発地と目的地が同じです" : "Start and destination are the same");
    return out;
  }

  const connectorLabel = (type: string) => {
    if (lang === "ja") {
      switch (type) {
        case "stairs": return "階段";
        case "elevator": return "エレベーター";
        case "escalator": return "エスカレーター";
        case "ramp": return "スロープ";
        default: return "通路";
      }
    } else {
      switch (type) {
        case "stairs": return "stairs";
        case "elevator": return "elevator";
        case "escalator": return "escalator";
        case "ramp": return "ramp";
        default: return "passage";
      }
    }
  };

  let lastFloor = route.startFloor;
  for (const step of route.steps) {
    if (step.kind === "move") {
      // Skip narrating internal moves; we summarize
      lastFloor = step.floor;
    } else {
      const t = connectorLabel(step.via.connectorType || "");
      if (lang === "ja") {
        out.push(`${lastFloor || "現フロア"} → ${t}「${step.via.name}」→ ${step.toFloor}`);
      } else {
        out.push(`${lastFloor || "current"} → ${t} "${step.via.name}" → ${step.toFloor}`);
      }
      lastFloor = step.toFloor;
    }
  }
  if (out.length === 0) {
    out.push(lang === "ja" ? `${route.startFloor} 内を移動` : `Move within ${route.startFloor}`);
  }
  return out;
}
