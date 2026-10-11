import React from "react";
import { createRoot } from "react-dom/client";
import DropApp from "./drop/DropApp";
import PanelApp from "./panel/PanelApp";
import SnakeApp from "./game/SnakeApp";
import "./styles.css";

const params = new URLSearchParams(location.search);
const mode = params.get("window") ?? "panel";

document.body.style.background = "transparent";
document.body.dataset.graphics = "neo";

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>{mode === "drop" ? <DropApp /> : mode === "game" ? <SnakeApp /> : <PanelApp />}</React.StrictMode>,
);
