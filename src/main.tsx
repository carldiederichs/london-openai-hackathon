import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LiveApp from "./live/LiveApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.startsWith("/prototype") ? <App /> : <LiveApp />}
  </React.StrictMode>,
);
