import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import LiveApp from "./live/LiveApp";
import WorldApp from "./world/WorldApp";
import "./global.css";
const PracticeHunt = lazy(() => import("./live/PracticeHunt"));
const path = window.location.pathname;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<p>Opening castle…</p>}>
      {path === "/practice" ? (
        <PracticeHunt />
      ) : /^\/(host|play)\/[A-Za-z0-9]{6}/.test(path) || path === "/hunt" ? (
        <LiveApp />
      ) : (
        <WorldApp />
      )}
    </Suspense>
  </React.StrictMode>,
);
