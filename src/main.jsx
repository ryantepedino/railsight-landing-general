import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; // App.jsx está no mesmo diretório de src/main.jsx

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
