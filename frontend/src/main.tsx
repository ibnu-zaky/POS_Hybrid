// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/chalk.css";
import "./styles/layout.css";
import "./styles/print.css";
import App from "./App";

// restore tema & foto dari localStorage
try {
  const theme = localStorage.getItem("wk-theme");
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  const photo = localStorage.getItem("wk-photo");
  if (photo) document.documentElement.setAttribute("data-photo", photo);
} catch {
  // ignore
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
