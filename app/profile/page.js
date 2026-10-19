"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import { useAuth, useRequireAuth } from "@/components/AuthProvider";
import { API_URL, fetchJSON } from "@/lib/api";
import {
  Activity,
  ArrowLeft,
  Check,
  Goal,
  LogOut,
  Pencil,
  Route,
  X,
} from "lucide-react";

function initialsFromName(name) {
  if (!name) return "A";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function ProfilePage() {
  const { user, loading, logout } = useRequireAuth();
  const { login } = useAuth();
  const router = useRouter();

  const [workouts, setWorkouts] = useState([]);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchJSON(`${API_URL}/workouts`)
      .then(({ data }) => {
        if (active) {
          setWorkouts(Array.isArray(data?.workouts) ? data.workouts : []);
        }
      })
      .catch(() => {
        if (active) setWorkouts([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const totals = useMemo(() => {
    const distanceKm =
      workouts.reduce((sum, w) => sum + (w.distanceMeters || 0), 0) / 1000;
    const durationMin = Math.round(
      workouts.reduce((sum, w) => sum + (w.durationMs || 0), 0) / 60000
    );
    return {
      distanceKm: distanceKm.toFixed(2),
      durationMin,
      count: workouts.length,
    };
  }, [workouts]);

  function startEditingName() {
    setNameInput(user?.name || "");
    setNameError("");
    setNameSaved(false);
    setEditingName(true);
  }

  function cancelEditingName() {
    setEditingName(false);
    setNameError("");
    setNameSaved(false);
  }

  async function saveName(event) {
    event.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError("Name must contain at least 2 characters.");
      return;
    }
    if (trimmed === user?.name) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    setNameError("");

    try {
      const { data } = await fetchJSON(`${API_URL}/auth/me`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed }),
      });
      login(getStoredToken(), data.user);
      setNameSaved(true);
      setEditingName(false);
    } catch (err) {
      if (err.status === 401) {
        logout();
        router.replace("/login");
        return;
      }
      setNameError(err.message || "Could not update your name.");
    } finally {
      setSavingName(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA] text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-4 py-6 pb-28 text-[#101828] sm:px-6 sm:py-8 lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>

        <header className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            YOUR ACCOUNT
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Manage your personal details and fitness preferences.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-2xl font-bold text-emerald-700">
              {initialsFromName(user.name)}
            </div>

            <div className="min-w-0 flex-1">
              {editingName ? (
                <form onSubmit={saveName} className="space-y-3">
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Display name
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="name"
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      autoFocus
                      maxLength={80}
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingName}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check size={16} />
                        {savingName ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingName}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  {nameError && (
                    <p role="alert" className="text-sm text-red-600">
                      {nameError}
                    </p>
                  )}
                </form>
              ) : (
                <>
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  <p className="mt-1 break-words text-sm text-slate-500">
                    {user.email}
                  </p>
                  {nameSaved && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <Check size={15} /> Name updated.
                    </p>
                  )}
                </>
              )}
            </div>

            {!editingName && (
              <button
                type="button"
                onClick={startEditingName}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit name
              </button>
            )}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            {
              label: "Total distance",
              value: `${totals.distanceKm} km`,
              Icon: Route,
            },
            {
              label: "Workouts completed",
              value: String(totals.count),
              Icon: Activity,
            },
            {
              label: "Active minutes",
              value: `${totals.durationMin} min`,
              Icon: Goal,
            },
          ].map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Icon size={22} className="text-emerald-600" />
              <p className="mt-4 text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-9">
          <h2 className="mb-4 text-lg font-bold">Preferences and settings</h2>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {[
              {
                title: "Workout goals",
                description: "Your weekly distance and activity targets",
                Icon: Goal,
              },
              {
                title: "Privacy and location",
                description: "GPS data stays on your account only",
                Icon: Route,
              },
            ].map(({ title, description, Icon }, index, arr) => (
              <div
                key={title}
                className={`flex items-center gap-4 p-5 ${
                  index !== arr.length - 1
                    ? "border-b border-slate-100"
                    : ""
                }`}
              >
                <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
                  <Icon size={21} />
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 sm:w-auto"
        >
          <LogOut size={18} />
          Sign out
        </button>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">
          alive · Your fitness, your data
        </footer>
      </div>

      <MobileNav />
    </main>
  );
}

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("fittrack-token");
}
