import { chromium } from "playwright";

const scratch = "/private/tmp/claude-501/-Users-ombissa-Projects-uni-chatbot/29941500-2f71-496d-8e82-baacd522f93f/scratchpad";
const tenantId = process.argv[2];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(`http://localhost:4000/tenants/${tenantId}/pdfs`);
await page.waitForSelector("table");
await page.screenshot({ path: `${scratch}/admin-1-pending.png`, fullPage: true });

// Approve the first pending row
const approveButton = page.locator("tr", { hasText: "pending" }).first().locator("button", { hasText: "Approve" });
await approveButton.click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${scratch}/admin-2-after-approve.png`, fullPage: true });

const html = await page.locator("table").innerHTML();
console.log("=== table after approve ===");
console.log(html.replace(/\s+/g, " "));
console.log("=== console/page errors ===");
console.log(errors.length ? errors.join("\n") : "(none)");

await browser.close();
