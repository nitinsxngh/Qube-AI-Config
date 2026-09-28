"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next") || "/rag";
    return raw.startsWith("/") ? raw : "/rag";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[14px] text-[#86868b]">Signed in — redirecting…</p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(nextPath);
    } catch (err) {
      let message = "Login failed";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { detail?: string };
          message = parsed.detail || err.message;
        } catch {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,13,100,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(0,0,0,0.04), transparent 50%), #f5f5f7",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[2px] bg-[#8b0d64] text-[18px] font-semibold text-white shadow-sm">
            Q
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            QubeAI Config
          </h1>
          <p className="mt-1 text-[15px] text-[#86868b]">
            Sign in to manage RAG, ingest, and configs
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2px] bg-white p-6 shadow-sm"
          style={{
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)",
          }}
        >
          <label className="block">
            <span className="apple-label mb-1.5 block">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="apple-input"
              placeholder="admin@local.dev"
              disabled={submitting}
            />
          </label>

          <label className="mt-4 block">
            <span className="apple-label mb-1.5 block">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="apple-input"
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>

          {error && (
            <p className="mt-3 text-[13px] text-[#ff3b30]">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="apple-btn-primary mt-5 w-full"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-[#aeaeb2]">
          Seeded: superadmin@local.dev · admin@local.dev
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[14px] text-[#86868b]">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
