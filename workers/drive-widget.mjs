import { chromium } from "playwright";

const scratch = "/private/tmp/claude-501/-Users-ombissa-Projects-uni-chatbot/29941500-2f71-496d-8e82-baacd522f93f/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:8080/demo.html");
await page.waitForSelector("#uc-toggle");
await page.screenshot({ path: `${scratch}/widget-1-bubble.png` });

await page.click("#uc-toggle");
await page.waitForSelector("#uc-panel", { state: "visible" });
await page.screenshot({ path: `${scratch}/widget-2-panel-open.png` });

await page.fill("#uc-input", "What is on the academic calendar?");
await page.click("#uc-form button[type=submit]");

// Wait for the bot bubble to start receiving streamed tokens (non-empty, non-"…")
await page.waitForFunction(
  () => {
    const bubbles = document.querySelectorAll("#uc-messages span");
    const last = bubbles[bubbles.length - 1];
    return last && last.textContent.length > 0;
  },
  undefined,
  { timeout: 340000 }
);
await page.screenshot({ path: `${scratch}/widget-3-streaming.png` });

const messagesHtml = await page.locator("#uc-messages").innerHTML();
console.log("=== messages HTML ===");
console.log(messagesHtml);
console.log("=== console/page errors ===");
console.log(errors.length ? errors.join("\n") : "(none)");

await browser.close();
