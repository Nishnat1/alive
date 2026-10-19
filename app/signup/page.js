"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { API_URL, fetchJSON } from "@/lib/api";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Please enter a name with at least 2 characters.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data } = await fetchJSON(`${API_URL}/auth/signup`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (data.access_token && data.user) {
        login(data.access_token, data.user);
        router.replace("/");
        return;
      }

      router.replace("/login");
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Cannot reach the alive API. Check that FastAPI is running and CORS is configured."
        );
      } else {
        setError(err.message || "Unable to create your account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F7F5] px-4 py-8 text-slate-900 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-teal-100/60 blur-3xl"
      />

      <section className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <Activity size={24} />
          </span>

          <span className="text-2xl font-bold tracking-tight">
            alive<span className="text-emerald-600">.</span>
          </span>
        </Link>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-semibold text-emerald-700">
              GET STARTED
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Create your account
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Join alive and start tracking your fitness progress.
            </p>
          </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Full name
                  </label>

                  <div className="relative">
                    <UserRound
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your full name"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>

                  <div className="relative">
                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter your password again"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Creating account..." : "Create account"}

                  {!isSubmitting && <ArrowRight size={18} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Sign in
                </Link>
              </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Your fitness journey, one step at a time.
        </p>
      </section>
    </main>
  );
}
