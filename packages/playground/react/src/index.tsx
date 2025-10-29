import "./store/initSea";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";
import "antd/dist/antd.css";

createRoot(document.getElementById("app")!).render(<App />);
