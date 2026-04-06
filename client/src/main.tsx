import React from "react";
import { createRoot } from "react-dom/client";
import * as ReactDOM from "react-dom";
import App from "./App";
import "./index.css";
import { getSavedTheme, applyTheme } from "./lib/theme";
import { ensureDeviceIdCookie } from "./lib/device-id";

// Применить сохранённую тему до первого рендера (без мигания)
applyTheme(getSavedTheme());
ensureDeviceIdCookie();

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// UIX: проверка доступности в разработке (см. docs/UIX_AUDIT.md)
if (import.meta.env.DEV) {
  import("@axe-core/react").then(({ default: reactAxe }) => {
    reactAxe(React, ReactDOM, 1000);
  }).catch(() => {});
}
