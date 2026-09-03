"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else if (res.status === 502) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ??
            "Email could not be sent. Please try again later."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl p-8 shadow-lg"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <h1
        className="text-xl font-semibold mb-2 text-center"
        style={{ color: "var(--color-text-heading)" }}
      >
        Forgot password
      </h1>

      {submitted ? (
        <>
          <p
            className="text-sm mb-6 text-center"
            style={{ color: "var(--color-text-primary)" }}
          >
            If an account exists for <strong>{email}</strong>, a reset link is
            on its way. Check your inbox — the link expires in 1 hour.
          </p>
          <Link
            href="/admin/login"
            className="block text-center w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p
            className="text-sm mb-6 text-center"
            style={{ color: "var(--color-text-primary)" }}
          >
            Enter your admin email and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--color-text-primary)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-brand-logo)",
                color: "#fff",
              }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p
            className="text-sm mt-4 text-center"
            style={{ color: "var(--color-text-primary)" }}
          >
            <Link href="/admin/login" className="underline hover:opacity-80">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
