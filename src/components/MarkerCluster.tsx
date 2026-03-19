import React, { useMemo } from "react";
import * as L from "leaflet";
import { Marker, Popup, useMap } from "react-leaflet";

/**
 * Lightweight marker clustering for Leaflet (no external dependency).
 *
 * Groups nearby markers into numbered cluster circles at low zoom levels.
 * Expands to individual markers when zoomed in or when cluster size is 1.
 *
 * This avoids a dependency on leaflet.markercluster while solving the problem
 * of 50+ markers overlapping at low zoom.
 */

type ClusterItem<T> = {
  position: L.LatLngExpression;
  data: T;
  icon: L.DivIcon;
  popup?: React.ReactNode;
};

type ClusterGroup<T> = {
  center: L.LatLng;
  items: ClusterItem<T>[];
};

const clusterIconCache = new Map<string, L.DivIcon>();

function makeClusterIcon(count: number): L.DivIcon {
  const key = `cluster-${count}`;
  const cached = clusterIconCache.get(key);
  if (cached) return cached;

  const size = count >= 100 ? 48 : count >= 10 ? 40 : 34;
  const icon = L.divIcon({
    className: "msf-cluster-icon",
    html: `<div class="msf-cluster" style="width:${size}px;height:${size}px"><span>${count}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  clusterIconCache.set(key, icon);
  return icon;
}

/**
 * Simple grid-based spatial clustering.
 * Divides the visible map into a grid and groups markers that fall into the same cell.
 */
function clusterItems<T>(
  items: ClusterItem<T>[],
  map: L.Map,
  gridSizePx: number = 80
): ClusterGroup<T>[] {
  if (!items.length) return [];

  const zoom = map.getZoom();
  const groups = new Map<string, ClusterGroup<T>>();

  for (const item of items) {
    const ll = L.latLng(item.position as any);
    const point = map.project(ll, zoom);
    const cellX = Math.floor(point.x / gridSizePx);
    const cellY = Math.floor(point.y / gridSizePx);
    const key = `${cellX}:${cellY}`;

    let group = groups.get(key);
    if (!group) {
      group = { center: ll, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  // Recalculate center as the average of all points in the cluster
  for (const group of groups.values()) {
    if (group.items.length > 1) {
      let latSum = 0;
      let lngSum = 0;
      for (const item of group.items) {
        const ll = L.latLng(item.position as any);
        latSum += ll.lat;
        lngSum += ll.lng;
      }
      group.center = L.latLng(latSum / group.items.length, lngSum / group.items.length);
    }
  }

  return Array.from(groups.values());
}

export type MarkerClusterProps<T> = {
  items: ClusterItem<T>[];
  /** Minimum zoom level at which clustering is disabled (all markers shown individually). */
  disableClusteringAtZoom?: number;
  /** Grid cell size in pixels for grouping. Default 80. */
  gridSize?: number;
  /** Called when a cluster is clicked (zooms to fit its items). */
  onClusterClick?: (items: ClusterItem<T>[]) => void;
};

function MarkerClusterInner<T>(props: MarkerClusterProps<T>) {
  const map = useMap();
  const [zoom, setZoom] = React.useState(() => map.getZoom());

  React.useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    map.on("moveend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
      map.off("moveend", onZoom);
    };
  }, [map]);

  const disableAt = props.disableClusteringAtZoom ?? 17;
  const gridSize = props.gridSize ?? 80;

  const clusters = useMemo(() => {
    if (zoom >= disableAt) return null; // show all individual markers
    return clusterItems(props.items, map, gridSize);
  }, [props.items, map, zoom, disableAt, gridSize]);

  // Individual markers mode
  if (!clusters) {
    return (
      <>
        {props.items.map((item, idx) => (
          <Marker key={idx} position={item.position} icon={item.icon}>
            {item.popup ? <Popup>{item.popup}</Popup> : null}
          </Marker>
        ))}
      </>
    );
  }

  // Clustered mode
  return (
    <>
      {clusters.map((group, idx) => {
        if (group.items.length === 1) {
          const item = group.items[0];
          return (
            <Marker key={`s-${idx}`} position={item.position} icon={item.icon}>
              {item.popup ? <Popup>{item.popup}</Popup> : null}
            </Marker>
          );
        }

        return (
          <Marker
            key={`c-${idx}`}
            position={group.center}
            icon={makeClusterIcon(group.items.length)}
            eventHandlers={{
              click: () => {
                // Zoom to fit all items in this cluster
                const bounds = L.latLngBounds(
                  group.items.map((i) => L.latLng(i.position as any))
                );
                map.fitBounds(bounds.pad(0.3));
              },
            }}
          />
        );
      })}
    </>
  );
}

export function MarkerClusterGroup<T>(props: MarkerClusterProps<T>) {
  return <MarkerClusterInner {...props} />;
}

export type { ClusterItem };
