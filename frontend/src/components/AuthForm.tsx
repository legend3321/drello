"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuthStore } from "@/store/authStore";

import styles from "./AuthForm.module.css";

type Mode = "login" | "register";

type Props = {
  mode: Mode;
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);

  const [username, setUsername] = useState(mode === "login" ? "demo" : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(mode === "login" ? "demo12345" : "");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "login") {
        await login({ username, password });
      } else {
        await register({
          username,
          email,
          password,
          password_confirm: passwordConfirm,
        });
      }
      const next = searchParams.get("next") || "/";
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <main className={styles.main}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
        <p className={styles.subtitle}>
          {mode === "login"
            ? "Access your boards and collaborate in real time."
            : "Register to create and manage your own boards."}
        </p>

        {error ? <p className={styles.error}>{error}</p> : null}

        <label className={styles.label}>
          Username
          <input
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        {mode === "register" ? (
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        ) : null}

        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        </label>

        {mode === "register" ? (
          <label className={styles.label}>
            Confirm password
            <input
              className={styles.input}
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
        ) : null}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Register"}
        </button>

        <p className={styles.switch}>
          {mode === "login" ? (
            <>
              No account? <Link href="/register">Register</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          )}
        </p>

        {mode === "login" ? (
          <p className={styles.hint}>
            Demo user: <code>demo</code> / <code>demo12345</code> (run{" "}
            <code>python manage.py seed_demo</code>)
          </p>
        ) : null}
      </form>
    </main>
  );
}
