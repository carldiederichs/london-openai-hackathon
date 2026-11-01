import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import LiveApp from "./live/LiveApp";
import "./global.css";
const PracticeHunt = lazy(() => import("./live/PracticeHunt"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<p>Opening castle…</p>}>
      {window.location.pathname === "/practice" ? (
        <PracticeHunt />
      ) : (
        <LiveApp />
      )}
    </Suspense>
  </React.StrictMode>,
);
