(function () {
  const scriptTag = document.currentScript;
  const tenantKey = scriptTag.getAttribute("data-tenant-key");
  const apiUrl = scriptTag.getAttribute("data-api-url") || "http://localhost:3000";

  if (!tenantKey) {
    console.error("uni-chatbot widget: missing data-tenant-key attribute");
    return;
  }

  // Theme is baked into the snippet at admin-edit time (see docs/WIDGET_THEMING.md),
  // not fetched at runtime, so it's available before first paint — no flash of
  // default colors.
  const theme = (() => {
    try {
      return JSON.parse(scriptTag.getAttribute("data-theme") || "{}");
    } catch {
      return {}; // malformed snippet edit — fall back to defaults, don't break the widget
    }
  })();

  const host = document.createElement("div");
  host.id = "uni-chatbot-root";
  if (theme.primaryColor) host.style.setProperty("--uc-primary", theme.primaryColor);
  if (theme.textOnPrimary) host.style.setProperty("--uc-on-primary", theme.textOnPrimary);
  if (theme.botBubbleColor) host.style.setProperty("--uc-bot-bubble", theme.botBubbleColor);
  if (theme.fontFamily) host.style.setProperty("--uc-font", theme.fontFamily);
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const side = theme.position === "bottom-left" ? "left" : "right";

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: var(--uc-font, system-ui, sans-serif); }
      #uc-toggle { position:fixed;bottom:20px;${side}:20px;width:56px;height:56px;
        border-radius:50%;background:var(--uc-primary,#1a56db);color:#fff;border:none;
        cursor:pointer;font-size:24px;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:2147483647; }
      #uc-panel { display:none;position:fixed;bottom:88px;${side}:20px;width:340px;height:460px;
        background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.2);
        flex-direction:column;overflow:hidden;z-index:2147483647; }
      #uc-panel-header { background:var(--uc-primary,#1a56db);color:var(--uc-on-primary,#fff);
        padding:12px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center; }
      #uc-header-title { display:flex;align-items:center;gap:8px; }
      #uc-header-title img { height:20px;width:20px;object-fit:contain; }
      #uc-clear { background:none;border:none;color:var(--uc-on-primary,#fff);opacity:.8;
        cursor:pointer;font-size:12px;text-decoration:underline;padding:0; }
      #uc-messages { flex:1;overflow-y:auto;padding:12px;font-size:14px; }
      #uc-form { display:flex;align-items:flex-end;border-top:1px solid #eee; }
      #uc-input { flex:1;border:none;padding:10px;font-size:14px;outline:none;resize:none;
        max-height:120px;overflow-y:auto;font-family:inherit; }
      #uc-send { border:none;background:var(--uc-primary,#1a56db);color:var(--uc-on-primary,#fff);
        padding:10px 16px;cursor:pointer;align-self:stretch; }
      .uc-bubble-user { background:var(--uc-primary,#1a56db);color:var(--uc-on-primary,#fff); }
      .uc-bubble-bot { background:var(--uc-bot-bubble,#f1f3f5);color:#000; }
    </style>
    <button id="uc-toggle">💬</button>
    <div id="uc-panel">
      <div id="uc-panel-header">
        <span id="uc-header-title"><span id="uc-title"></span></span>
        <button id="uc-clear" title="Clear chat history">Clear</button>
      </div>
      <div id="uc-messages"></div>
      <form id="uc-form">
        <textarea id="uc-input" rows="1" placeholder="Type your question..."></textarea>
        <button id="uc-send" type="submit">Send</button>
      </form>
    </div>
  `;

  const titleEl = shadow.querySelector("#uc-title");
  titleEl.textContent = theme.title || "Ask us anything";
  if (theme.logoUrl) {
    const logo = document.createElement("img");
    logo.src = theme.logoUrl;
    logo.alt = "";
    shadow.querySelector("#uc-header-title").prepend(logo);
  }

  const toggleBtn = shadow.querySelector("#uc-toggle");
  const panel = shadow.querySelector("#uc-panel");
  const messages = shadow.querySelector("#uc-messages");
  const form = shadow.querySelector("#uc-form");
  const input = shadow.querySelector("#uc-input");
  const clearBtn = shadow.querySelector("#uc-clear");

  function autoResizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }
  input.addEventListener("input", autoResizeInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

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
    bubble.className = role === "user" ? "uc-bubble-user" : "uc-bubble-bot";
    bubble.style.display = "inline-block";
    bubble.style.maxWidth = "100%";
    bubble.style.overflowWrap = "anywhere";
    bubble.style.padding = "8px 12px";
    bubble.style.borderRadius = "12px";
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
    autoResizeInput();
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
