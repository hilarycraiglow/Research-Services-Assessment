(function () {
  "use strict";

  const STORAGE_KEY = "rsra-answers-v1";

  /** @type {{library: object, admin: object, costing: object}} */
  let DATA = loadData();

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

  function showView(name) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    document.querySelectorAll(".nav-link").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    if (name === "results") renderResults();
    if (name === "home") renderHomeProgress();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.getElementById("topnav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-link");
    if (btn) showView(btn.dataset.view);
  });

  document.getElementById("back-home").addEventListener("click", () => showView("home"));

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
  function openAssessment(roleId) {
    const role = ROLES[roleId];
    document.getElementById("assessment-role-title").textContent = `${role.label} assessment`;
    document.getElementById("assessment-role-sub").textContent = role.subtitle;
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
    const answers = DATA[roleId][item.id] || {};

    const card = document.createElement("article");
    card.className = "item-card";

    const title = document.createElement("div");
    title.className = "item-title";
    title.innerHTML = `<h4>${item.name}</h4><p>${item.desc}</p>`;
    card.appendChild(title);

    const qWrap = document.createElement("div");
    qWrap.className = "question-wrap";

    role.questions.forEach((q) => {
      const qEl = document.createElement("div");
      qEl.className = "question";
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
        optBtn.style.setProperty("--role-color", role.color);
        optBtn.addEventListener("click", () => {
          DATA[roleId][item.id] = DATA[roleId][item.id] || {};
          DATA[roleId][item.id][q.key] = opt.value;
          saveData();
          optWrap.querySelectorAll(".opt-btn").forEach((b) => b.classList.remove("selected"));
          optBtn.classList.add("selected");
          updateAssessmentProgress(roleId);
        });
        optWrap.appendChild(optBtn);
      });
      qEl.appendChild(optWrap);
      qWrap.appendChild(qEl);
    });

    card.appendChild(qWrap);
    return card;
  }

  function updateAssessmentProgress(roleId) {
    const { answered, total } = roleCompletion(roleId);
    document.getElementById("assessment-progress").textContent = `${answered} / ${total}`;
  }

  // ---------- EXPORT / IMPORT ----------
  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-services-assessment-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

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
    renderDetailTable();
  }

  function renderTransparencyOutcome() {
    const el = document.querySelector("#outcome-transparency .outcome-body");
    const libDone = roleCompletion("library").answered > 0;
    const costDone = roleCompletion("costing").answered > 0;

    if (!libDone || !costDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from both <strong>Library</strong> and <strong>University Costing</strong> to calculate. Import their results to continue.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const lib = itemRoleScore("library", item.id);
      const cost = itemRoleScore("costing", item.id);
      if (!lib || !cost) return null;
      if (lib.offer === 0) return null; // not offered yet, can't model transparency on it
      const trackingScore = lib.isolate + lib.demonstrate; // 0-4
      const appetiteScore = cost.direct + (2 - cost.fa); // already-not-in-FA + wants direct charging, 0-4
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
      el.innerHTML = `<p class="empty-note">Needs answers from <strong>Research Administration</strong> to calculate. Import their results to continue.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const admin = itemRoleScore("admin", item.id);
      if (!admin) return null;
      const lib = itemRoleScore("library", item.id);
      const offerLevel = lib ? lib.offer : null;
      if (offerLevel === 2) return null; // already fully offered, not a start/expand candidate
      const adminScore = admin.value + admin.compliance + admin.chargeable; // 0-6
      const status = !libDone ? "Unknown" : offerLevel === 1 ? "Expand" : "Start";
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

  function renderDetailTable() {
    const el = document.getElementById("results-detail");
    const rows = INVENTORY.map((item) => {
      const lib = itemRoleScore("library", item.id);
      const admin = itemRoleScore("admin", item.id);
      const cost = itemRoleScore("costing", item.id);
      return { item, lib, admin, cost };
    });

    el.innerHTML = `
      <h3>Full detail by service</h3>
      <div class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Library: offer / isolate / demonstrate</th>
            <th>Admin: value / compliance / chargeable</th>
            <th>Costing: cost center / in F&amp;A / direct?</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.item.name}</td>
              <td>${r.lib ? `${r.lib.offer}/${r.lib.isolate}/${r.lib.demonstrate}` : "&mdash;"}</td>
              <td>${r.admin ? `${r.admin.value}/${r.admin.compliance}/${r.admin.chargeable}` : "&mdash;"}</td>
              <td>${r.cost ? `${r.cost.costcenter}/${r.cost.fa}/${r.cost.direct}` : "&mdash;"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      </div>`;
  }

  // init
  renderHomeProgress();
})();
