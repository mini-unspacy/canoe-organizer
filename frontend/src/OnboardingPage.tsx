import { useState } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "./convex_generated/api";

export default function OnboardingPage({ name }: { name?: string }) {
  const nameParts = name?.trim().split(/\s+/) || [];
  const [firstName, setFirstName] = useState(nameParts[0] || "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [gender, setGender] = useState<"wahine" | "kane" | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const completeOnboarding = useMutation(api.auth.completeOnboarding);
  const { signOut } = useAuthActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gender) {
      setError("please select wahine or kane");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await completeOnboarding({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
    } catch {
      setError("something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#000000",
    border: "1px solid #4b5563",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#e5e7eb",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  const genderBtnStyle = (selected: boolean) => ({
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: selected ? "2px solid #3b82f6" : "2px solid #4b5563",
    backgroundColor: selected ? "rgba(59,130,246,0.15)" : "#000000",
    color: selected ? "#93c5fd" : "#9ca3af",
    fontSize: "14px",
    fontWeight: 600 as const,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#111111",
          borderRadius: "16px",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
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
          <p style={{ color: "#9ca3af", fontSize: "14px", margin: "12px 0 0 0" }}>
            welcome! tell us about yourself
          </p>
        </div>

        <input
          type="text"
          placeholder="first name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          style={inputStyle}
        />

        <div>
          <div style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "8px" }}>
            I am...
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setGender("wahine")}
              style={genderBtnStyle(gender === "wahine")}
            >
              wahine
            </button>
            <button
              type="button"
              onClick={() => setGender("kane")}
              style={genderBtnStyle(gender === "kane")}
            >
              kane
            </button>
          </div>
        </div>

        <input
          type="tel"
          placeholder="phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div style={{ color: "#f87171", fontSize: "13px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !firstName.trim() || !lastName.trim() || !gender}
          style={{
            background: "linear-gradient(to right, #3b82f6, #4f46e5)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading || !firstName.trim() || !lastName.trim() || !gender ? 0.5 : 1,
          }}
        >
          {loading ? "saving..." : "let's go"}
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            fontSize: "13px",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          sign out
        </button>
      </form>
    </div>
  );
}
