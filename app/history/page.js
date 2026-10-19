"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import { useRequireAuth } from "@/components/AuthProvider";
import { fetchJSON, API_URL } from "@/lib/api";
import {
  Activity,
  ArrowLeft,
  Bike,
  CalendarDays,
  Clock3,
  Footprints,
  RefreshCw,
  Route,
  Trash2,
} from "lucide-react";

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function formatDistance(meters) {
  return `${(meters / 1000).toFixed(2)} km`;
}

function getActivityIcon(activity) {
  if (activity === "Cycling") return Bike;
  if (activity === "Walking") return Footprints;
  return Activity;
}

function formatAverage(workout) {
  const distance = workout.distanceMeters || 0;
  const duration = workout.durationMs || 0;

  if (distance < 20 || duration <= 0) return "--";

  if (workout.activity === "Cycling") {
    return `${((distance / 1000) / (duration / 3600000)).toFixed(1)} km/h`;
  }

  const secondsPerKm = Math.floor(duration / distance);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

export default function HistoryPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [workouts, setWorkouts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadWorkouts = useCallback(async () => {
    setLoadingData(true);
    setError("");

    try {
      const { data } = await fetchJSON(`${API_URL}/workouts`);
      setWorkouts(Array.isArray(data?.workouts) ? data.workouts : []);
    } catch (err) {
      console.error("History loading failed:", err);
      if (err.status === 401) {
        setError("Your session has expired. Please sign in again.");
        router.replace("/login");
        return;
      }
      setError(
        "Could not load your activities. Make sure the backend is running."
      );
    } finally {
      setLoadingData(false);
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    loadWorkouts();
  }, [user, loadWorkouts]);

  const handleDelete = useCallback(
    async (workoutId) => {
      setDeletingId(workoutId);
      setError("");
      try {
        await fetchJSON(`${API_URL}/workouts/${workoutId}`, {
          method: "DELETE",
        });
        setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
      } catch (err) {
        if (err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err.message || "Could not delete the workout.");
      } finally {
        setDeletingId(null);
      }
    },
    [router]
  );

  const totalDistance = workouts.reduce(
    (total, workout) => total + (workout.distanceMeters || 0),
    0
  );

  const totalDuration = workouts.reduce(
    (total, workout) => total + (workout.durationMs || 0),
    0
  );

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA] text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-4 py-6 pb-28 text-[#101828] sm:px-6 sm:py-8 sm:pb-28 lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              YOUR PROGRESS
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Activity history
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your completed workouts saved to MongoDB.
            </p>
          </div>

          <button
            type="button"
            onClick={loadWorkouts}
            disabled={loadingData}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loadingData ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Route size={21} className="text-emerald-600" />
            <p className="mt-4 text-sm text-slate-500">Total distance</p>
            <p className="mt-1 text-2xl font-bold">
              {formatDistance(totalDistance)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Clock3 size={21} className="text-emerald-600" />
            <p className="mt-4 text-sm text-slate-500">Total duration</p>
            <p className="mt-1 text-2xl font-bold">
              {formatDuration(totalDuration)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays size={21} className="text-emerald-600" />
            <p className="mt-4 text-sm text-slate-500">Saved activities</p>
            <p className="mt-1 text-2xl font-bold">{workouts.length}</p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold">Your workouts</h2>

          {loadingData ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading your activities...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-white p-5">
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
              <button
                type="button"
                onClick={loadWorkouts}
                className="mt-4 min-h-11 rounded-xl bg-[#101828] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243247]"
              >
                Try again
              </button>
            </div>
          ) : workouts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <Activity size={28} className="mx-auto text-emerald-700" />
              <h3 className="mt-4 font-semibold">
                No saved activities yet
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Finish a workout and choose Save activity to add it to your history.
              </p>
              <Link
                href="/workout?activity=Running"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#101828] px-5 py-3 text-sm font-semibold text-white hover:bg-[#243247]"
              >
                Start a workout
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((workout) => {
                const Icon = getActivityIcon(workout.activity);

                return (
                  <article
                    key={workout.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                      <div className="shrink-0 rounded-xl bg-emerald-50 p-3 text-emerald-700">
                        <Icon size={23} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">
                          {workout.activity}
                        </h3>

                        <p className="mt-1 break-words text-xs text-slate-500">
                          {workout.completedAt
                            ? new Date(workout.completedAt).toLocaleString()
                            : "Date unavailable"}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-slate-500">Distance</p>
                            <p className="mt-1 text-sm font-bold">
                              {formatDistance(workout.distanceMeters || 0)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">Duration</p>
                            <p className="mt-1 text-sm font-bold">
                              {formatDuration(workout.durationMs || 0)}
                            </p>
                          </div>

                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-xs text-slate-500">
                              {workout.activity === "Cycling"
                                ? "Average speed"
                                : "Average pace"}
                            </p>
                            <p className="mt-1 text-sm font-bold">
                              {formatAverage(workout)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-4 text-xs text-slate-400">
                          {workout.routePoints?.length || 0} recorded GPS points
                        </p>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDelete(workout.id)}
                            disabled={deletingId === workout.id}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Delete ${workout.activity} workout`}
                          >
                            <Trash2 size={14} />
                            {deletingId === workout.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <MobileNav />
    </main>
  );
}
