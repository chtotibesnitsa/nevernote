// The laptop screen from the hero: an essay in progress, Nevernote's live
// transcript beside it, the recording pill below. Shared by the 3D scene (as a
// texture) and the flat fallback for browsers without WebGL.
export const TEACHER = "#c8794a";
const SPEAKERS = [
  { who: "Ms. Rivera", c: TEACHER, t: "Limestone stores carbon for millions of years." },
  { who: "Jordan", c: "#3f7fbf", t: "So rocks are a carbon sink?" },
  { who: "Ms. Rivera", c: TEACHER, t: "Exactly. Lab report due Friday, 11:59 PM.", due: "Due Fri 11:59 PM" },
  { who: "Sam", c: "#8a5cc2", t: "Is the nitrogen cycle on the test?" },
  { who: "Ms. Rivera", c: TEACHER, t: "Yes. That one will be on the test.", due: "★ On the test" },
];
const ESSAY = [
  "Why the New Deal still matters",
  "",
  "In 1933 a quarter of Americans were out of work. The",
  "programs that followed did more than create jobs; they",
  "changed what people expected from their government.",
  "Social Security, the FDIC and fair labor standards are",
  "still here ninety years later, which is the strongest",
  "argument that the New Deal worked where it counted.",
];

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** The laptop screen: an essay in progress, Nevernote's live transcript beside it, the recording pill below. */
export function drawScreen(g: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f6d9b8");
  bg.addColorStop(1, "#e7b98f");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Menu bar.
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillRect(0, 0, W, 26);
  g.fillStyle = "#1c1915";
  g.font = "600 15px Inter, system-ui";
  g.fillText("  Docs   File   Edit   View", 10, 18);

  // Essay window.
  const ex = 34, ey = 52, ew = W * 0.56, eh = H - 160;
  g.shadowColor = "rgba(60,40,20,0.25)";
  g.shadowBlur = 24;
  g.fillStyle = "#ffffff";
  roundRect(g, ex, ey, ew, eh, 14);
  g.fill();
  g.shadowBlur = 0;
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(ex + 20 + i * 18, ey + 18, 6, 0, Math.PI * 2);
    g.fill();
  });
  const typed = Math.floor((t * 34) % (ESSAY.join(" ").length + 120));
  let left = typed;
  ESSAY.forEach((line, i) => {
    const show = line.slice(0, Math.max(0, left));
    left -= line.length + 1;
    g.fillStyle = i === 0 ? "#1c1915" : "#4a433b";
    g.font = i === 0 ? "600 24px Newsreader, Georgia, serif" : "17px Inter, system-ui";
    g.fillText(show, ex + 30, ey + 64 + i * 30);
    if (left < 0 && left > -line.length - 1 && Math.floor(t * 2) % 2 === 0) {
      const w = g.measureText(show).width;
      g.fillStyle = "#c8794a";
      g.fillRect(ex + 31 + w, ey + 48 + i * 30, 2, 20);
    }
  });

  // Nevernote panel.
  const px = ex + ew + 24, py = 52, pw = W - px - 30, ph = H - 160;
  g.shadowColor = "rgba(60,40,20,0.3)";
  g.shadowBlur = 30;
  g.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(g, px, py, pw, ph, 18);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#d9534a";
  g.beginPath();
  g.arc(px + 22, py + 24, 6 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1915";
  g.font = "600 16px Inter, system-ui";
  g.fillText("Nevernote · APES", px + 36, py + 30);
  const n = Math.floor(t / 1.6) % (SPEAKERS.length + 3);
  let y = py + 62;
  SPEAKERS.slice(0, Math.min(n + 1, SPEAKERS.length)).forEach((s) => {
    g.fillStyle = s.c;
    g.font = "700 13px Inter, system-ui";
    g.fillText(s.who, px + 16, y);
    g.fillStyle = "#f0ebe3";
    g.font = "14px Inter, system-ui";
    const words = s.t.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (g.measureText(cur + " " + w).width > pw - 50) {
        lines.push(cur);
        cur = w;
      } else cur = cur ? cur + " " + w : w;
    }
    lines.push(cur);
    const bh = lines.length * 19 + 14;
    roundRect(g, px + 12, y + 6, pw - 24, bh, 12);
    g.fill();
    g.fillStyle = "#1c1915";
    lines.forEach((l, i) => g.fillText(l, px + 22, y + 25 + i * 19));
    y += bh + 12;
    if (s.due) {
      g.fillStyle = "rgba(200,121,74,0.18)";
      roundRect(g, px + 12, y - 4, g.measureText(s.due).width + 28, 24, 12);
      g.fill();
      g.fillStyle = "#6b4f3a";
      g.font = "700 13px Inter, system-ui";
      g.fillText(s.due, px + 26, y + 12);
      y += 30;
    }
    y += 12;
  });

  // Recording pill at the bottom of the screen.
  const pwid = 260, phgt = 52, pxl = W / 2 - pwid / 2, pyl = H - 78;
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = 20;
  g.fillStyle = "#16120e";
  roundRect(g, pxl, pyl, pwid, phgt, 26);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#d9534a";
  g.beginPath();
  g.arc(pxl + 28, pyl + 26, 8, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 18; i++) {
    const h = 6 + Math.abs(Math.sin(t * 7 + i * 0.7) * Math.cos(t * 3 + i)) * 26;
    g.fillStyle = "#3f9a6b";
    roundRect(g, pxl + 50 + i * 8, pyl + 26 - h / 2, 4, h, 2);
    g.fill();
  }
  const sec = Math.floor(t) + 2520;
  g.fillStyle = "#f6f1e9";
  g.font = "600 17px ui-monospace, monospace";
  g.fillText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, pxl + 200, pyl + 32);
}

