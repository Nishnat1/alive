"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import RouteMap from "@/components/RouteMap";
import { useAuth, useRequireAuth } from "@/components/AuthProvider";
import { API_URL, fetchJSON } from "@/lib/api";
import { exportActivityPNG } from "@/lib/exportActivityPng";
import {
  Activity,
  ArrowLeft,
  Bike,
  Clock3,
  Download,
  Footprints,
  Gauge,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  Square,
} from "lucide-react";

const activities = [
  { name: "Running", Icon: Activity },
  { name: "Walking", Icon: Footprints },
  { name: "Cycling", Icon: Bike },
];

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

const MAX_SPEED_MPS = {
  Walking: 3.2,
  Running: 12.5,
  Cycling: 25,
};

type RoutePoint = [number, number];

const MIN_MOVE_METERS = 2;
const ACCEPTABLE_ACCURACY_METERS = 30;

function distanceInMeters(
  [lat1, lon1]: RoutePoint,
  [lat2, lon2]: RoutePoint
) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(1 - a))
  );
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

export default function WorkoutPage() {
  const router = useRouter();
  const { loading } = useRequireAuth();
  const { location, locationError } = useAuth();

  const [activity, setActivity] = useState("Running");
  const [status, setStatus] = useState("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [gpsStatus, setGpsStatus] = useState(
    "Location access is requested after sign-in."
  );
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const routePointsRef = useRef<RoutePoint[]>([]);
  const lastAcceptedFixRef = useRef<{
    point: RoutePoint;
    timestamp: number;
  } | null>(null);
  const lastProcessedLocationRef = useRef(null);
  const elapsedBeforeRunRef = useRef(0);
  const runStartedAtRef = useRef(null);
  const smoothedLatRef = useRef(null);
  const smoothedLngRef = useRef(null);
  const mapCenter = useMemo<[number, number] | null>(
    () => (location ? [location.latitude, location.longitude] : null),
    [location]
  );

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("activity");
    if (activities.some((item) => item.name === selected)) setActivity(selected);
  }, []);

  useEffect(() => {
    if (status !== "running") return;

    const updateTimer = () => {
      setElapsedMs(
        elapsedBeforeRunRef.current + (Date.now() - runStartedAtRef.current)
      );
    };

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(intervalId);
  }, [status]);

  useEffect(() => {
    if (locationError) {
      setGpsStatus(locationError);
    }

    if (!location) {
      setGpsStatus(locationError || "Waiting for your GPS location…");
      return;
    }

    const { latitude, longitude, accuracy, timestamp } = location;
    if (accuracy > 60) {
      setGpsStatus(
        `Weak signal · accuracy ±${Math.round(accuracy)} m. Move outdoors.`
      );
      return;
    }

    if (smoothedLatRef.current === null) {
      smoothedLatRef.current = latitude;
      smoothedLngRef.current = longitude;
    } else {
      const alpha = Math.min(1, 15 / Math.max(accuracy, 5));
      smoothedLatRef.current =
        alpha * latitude + (1 - alpha) * smoothedLatRef.current;
      smoothedLngRef.current =
        alpha * longitude + (1 - alpha) * smoothedLngRef.current;
    }

    const point: RoutePoint = [
      smoothedLatRef.current,
      smoothedLngRef.current,
    ];
    if (status !== "running") {
      if (!locationError) {
        setGpsStatus(
          `Location ready · accuracy ±${Math.round(accuracy)} m`
        );
      }
      return;
    }

    if (lastProcessedLocationRef.current === timestamp) return;
    lastProcessedLocationRef.current = timestamp;

    const previous = lastAcceptedFixRef.current;
    if (!previous) {
      if (accuracy <= ACCEPTABLE_ACCURACY_METERS) {
        const lastPoint = routePointsRef.current.at(-1);
        if (!lastPoint || distanceInMeters(lastPoint, point) >= MIN_MOVE_METERS) {
          routePointsRef.current = [...routePointsRef.current, point];
          setRoutePoints(routePointsRef.current);
        }
        lastAcceptedFixRef.current = { point, timestamp };
        setGpsStatus(
          `GPS tracking active · accuracy ±${Math.round(accuracy)} m`
        );
      } else {
        setGpsStatus(
          `Waiting for a clearer GPS fix · accuracy ±${Math.round(accuracy)} m`
        );
      }
      return;
    }

    const elapsedSeconds = (timestamp - previous.timestamp) / 1000;
    if (elapsedSeconds <= 0) return;

    const movedMeters = distanceInMeters(previous.point, point);
    const speedMps = movedMeters / elapsedSeconds;
    const maxSpeed = MAX_SPEED_MPS[activity] || 12.5;

    if (speedMps > maxSpeed || movedMeters < MIN_MOVE_METERS) return;

    lastAcceptedFixRef.current = { point, timestamp };
    routePointsRef.current = [...routePointsRef.current, point];
    setRoutePoints(routePointsRef.current);
    setDistanceMeters((current) => current + movedMeters);
    setCurrentSpeed(speedMps);
    setGpsStatus(
      `GPS tracking active · accuracy ±${Math.round(accuracy)} m`
    );
  }, [location, locationError, status, activity]);

  function startWorkout() {
    elapsedBeforeRunRef.current = 0;
    runStartedAtRef.current = Date.now();
    lastAcceptedFixRef.current = null;
    lastProcessedLocationRef.current = null;
    routePointsRef.current = [];
    smoothedLatRef.current = null;
    smoothedLngRef.current = null;
    setElapsedMs(0);
    setRoutePoints([]);
    setDistanceMeters(0);
    setCurrentSpeed(0);
    setSaveMessage("");
    setGpsStatus("Searching for GPS signal…");
    setStatus("running");
  }

  function pauseWorkout() {
    if (status !== "running") return;
    const finalElapsed =
      elapsedBeforeRunRef.current + (Date.now() - runStartedAtRef.current);
    elapsedBeforeRunRef.current = finalElapsed;
    runStartedAtRef.current = null;
    lastAcceptedFixRef.current = null;
    smoothedLatRef.current = null;
    smoothedLngRef.current = null;
    setElapsedMs(finalElapsed);
    setGpsStatus("Workout paused · GPS paused");
    setStatus("paused");
  }

  function resumeWorkout() {
    if (status !== "paused") return;
    runStartedAtRef.current = Date.now();
    setGpsStatus("Searching for GPS signal…");
    setStatus("running");
  }

  function finishWorkout() {
    if (status !== "running" && status !== "paused") return;

    if (status === "running") {
      const finalElapsed =
        elapsedBeforeRunRef.current + (Date.now() - runStartedAtRef.current);
      elapsedBeforeRunRef.current = finalElapsed;
      setElapsedMs(finalElapsed);
    }

    runStartedAtRef.current = null;
    lastAcceptedFixRef.current = null;
    setStatus("finished");
    setSaveMessage("");
    setShowSavePrompt(true);
  }

  async function saveFinishedWorkout() {
    if (isSaving) return;

    const workout = {
      activity,
      durationMs: elapsedMs,
      distanceMeters,
      routePoints: routePointsRef.current.filter((point) => point !== null),
      completedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setSaveMessage("");

    try {
      await fetchJSON(`${API_URL}/workouts`, {
        method: "POST",
        body: JSON.stringify(workout),
      });

      setShowSavePrompt(false);
      setSaveMessage("Activity saved successfully.");
    } catch (error) {
      console.error("Workout save failed:", error);
      if (error.status === 401) {
        router.replace("/login");
        return;
      }
      setSaveMessage(
        error.message || "Could not save. Check that the API is running."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function discardFinishedWorkout() {
    setShowSavePrompt(false);
    setSaveMessage("Activity discarded. It was not saved.");
  }

  function downloadActivityPNG() {
    try {
      exportActivityPNG({
        routePoints: routePointsRef.current.filter((p) => p !== null),
        distanceMeters,
        durationMs: elapsedMs,
        activity,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("PNG export failed:", error);
      setSaveMessage("Could not generate the PNG image.");
    }
  }

  function resetWorkout() {
    elapsedBeforeRunRef.current = 0;
    runStartedAtRef.current = null;
    lastAcceptedFixRef.current = null;
    routePointsRef.current = [];
    smoothedLatRef.current = null;
    smoothedLngRef.current = null;
    setElapsedMs(0);
    setRoutePoints([]);
    setDistanceMeters(0);
    setCurrentSpeed(0);
    setGpsStatus("Waiting for your GPS location…");
    setSaveMessage("");
    setShowSavePrompt(false);
    setStatus("idle");
  }

  function chooseActivity(name) {
    if (status === "running" || status === "paused") return;
    if (status === "finished") resetWorkout();
    setActivity(name);
  }

  const isActive = status === "running" || status === "paused";
  const statusLabel = {
    idle: "Ready to start",
    running: "Workout in progress",
    paused: "Workout paused",
    finished: "Workout finished",
  }[status];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA] text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-4 py-6 pb-28 text-[#101828] sm:px-6 sm:py-8 sm:pb-28 lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft size={17} /> Dashboard
        </Link>

        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            WORKOUT TRACKER
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Your workout
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Track your activity, route, and elapsed time.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold">Choose your activity</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {activities.map(({ name, Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => chooseActivity(name)}
                disabled={isActive}
                aria-pressed={activity === name}
                className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                  activity === name
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <Icon size={22} />
                <span>{name}</span>
              </button>
            ))}
          </div>
          {isActive && (
            <p className="mt-3 text-xs text-slate-500">
              Pause or finish the workout before changing activities.
            </p>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Elapsed time</p>
                <p
                  role="timer"
                  aria-live="off"
                  className="mt-2 text-5xl font-bold tracking-tight tabular-nums sm:text-6xl"
                >
                  {formatDuration(elapsedMs)}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 sm:p-4">
                <Clock3 size={27} />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status === "running"
                    ? "animate-pulse bg-emerald-500"
                    : status === "finished"
                    ? "bg-slate-400"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-slate-600">{statusLabel}</span>
            </div>

            <div className="my-6 h-px bg-slate-100" />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <Route size={20} className="text-emerald-700" />
                <p className="mt-3 text-xs text-slate-500">Distance</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {(distanceMeters / 1000).toFixed(2)} km
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <Gauge size={20} className="text-emerald-700" />
                <p className="mt-3 text-xs text-slate-500">
                  {activity === "Cycling" ? "Avg speed" : "Avg pace"}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">
                  {activity === "Cycling"
                    ? formatSpeed(distanceMeters, elapsedMs)
                    : formatPace(distanceMeters, elapsedMs)}
                </p>
              </div>
            </div>

            {status === "running" && routePoints.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                <span>Current:</span>
                <span className="font-semibold text-slate-700">
                  {activity === "Cycling"
                    ? `${(currentSpeed * 3.6).toFixed(1)} km/h`
                    : currentSpeed > 0
                    ? `${Math.floor(1000 / 60 / currentSpeed)}:${String(
                        Math.floor((1000 / currentSpeed) % 60)
                      ).padStart(2, "0")} /km`
                    : "--:-- /km"}
                </span>
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <MapPin size={19} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{gpsStatus}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Location is requested after sign-in so the map can find you
                  before you start. Allow access to record your route.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {status === "idle" && (
                <button
                  type="button"
                  onClick={startWorkout}
                  className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
                >
                  <Play size={18} fill="currentColor" /> Start workout
                </button>
              )}
              {status === "running" && (
                <>
                  <button
                    type="button"
                    onClick={pauseWorkout}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-3 font-semibold text-white hover:bg-amber-600"
                  >
                    <Pause size={18} /> Pause
                  </button>
                  <button
                    type="button"
                    onClick={finishWorkout}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#101828] px-3 py-3 font-semibold text-white hover:bg-[#243247]"
                  >
                    <Square size={16} fill="currentColor" /> Finish
                  </button>
                </>
              )}
              {status === "paused" && (
                <>
                  <button
                    type="button"
                    onClick={resumeWorkout}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 font-semibold text-white hover:bg-emerald-700"
                  >
                    <Play size={18} fill="currentColor" /> Resume
                  </button>
                  <button
                    type="button"
                    onClick={finishWorkout}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#101828] px-3 py-3 font-semibold text-white hover:bg-[#243247]"
                  >
                    <Square size={16} fill="currentColor" /> Finish
                  </button>
                </>
              )}
              {status === "finished" && !showSavePrompt && (
                <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-800">
                    Workout completed
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Recorded time: {formatDuration(elapsedMs)}
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={downloadActivityPNG}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <Download size={17} /> Download PNG
                    </button>
                    <button
                      type="button"
                      onClick={resetWorkout}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      <RotateCcw size={17} /> New workout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!showSavePrompt && saveMessage && (
              <p
                role="status"
                className="mt-4 break-words text-center text-sm text-slate-600"
              >
                {saveMessage}
              </p>
            )}
            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Activities are sent to the alive API when you choose Save.
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6">
              <div>
                <h2 className="font-bold">Route map</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your current location and recorded route
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
                <MapPin size={21} />
              </div>
            </div>
            <RouteMap
              center={mapCenter}
              accuracy={location?.accuracy}
              routePoints={routePoints}
            />
          </section>
        </div>
      </div>

      {showSavePrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-workout-title"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Route size={24} />
            </div>
            <h2
              id="save-workout-title"
              className="text-xl font-bold text-slate-900"
            >
              Save this activity?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your {activity.toLowerCase()} is finished. Would you like to save
              it?
            </p>
            <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Duration</span>
                <span className="font-semibold">
                  {formatDuration(elapsedMs)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Distance</span>
                <span className="font-semibold">
                  {(distanceMeters / 1000).toFixed(2)} km
                </span>
              </div>
            </div>
            {saveMessage && (
              <p role="alert" className="mt-4 break-words text-sm text-red-600">
                {saveMessage}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={discardFinishedWorkout}
                disabled={isSaving}
                className="min-h-12 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveFinishedWorkout}
                disabled={isSaving}
                className="min-h-12 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save activity"}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Save sends this activity to the alive API.
            </p>
          </div>
        </div>
      )}

      <MobileNav />
    </main>
  );
}
