"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../login/login.css"; // Gunakan file CSS yang sama agar tema seragam

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    // Logika konfirmasi password sederhana
    if (password !== confirmPassword) {
      setErr("Password dan konfirmasi password tidak cocok!");
      return;
    }

    setLoading(true);

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      setErr("Email wajib diisi!");
      setLoading(false);
      return;
    }

    try {
      const checkRes = await fetch("/auth/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed }),
      });
      if (!checkRes.ok) throw new Error(await checkRes.text());
      const checkData = (await checkRes.json()) as { exists?: boolean };
      if (checkData.exists) {
        setErr("Email sudah terdaftar. Silakan login.");
        setLoading(false);
        return;
      }
    } catch (e: any) {
      setErr(e.message ?? "Gagal cek email");
      setLoading(false);
      return;
    }

    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: emailTrimmed,
      options: {
        shouldCreateUser: true,
        data: { name },
        emailRedirectTo: `${origin}/auth/callback?next=/auth/register/success`,
      },
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Link verifikasi sudah dikirim. Cek email, lalu klik link.");
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Daftar</h1>

        <form onSubmit={onSubmit} className="login-form">
          <div className="input-group">
            <label>Username / Nama</label>
            <input
              placeholder="Masukkan nama anda"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Email</label>
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
            <input
              type="password"
              placeholder="Masukkan password (min 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Ulangi password anda"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {err && <div className="error-message">{err}</div>}
          {msg && <div className="success-message">{msg}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Loading..." : "Kirim Link Verifikasi"}
          </button>
        </form>

        <div className="login-footer">
          <p>Sudah punya akun?</p>
          <Link href="/auth/login" className="btn-secondary">
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
