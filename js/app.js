(function () {
  "use strict";

  const STORAGE_KEY = "rsra-answers-v1";
  const INSTITUTION_KEY = "rsra-institution";

  // Services for which the cost_tracking question is shown in the Library assessment
  const LIBRARY_TRACKED_IDS = new Set([
    "evidence-synthesis", "digitization", "data-management-planning", "data-repositories",
    "computational-storage", "data-curation", "code-hosting", "code-training",
    "processing-charges", "publishing-services", "communication-guidance",
    "grant-compliance", "research-authorship", "data-security", "data-preservation"
  ]);

  /** @type {{library: object, admin: object, costing: object}} */
  let DATA = loadData();
  let currentInstitution = localStorage.getItem(INSTITUTION_KEY) || "";
  // (hash processing happens immediately after this block)

  // Process URL hash: extract institution and share data before anything else
  (function processHash() {
    const hash = window.location.hash || "";
    if (!hash) return;
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;

    // Extract institution= param
    const instMatch = raw.match(/(?:^|&)institution=([^&]+)/);
    if (instMatch) {
      currentInstitution = decodeURIComponent(instMatch[1].replace(/\+/g, " "));
      localStorage.setItem(INSTITUTION_KEY, currentInstitution);
    }

    // Extract share= param (base64 may contain + and =, so find from "share=" to next &institution)
    const shareMatch = raw.match(/(?:^|&)share=(.+?)(?:&institution=|$)/);
    if (shareMatch) {
      try {
        const incoming = JSON.parse(decodeURIComponent(escape(atob(shareMatch[1]))));
        ROLE_ORDER.forEach((roleId) => {
          if (incoming[roleId]) DATA[roleId] = Object.assign({}, DATA[roleId], incoming[roleId]);
        });
        saveData();
      } catch (e) {}
    }

    history.replaceState(null, "", window.location.pathname + window.location.search);
  })();

  // Legacy: handle old-style #share= without institution param
  function mergeSharedLinkData() { /* handled above */ }

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
  function buildShareLink() {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(DATA))));
    let url = window.location.href.split("#")[0] + `#share=${encoded}`;
    if (currentInstitution) url += `&institution=${encodeURIComponent(currentInstitution)}`;
    return url;
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
    let answered = 0;
    INVENTORY.forEach((item) => {
      const a = answers[item.id];
      // Default (undefined or not explicitly offered) = not offered = answered
      if (!a || a.offers !== true) { answered++; return; }
      // Offered but no cost_tracking question for this service = answered
      if (!LIBRARY_TRACKED_IDS.has(item.id)) { answered++; return; }
      // Offered + tracked: only answered once cost_tracking is set
      if (a.cost_tracking !== undefined) answered++;
    });
    return { answered, total: INVENTORY.length };
  }

  function adminCompletion() {
    // Admin is question-by-question: complete once the form has been rendered (all entries initialized)
    const answers = DATA.admin || {};
    const initialized = INVENTORY.filter((item) => answers[item.id] !== undefined).length;
    return { answered: initialized, total: INVENTORY.length };
  }

  function costingCompletion() {
    // Costing is question-by-question: complete once the form has been rendered (all entries initialized)
    const answers = DATA.costing || {};
    const initialized = INVENTORY.filter((item) => answers[item.id] !== undefined).length;
    return { answered: initialized, total: INVENTORY.length };
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
    el.innerHTML = `
      <h3 class="progress-summary-title">Assessment status</h3>
      <div class="progress-cards">` +
      ROLE_ORDER.map((roleId) => {
        const role = ROLES[roleId];
        const { answered, total } = roleCompletion(roleId);
        const pct = Math.round((answered / total) * 100);
        const notStarted = answered === 0;
        const complete = answered === total;
        const statusLabel = notStarted ? "Not started" : complete ? "Complete" : "In progress";
        const statusClass = notStarted ? "status-not-started" : complete ? "status-complete" : "status-progress";
        return `
          <div class="progress-card" style="border-top-color:${role.color}">
            <div class="progress-card-top">
              <div>
                <p class="progress-card-role" style="color:${role.color}">${role.label}</p>
                <p class="progress-card-sub">${role.subtitle}</p>
              </div>
              <span class="progress-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${role.color}"></div></div>
            <div class="progress-card-foot">
              <span class="progress-count">${answered} of ${total} services</span>
              <button class="btn btn-sm" style="border-color:${role.color};color:${role.color}" data-start="${roleId}">
                ${notStarted ? "Start" : complete ? "Review" : "Continue"} →
              </button>
            </div>
          </div>`;
      }).join("") +
    `</div>`;

    // re-bind start buttons since innerHTML replaced them
    el.querySelectorAll("[data-start]").forEach((btn) => {
      btn.addEventListener("click", () => openAssessment(btn.dataset.start));
    });
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
      hint.textContent = "Check the box next to each service your library offers. Services are unchecked by default.";
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
    appendFinishBanner(container, ROLES[roleId].label, roleId);
    updateAssessmentProgress(roleId);
  }

  function renderItemCard(roleId, item) {
    if (roleId === "library") return renderLibraryItemCard(item);
    return renderCostingItemCard(item);
  }

  // Library card: offer toggle checkbox + optional cost_tracking question for tracked services
  function renderLibraryItemCard(item) {
    DATA.library[item.id] = DATA.library[item.id] || {};
    const answers = DATA.library[item.id];
    const offered = answers.offers === true;
    const isTracked = LIBRARY_TRACKED_IDS.has(item.id);

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
      nameDiv.innerHTML += ` <span class="not-offered-badge">Not offered</span>`;
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

    // cost_tracking question only for tracked services
    if (isTracked) {
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
    }

    return card;
  }

  // Shared: append a finish/submit banner at the bottom of an assessment container
  function appendFinishBanner(container, roleLabel, roleId) {
    const { answered, total } = roleCompletion(roleId);
    const remaining = total - answered;
    const complete = remaining === 0;
    const banner = document.createElement("div");
    banner.className = "finish-banner" + (complete ? "" : " finish-banner-incomplete");
    const incompleteNote = complete ? "" : `
      <p class="finish-incomplete-note">
        ${remaining} service${remaining !== 1 ? "s" : ""} still need${remaining === 1 ? "s" : ""} responses — scroll up to find unanswered sections.
      </p>`;
    banner.innerHTML = `
      <div class="finish-banner-copy">
        <p class="finish-banner-title">${complete ? `You're done with the ${roleLabel} section` : `${roleLabel} assessment in progress`}</p>
        <p class="finish-banner-sub">Your answers are saved automatically. Head to Outcomes to see combined results, or use the share link above to bring in the other teams.</p>
        ${incompleteNote}
      </div>
      <div class="finish-banner-actions">
        <button class="btn btn-cta finish-btn" data-goto="results">View Outcomes &rarr;</button>
        <button class="btn btn-outline finish-btn-home" data-goto="home">Back to Home</button>
      </div>`;
    banner.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.goto));
    });
    container.appendChild(banner);
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

      // Q4 (threshold): institution-level radio + text, not per-service checkboxes
      if (q.hasTextInput) {
        DATA.costing._threshold = DATA.costing._threshold || {};
        const tData = DATA.costing._threshold;

        const radioWrap = document.createElement("div");
        radioWrap.className = "threshold-radios";
        q.options.forEach((opt) => {
          const lbl = document.createElement("label");
          lbl.className = "threshold-radio-row";
          const rb = document.createElement("input");
          rb.type = "radio";
          rb.name = "threshold-q";
          rb.value = opt.value;
          rb.checked = tData[q.key] === opt.value;
          rb.addEventListener("change", () => {
            tData[q.key] = opt.value;
            saveData();
          });
          lbl.appendChild(rb);
          lbl.appendChild(document.createTextNode(" " + opt.label));
          radioWrap.appendChild(lbl);
        });
        body.appendChild(radioWrap);

        const textLabel = document.createElement("label");
        textLabel.className = "threshold-text-label";
        textLabel.textContent = q.textInputLabel;
        const inputWrap = document.createElement("div");
        inputWrap.className = "threshold-input-wrap";
        const dollarPrefix = document.createElement("span");
        dollarPrefix.className = "threshold-dollar";
        dollarPrefix.textContent = "$";
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.className = "threshold-text-input";
        textInput.placeholder = "e.g. 5,000 per year";
        textInput.value = tData[q.textInputKey] || "";
        textInput.addEventListener("input", () => {
          tData[q.textInputKey] = textInput.value;
          saveData();
        });
        inputWrap.appendChild(dollarPrefix);
        inputWrap.appendChild(textInput);
        body.appendChild(textLabel);
        body.appendChild(inputWrap);

        section.appendChild(body);
        container.appendChild(section);
        return;
      }

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

    appendFinishBanner(container, ROLES.costing.label, "costing");
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
    { key: "compliance", text: "Which of the following library services would help you satisfy grant compliance requirements? Select all that apply." },
    { key: "value",      text: "Which of the following library services directly impact your institution's research strategy? Select all that apply." },
    { key: "chargeable", text: "If there were an allocable, documented per project cost for this service, would you consider direct charging grants to keep the service sustainable for the institution? Select all that apply." }
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

    appendFinishBanner(container, ROLES.admin.label, "admin");
    updateAdminProgress();
  }

  function updateAdminProgress() {
    const { answered, total } = adminCompletion();
    document.getElementById("assessment-progress").textContent = `${answered} / ${total}`;
  }

  // ---------- INSTITUTION BANNER ----------
  function updateInstitutionBanner() {
    const banner = document.getElementById("institution-banner");
    const printName = document.getElementById("print-institution-name");
    if (currentInstitution) {
      banner.textContent = currentInstitution;
      banner.hidden = false;
      if (printName) printName.textContent = currentInstitution;
    } else {
      banner.hidden = true;
    }
  }

  // ---------- INSTITUTION MODAL ----------
  const institutionModal = document.getElementById("institution-modal");
  const institutionSelect = document.getElementById("institution-select");
  const modalUrlSection = document.getElementById("modal-url-section");
  const modalUrlInput = document.getElementById("modal-url-input");

  document.getElementById("open-institution-modal-btn").addEventListener("click", () => {
    // Pre-select current institution if one is set
    if (currentInstitution) institutionSelect.value = currentInstitution;
    modalUrlSection.hidden = true;
    institutionModal.hidden = false;
    document.body.classList.add("modal-open");
  });

  function closeModal() {
    institutionModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
  institutionModal.addEventListener("click", (e) => { if (e.target === institutionModal) closeModal(); });

  document.getElementById("modal-generate-btn").addEventListener("click", () => {
    const selected = institutionSelect.value;
    if (!selected) { institutionSelect.focus(); return; }
    currentInstitution = selected;
    localStorage.setItem(INSTITUTION_KEY, currentInstitution);
    updateInstitutionBanner();
    const url = window.location.href.split("#")[0] + "#institution=" + encodeURIComponent(currentInstitution);
    modalUrlInput.value = url;
    modalUrlSection.hidden = false;
  });

  document.getElementById("modal-copy-btn").addEventListener("click", async () => {
    const copied = document.getElementById("modal-copied");
    try { await navigator.clipboard.writeText(modalUrlInput.value); }
    catch (e) { modalUrlInput.select(); document.execCommand("copy"); }
    copied.hidden = false;
    setTimeout(() => { copied.hidden = true; }, 2500);
  });

  document.getElementById("modal-email-btn").addEventListener("click", (e) => {
    e.preventDefault();
    const url = modalUrlInput.value;
    const inst = currentInstitution;
    const subject = encodeURIComponent(`Research Services Readiness Assessment — ${inst}`);
    const body = encodeURIComponent(
      `Hi,\n\nI've created a Research Services Collaborative Readiness Assessment for ${inst}. ` +
      `Use this link to open the assessment with our institution name pre-loaded:\n\n${url}\n\nThanks!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });

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
    if (!a || a.offers !== true) return null;
    // For tracked services, only return answers once cost_tracking is set
    if (LIBRARY_TRACKED_IDS.has(itemId) && a.cost_tracking === undefined) return null;
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
    renderThresholdCard();
    renderLearnMoreOutcome();
    renderDetailVisual();
  }

  function renderThresholdCard() {
    const el = document.querySelector("#outcome-threshold .outcome-body");
    if (!el) return;
    const thresholdData = (DATA.costing || {})._threshold || {};
    const thresholdValue = thresholdData.threshold;
    const thresholdText = thresholdData.threshold_text || "";
    const thresholdLabels = { 2: "Yes", 1: "Depends", 0: "No" };
    if (thresholdValue === undefined) {
      el.innerHTML = `<p class="empty-note">Not yet answered — complete the Institutional Finance/Costing assessment to add this.</p>`;
      return;
    }
    const displayText = thresholdText ? ` &mdash; $${thresholdText}` : "";
    el.innerHTML = `<p class="threshold-result"><strong>${thresholdLabels[thresholdValue]}</strong>${displayText}</p>`;
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
      const adm = adminAnswers(item.id) || {};
      // Library can isolate cost + Admin values it + Costing open to direct charging
      const libScore = (lib.cost_tracking || 0);     // 0-2
      const admScore = (adm.value || 0);             // 0-2
      const costScore = (cost.costcenter || 0);      // 0-2
      const total = libScore + admScore + costScore; // max 6
      return { item, total };
    }).filter(Boolean).sort((a, b) => b.total - a.total);

    if (!ranked.length) {
      el.innerHTML = `<p class="empty-note">No services scored yet.</p>`;
      return;
    }

    el.innerHTML = `<ol class="outcome-list">` + ranked.slice(0, 8).map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name}</span>
        <span class="outcome-meter"><span class="outcome-meter-fill" style="width:${(r.total / 6) * 100}%;background:#52733E"></span></span>
        <span class="outcome-score">${r.total}/6</span>
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

    // Services library offers AND research admin values highly
    const alreadyStrong = libDone ? INVENTORY.filter((item) => {
      const admin = adminAnswers(item.id);
      const libA = (DATA.library || {})[item.id];
      if (!admin) return false;
      const libOffers = !libA ? null : libA.offers === true;
      return libOffers === true && admin.value === 2;
    }) : [];

    // Services admin values that the library does NOT currently offer
    const toExpand = INVENTORY.map((item) => {
      const admin = adminAnswers(item.id);
      if (!admin) return null;
      const libA = (DATA.library || {})[item.id];
      const libOffers = !libA ? null : libA.offers === true;
      if (libOffers === true) return null;
      const adminScore = admin.value + admin.compliance + admin.chargeable;
      return { item, adminScore };
    }).filter(Boolean).sort((a, b) => b.adminScore - a.adminScore);

    let html = "";

    if (alreadyStrong.length) {
      html += `<p class="expand-section-label expand-offered">Services Offered and Highly Valued by Research Administrators</p>
        <ul class="outcome-list">` +
        alreadyStrong.map((s) => `<li><span class="outcome-item-name">${s.name}</span></li>`).join("") +
        `</ul>`;
    }

    if (toExpand.length) {
      html += `<p class="expand-section-label expand-start" style="margin-top:${alreadyStrong.length ? "16px" : "0"}">Services to Expand or Start | Valued by Research Administration</p>
        <ol class="outcome-list">` +
        toExpand.slice(0, 8).map((r) => `
          <li>
            <span class="outcome-item-name">${r.item.name} <span class="tag tag-start">${libDone ? "Start" : "Unknown"}</span></span>
            <span class="outcome-meter"><span class="outcome-meter-fill" style="width:${(r.adminScore / 6) * 100}%;background:#52733E"></span></span>
            <span class="outcome-score">${r.adminScore}/6</span>
          </li>`).join("") +
        `</ol>`;
    }

    if (!html) {
      html = `<p class="empty-note">No data yet — check back once research administration has completed their section.</p>`;
    }

    el.innerHTML = html;
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
    const tagColors = { "Research Admin": ROLES.admin.color, "Costing": ROLES.costing.color };
    const legend = `<div class="outcome-legend">
      <span class="outcome-legend-item"><span class="learnmore-dot" style="background:${ROLES.admin.color}"></span>Research Admin</span>
      <span class="outcome-legend-item"><span class="learnmore-dot" style="background:${ROLES.costing.color}"></span>Finance/Costing</span>
    </div>`;
    el.innerHTML = legend + `<ul class="outcome-list">` + items.map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name}</span>
        ${r.tags.map((t) => `<span class="learnmore-dot" style="background:${tagColors[t]}" title="${t}"></span>`).join("")}
      </li>`).join("") + `</ul>`;
  }

  function renderQuickWinsOutcome() {
    const el = document.querySelector("#outcome-quickwins .outcome-body");
    if (!el) return;
    const allDone = libraryCompletion().answered > 0 && adminCompletion().answered > 0 && costingCompletion().answered > 0;
    if (!allDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from all three teams to identify quick wins.</p>`;
      return;
    }

    const wins = [], longterm = [];
    INVENTORY.forEach((item) => {
      const lib = (DATA.library || {})[item.id] || {};
      const adm = (DATA.admin || {})[item.id] || {};
      const cst = (DATA.costing || {})[item.id] || {};

      if (lib.offers !== true) return;

      // Quick win: library tracks cost + admin values it + costing already has a cost center
      const libTracks = (lib.cost_tracking || 0) >= 1;
      const adminValues = (adm.value || 0) === 2 && (adm.chargeable || 0) >= 1;
      const costReady = (cst.costcenter || 0) === 2;

      if (libTracks && adminValues && costReady) {
        wins.push(item);
      } else if ((adm.value || 0) === 2 && (!libTracks || !costReady)) {
        // Valued by admin but needs groundwork
        const gaps = [];
        if (!libTracks) gaps.push("cost tracking");
        if (!costReady) gaps.push("cost center");
        longterm.push({ item, gaps });
      }
    });

    if (!wins.length && !longterm.length) {
      el.innerHTML = `<p class="empty-note">Not enough data to classify services yet.</p>`;
      return;
    }

    let html = "";
    if (wins.length) {
      html += `<p class="qw-section-label qw-wins">Quick wins <span class="qw-count">${wins.length}</span></p>
        <ul class="outcome-list">` +
        wins.map((s) => `<li><span class="outcome-item-name">${s.name}</span></li>`).join("") +
        `</ul>`;
    }
    if (longterm.length) {
      html += `<p class="qw-section-label qw-longterm">Needs groundwork <span class="qw-count">${longterm.length}</span></p>
        <ul class="outcome-list">` +
        longterm.map((r) => `<li>
          <span class="outcome-item-name">${r.item.name}</span>
          <span class="qw-gap-tags">${r.gaps.map((g) => `<span class="tag tag-unknown">${g}</span>`).join("")}</span>
        </li>`).join("") +
        `</ul>`;
    }
    el.innerHTML = html;
  }

  function renderGapOutcome() {
    const el = document.querySelector("#outcome-gap .outcome-body");
    if (!el) return;
    const libDone = libraryCompletion().answered > 0;
    const adminDone = adminCompletion().answered > 0;
    const costDone = costingCompletion().answered > 0;

    if (!libDone || (!adminDone && !costDone)) {
      el.innerHTML = `<p class="empty-note">Needs Library answers plus at least one of Research Administration or Institutional Finance/Costing.</p>`;
      return;
    }

    const gaps = INVENTORY.filter((item) => {
      const lib = (DATA.library || {})[item.id] || {};
      if (lib.offers !== true) return false; // not offered — not a hidden investment
      const libAnswered = ["project_specific","usage_scope","researcher_request","cost_tracking"].some((k) => lib[k] !== undefined);
      if (!libAnswered) return false;

      const adm = (DATA.admin || {})[item.id] || {};
      const cst = (DATA.costing || {})[item.id] || {};
      // Admin doesn't recognise as chargeable AND costing doesn't have it in pool or cost center
      const adminNotCharging = adminDone && (adm.chargeable || 0) === 0;
      const costNotRecognised = costDone && (cst.idc || 0) === 0 && (cst.costcenter || 0) === 0;
      if (adminDone && costDone) return adminNotCharging && costNotRecognised;
      if (adminDone) return adminNotCharging;
      return costNotRecognised;
    });

    if (!gaps.length) {
      el.innerHTML = `<p class="empty-note">No invisible investments found — all offered services are recognized by research administration or costing.</p>`;
      return;
    }

    el.innerHTML = `<p class="gap-intro">Library offers these services but they are not currently recognized as billable or poolable by the other teams:</p>
      <ul class="outcome-list">` +
      gaps.map((item) => `<li><span class="outcome-item-name">${item.name}</span></li>`).join("") +
      `</ul>`;
  }

  const VALUE_COLOR = { 2: "#52733E", 1: "#C9941F", 0: "#E6394A" };

  function chip(value, label) {
    if (value === undefined) return `<span class="vchip vchip-empty" title="No answer yet">&middot;</span>`;
    if (value === 2) return `<span class="vchip-icon vchip-check" title="${label}">✓</span>`;
    if (value === 1) return `<span class="vchip-icon vchip-question" title="${label}">?</span>`;
    return `<span class="vchip-icon vchip-x" title="${label}">✕</span>`;
  }

  function learnMoreChip(itemId) {
    const a = (DATA.admin || {})[itemId];
    if (!a || !a.learnmore) return `<span class="vchip vchip-empty" title="Not flagged">&middot;</span>`;
    return `<span class="vchip" style="background:#52733E" title="Wants to learn more"></span>`;
  }

  // Alignment score: how many of the three teams signal this service is ready for cost discussion.
  // Library: offers it AND tracks cost (cost_tracking >= 1)
  // Admin: marks it essential (value=2) AND open to charging (chargeable >= 1)
  // Costing: has it in IDC pool OR has a cost center, AND no inconsistency flagged
  function alignmentScore(libA, adminA, costA, notOffered, itemId) {
    let score = 0;
    if (!notOffered) {
      // Non-tracked offered services count as library-ready (no question to answer)
      const tracked = itemId && LIBRARY_TRACKED_IDS.has(itemId);
      if (!tracked || (libA.cost_tracking || 0) >= 1) score++;
    }
    if ((adminA.value || 0) === 2 && (adminA.chargeable || 0) >= 1) score++;
    if ((costA.idc || 0) === 2 || (costA.costcenter || 0) === 2) score++;
    return score;
  }

  function alignmentBar(score, libA, adminA, costA, notOffered, itemId) {
    const tracked = itemId && LIBRARY_TRACKED_IDS.has(itemId);
    const libReady = !notOffered && (!tracked || (libA.cost_tracking || 0) >= 1);
    const adminReady = (adminA.value || 0) === 2 && (adminA.chargeable || 0) >= 1;
    const costReady = (costA.idc || 0) === 2 || (costA.costcenter || 0) === 2;

    const dotColor = score === 3 ? '#52733E' : score >= 1 ? '#C9941F' : '#d0d7df';

    const dot = (ready, roleLabel) =>
      `<span class="align-dot ${ready ? 'align-dot-on' : 'align-dot-off'}"
        style="${ready ? `background:${dotColor}` : ''}" title="${roleLabel}: ${ready ? 'interested' : 'not yet'}"></span>`;

    return `<div class="align-bar">
      ${dot(libReady, 'Library')}
      ${dot(adminReady, 'Research Admin')}
      ${dot(costReady, 'Finance/Costing')}
    </div>`;
  }

  function renderDetailVisual() {
    const el = document.getElementById("results-detail");
    const rows = INVENTORY.map((item) => {
      const libA = (DATA.library || {})[item.id] || {};
      const adminA = adminAnswers(item.id) || {};
      const costA = costAnswers(item.id) || {};
      const notOffered = libA.offers !== true;
      const score = alignmentScore(libA, adminA, costA, notOffered, item.id);
      return { item, libA, adminA, costA, notOffered, score };
    }).sort((a, b) => b.score - a.score); // highest alignment first

    el.innerHTML = `
      <h3>Full Detail by Service</h3>
      <p class="detail-intro">Each service is shown with its full description, how each team answered, and an alignment indicator showing which teams signal interest in exploring further. Services are sorted by the highest interest in exploring further.</p>

      <div class="detail-legend">
        <div class="detail-legend-section">
          <span class="detail-legend-title">Key</span>
          <span class="detail-legend-item"><span class="vchip-icon vchip-check">✓</span>Yes / good</span>
          <span class="detail-legend-item"><span class="vchip-icon vchip-question">?</span>Unsure / maybe</span>
          <span class="detail-legend-item"><span class="vchip-icon vchip-x">✕</span>No / caution</span>
          <span class="detail-legend-item"><span class="vchip vchip-empty">&middot;</span>Not yet answered</span>
        </div>
      </div>

      <div class="detail-rows">
        ${rows.map((r) => `
          <div class="detail-row detail-row-v2">
            <div class="detail-row-header">
              <div class="detail-row-title">
                <span class="detail-row-name-text">${r.item.name}</span>
                ${r.notOffered ? ' <span class="tag tag-unknown">Not offered</span>' : ''}
              </div>
            </div>
            <p class="detail-row-desc">${r.item.desc}</p>
            <div class="detail-row-groups">
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.library.color}">Library</span>
                ${r.notOffered
                  ? '<span class="detail-not-offered">Not offered</span>'
                  : LIBRARY_TRACKED_IDS.has(r.item.id)
                    ? `<div class="detail-q-list">
                        <span class="detail-not-offered">Offered</span>
                        <div class="detail-q-item">${chip(r.libA.cost_tracking, "Library tracks cost or effort per project")}<span>Library already tracks cost or effort per project</span></div>
                      </div>`
                    : '<span class="detail-not-offered">Offered — costs not easily tracked per individual researcher</span>'}
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.admin.color}">Research Admin</span>
                <div class="detail-q-list">
                  <div class="detail-q-item">${chip(r.adminA.compliance, "Helps satisfy grant compliance")}<span>Helps satisfy grant compliance requirements</span></div>
                  <div class="detail-q-item">${chip(r.adminA.value, "Essential to research strategy")}<span>Essential to the institution's research strategy</span></div>
                  <div class="detail-q-item">${chip(r.adminA.chargeable, "PIs open to direct charging")}<span>PIs open to direct charging grants to keep it sustainable</span></div>
                  <div class="detail-q-item">${learnMoreChip(r.item.id)}<span>Flagged: wants to learn more from the library</span></div>
                </div>
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.costing.color}">Finance/Costing</span>
                <div class="detail-q-list">
                  <div class="detail-q-item">${chip(r.costA.idc, "Cost recovered in indirect cost rate")}<span>Costs recovered in indirect cost rate</span></div>
                  <div class="detail-q-item">${chip(r.costA.costcenter, "Cost center available")}<span>Existing cost center available to direct charge departments or grants</span></div>
                  <div class="detail-q-item">${r.costA.learnmore ? `<span class="vchip" style="background:${ROLES.costing.color}" title="Wants to learn more"></span>` : `<span class="vchip vchip-empty">&middot;</span>`}<span>Flagged: wants to learn more from the library</span></div>
                </div>
              </div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // init
  updateInstitutionBanner();
  renderHomeProgress();
})();
