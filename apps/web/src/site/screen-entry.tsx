import { createRoot } from "react-dom/client";
import "../styles/index.css";
import { DesktopDemo } from "./DesktopDemo.tsx";
createRoot(document.getElementById("root")!).render(<div style={{ width: 1024 }}><DesktopDemo /></div>);
