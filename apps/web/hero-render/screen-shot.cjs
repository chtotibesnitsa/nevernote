const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 2 });
  await p.goto("process.env.DEV_URL || "http://127.0.0.1:5173/screen.html"");
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: require("path").join(__dirname, "screen.png"), clip: { x: 0, y: 0, width: 1024, height: 640 } });
  await b.close();
})();
