import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Clear stale auth tokens from localStorage when login page is shown.
  // This prevents invalid refresh tokens from blocking future sign-ins.
  useEffect(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("__convexAuth")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }, []);

  const buttonStyle = (bg: string) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    padding: "12px 16px",
    borderRadius: "8px",
    border: "none",
    fontSize: "15px",
    fontWeight: 600 as const,
    cursor: "pointer",
    background: bg,
    color: "#ffffff",
    transition: "opacity 0.15s",
  });

  const inputStyle = {
    backgroundColor: "#374151",
    border: "1px solid #4b5563",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#e5e7eb",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("email", email.trim().toLowerCase());
      formData.set("password", password);
      formData.set("flow", isSignUp ? "signUp" : "signIn");
      await signIn("password", formData);
    } catch {
      setError(isSignUp ? "sign up failed" : "invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#1f2937",
          borderRadius: "16px",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <span
            style={{
              fontFamily: "'UnifrakturMaguntia', cursive",
              color: "#dc2626",
              WebkitTextStroke: "1.5px white",
              paintOrder: "stroke fill",
              textShadow:
                "-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white",
              fontSize: "36px",
            }}
          >
            Lokahi
          </span>
        </div>

        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", margin: "0 0 8px 0" }}>
          sign in to continue
        </p>

        <button
          onClick={() => signIn("google", { redirectTo: "/" }).catch(console.error)}
          style={buttonStyle("#4285F4")}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#4b5563" }} />
          <span style={{ color: "#6b7280", fontSize: "12px" }}>or</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#4b5563" }} />
        </div>

        <form onSubmit={handlePasswordAuth} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && (
            <div style={{ color: "#f87171", fontSize: "13px", textAlign: "center" }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle("#4b5563"),
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : isSignUp ? "sign up" : "sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            style={{ background: "none", border: "none", color: "#6b7280", fontSize: "12px", cursor: "pointer", padding: "2px" }}
          >
            {isSignUp ? "already have an account? sign in" : "need an account? sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
