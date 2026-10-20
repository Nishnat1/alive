"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bike,
  CalendarDays,
  ChevronRight,
  Clock3,
  Footprints,
  Home,
  MapPin,
  Play,
  Route,
  Settings,
  UserRound,
} from "lucide-react";
import { useRequireAuth } from "@/components/AuthProvider";
import MobileNav from "@/components/MobileNav";
import { fetchJSON, API_URL } from "@/lib/api";

const activities = [
  { name: "Running", Icon: Activity, detail: "Outdoor run" },
  { name: "Walking", Icon: Footprints, detail: "Daily walk" },
  { name: "Cycling", Icon: Bike, detail: "Outdoor ride" },
];

function initialsFromName(name) {
  if (!name) return "A";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function formatDurationShort(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getActivityIcon(activity) {
  if (activity === "Cycling") return Bike;
  if (activity === "Walking") return Footprints;
  return Activity;
}

function buildWeeklyData(workouts, today) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const reference = today || new Date();
  reference.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(reference);
    d.setDate(reference.getDate() - (6 - i));
    return {
      day: days[d.getDay()],
      date: d,
      minutes: 0,
    };
  });

  workouts.forEach((w) => {
    if (!w.completedAt) return;
    const completed = new Date(w.completedAt);
    completed.setHours(0, 0, 0, 0);
    const bucket = buckets.find(
      (b) => b.date.getTime() === completed.getTime()
    );
    if (bucket && w.durationMs) {
      bucket.minutes += w.durationMs / 60000;
    }
  });

  const maxMinutes = Math.max(...buckets.map((b) => b.minutes), 1);
  return buckets.map((b) => ({
    day: b.day,
    value: Math.round((b.minutes / maxMinutes) * 100),
    minutes: Math.round(b.minutes),
  }));
}

export default function HomePage() {
  const { user, loading } = useRequireAuth();
  const [activity, setActivity] = useState("Running");
  const [workouts, setWorkouts] = useState([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [workoutError, setWorkoutError] = useState("");
  const [today, setToday] = useState(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingWorkouts(true);
    fetchJSON(`${API_URL}/workouts`)
      .then(({ data }) => {
        if (active) {
          setWorkouts(Array.isArray(data?.workouts) ? data.workouts : []);
          setWorkoutError("");
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          setWorkoutError("Please sign in to view your workouts.");
        } else {
          setWorkoutError("Could not load your workouts. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoadingWorkouts(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const totals = useMemo(() => {
    const totalDistance = workouts.reduce(
      (sum, w) => sum + (w.distanceMeters || 0),
      0
    );
    const totalDuration = workouts.reduce(
      (sum, w) => sum + (w.durationMs || 0),
      0
    );
    return {
      distanceKm: (totalDistance / 1000).toFixed(2),
      durationMin: Math.round(totalDuration / 60000),
      count: workouts.length,
    };
  }, [workouts]);

  const weekly = useMemo(
    () => (today ? buildWeeklyData(workouts, today) : []),
    [workouts, today]
  );
  const recent = useMemo(() => workouts.slice(0, 5), [workouts]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#101828]">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-[#101828] p-6 text-white">
        <Link href="/" className="flex items-center gap-3 mb-12">
          <div className="rounded-xl bg-emerald-400 p-2 text-[#101828]">
            <Activity size={23} />
          </div>
          <span className="text-xl font-bold tracking-tight">
            alive<span className="text-emerald-400">.</span>
          </span>
        </Link>

        <p className="mb-4 text-xs uppercase tracking-widest text-slate-400">
          Workspace
        </p>

        <nav className="space-y-2">
          <Link href="/" className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium">
            <Home size={18} /> Overview
          </Link>
          <Link href="/workout" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10">
            <Route size={18} /> Start activity
          </Link>
          <Link href="/history" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10">
            <CalendarDays size={18} /> History
          </Link>
          <Link href="/profile" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10">
            <UserRound size={18} /> Profile
          </Link>
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <Settings size={19} className="mb-3 text-emerald-400" />
          <p className="text-sm font-medium">Keep moving</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Small steps every day.
          </p>
        </div>
      </aside>

      <main id="overview" className="mx-auto max-w-7xl p-5 pb-28 sm:p-8 sm:pb-28 lg:ml-64 lg:p-10">
        <header className="mb-9 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">YOUR FITNESS DASHBOARD</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Hi {user.name?.split(" ")[0] || "there"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Here is your activity at a glance.
            </p>
          </div>
          <Link
            href="/profile"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white"
            aria-label="Open profile"
          >
            {initialsFromName(user.name)}
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Total distance", value: totals.distanceKm, unit: "km", Icon: Route },
            { label: "Workout time", value: String(totals.durationMin), unit: "min", Icon: Clock3 },
            { label: "Activities", value: String(totals.count), unit: "workouts", Icon: Activity },
          ].map(({ label, value, unit, Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <Icon size={20} className="text-emerald-600" />
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{value}</span>
                <span className="text-sm text-slate-500">{unit}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Across all your saved workouts.</p>
            </div>
          ))}
        </section>

        <section id="activity-selection" className="mt-9 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <Play size={19} />
            </div>
            <div>
              <h2 className="font-bold">Start a workout</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose an activity. GPS starts automatically when you begin.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {activities.map(({ name, Icon, detail }) => (
              <button
                key={name}
                type="button"
                onClick={() => setActivity(name)}
                className={`rounded-xl border p-4 text-left transition ${
                  activity === name
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icon size={25} className={activity === name ? "text-emerald-700" : "text-slate-500"} />
                <p className="mt-4 font-semibold">{name}</p>
                <p className="mt-1 text-sm text-slate-500">{detail}</p>
              </button>
            ))}
          </div>

          <Link
            href={`/workout?activity=${encodeURIComponent(activity)}`}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#101828] px-5 py-3.5 font-semibold text-white transition hover:bg-[#243247] sm:w-auto"
          >
            Continue with {activity}
            <ChevronRight size={18} />
          </Link>
        </section>

        <section className="mt-9 grid gap-5 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-3 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Weekly activity</h2>
                <p className="mt-1 text-sm text-slate-500">Minutes active over the last 7 days</p>
              </div>
              <CalendarDays size={20} className="text-slate-400" />
            </div>

            <div className="mt-7 flex h-44 items-end justify-between gap-2 sm:gap-3">
              {weekly.map(({ day, value, minutes }) => (
                <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      className="w-full max-w-10 rounded-t-lg bg-emerald-500"
                      style={{ height: `${Math.max(value, 3)}%`, opacity: 0.4 + value / 150 }}
                      title={`${minutes} min`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{day}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="recent-activity" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2 sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Recent activities</h2>
              <Link href="/history" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                View all
              </Link>
            </div>

            {loadingWorkouts ? (
              <p className="mt-6 text-sm text-slate-500">Loading your workouts...</p>
            ) : workoutError ? (
              <p className="mt-6 text-sm text-red-600">{workoutError}</p>
            ) : recent.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-4 py-9 text-center">
                <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                  <MapPin size={22} />
                </div>
                <p className="mt-4 text-sm font-medium">No activities yet</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                  Complete and save your first workout to see it here.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {recent.map((w) => {
                  const Icon = getActivityIcon(w.activity);
                  return (
                  <li key={w.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <div className="shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-700">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{w.activity}</p>
                      <p className="text-xs text-slate-500">
                        {w.completedAt ? new Date(w.completedAt).toLocaleDateString() : "Recently"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p className="font-semibold">{(w.distanceMeters / 1000).toFixed(2)} km</p>
                      <p>{formatDurationShort(w.durationMs)}</p>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">
          alive · Built for your everyday progress
        </footer>
      </main>
      <MobileNav />
    </div>
  );
}
