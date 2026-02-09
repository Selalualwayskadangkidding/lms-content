"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client"; // Sesuaikan path ini
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./login.css"; // Kita buat file ini di bawah

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setErr("Env Supabase tidak terbaca di client. Restart dev server.");
    }
  }, []);

  function withTimeout<T>(promise: Promise<T>, ms = 12000) {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Request timeout. Cek koneksi & konfigurasi Supabase."));
      }, ms);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setIsLoading(true);

    try {
      const res = await withTimeout(
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })
      );

      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        let message = "Login gagal. Cek email dan password.";
        try {
          if (contentType.includes("application/json")) {
            const data = (await res.json()) as { error?: string; message?: string };
            message = data.error ?? data.message ?? message;
          } else {
            const text = (await res.text()).trim();
            if (text) message = text;
          }
        } catch {
          // ignore parse errors, use default message
        }

        if (message.toLowerCase().includes("invalid login credentials")) {
          message = "Email atau password salah.";
        }
        if (message.toLowerCase().includes("email not confirmed")) {
          message = "Email belum diverifikasi. Silakan cek inbox.";
        }

        setErr(message);
        return;
      }

      const payload = (await res.json()) as {
        userId: string;
        role: "TEACHER" | "STUDENT";
        is_active: boolean;
      };

      if (!payload.is_active) {
        router.push("/auth/pending");
        return;
      }

      if (payload.role === "TEACHER") {
        router.push("/teacher");
        return;
      }

      router.push("/student");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Auth request failed. Coba lagi.";
      if (message.toLowerCase().includes("failed to fetch")) {
        setErr("Auth request gagal. Supabase sedang throttling / koneksi bermasalah.");
      } else if (message.toLowerCase().includes("timeout")) {
        setErr("Auth request timeout. Coba lagi sebentar.");
      } else {
        setErr(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Masuk</h1>

        <form onSubmit={onSubmit} className="login-form">
          <div className="input-group">
            <label>Username</label>
            <input
              type="email"
              placeholder="Masukkan email anda"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan password anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🔒" : "👁️"}
              </button>
            </div>
            <div className="forgot-link">
              <Link href="/auth/forgot">Lupa password atau username?</Link>
            </div>
          </div>

          {err && <div className="error-message">{err}</div>}

          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? "Loading..." : "Masuk"}
          </button>
        </form>

        <div className="login-footer">
          <p>Belum punya akun?</p>
          <Link href="/auth/register" className="btn-secondary">
            Daftar
          </Link>
        </div>
      </div>
    </div>
  );
}
