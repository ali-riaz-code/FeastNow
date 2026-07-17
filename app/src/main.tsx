import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/home.css";
import "./styles/restaurant.css";
import "./styles/search.css";
import "./styles/orders.css";
import "./styles/rshell.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });
  });
}
