import React from "react";
import { createRoot } from "react-dom/client";
import DropApp from "./drop/DropApp";
import PanelApp from "./panel/PanelApp";
import SnakeApp from "./game/SnakeApp";
import TasksApp from "./tasks/TasksApp";
import SettingsApp from "./settings/SettingsApp";
import "./styles.css";

const params = new URLSearchParams(location.search);
const mode = params.get("window") ?? "panel";

document.body.style.background = "transparent";
document.body.dataset.graphics = "neo";

function Root() {
  if (mode === "drop") return <DropApp />;
  if (mode === "game") return <SnakeApp />;
  if (mode === "tasks") return <TasksApp />;
  if (mode === "settings") return <SettingsApp />;
  return <PanelApp />;
}

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
