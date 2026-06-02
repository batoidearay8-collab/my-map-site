import "leaflet/dist/leaflet.css";
import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/*
      HashRouter is the most reliable option for static hosting (GitHub Pages, school servers)
      because it does not require server-side rewrite rules for routes like /builder.

      ErrorBoundary catches any render-time exceptions and shows a recoverable error page
      instead of leaving the user with a blank screen.
    */}
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
