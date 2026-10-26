import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {/* Cookie なしの Vercel Web Analytics。ストア版（Capacitor の localhost）では出さない */}
    {location.hostname !== "localhost" && <Analytics />}
  </StrictMode>,
);
