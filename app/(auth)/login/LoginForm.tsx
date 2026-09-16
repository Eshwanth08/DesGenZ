"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("designer@desgenz.app");
  const [password, setPassword] = useState("demo-employee");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"employee" | "hr">("employee");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const payload =
      mode === "signup" ? { email, password, name, role } : { email, password };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    router.replace(data.user.role === "hr" ? "/hr" : "/workspace");
    router.refresh();
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent";

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      onSubmit={submit}
      className="w-full max-w-sm bg-bg-surface border border-border-subtle rounded-xl p-8 shadow-sm"
    >
      <h1 className="text-2xl font-bold tracking-tight">DesGenZ</h1>
      <p className="text-text-secondary text-sm mt-1">
        {mode === "signin" ? "Sign in to your design pipeline" : "Create your DesGenZ account"}
      </p>

      {mode === "signup" && (
        <>
          <label className="block mt-6 text-sm font-medium">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Rivera"
            className={inputClass}
            required
          />
        </>
      )}

      <label className={`block ${mode === "signup" ? "mt-4" : "mt-6"} text-sm font-medium`}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
        required
      />

      <label className="block mt-4 text-sm font-medium">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={mode === "signup" ? 6 : undefined}
        className={inputClass}
        required
      />

      {mode === "signup" && (
        <>
          <p className="mt-4 text-sm font-medium">Role</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["employee", "hr"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors duration-150 ${
                  role === r
                    ? "border-accent bg-accent-muted text-accent font-medium"
                    : "border-border-subtle text-text-secondary hover:bg-bg-base"
                }`}
              >
                {r === "employee" ? "Designer / PM" : "HR"}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-md bg-accent text-accent-contrast text-sm font-medium py-2.5 transition-transform duration-150 hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="mt-3 w-full text-sm text-accent hover:underline"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already registered? Sign in"}
      </button>

      <div className="mt-6 pt-4 border-t border-border-subtle text-xs text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Demo accounts</p>
        <p>Designer: designer@desgenz.app / demo-employee</p>
        <p>HR: hr@desgenz.app / demo-hr</p>
      </div>
    </motion.form>
  );
}
