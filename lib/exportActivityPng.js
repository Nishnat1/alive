"use client";

const ROUTE_COLOR = "#2563EB";
const START_COLOR = "#16A34A";
const END_COLOR = "#DC2626";
const TEXT_COLOR = "#101828";
const SUBTEXT_COLOR = "#475467";

function projectPoints(points, width, height, padding) {
  if (!points || points.length === 0) return [];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const latRange = maxLat - minLat || 0.0005;
  const lngRange = maxLng - minLng || 0.0005;

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const scale = Math.min(drawWidth / lngRange, drawHeight / latRange);

  const offsetX = (drawWidth - lngRange * scale) / 2;
  const offsetY = (drawHeight - latRange * scale) / 2;

  return points.map(([lat, lng]) => [
    padding + offsetX + (lng - minLng) * scale,
    padding + offsetY + (maxLat - lat) * scale,
  ]);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${mm}:${ss}`
    : `${mm}:${ss}`;
}

function formatPace(distanceMeters, elapsedMs) {
  if (distanceMeters < 20 || elapsedMs <= 0) return "--:-- /km";
  const secondsPerKm = Math.floor((elapsedMs / 1000) / (distanceMeters / 1000));
  return `${Math.floor(secondsPerKm / 60)}:${String(
    secondsPerKm % 60
  ).padStart(2, "0")} /km`;
}

function formatSpeed(distanceMeters, elapsedMs) {
  if (distanceMeters < 20 || elapsedMs <= 0) return "0.0 km/h";
  return `${((distanceMeters / 1000) / (elapsedMs / 3600000)).toFixed(1)} km/h`;
}

export function exportActivityPNG({
  routePoints,
  distanceMeters,
  durationMs,
  activity,
  completedAt,
}) {
  const width = 1080;
  const height = 1080;
  const padding = 80;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  const isCycling = activity === "Cycling";
  const paceOrSpeed = isCycling
    ? formatSpeed(distanceMeters, durationMs)
    : formatPace(distanceMeters, durationMs);

  const projected = projectPoints(routePoints, width, height, padding);

  if (projected.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = ROUTE_COLOR;
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.moveTo(projected[0][0], projected[0][1]);
    for (let i = 1; i < projected.length; i++) {
      ctx.lineTo(projected[i][0], projected[i][1]);
    }
    ctx.stroke();

    const start = projected[0];
    const end = projected[projected.length - 1];

    ctx.beginPath();
    ctx.fillStyle = START_COLOR;
    ctx.arc(start[0], start[1], 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = END_COLOR;
    ctx.arc(end[0], end[1], 14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const statsY = height - 230;

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = "bold 56px Arial, sans-serif";
  ctx.fillText(activity, padding, statsY);

  ctx.fillStyle = SUBTEXT_COLOR;
  ctx.font = "24px Arial, sans-serif";
  if (completedAt) {
    const date = new Date(completedAt);
    ctx.fillText(date.toLocaleString(), padding, statsY + 70);
  }

  const rowY = statsY + 120;
  const statWidth = 300;

  ctx.fillStyle = SUBTEXT_COLOR;
  ctx.font = "22px Arial, sans-serif";
  ctx.fillText("Distance", padding, rowY);
  ctx.fillText("Duration", padding + statWidth, rowY);
  ctx.fillText(isCycling ? "Avg speed" : "Avg pace", padding + statWidth * 2, rowY);

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = "bold 42px Arial, sans-serif";
  ctx.fillText(`${(distanceMeters / 1000).toFixed(2)} km`, padding, rowY + 36);
  ctx.fillText(formatDuration(durationMs), padding + statWidth, rowY + 36);
  ctx.fillText(paceOrSpeed, padding + statWidth * 2, rowY + 36);

  const dataUrl = canvas.toDataURL("image/png");

  const link = document.createElement("a");
  const dateStr = completedAt
    ? new Date(completedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  link.download = `fittrack-${activity.toLowerCase()}-${dateStr}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
