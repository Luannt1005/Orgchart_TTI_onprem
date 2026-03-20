"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./login.module.css";
import { EyeIcon, EyeSlashIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

// Supabase client
import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { useUser } from "@/app/context/UserContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { setUser } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Login failed");
      }

      // 6. Save user info to context for UI
      setUser(data.user);

      // ✅ Show success animation
      setSuccess(true);

      // Redirect after animation
      setTimeout(() => {
        router.replace("/Orgchart");
      }, 2000);

    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Connection error. Please try again.");
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className={styles['login-container']}>
        <div className={styles['success-container']}>
          <div className={styles['success-icon']}>✓</div>
          <h2>Login successful!</h2>
          <p>Welcome back</p>
          <div className={styles['spinner-dots']}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['login-container']}>
      <div className={styles['login-card']}>
        {/* Logo */}
        <div className={styles['login-logo']}>
          <div className={styles['logo-wrapper']}>
            <Image
              src="/Milwaukee-logo-red.png"
              width={200}
              height={90}
              alt="Milwaukee Tool"
              style={{ objectFit: 'contain' }}
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Header */}
        <div className={styles['login-header']}>
          <h1>Login</h1>
          <p>Org Chart Management</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className={`${styles.alert} ${styles['alert-error']}`}>
            <span className={styles['alert-icon']}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className={styles['login-form']}>
          {/* Username Input */}
          <div className={styles['form-group']}>
            <label htmlFor="username">Email</label>
            <div className={styles['input-wrapper']}>
              <input
                id="username"
                type="text"
                placeholder="Enter email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className={styles['form-input']}
                required
              />
              <span className={styles['input-icon']}>
                <EnvelopeIcon className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Password Input */}
          <div className={styles['form-group']}>
            <label htmlFor="password">Password</label>
            <div className={styles['input-wrapper']}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={styles['form-input']}
                required
              />
              <button
                type="button"
                className={styles['input-button']}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" disabled={loading} className={styles['login-button']}>
            {loading ? (
              <>
                <span className={styles['button-spinner']}></span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Login</span>
                <span className={styles['button-arrow']}>→</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className={styles['divider-line']}></div>

        {/* Footer Links */}
        <div className={styles['login-footer']}>
          <a href="#forgot" className={styles['footer-link']}>
            Forgot password?
          </a>
          <a href="/signup" className={styles['footer-link']}>
            Create account
          </a>
        </div>
      </div>

      {/* Background Elements */}
      <div className={`${styles['bg-decoration']} ${styles['bg-1']}`}></div>
      <div className={`${styles['bg-decoration']} ${styles['bg-2']}`}></div>
    </div>
  );
}
