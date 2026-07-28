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
      <div style="background:#1a56db;color:#fff;padding:12px 16px;font-weight:600;
        display:flex;justify-content:space-between;align-items:center;">
        <span>Ask us anything</span>
        <button id="uc-clear" title="Clear chat history" style="background:none;border:none;color:#fff;
          opacity:.8;cursor:pointer;font-size:12px;text-decoration:underline;padding:0;">Clear</button>
      </div>
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
  const clearBtn = root.querySelector("#uc-clear");

  toggleBtn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });

  // Chat history persistence: per-tenant localStorage, capped and time-limited
  // per tenant config fetched from /widget-config (falls back to safe
  // defaults if that request fails, e.g. tenant not resolvable yet).
  const historyKey = `uc_history_${tenantKey}`;
  const DEFAULT_HISTORY_LIMIT = 50;
  const DEFAULT_HISTORY_EXPIRY_HOURS = 720; // 30 days
  let historyLimit = DEFAULT_HISTORY_LIMIT;
  let historyExpiryHours = DEFAULT_HISTORY_EXPIRY_HOURS;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(historyKey);
      if (!raw) return [];
      const entries = JSON.parse(raw);
      const cutoff = Date.now() - historyExpiryHours * 60 * 60 * 1000;
      return entries.filter((m) => m.ts >= cutoff);
    } catch {
      return [];
    }
  }

  function saveHistory(entries) {
    try {
      const trimmed = entries.slice(-historyLimit);
      localStorage.setItem(historyKey, JSON.stringify(trimmed));
    } catch {
      // localStorage unavailable or full; history just won't persist
    }
  }

  let history = [];

  function clearHistory() {
    history = [];
    localStorage.removeItem(historyKey);
    messages.innerHTML = "";
  }

  clearBtn.addEventListener("click", clearHistory);

  // Guards against a race where the user submits a question before the
  // config fetch resolves: once that happens, `history` already reflects
  // live state (via appendMessage), so a wipe-and-rerender here would drop
  // the in-flight bot bubble instead of just adjusting limit/expiry.
  let interacted = false;
  form.addEventListener("submit", () => {
    interacted = true;
  });

  function renderHistory() {
    if (interacted) return;
    history = loadHistory();
    messages.innerHTML = "";
    for (const m of history) appendMessage(m.role, m.text, false);
  }

  fetch(`${apiUrl}/widget-config?tenantKey=${encodeURIComponent(tenantKey)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((config) => {
      if (config) {
        if (Number.isFinite(config.chatHistoryLimit)) historyLimit = config.chatHistoryLimit;
        if (Number.isFinite(config.chatHistoryExpiryHours)) historyExpiryHours = config.chatHistoryExpiryHours;
      }
    })
    .catch(() => {
      // request failed (tenant unresolvable, network, etc.) — fall back to defaults
    })
    .finally(renderHistory);

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Minimal markdown -> HTML: bold, links, bullet/numbered lists, paragraphs.
  // Input is escaped first so LLM output can never inject raw HTML/script.
  function renderMarkdown(raw) {
    const escaped = escapeHtml(raw)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // [text](url) — url may contain one level of nested parens, e.g. a
      // filename like "...(OnlyForStudents).pdf" from a real crawled link.
      .replace(
        /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
    const lines = escaped.split("\n");
    const html = [];
    let listItems = null;
    let listTag = null;

    function closeList() {
      if (listItems) {
        html.push(`<${listTag}>${listItems.join("")}</${listTag}>`);
        listItems = null;
        listTag = null;
      }
    }

    for (const line of lines) {
      const bullet = line.match(/^\s*[-*]\s+(.*)/);
      const numbered = line.match(/^\s*\d+\.\s+(.*)/);
      if (bullet || numbered) {
        const tag = numbered ? "ol" : "ul";
        if (listTag && listTag !== tag) closeList();
        listTag = tag;
        listItems = listItems || [];
        listItems.push(`<li>${(bullet ?? numbered)[1]}</li>`);
      } else {
        closeList();
        if (line.trim()) html.push(`<p>${line}</p>`);
      }
    }
    closeList();
    return html.join("");
  }

  function appendMessage(role, text, persist = true) {
    const el = document.createElement("div");
    el.style.margin = "8px 0";
    el.style.textAlign = role === "user" ? "right" : "left";
    const bubble = document.createElement("span");
    bubble.style.display = "inline-block";
    bubble.style.maxWidth = "100%";
    bubble.style.overflowWrap = "anywhere";
    bubble.style.padding = "8px 12px";
    bubble.style.borderRadius = "12px";
    bubble.style.background = role === "user" ? "#1a56db" : "#f1f3f5";
    bubble.style.color = role === "user" ? "#fff" : "#000";
    if (role === "bot") {
      bubble.innerHTML = renderMarkdown(text);
    } else {
      bubble.textContent = text;
    }
    el.appendChild(bubble);
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    if (persist) {
      history.push({ role, text, ts: Date.now() });
      saveHistory(history);
    }
    return bubble;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    appendMessage("user", question);
    const answerBubble = appendMessage("bot", "…", false);
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
      let answerText = "";
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
          if (payload.error) throw new Error(payload.error);
          if (payload.token) {
            answerText += payload.token;
            answerBubble.innerHTML = renderMarkdown(answerText);
          }
        }
      }
      history.push({ role: "bot", text: answerText, ts: Date.now() });
      saveHistory(history);
    } catch (err) {
      const errorText = "Sorry, something went wrong. Please try again later.";
      answerBubble.textContent = errorText;
      history.push({ role: "bot", text: errorText, ts: Date.now() });
      saveHistory(history);
      console.error(err);
    }
  });
})();
