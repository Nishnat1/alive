
"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./RouteMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center bg-slate-100 text-sm text-slate-500 sm:h-[380px]">
      Loading map...
    </div>
  ),
});

export default function RouteMap({
  center = null,
  accuracy = null,
  routePoints = [],
}) {
  return (
    <div className="h-[280px] w-full overflow-hidden rounded-b-2xl sm:h-[380px]">
      <MapView center={center} accuracy={accuracy} routePoints={routePoints} />
    </div>
  );
}
