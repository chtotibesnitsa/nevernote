import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./app/Home.tsx";
import { Insights } from "./app/Insights.tsx";
import { NoteView } from "./app/NoteView.tsx";
import { Notes } from "./app/Notes.tsx";
import { Settings } from "./app/Settings.tsx";
import { Shell } from "./app/Shell.tsx";
import { AppProvider } from "./app/state.tsx";
import { isDesktop } from "./lib/bridge.ts";
import { Landing } from "./site/Landing.tsx";

if (isDesktop) document.documentElement.classList.add("desktop");
if (new URLSearchParams(location.search).has("demo")) await import("./lib/demo.ts").then((d) => d.seedDemo());

// The desktop app loads files from disk, so it routes with the hash.
const Router = isDesktop || location.protocol === "file:" ? HashRouter : BrowserRouter;

function App() {
  return (
    <AppProvider>
      <Shell>
        <Routes>
          <Route index element={<Home />} />
          <Route path="notes" element={<Notes />} />
          <Route path="note/:id" element={<NoteView />} />
          <Route path="insights" element={<Insights />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </Shell>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={isDesktop ? <Navigate to="/app" replace /> : <Landing />} />
        <Route path="/app/*" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </StrictMode>,
);
