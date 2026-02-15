import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Only handle OAuth code from URL if there's a fresh verifier in localStorage.
// This prevents Chrome (especially iOS) from re-submitting stale codes when
// restoring a tab, which causes "Invalid verification code" errors.
function shouldHandleCode() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes("__convexAuthOAuthVerifier")) {
      return true;
    }
  }
  // No verifier means the code in the URL is stale — skip it
  return false;
}

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex} shouldHandleCode={shouldHandleCode}>
    <App />
  </ConvexAuthProvider>
);
