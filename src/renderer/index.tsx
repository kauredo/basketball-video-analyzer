import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Find the root element
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

// Create root and render app
const root = createRoot(container);
root.render(<App />);
