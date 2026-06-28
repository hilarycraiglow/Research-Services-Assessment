(function () {
  "use strict";

  const STORAGE_KEY = "rsra-answers-v1";

  /** @type {{library: object, admin: object, costing: object}} */
  let DATA = loadData();
  mergeSharedLinkData();

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt data */ }
    return { library: {}, admin: {}, costing: {} };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
  }

  // ---------- SHARE LINK (no backend: answers travel inside the URL) ----------
  function encodeShareData(data) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }

  function decodeShareData(str) {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  }

  function buildShareLink() {
    const encoded = encodeShareData(DATA);
    const base = window.location.href.split("#")[0];
    return `${base}#share=${encoded}`;
  }

  function mergeSharedLinkData() {
    const hash = window.location.hash || "";
    if (!hash.startsWith("#share=")) return;
    try {
      const incoming = decodeShareData(hash.slice("#share=".length));
      ROLE_ORDER.forEach((roleId) => {
        if (incoming[roleId]) {
          DATA[roleId] = Object.assign({}, DATA[roleId], incoming[roleId]);
        }
      });
      saveData();
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) { /* ignore bad links */ }
  }

  function categoryItems(catId) {
    return INVENTORY.filter((i) => i.category === catId);
  }

  function roleCompletion(roleId) {
    const role = ROLES[roleId];
    const answers = DATA[roleId] || {};
    let answered = 0;
    INVENTORY.forEach((item) => {
      const a = answers[item.id];
      if (a && role.questions.every((q) => a[q.key] !== undefined)) answered++;
    });
    return { answered, total: INVENTORY.length };
  }

  // ---------- VIEW SWITCHING ----------
  const views = {
    home: document.getElementById("view-home"),
    assessment: document.getElementById("view-assessment"),
    results: document.getElementById("view-results")
  };

  const heroHome = document.getElementById("hero-home");

  function showView(name) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    document.querySelectorAll(".tab-link").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    heroHome.hidden = name !== "home";
    if (name === "results") renderResults();
    if (name === "home") renderHomeProgress();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.getElementById("topnav").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-link");
    if (btn) showView(btn.dataset.view);
  });

  document.getElementById("back-home").addEventListener("click", () => showView("home"));

  document.querySelectorAll("[data-scroll-to]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.scrollTo);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.goto));
  });

  // ---------- HOME ----------
  document.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => openAssessment(btn.dataset.start));
  });

  function renderHomeProgress() {
    const el = document.getElementById("progress-summary");
    el.innerHTML = ROLE_ORDER.map((roleId) => {
      const role = ROLES[roleId];
      const { answered, total } = roleCompletion(roleId);
      const pct = Math.round((answered / total) * 100);
      return `
        <div class="progress-row">
          <span class="progress-label" style="color:${role.color}">${role.label}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${role.color}"></div></div>
          <span class="progress-count">${answered} / ${total}</span>
        </div>`;
    }).join("");
  }

  // ---------- ASSESSMENT ----------
  let currentRoleId = null;

  function openAssessment(roleId) {
    currentRoleId = roleId;
    const role = ROLES[roleId];
    document.getElementById("assessment-role-title").textContent = `${role.label} Assessment`;
    document.getElementById("assessment-role-sub").textContent = role.subtitle;
    document.getElementById("share-link-input").value = "";
    renderCategoryList(roleId);
    showView("assessment");
  }

  function renderCategoryList(roleId) {
    const role = ROLES[roleId];
    const container = document.getElementById("category-list");
    container.innerHTML = "";

    CATEGORIES.forEach((cat) => {
      const items = categoryItems(cat.id);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "cat-section";

      const head = document.createElement("button");
      head.className = "cat-head";
      head.style.borderLeftColor = cat.color;
      head.innerHTML = `<span>${cat.name}</span><span class="cat-count">${items.length} services</span>`;
      head.addEventListener("click", () => section.classList.toggle("open"));
      section.appendChild(head);

      const body = document.createElement("div");
      body.className = "cat-body";

      items.forEach((item) => {
        body.appendChild(renderItemCard(roleId, item));
      });

      section.appendChild(body);
      section.classList.add("open");
      container.appendChild(section);
    });

    updateAssessmentProgress(roleId);
  }

  function renderItemCard(roleId, item) {
    const role = ROLES[roleId];
    DATA[roleId][item.id] = DATA[roleId][item.id] || {};
    const answers = DATA[roleId][item.id];

    // Library-only rule: if the library doesn't offer a service, the cost-tracking
    // questions for it are meaningless, so they're forced to "No" and locked.
    const forcedNo = roleId === "library" && answers.offer === 0;
    if (forcedNo && (answers.isolate !== 0 || answers.demonstrate !== 0)) {
      answers.isolate = 0;
      answers.demonstrate = 0;
      saveData();
    }

    const card = document.createElement("article");
    card.className = "item-card";

    const title = document.createElement("div");
    title.className = "item-title";
    title.innerHTML = `<h4>${item.name}</h4><p>${item.desc}</p>`;
    card.appendChild(title);

    const qWrap = document.createElement("div");
    qWrap.className = "question-wrap";

    role.questions.forEach((q) => {
      const locked = forcedNo && q.key !== "offer";

      const qEl = document.createElement("div");
      qEl.className = "question" + (locked ? " question-locked" : "");
      const qText = document.createElement("p");
      qText.className = "question-text";
      qText.textContent = q.text(item.name.toLowerCase());
      qEl.appendChild(qText);

      const optWrap = document.createElement("div");
      optWrap.className = "options";
      q.options.forEach((opt) => {
        const optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = "opt-btn";
        optBtn.textContent = opt.label;
        if (answers[q.key] === opt.value) optBtn.classList.add("selected");
        optBtn.classList.add(`val-${opt.value}`);
        if (locked) optBtn.disabled = true;
        optBtn.addEventListener("click", () => {
          answers[q.key] = opt.value;
          if (roleId === "library" && q.key === "offer") {
            if (opt.value === 0) {
              answers.isolate = 0;
              answers.demonstrate = 0;
            } else {
              delete answers.isolate;
              delete answers.demonstrate;
            }
          }
          saveData();
          renderCategoryList(roleId);
        });
        optWrap.appendChild(optBtn);
      });
      qEl.appendChild(optWrap);
      if (locked) {
        const note = document.createElement("p");
        note.className = "locked-note";
        note.textContent = "Automatically set to No — the library does not yet offer this service.";
        qEl.appendChild(note);
      }
      qWrap.appendChild(qEl);
    });

    card.appendChild(qWrap);
    return card;
  }

  function updateAssessmentProgress(roleId) {
    const { answered, total } = roleCompletion(roleId);
    document.getElementById("assessment-progress").textContent = `${answered} / ${total}`;
  }

  // ---------- SHARE LINK UI (assessment "what's next" panel) ----------
  const shareLinkInput = document.getElementById("share-link-input");

  document.getElementById("gen-link-btn").addEventListener("click", () => {
    shareLinkInput.value = buildShareLink();
    shareLinkInput.select();
  });

  document.getElementById("copy-link-btn").addEventListener("click", async () => {
    if (!shareLinkInput.value) shareLinkInput.value = buildShareLink();
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
    } catch (e) {
      shareLinkInput.select();
      document.execCommand("copy");
    }
  });

  document.getElementById("email-link-btn").addEventListener("click", (e) => {
    e.preventDefault();
    const link = shareLinkInput.value || buildShareLink();
    shareLinkInput.value = link;
    const subject = encodeURIComponent("Research Services Readiness Assessment — your input needed");
    const body = encodeURIComponent(
      `Hi,\n\nWe're working through the Research Services Collaborative Readiness Assessment. ` +
      `Click this link to load what's been answered so far and add your team's answers:\n\n${link}\n\nThanks!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });

  // ---------- EXPORT / IMPORT ----------
  function exportAnswers() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-services-assessment-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById("export-btn").addEventListener("click", exportAnswers);

  const exportBtnResults = document.getElementById("export-btn-results");
  if (exportBtnResults) {
    exportBtnResults.addEventListener("click", () => window.print());
  }

  document.getElementById("import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        ROLE_ORDER.forEach((roleId) => {
          if (incoming[roleId]) {
            DATA[roleId] = Object.assign({}, DATA[roleId], incoming[roleId]);
          }
        });
        saveData();
        renderHomeProgress();
        alert("Import successful. Combined results are reflected in Outcomes.");
      } catch (err) {
        alert("That file could not be read as a valid export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Clear all locally saved answers for every role? This cannot be undone.")) {
      DATA = { library: {}, admin: {}, costing: {} };
      saveData();
      renderHomeProgress();
    }
  });

  // ---------- RESULTS / OUTCOMES ----------
  function itemRoleScore(roleId, itemId) {
    const role = ROLES[roleId];
    const a = (DATA[roleId] || {})[itemId];
    if (!a) return null;
    if (!role.questions.every((q) => a[q.key] !== undefined)) return null;
    return a;
  }

  function renderResults() {
    renderTransparencyOutcome();
    renderExpandOutcome();
    renderDetailVisual();
  }

  function renderTransparencyOutcome() {
    const el = document.querySelector("#outcome-transparency .outcome-body");
    const libDone = roleCompletion("library").answered > 0;
    const costDone = roleCompletion("costing").answered > 0;

    if (!libDone || !costDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from both <strong>Library</strong> and <strong>University Costing</strong> to calculate.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const lib = itemRoleScore("library", item.id);
      const cost = itemRoleScore("costing", item.id);
      if (!lib || !cost) return null;
      if (lib.offer === 0) return null; // not offered yet, can't model transparency on it
      const trackingScore = lib.isolate + lib.demonstrate; // 0-4
      const appetiteScore = cost.direct + (2 - cost.idc); // not-already-in-IDC-pool + open to direct charging, 0-4
      const total = trackingScore + appetiteScore; // 0-8
      return { item, total, trackingScore, appetiteScore };
    }).filter(Boolean).sort((a, b) => b.total - a.total);

    if (!ranked.length) {
      el.innerHTML = `<p class="empty-note">No services are both offered and scored yet.</p>`;
      return;
    }

    el.innerHTML = `<ol class="outcome-list">` + ranked.slice(0, 8).map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name}</span>
        <span class="outcome-meter"><span class="outcome-meter-fill" style="width:${(r.total / 8) * 100}%;background:#1F87A6"></span></span>
        <span class="outcome-score">${r.total}/8</span>
      </li>`).join("") + `</ol>`;
  }

  function renderExpandOutcome() {
    const el = document.querySelector("#outcome-expand .outcome-body");
    const adminDone = roleCompletion("admin").answered > 0;
    const libDone = roleCompletion("library").answered > 0;

    if (!adminDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from <strong>Research Administration</strong> to calculate.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const admin = itemRoleScore("admin", item.id);
      if (!admin) return null;
      const lib = itemRoleScore("library", item.id);
      const offerLevel = lib ? lib.offer : null;
      if (offerLevel === 2) return null; // already fully offered, not a start/expand candidate
      const adminScore = admin.value + admin.compliance + admin.chargeable; // 0-6
      const status = !libDone ? "Unknown" : "Start";
      return { item, adminScore, status };
    }).filter(Boolean).sort((a, b) => b.adminScore - a.adminScore);

    if (!ranked.length) {
      el.innerHTML = `<p class="empty-note">No expansion gaps found with current data — library already offers the services research administration values most.</p>`;
      return;
    }

    el.innerHTML = `<ol class="outcome-list">` + ranked.slice(0, 8).map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name} <span class="tag tag-${r.status.toLowerCase()}">${r.status}</span></span>
        <span class="outcome-meter"><span class="outcome-meter-fill" style="width:${(r.adminScore / 6) * 100}%;background:#52733E"></span></span>
        <span class="outcome-score">${r.adminScore}/6</span>
      </li>`).join("") + `</ol>`;
  }

  const VALUE_COLOR = { 2: "#1F87A6", 1: "#C9941F", 0: "#E6394A" };
  function chip(value, label) {
    if (value === undefined) return `<span class="vchip vchip-empty" title="No answer yet">&middot;</span>`;
    return `<span class="vchip" style="background:${VALUE_COLOR[value]}" title="${label}"></span>`;
  }

  function renderDetailVisual() {
    const el = document.getElementById("results-detail");
    const rows = INVENTORY.map((item) => {
      const lib = itemRoleScore("library", item.id) || {};
      const admin = itemRoleScore("admin", item.id) || {};
      const cost = itemRoleScore("costing", item.id) || {};
      return { item, lib, admin, cost };
    });

    el.innerHTML = `
      <h3>Full detail by service</h3>
      <p class="detail-legend">
        <span class="vchip" style="background:${VALUE_COLOR[2]}"></span> Yes / strong
        <span class="vchip" style="background:${VALUE_COLOR[1]}"></span> Partial / not sure
        <span class="vchip" style="background:${VALUE_COLOR[0]}"></span> No
        <span class="vchip vchip-empty">&middot;</span> Not answered
      </p>
      <div class="detail-rows">
        ${rows.map((r) => `
          <div class="detail-row">
            <div class="detail-row-name">${r.item.name}</div>
            <div class="detail-row-groups">
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.library.color}">Library</span>
                ${chip(r.lib.offer, "Offers it")}${chip(r.lib.isolate, "Can isolate cost")}${chip(r.lib.demonstrate, "Can demonstrate per-project cost")}
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.admin.color}">Admin</span>
                ${chip(r.admin.value, "Valuable to strategy")}${chip(r.admin.compliance, "Helps grant compliance")}${chip(r.admin.chargeable, "Open to direct charging")}
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.costing.color}">Costing</span>
                ${chip(r.cost.costcenter, "Has a cost center")}${chip(r.cost.idc, "In IDC library cost pool")}${chip(r.cost.direct, "Would move to direct charging")}
              </div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // init
  renderHomeProgress();
})();
