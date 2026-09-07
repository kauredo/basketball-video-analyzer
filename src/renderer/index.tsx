import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./contexts/ToastContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
// Self-hosted: the app is offline software and must never reach a font CDN.
import "@fontsource-variable/space-grotesk/wght.css";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./styles/variables.css";
import "../i18n";

// Find the root element
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

// Create root and render app
const root = createRoot(container);
root.render(
  <ToastProvider>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </ToastProvider>
);
