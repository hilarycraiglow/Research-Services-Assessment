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
    } catch (e) {}
    return { library: {}, admin: {}, costing: {} };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
  }

  // ---------- SHARE LINK ----------
  function encodeShareData(data) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }
  function decodeShareData(str) {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  }
  function buildShareLink() {
    const encoded = encodeShareData(DATA);
    return window.location.href.split("#")[0] + `#share=${encoded}`;
  }
  function mergeSharedLinkData() {
    const hash = window.location.hash || "";
    if (!hash.startsWith("#share=")) return;
    try {
      const incoming = decodeShareData(hash.slice("#share=".length));
      ROLE_ORDER.forEach((roleId) => {
        if (incoming[roleId]) DATA[roleId] = Object.assign({}, DATA[roleId], incoming[roleId]);
      });
      saveData();
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {}
  }

  function categoryItems(catId) {
    return INVENTORY.filter((i) => i.category === catId);
  }

  // ---------- COMPLETION ----------
  function roleCompletion(roleId) {
    if (roleId === "library") return libraryCompletion();
    if (roleId === "admin") return adminCompletion();
    return costingCompletion();
  }

  function libraryCompletion() {
    const answers = DATA.library || {};
    const keys = ["project_specific", "usage_scope", "researcher_request", "cost_tracking"];
    let answered = 0;
    INVENTORY.forEach((item) => {
      const a = answers[item.id];
      if (!a) return;
      if (a.offers === false) { answered++; return; }
      if (keys.every((k) => a[k] !== undefined)) answered++;
    });
    return { answered, total: INVENTORY.length };
  }

  function adminCompletion() {
    const answers = DATA.admin || {};
    const keys = ["value", "compliance", "chargeable"];
    let answered = 0;
    INVENTORY.forEach((item) => {
      const a = answers[item.id];
      if (a && keys.every((k) => a[k] !== undefined)) answered++;
    });
    return { answered, total: INVENTORY.length };
  }

  function costingCompletion() {
    const answers = DATA.costing || {};
    let answered = 0;
    INVENTORY.forEach((item) => {
      const a = answers[item.id];
      if (a && ROLES.costing.questions.some((q) => a[q.key] !== undefined)) answered++;
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

  // ---------- ASSESSMENT ROUTING ----------
  let currentRoleId = null;

  function openAssessment(roleId) {
    currentRoleId = roleId;
    const role = ROLES[roleId];
    document.getElementById("assessment-role-title").textContent = `${role.label} Assessment`;
    document.getElementById("assessment-role-sub").textContent = role.subtitle;
    document.getElementById("share-link-input").value = "";
    if (roleId === "admin") {
      renderAdminAssessment();
    } else if (roleId === "costing") {
      renderCostingAssessment();
    } else {
      renderCategoryList(roleId);
    }
    showView("assessment");
  }

  // ---------- LIBRARY & COSTING ASSESSMENT (category accordion) ----------
  function renderCategoryList(roleId) {
    const container = document.getElementById("category-list");
    container.innerHTML = "";
    if (roleId === "library") {
      const hint = document.createElement("p");
      hint.className = "lib-offer-hint";
      hint.textContent = "Each service below is checked by default. Uncheck the box if your library does not offer that service.";
      container.appendChild(hint);
    }
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
      items.forEach((item) => body.appendChild(renderItemCard(roleId, item)));
      section.appendChild(body);
      section.classList.add("open");
      container.appendChild(section);
    });
    updateAssessmentProgress(roleId);
  }

  function renderItemCard(roleId, item) {
    if (roleId === "library") return renderLibraryItemCard(item);
    return renderCostingItemCard(item);
  }

  // Library card: offer toggle checkbox + 4 new questions
  function renderLibraryItemCard(item) {
    DATA.library[item.id] = DATA.library[item.id] || {};
    const answers = DATA.library[item.id];
    const offered = answers.offers !== false;

    const card = document.createElement("article");
    card.className = "item-card lib-item-card" + (offered ? "" : " not-offered");

    // Offer toggle header
    const offerRow = document.createElement("label");
    offerRow.className = "lib-offer-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "lib-offer-cb";
    cb.checked = offered;
    cb.addEventListener("change", () => {
      answers.offers = cb.checked;
      saveData();
      renderCategoryList("library");
    });

    const nameDiv = document.createElement("div");
    nameDiv.className = "lib-offer-name";
    nameDiv.innerHTML = `<span class="lib-item-title">${item.name}</span>`;
    if (!offered) {
      nameDiv.innerHTML += ` <span class="not-offered-badge">Not offered — questions skipped</span>`;
    }

    offerRow.appendChild(cb);
    offerRow.appendChild(nameDiv);
    card.appendChild(offerRow);

    if (!offered) return card;

    // Description
    const desc = document.createElement("p");
    desc.className = "lib-item-desc";
    desc.textContent = item.desc;
    card.appendChild(desc);

    // 4 questions
    const role = ROLES.library;
    const qWrap = document.createElement("div");
    qWrap.className = "question-wrap";

    role.questions.forEach((q) => {
      const qEl = document.createElement("div");
      qEl.className = "question";
      const qText = document.createElement("p");
      qText.className = "question-text";
      qText.textContent = q.text();
      qEl.appendChild(qText);

      const optWrap = document.createElement("div");
      optWrap.className = "options";
      q.options.forEach((opt) => {
        const optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = `opt-btn val-${opt.value}`;
        optBtn.textContent = opt.label;
        if (answers[q.key] === opt.value) optBtn.classList.add("selected");
        optBtn.addEventListener("click", () => {
          answers[q.key] = opt.value;
          saveData();
          renderCategoryList("library");
        });
        optWrap.appendChild(optBtn);
      });
      qEl.appendChild(optWrap);
      qWrap.appendChild(qEl);
    });

    card.appendChild(qWrap);
    return card;
  }

  // Costing assessment: question-by-question checkbox format (mirrors admin layout)
  function renderCostingAssessment() {
    DATA.costing = DATA.costing || {};
    const container = document.getElementById("category-list");
    container.innerHTML = "";
    INVENTORY.forEach((item) => { DATA.costing[item.id] = DATA.costing[item.id] || {}; });

    ROLES.costing.questions.forEach((q, qi) => {
      const section = document.createElement("section");
      section.className = "cat-section open admin-q-section";

      const head = document.createElement("div");
      head.className = "admin-q-head";
      head.innerHTML = `<span class="admin-q-num">Question ${qi + 1}</span><p class="admin-q-text">${q.text}</p>`;
      section.appendChild(head);

      const body = document.createElement("div");
      body.className = "cat-body admin-q-body";

      const selectAllBtn = document.createElement("button");
      selectAllBtn.type = "button";
      selectAllBtn.className = "btn btn-text admin-select-all";
      selectAllBtn.textContent = "Select all";
      body.appendChild(selectAllBtn);

      const allCheckboxes = [];

      CATEGORIES.forEach((cat) => {
        const items = INVENTORY.filter((i) => i.category === cat.id);
        if (!items.length) return;

        const grid = document.createElement("div");
        grid.className = "admin-check-grid";

        const catLabel = document.createElement("div");
        catLabel.className = "admin-cat-label";
        catLabel.style.borderLeftColor = cat.color;
        catLabel.textContent = cat.name;
        grid.appendChild(catLabel);

        items.forEach((item) => {
          const answers = DATA.costing[item.id];
          const checked = answers[q.key] === 2;

          const row = document.createElement("label");
          row.className = "admin-check-row" + (checked ? " checked" : "");
          row.dataset.tooltip = item.desc;

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = checked;
          cb.addEventListener("change", () => {
            answers[q.key] = cb.checked ? 2 : 0;
            row.classList.toggle("checked", cb.checked);
            saveData();
            updateCostingProgress();
          });

          const label = document.createElement("span");
          label.className = "admin-check-label";
          label.textContent = item.name;

          row.appendChild(cb);
          row.appendChild(label);
          grid.appendChild(row);
          allCheckboxes.push({ cb, itemId: item.id });
        });

        body.appendChild(grid);
      });

      selectAllBtn.addEventListener("click", () => {
        const allChecked = allCheckboxes.every(({ cb }) => cb.checked);
        allCheckboxes.forEach(({ cb, itemId }) => {
          cb.checked = !allChecked;
          DATA.costing[itemId][q.key] = cb.checked ? 2 : 0;
          cb.parentElement.classList.toggle("checked", cb.checked);
        });
        saveData();
        updateCostingProgress();
      });

      section.appendChild(body);
      container.appendChild(section);
    });

    // Optional "learn more" section
    const learnSection = document.createElement("section");
    learnSection.className = "cat-section open admin-q-section admin-learn-section";

    const learnHead = document.createElement("div");
    learnHead.className = "admin-q-head admin-learn-head";
    learnHead.innerHTML = `
      <span class="admin-q-num">Optional</span>
      <p class="admin-q-text">I'd like to learn more about the following services. Select all that apply.</p>`;
    learnSection.appendChild(learnHead);

    const learnBody = document.createElement("div");
    learnBody.className = "cat-body admin-q-body";

    const learnSelectAll = document.createElement("button");
    learnSelectAll.type = "button";
    learnSelectAll.className = "btn btn-text admin-select-all";
    learnSelectAll.textContent = "Select all";
    learnBody.appendChild(learnSelectAll);

    const learnGrid = document.createElement("div");
    learnGrid.className = "admin-check-grid";
    const learnCbs = [];

    CATEGORIES.forEach((cat) => {
      const catItems = INVENTORY.filter((i) => i.category === cat.id);
      if (!catItems.length) return;
      const catLabel = document.createElement("div");
      catLabel.className = "admin-cat-label";
      catLabel.style.borderLeftColor = cat.color;
      catLabel.textContent = cat.name;
      learnGrid.appendChild(catLabel);
      catItems.forEach((item) => {
        DATA.costing[item.id] = DATA.costing[item.id] || {};
        const checked = !!DATA.costing[item.id].learnmore;
        const row = document.createElement("label");
        row.className = "admin-check-row" + (checked ? " checked" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.addEventListener("change", () => {
          DATA.costing[item.id].learnmore = cb.checked;
          row.classList.toggle("checked", cb.checked);
          saveData();
        });
        const lbl = document.createElement("span");
        lbl.className = "admin-check-label";
        lbl.textContent = item.name;
        row.appendChild(cb);
        row.appendChild(lbl);
        learnGrid.appendChild(row);
        learnCbs.push({ cb, itemId: item.id });
      });
    });

    learnBody.appendChild(learnGrid);
    learnSelectAll.addEventListener("click", () => {
      const allChecked = learnCbs.every(({ cb }) => cb.checked);
      learnCbs.forEach(({ cb, itemId }) => {
        cb.checked = !allChecked;
        DATA.costing[itemId].learnmore = cb.checked;
        cb.parentElement.classList.toggle("checked", cb.checked);
      });
      saveData();
    });

    learnSection.appendChild(learnBody);
    container.appendChild(learnSection);

    updateCostingProgress();
  }

  function updateCostingProgress() {
    const { answered, total } = costingCompletion();
    document.getElementById("assessment-progress").textContent = `${answered} / ${total}`;
  }

  function updateAssessmentProgress(roleId) {
    const { answered, total } = roleCompletion(roleId);
    document.getElementById("assessment-progress").textContent = `${answered} / ${total}`;
  }

  // ---------- ADMIN ASSESSMENT (question-by-question, grouped by lifecycle) ----------
  const ADMIN_QUESTIONS = [
    { key: "value",      text: "Which of the following services are valuable to your institution's research strategy? Select all that apply." },
    { key: "compliance", text: "Which of the following services helps satisfy grant compliance requirements? Select all that apply." },
    { key: "chargeable", text: "If there were an allocable, documented per project cost for this service, would you be open to direct charging this service? Select all that apply." }
  ];

  function renderAdminAssessment() {
    DATA.admin = DATA.admin || {};
    const container = document.getElementById("category-list");
    container.innerHTML = "";
    INVENTORY.forEach((item) => { DATA.admin[item.id] = DATA.admin[item.id] || {}; });

    ADMIN_QUESTIONS.forEach((q, qi) => {
      const section = document.createElement("section");
      section.className = "cat-section open admin-q-section";

      const head = document.createElement("div");
      head.className = "admin-q-head";
      head.innerHTML = `<span class="admin-q-num">Question ${qi + 1}</span><p class="admin-q-text">${q.text}</p>`;
      section.appendChild(head);

      const body = document.createElement("div");
      body.className = "cat-body admin-q-body";

      const selectAllBtn = document.createElement("button");
      selectAllBtn.type = "button";
      selectAllBtn.className = "btn btn-text admin-select-all";
      selectAllBtn.textContent = "Select all";
      body.appendChild(selectAllBtn);

      const allCheckboxes = [];

      // Group services by lifecycle category
      CATEGORIES.forEach((cat) => {
        const items = INVENTORY.filter((i) => i.category === cat.id);
        if (!items.length) return;

        const grid = document.createElement("div");
        grid.className = "admin-check-grid";

        // Category label spanning full width
        const catLabel = document.createElement("div");
        catLabel.className = "admin-cat-label";
        catLabel.style.borderLeftColor = cat.color;
        catLabel.textContent = cat.name;
        grid.appendChild(catLabel);

        const catCheckboxes = [];
        items.forEach((item) => {
          const answers = DATA.admin[item.id];
          const checked = answers[q.key] === 2;

          const row = document.createElement("label");
          row.className = "admin-check-row" + (checked ? " checked" : "");
          row.dataset.tooltip = item.desc;

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = checked;
          cb.addEventListener("change", () => {
            answers[q.key] = cb.checked ? 2 : 0;
            row.classList.toggle("checked", cb.checked);
            saveData();
            updateAdminProgress();
          });

          const label = document.createElement("span");
          label.className = "admin-check-label";
          label.textContent = item.name;

          row.appendChild(cb);
          row.appendChild(label);
          grid.appendChild(row);
          catCheckboxes.push({ cb, itemId: item.id });
          allCheckboxes.push({ cb, itemId: item.id });
        });

        body.appendChild(grid);
      });

      selectAllBtn.addEventListener("click", () => {
        const allChecked = allCheckboxes.every(({ cb }) => cb.checked);
        allCheckboxes.forEach(({ cb, itemId }) => {
          cb.checked = !allChecked;
          DATA.admin[itemId][q.key] = cb.checked ? 2 : 0;
          cb.parentElement.classList.toggle("checked", cb.checked);
        });
        saveData();
        updateAdminProgress();
      });

      section.appendChild(body);
      container.appendChild(section);
    });

    // Optional "learn more" section
    const learnSection = document.createElement("section");
    learnSection.className = "cat-section open admin-q-section admin-learn-section";

    const learnHead = document.createElement("div");
    learnHead.className = "admin-q-head admin-learn-head";
    learnHead.innerHTML = `
      <span class="admin-q-num">Optional</span>
      <p class="admin-q-text">I'd like to learn more about the following services. Select all that apply.</p>`;
    learnSection.appendChild(learnHead);

    const learnBody = document.createElement("div");
    learnBody.className = "cat-body admin-q-body";

    const learnSelectAll = document.createElement("button");
    learnSelectAll.type = "button";
    learnSelectAll.className = "btn btn-text admin-select-all";
    learnSelectAll.textContent = "Select all";
    learnBody.appendChild(learnSelectAll);

    const learnGrid = document.createElement("div");
    learnGrid.className = "admin-check-grid";
    const learnCbs = [];

    CATEGORIES.forEach((cat) => {
      const items = INVENTORY.filter((i) => i.category === cat.id);
      if (!items.length) return;

      const catLabel = document.createElement("div");
      catLabel.className = "admin-cat-label";
      catLabel.style.borderLeftColor = cat.color;
      catLabel.textContent = cat.name;
      learnGrid.appendChild(catLabel);

      items.forEach((item) => {
        DATA.admin[item.id] = DATA.admin[item.id] || {};
        const checked = !!DATA.admin[item.id].learnmore;

        const row = document.createElement("label");
        row.className = "admin-check-row" + (checked ? " checked" : "");

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.addEventListener("change", () => {
          DATA.admin[item.id].learnmore = cb.checked;
          row.classList.toggle("checked", cb.checked);
          saveData();
        });

        const label = document.createElement("span");
        label.className = "admin-check-label";
        label.textContent = item.name;

        row.appendChild(cb);
        row.appendChild(label);
        learnGrid.appendChild(row);
        learnCbs.push({ cb, itemId: item.id });
      });
    });

    learnBody.appendChild(learnGrid);

    learnSelectAll.addEventListener("click", () => {
      const allChecked = learnCbs.every(({ cb }) => cb.checked);
      learnCbs.forEach(({ cb, itemId }) => {
        cb.checked = !allChecked;
        DATA.admin[itemId].learnmore = cb.checked;
        cb.parentElement.classList.toggle("checked", cb.checked);
      });
      saveData();
    });

    learnSection.appendChild(learnBody);
    container.appendChild(learnSection);

    updateAdminProgress();
  }

  function updateAdminProgress() {
    const { answered, total } = adminCompletion();
    document.getElementById("assessment-progress").textContent = `${answered} / ${total}`;
  }

  // ---------- SHARE LINK UI ----------
  const shareLinkInput = document.getElementById("share-link-input");

  document.getElementById("gen-link-btn").addEventListener("click", () => {
    shareLinkInput.value = buildShareLink();
    shareLinkInput.select();
  });
  document.getElementById("copy-link-btn").addEventListener("click", async () => {
    if (!shareLinkInput.value) shareLinkInput.value = buildShareLink();
    try { await navigator.clipboard.writeText(shareLinkInput.value); }
    catch (e) { shareLinkInput.select(); document.execCommand("copy"); }
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
    a.href = url; a.download = `research-services-assessment-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  document.getElementById("export-btn").addEventListener("click", exportAnswers);
  const exportBtnResults = document.getElementById("export-btn-results");
  if (exportBtnResults) exportBtnResults.addEventListener("click", () => window.print());

  document.getElementById("import-input").addEventListener("change", (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        ROLE_ORDER.forEach((roleId) => {
          if (incoming[roleId]) DATA[roleId] = Object.assign({}, DATA[roleId], incoming[roleId]);
        });
        saveData(); renderHomeProgress();
        alert("Import successful. Combined results are reflected in Outcomes.");
      } catch (err) { alert("That file could not be read as a valid export."); }
    };
    reader.readAsText(file); e.target.value = "";
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Clear all locally saved answers for every role? This cannot be undone.")) {
      DATA = { library: {}, admin: {}, costing: {} };
      saveData(); renderHomeProgress();
    }
  });

  // ---------- RESULTS / OUTCOMES ----------
  function libAnswers(itemId) {
    const a = (DATA.library || {})[itemId];
    if (!a || a.offers === false) return null;
    const keys = ["project_specific", "usage_scope", "researcher_request", "cost_tracking"];
    if (!keys.every((k) => a[k] !== undefined)) return null;
    return a;
  }

  function adminAnswers(itemId) {
    const a = (DATA.admin || {})[itemId];
    if (!a) return null;
    if (a.value === undefined || a.compliance === undefined || a.chargeable === undefined) return null;
    return a;
  }

  function costAnswers(itemId) {
    const a = (DATA.costing || {})[itemId];
    if (!a) return null;
    return a;
  }

  function renderResults() {
    renderTransparencyOutcome();
    renderExpandOutcome();
    renderLearnMoreOutcome();
    renderDetailVisual();
  }

  function renderTransparencyOutcome() {
    const el = document.querySelector("#outcome-transparency .outcome-body");
    const libDone = libraryCompletion().answered > 0;
    const costDone = costingCompletion().answered > 0;

    if (!libDone || !costDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from both <strong>Library</strong> and <strong>Institutional Finance/Costing</strong> to calculate.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const lib = libAnswers(item.id);
      const cost = costAnswers(item.id);
      if (!lib || !cost) return null;
      // Library score: project-specificity + researcher demand + cost tracking readiness
      const libScore = (lib.project_specific || 0) + (lib.researcher_request || 0) + (lib.cost_tracking || 0);
      // Costing appetite: has a cost center + phase-in path available
      const costScore = (cost.costcenter || 0) + (cost.phase_in || 0);
      const total = libScore + costScore;
      return { item, total };
    }).filter(Boolean).sort((a, b) => b.total - a.total);

    if (!ranked.length) {
      el.innerHTML = `<p class="empty-note">No services scored yet.</p>`;
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
    const adminDone = adminCompletion().answered > 0;
    const libDone = libraryCompletion().answered > 0;

    if (!adminDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from <strong>Research Administration</strong> to calculate.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const admin = adminAnswers(item.id);
      if (!admin) return null;
      // Check if library offers this service (if library has answered)
      const libA = (DATA.library || {})[item.id];
      const libOffers = !libA ? null : libA.offers !== false;
      if (libOffers === true) return null; // already offered — not an expand/start candidate
      const adminScore = admin.value + admin.compliance + admin.chargeable;
      const status = !libDone ? "Unknown" : "Start";
      return { item, adminScore, status };
    }).filter(Boolean).sort((a, b) => b.adminScore - a.adminScore);

    if (!ranked.length) {
      el.innerHTML = `<p class="empty-note">No expansion gaps found — the library already offers the services research administration values most.</p>`;
      return;
    }

    el.innerHTML = `<ol class="outcome-list">` + ranked.slice(0, 8).map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name} <span class="tag tag-${r.status.toLowerCase()}">${r.status}</span></span>
        <span class="outcome-meter"><span class="outcome-meter-fill" style="width:${(r.adminScore / 6) * 100}%;background:#52733E"></span></span>
        <span class="outcome-score">${r.adminScore}/6</span>
      </li>`).join("") + `</ol>`;
  }

  function renderLearnMoreOutcome() {
    const el = document.querySelector("#outcome-learnmore .outcome-body");
    if (!el) return;
    const items = INVENTORY.map((item) => {
      const adminFlag = !!((DATA.admin || {})[item.id] || {}).learnmore;
      const costFlag  = !!((DATA.costing || {})[item.id] || {}).learnmore;
      if (!adminFlag && !costFlag) return null;
      const tags = [];
      if (adminFlag) tags.push("Research Admin");
      if (costFlag)  tags.push("Costing");
      return { item, tags };
    }).filter(Boolean);
    if (!items.length) {
      el.innerHTML = `<p class="empty-note">No services selected yet — Research Administration and Institutional Finance/Costing can each flag services for follow-up in the optional section at the end of their assessment.</p>`;
      return;
    }
    el.innerHTML = `<ul class="outcome-list">` + items.map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:6px">${r.tags.join(", ")}</span>
      </li>`).join("") + `</ul>`;
  }

  const VALUE_COLOR = { 2: "#1F87A6", 1: "#C9941F", 0: "#E6394A" };

  function chip(value, label) {
    if (value === undefined) return `<span class="vchip vchip-empty" title="No answer yet">&middot;</span>`;
    return `<span class="vchip" style="background:${VALUE_COLOR[value]}" title="${label}"></span>`;
  }

  function learnMoreChip(itemId) {
    const a = (DATA.admin || {})[itemId];
    if (!a || !a.learnmore) return `<span class="vchip vchip-empty" title="Not flagged">&middot;</span>`;
    return `<span class="vchip" style="background:#52733E" title="Wants to learn more"></span>`;
  }

  function renderDetailVisual() {
    const el = document.getElementById("results-detail");
    const rows = INVENTORY.map((item) => {
      const libA = (DATA.library || {})[item.id] || {};
      const adminA = adminAnswers(item.id) || {};
      const costA = costAnswers(item.id) || {};
      const notOffered = libA.offers === false;
      return { item, libA, adminA, costA, notOffered };
    });

    el.innerHTML = `
      <h3>Full detail by service</h3>
      <p class="detail-legend">
        <span class="vchip" style="background:${VALUE_COLOR[2]}"></span> Yes / selected &nbsp;
        <span class="vchip" style="background:${VALUE_COLOR[1]}"></span> Partial &nbsp;
        <span class="vchip" style="background:${VALUE_COLOR[0]}"></span> No / not selected &nbsp;
        <span class="vchip vchip-empty">&middot;</span> Not answered
      </p>
      <div class="detail-rows">
        ${rows.map((r) => `
          <div class="detail-row">
            <div class="detail-row-name">${r.item.name}${r.notOffered ? ' <span class="tag tag-unknown">Not offered</span>' : ''}</div>
            <div class="detail-row-groups">
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.library.color}">Library</span>
                ${r.notOffered
                  ? '<span class="detail-not-offered">Not offered</span>'
                  : chip(r.libA.project_specific, "Project-specific") +
                    chip(r.libA.usage_scope, "Usage scope") +
                    chip(r.libA.researcher_request, "Researcher-requested") +
                    chip(r.libA.cost_tracking, "Tracks cost")}
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.admin.color}">Admin</span>
                ${chip(r.adminA.value, "Valuable to strategy")}${chip(r.adminA.compliance, "Helps grant compliance")}${chip(r.adminA.chargeable, "Open to direct charging")}${learnMoreChip(r.item.id)}
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.costing.color}">Finance/Costing</span>
                ${chip(r.costA.idc, "In IDC cost pool")}${chip(r.costA.costcenter, "Has a cost center")}${chip(r.costA.phase_in, "Phase-in path available")}${r.costA.learnmore ? `<span class="vchip" style="background:#1F87A6" title="Wants to learn more"></span>` : ''}
              </div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // init
  renderHomeProgress();
})();
