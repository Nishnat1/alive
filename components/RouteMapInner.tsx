"use client";

import * as L from "leaflet";
import { useEffect, useRef } from "react";

const currentLocationIcon = L.divIcon({
  className: "alive-location-icon",
  html: `
    <span class="alive-location-pulse">
      <span class="alive-location-dot"></span>
    </span>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const initialCenter = [20.5937, 78.9629];

export default function RouteMap({ center, accuracy, routePoints = [] }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);

  useEffect(() => {
    if (!mapElementRef.current) return;

    const map = L.map(mapElementRef.current, { scrollWheelZoom: true });
    map.setView(center || initialCenter, center ? 16 : 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const layers = L.layerGroup().addTo(map);
    mapRef.current = map;
    layersRef.current = layers;

    return () => {
      layers.clearLayers();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    if (center) {
      map.setView(center, Math.max(map.getZoom(), 16), { animate: false });
    }

    layers.clearLayers();

    if (center && Number.isFinite(accuracy)) {
      L.circle(center, {
        radius: Math.max(accuracy, 5),
        color: "#2563EB",
        weight: 2,
        fillColor: "#3B82F6",
        fillOpacity: 0.12,
      }).addTo(layers);
    }

    if (center) {
      L.marker(center, {
        icon: currentLocationIcon,
        zIndexOffset: 1000,
        keyboard: false,
      }).addTo(layers);

      L.circleMarker(center, {
        radius: 10,
        color: "#FFFFFF",
        weight: 3,
        fillColor: "#059669",
        fillOpacity: 1,
      }).addTo(layers);
    }

    if (routePoints.length > 1) {
      L.polyline(routePoints, {
        color: "#2563EB",
        weight: 6,
        opacity: 0.95,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(layers);
    }

    if (routePoints.length > 0) {
      L.circleMarker(routePoints[0], {
        radius: 8,
        color: "#FFFFFF",
        weight: 3,
        fillColor: "#16A34A",
        fillOpacity: 1,
      }).addTo(layers);

      if (routePoints.length > 1) {
        L.circleMarker(routePoints[routePoints.length - 1], {
          radius: 8,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#DC2626",
          fillOpacity: 1,
        }).addTo(layers);
      }
    }
  }, [center, accuracy, routePoints]);

  return <div ref={mapElementRef} style={{ height: "100%", width: "100%" }} />;
}
