import Link from "next/link";
import "../../login/login.css";

export default function RegisterSuccessPage() {
  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Akun Terdaftar</h1>
        <p className="success-message">
          Akun kamu sudah terverifikasi. Silakan login untuk melanjutkan.
        </p>

        <div className="login-footer">
          <Link href="/auth/login" className="btn-primary">
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
