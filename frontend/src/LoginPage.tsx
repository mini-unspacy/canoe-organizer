import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "./convex_generated/api";

interface User {
  email: string;
  role: "admin" | "normal";
  paddlerId: string;
}

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const loginMut = useMutation(api.auth.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginMut({ email: email.trim().toLowerCase(), password });
      if ("error" in result) {
        setError(result.error as string);
      } else {
        const user = result as User;
        localStorage.setItem("currentUser", JSON.stringify(user));
        localStorage.setItem("selectedPaddlerId", user.paddlerId);
        onLogin(user);
      }
    } catch {
      setError("something went wrong");
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
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#1f2937",
          borderRadius: "16px",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
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

        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            backgroundColor: "#374151",
            border: "1px solid #4b5563",
            borderRadius: "8px",
            padding: "10px 12px",
            color: "#e5e7eb",
            fontSize: "14px",
            outline: "none",
          }}
        />

        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            backgroundColor: "#374151",
            border: "1px solid #4b5563",
            borderRadius: "8px",
            padding: "10px 12px",
            color: "#e5e7eb",
            fontSize: "14px",
            outline: "none",
          }}
        />

        {error && (
          <div style={{ color: "#f87171", fontSize: "13px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "linear-gradient(to right, #3b82f6, #4f46e5)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "logging in..." : "log in"}
        </button>
      </form>
    </div>
  );
}
