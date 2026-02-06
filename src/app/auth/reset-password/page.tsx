"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../login/login.css";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setErr(error.message);

    setMsg("Password berhasil diubah. Silakan login.");
    router.push("/auth/login");
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Reset Password</h1>

        <form onSubmit={onSubmit} className="login-form">
          <div className="input-group">
            <label>Password Baru</label>
            <input
              placeholder="Masukkan password baru"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {msg && <div className="success-message">{msg}</div>}
          {err && <div className="error-message">{err}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Loading..." : "Update Password"}
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
