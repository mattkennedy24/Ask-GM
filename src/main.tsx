import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted variable fonts (no third-party requests, and nothing to block rendering).
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/libre-franklin/wght.css";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
