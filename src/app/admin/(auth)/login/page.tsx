"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else if (res.status === 423) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.emailSent === false
            ? "Too many failed attempts — your account is locked, but the unlock email could not be sent. Try again later or use forgot password."
            : "Account locked. Check your email for the unlock link — it expires in 1 hour. You can also use forgot password below."
        );
      } else {
        setError("Invalid credentials or account locked.");
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
        className="text-xl font-semibold mb-6 text-center"
        style={{ color: "var(--color-text-heading)" }}
      >
        Admin sign in
      </h1>

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

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text-primary)" }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            backgroundColor: "var(--color-brand-logo)",
            color: "#fff",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p
        className="text-sm mt-4 text-center"
        style={{ color: "var(--color-text-primary)" }}
      >
        <Link href="/admin/forgot-password" className="underline hover:opacity-80">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
