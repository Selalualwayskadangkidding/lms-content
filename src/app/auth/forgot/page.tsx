"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../login/login.css"; // Tetap pakai file CSS yang sama

export default function ForgotPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // State untuk loading

  function getAuthOrigin() {
    const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (process.env.NODE_ENV === "production" && envOrigin) return envOrigin;
    return runtimeOrigin || envOrigin || "http://localhost:3000";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true); // 1. Mulai loading sebelum panggil API

    // Validasi email terdaftar
    const checkRes = await fetch("/auth/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!checkRes.ok) {
      setLoading(false);
      setErr(await checkRes.text());
      return;
    }
    const checkData = await checkRes.json();
    if (!checkData?.exists) {
      setLoading(false);
      setErr("Email tidak terdaftar.");
      return;
    }

    const origin = getAuthOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    });

    setLoading(false); // 2. Matikan loading setelah proses selesai (baik sukses maupun error)

    if (error) {
      setErr(error.message);
      return;
    }
    
    // 3. Pesan sukses keluar setelah loading berhenti
    setMsg("Email reset password sudah dikirim. Cek inbox/spam.");
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Lupa Password</h1>
        

        <form onSubmit={onSubmit} className="login-form">
          <div className="input-group">
            <label>Email</label>
            <input 
              type="email"
              placeholder="Masukkan email anda" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              disabled={loading} // Input tidak bisa diketik saat loading
              required
            />
          </div>

          {msg && <div className="success-message">{msg}</div>}
          {err && <div className="error-message">{err}</div>}

          <button 
            type="submit" 
            disabled={loading} // Tombol mati saat loading
            className="btn-primary"
          >
            {loading ? "Sedang Mengirim..." : "Kirim Email Reset"}
          </button>
        </form>

        <div className="login-footer">
          <p>Sudah ingat password?</p>
          <Link href="/auth/login" className="btn-secondary">
            Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}
