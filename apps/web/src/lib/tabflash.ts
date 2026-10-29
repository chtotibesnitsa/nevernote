// While a class is recording, the tab shouts about it: a flashing red dot in the
// title and favicon, so nobody closes it by accident after switching away.
let timer = 0;
let original = { title: "", icon: "" };

function iconLink(): HTMLLinkElement {
  let l = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!l) {
    l = document.createElement("link");
    l.rel = "icon";
    document.head.appendChild(l);
  }
  return l;
}

function dot(color: string): string {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL("image/png");
}

export function startFlash(label: () => string, color = "#ef4444") {
  stopFlash();
  const link = iconLink();
  original = { title: document.title, icon: link.href };
  const on = dot(color);
  const off = dot("#fecaca");
  let i = 0;
  const tick = () => {
    const lit = i++ % 2 === 0;
    document.title = lit ? `🔴 ${label()}` : `⚪ ${label()}`;
    link.href = lit ? on : off;
  };
  tick();
  timer = window.setInterval(tick, 900);
}

export function stopFlash() {
  if (!timer) return;
  clearInterval(timer);
  timer = 0;
  document.title = original.title;
  if (original.icon) iconLink().href = original.icon;
}
