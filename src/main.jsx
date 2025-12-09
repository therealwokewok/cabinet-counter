import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Reshaped } from "reshaped";
import "reshaped/themes/reshaped/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Reshaped theme="reshaped">
      <App />
    </Reshaped>
  </React.StrictMode>
);
