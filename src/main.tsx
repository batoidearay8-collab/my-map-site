import "leaflet/dist/leaflet.css";
import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/*
      HashRouter is the most reliable option for static hosting (GitHub Pages, school servers)
      because it does not require server-side rewrite rules for routes like /builder.
    */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
