// "Ember" — Fire Triangle's on-brand AI assistant widget.
// Self-contained: builds its own DOM, talks to the same-origin /api/chat proxy
// (the OpenRouter key stays server-side). Classic script, loaded on every page.
(function () {
  "use strict";
  if (window.__emberLoaded) return;
  window.__emberLoaded = true;

  var GREETING =
    "Hi! I'm the Fire Triangle assistant. Ask me about our products, services, certifications, or how to get a quote.";
  var CHIPS = ["What products do you supply?", "Which brands are you agent for?", "Where are you located?", "Request a quote"];

  var history = []; // {role, content}
  var busy = false;

  // ---------- DOM ----------
  var root = document.createElement("div");
  root.className = "ember";
  root.innerHTML =
    '<button class="ember__launch" type="button" aria-label="Open chat" aria-expanded="false">' +
      '<svg class="ember__tri" viewBox="0 0 40 36" width="26" height="24" aria-hidden="true">' +
        '<polygon points="20,3 3,33 37,33" fill="none" stroke="currentColor" stroke-width="3"/>' +
        '<polygon points="20,15 13,28 27,28" fill="currentColor"/></svg>' +
      '<span class="ember__pulse" aria-hidden="true"></span>' +
    '</button>' +
    '<section class="ember__panel" role="dialog" aria-label="Chat with Fire Triangle assistant" hidden>' +
      '<header class="ember__head">' +
        '<div class="ember__id">' +
          '<svg viewBox="0 0 40 36" width="22" height="20" aria-hidden="true"><polygon points="20,3 3,33 37,33" fill="none" stroke="currentColor" stroke-width="3"/><polygon points="20,15 13,28 27,28" fill="currentColor"/></svg>' +
          '<div><strong>Fire Triangle Assistant</strong><span class="ember__status">Online</span></div>' +
        '</div>' +
        '<button class="ember__close" type="button" aria-label="Close chat">×</button>' +
      '</header>' +
      '<div class="ember__log" aria-live="polite"></div>' +
      '<div class="ember__chips"></div>' +
      '<form class="ember__form">' +
        '<input class="ember__input" type="text" autocomplete="off" placeholder="Ask us anything…" aria-label="Type your message" maxlength="500">' +
        '<button class="ember__send" type="submit" aria-label="Send">→</button>' +
      '</form>' +
      '<p class="ember__disclaimer">AI assistant · for exact specs &amp; pricing, request a quote.</p>' +
    '</section>';
  document.body.appendChild(root);

  var launch = root.querySelector(".ember__launch");
  var panel = root.querySelector(".ember__panel");
  var log = root.querySelector(".ember__log");
  var chips = root.querySelector(".ember__chips");
  var form = root.querySelector(".ember__form");
  var input = root.querySelector(".ember__input");

  // ---------- helpers ----------
  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function render(text) {
    // escape, then minimal formatting: **bold**, line breaks, bullet lines
    var safe = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/^[\-•]\s+/gm, "• ");
    return safe.replace(/\n/g, "<br>");
  }
  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "ember__msg ember__msg--" + role;
    el.innerHTML = render(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function typing(on) {
    var t = log.querySelector(".ember__typing");
    if (on && !t) {
      t = document.createElement("div");
      t.className = "ember__msg ember__msg--bot ember__typing";
      t.innerHTML = '<span></span><span></span><span></span>';
      log.appendChild(t);
      log.scrollTop = log.scrollHeight;
    } else if (!on && t) {
      t.remove();
    }
  }
  function renderChips() {
    chips.innerHTML = "";
    if (history.length > 0) return; // only show suggestions at the start
    CHIPS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ember__chip";
      b.textContent = c;
      b.addEventListener("click", function () { send(c); });
      chips.appendChild(b);
    });
  }

  var opened = false;
  function open() {
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    root.classList.add("is-open");
    if (!opened) {
      opened = true;
      addMsg("bot", GREETING);
      renderChips();
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() {
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
  }

  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    chips.innerHTML = "";
    addMsg("user", text);
    history.push({ role: "user", content: text });
    typing(true);
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-10) }),
      });
      var data = await res.json().catch(function () { return {}; });
      typing(false);
      if (!res.ok || data.error) {
        addMsg("bot", data.error || "Sorry, something went wrong. You can reach us at sales@firetriangle.net.");
      } else {
        addMsg("bot", data.reply);
        history.push({ role: "assistant", content: data.reply });
      }
    } catch (e) {
      typing(false);
      addMsg("bot", "I couldn't connect just now. Please email sales@firetriangle.net or try again.");
    }
    busy = false;
    input.focus();
  }

  // ---------- events ----------
  launch.addEventListener("click", function () { (root.classList.contains("is-open") ? close : open)(); });
  root.querySelector(".ember__close").addEventListener("click", close);
  form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("is-open")) close(); });
})();
