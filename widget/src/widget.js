(function () {
  const scriptTag = document.currentScript;
  const tenantKey = scriptTag.getAttribute("data-tenant-key");
  const apiUrl = scriptTag.getAttribute("data-api-url") || "http://localhost:3000";

  if (!tenantKey) {
    console.error("uni-chatbot widget: missing data-tenant-key attribute");
    return;
  }

  const root = document.createElement("div");
  root.id = "uni-chatbot-root";
  root.innerHTML = `
    <button id="uc-toggle" style="position:fixed;bottom:20px;right:20px;width:56px;height:56px;
      border-radius:50%;background:#1a56db;color:#fff;border:none;cursor:pointer;font-size:24px;
      box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:2147483647;">💬</button>
    <div id="uc-panel" style="display:none;position:fixed;bottom:88px;right:20px;width:340px;
      height:460px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.2);
      flex-direction:column;overflow:hidden;z-index:2147483647;font-family:system-ui,sans-serif;">
      <div style="background:#1a56db;color:#fff;padding:12px 16px;font-weight:600;">Ask us anything</div>
      <div id="uc-messages" style="flex:1;overflow-y:auto;padding:12px;font-size:14px;"></div>
      <form id="uc-form" style="display:flex;border-top:1px solid #eee;">
        <input id="uc-input" type="text" placeholder="Type your question..."
          style="flex:1;border:none;padding:10px;font-size:14px;outline:none;" />
        <button type="submit" style="border:none;background:#1a56db;color:#fff;padding:0 16px;cursor:pointer;">Send</button>
      </form>
    </div>
  `;
  document.body.appendChild(root);

  const toggleBtn = root.querySelector("#uc-toggle");
  const panel = root.querySelector("#uc-panel");
  const messages = root.querySelector("#uc-messages");
  const form = root.querySelector("#uc-form");
  const input = root.querySelector("#uc-input");

  toggleBtn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });

  function appendMessage(role, text) {
    const el = document.createElement("div");
    el.style.margin = "8px 0";
    el.style.textAlign = role === "user" ? "right" : "left";
    const bubble = document.createElement("span");
    bubble.style.display = "inline-block";
    bubble.style.padding = "8px 12px";
    bubble.style.borderRadius = "12px";
    bubble.style.background = role === "user" ? "#1a56db" : "#f1f3f5";
    bubble.style.color = role === "user" ? "#fff" : "#000";
    bubble.textContent = text;
    el.appendChild(bubble);
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    appendMessage("user", question);
    const answerBubble = appendMessage("bot", "…");
    answerBubble.textContent = "";

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantKey, question }),
      });
      if (!res.ok || !res.body) throw new Error(`request failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.replace(/^data: /, "");
          if (!line) continue;
          const payload = JSON.parse(line);
          if (payload.token) answerBubble.textContent += payload.token;
        }
      }
    } catch (err) {
      answerBubble.textContent = "Sorry, something went wrong. Please try again later.";
      console.error(err);
    }
  });
})();
