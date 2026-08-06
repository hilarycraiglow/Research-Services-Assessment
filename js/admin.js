(function () {
  "use strict";

  // ---- Configuration ----
  // Change ADMIN_PIN to set your admin password
  const ADMIN_PIN = "attain2025";
  const ADMIN_KEY = "rsra-admin-institutions-v1";
  const AUTH_KEY  = "rsra-admin-authed";

  // Services that show the cost_tracking question in the Library assessment
  const LIBRARY_TRACKED_IDS = new Set([
    "evidence-synthesis", "digitization", "data-management-planning", "data-repositories",
    "computational-storage", "data-curation", "code-hosting", "code-training",
    "processing-charges", "publishing-services", "communication-guidance",
    "grant-compliance", "research-authorship", "data-security", "data-preservation"
  ]);

  // ---- Storage ----
  let institutions = {}; // { [name]: { library, admin, costing, importedAt } }

  function loadInstitutions() {
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      if (raw) institutions = JSON.parse(raw);
    } catch (e) {}
  }

  function saveInstitutions() {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(institutions));
  }

  // ---- Auth ----
  function isAuthed() {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  }

  function grantAuth() {
    sessionStorage.setItem(AUTH_KEY, "1");
  }

  function checkUrlKey() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("key") === ADMIN_PIN) grantAuth();
  }

  // ---- Completion helpers (mirror app.js logic, take explicit data param) ----
  function libraryCompletion(data) {
    const answers = (data && data.library) || {};
    let answered = 0;
    INVENTORY.forEach((item) => {
      const a = answers[item.id];
      if (!a || a.offers !== true) { answered++; return; }
      if (!LIBRARY_TRACKED_IDS.has(item.id)) { answered++; return; }
      if (a.cost_tracking !== undefined) answered++;
    });
    return { answered, total: INVENTORY.length };
  }

  function adminCompletion(data) {
    const answers = (data && data.admin) || {};
    const initialized = INVENTORY.filter((item) => answers[item.id] !== undefined).length;
    return { answered: initialized, total: INVENTORY.length };
  }

  function costingCompletion(data) {
    const answers = (data && data.costing) || {};
    const initialized = INVENTORY.filter((item) => answers[item.id] !== undefined).length;
    return { answered: initialized, total: INVENTORY.length };
  }

  // ---- Answer helpers ----
  function libAnswers(data, itemId) {
    const a = ((data && data.library) || {})[itemId];
    if (!a || a.offers !== true) return null;
    if (LIBRARY_TRACKED_IDS.has(itemId) && a.cost_tracking === undefined) return null;
    return a;
  }

  function adminAnswers(data, itemId) {
    const a = ((data && data.admin) || {})[itemId];
    if (!a) return null;
    if (a.value === undefined || a.compliance === undefined || a.chargeable === undefined) return null;
    return a;
  }

  function costAnswers(data, itemId) {
    return ((data && data.costing) || {})[itemId] || null;
  }

  // ---- Chip icons ----
  const VALUE_COLOR = { 2: "#52733E", 1: "#C9941F", 0: "#E6394A" };

  function chip(value, label) {
    if (value === undefined) return `<span class="vchip vchip-empty" title="No answer yet">&middot;</span>`;
    if (value === 2) return `<span class="vchip-icon vchip-check" title="${label}">✓</span>`;
    if (value === 1) return `<span class="vchip-icon vchip-question" title="${label}">?</span>`;
    return `<span class="vchip-icon vchip-x" title="${label}">✕</span>`;
  }

  function learnMoreChip(data, itemId) {
    const a = ((data && data.admin) || {})[itemId];
    if (!a || !a.learnmore) return `<span class="vchip vchip-empty" title="Not flagged">&middot;</span>`;
    return `<span class="vchip-icon vchip-check" title="Wants to learn more">✓</span>`;
  }

  // ---- Alignment ----
  function alignmentScore(libA, adminA, costA, notOffered, itemId) {
    let score = 0;
    if (!notOffered) {
      const tracked = itemId && LIBRARY_TRACKED_IDS.has(itemId);
      if (!tracked || (libA.cost_tracking || 0) >= 1) score++;
    }
    if ((adminA.value || 0) === 2 && (adminA.chargeable || 0) >= 1) score++;
    if ((costA.idc || 0) === 2 || (costA.costcenter || 0) === 2) score++;
    return score;
  }

  function alignmentBar(score, libA, adminA, costA, notOffered, itemId) {
    const tracked = itemId && LIBRARY_TRACKED_IDS.has(itemId);
    const libReady  = !notOffered && (!tracked || (libA.cost_tracking || 0) >= 1);
    const adminReady = (adminA.value || 0) === 2 && (adminA.chargeable || 0) >= 1;
    const costReady  = (costA.idc || 0) === 2 || (costA.costcenter || 0) === 2;
    const dotColor = score === 3 ? "#52733E" : score >= 1 ? "#C9941F" : "#d0d7df";
    const dot = (ready, roleLabel) =>
      `<span class="align-dot ${ready ? "align-dot-on" : "align-dot-off"}"
        style="${ready ? `background:${dotColor}` : ""}" title="${roleLabel}: ${ready ? "interested" : "not yet"}"></span>`;
    return `<div class="align-bar">
      ${dot(libReady, "Library")}
      ${dot(adminReady, "Research Admin")}
      ${dot(costReady, "Finance/Costing")}
    </div>`;
  }

  // ---- Outcome rendering (all take data param) ----
  function renderExpandOutcome(el, data) {
    const adminDone = adminCompletion(data).answered > 0;
    const libDone   = libraryCompletion(data).answered > 0;

    if (!adminDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from <strong>Research Administration</strong> to calculate.</p>`;
      return;
    }

    const alreadyStrong = libDone ? INVENTORY.filter((item) => {
      const admin = adminAnswers(data, item.id);
      const libA  = ((data && data.library) || {})[item.id];
      if (!admin) return false;
      return libA && libA.offers === true && admin.value === 2;
    }) : [];

    const toExpand = INVENTORY.map((item) => {
      const admin = adminAnswers(data, item.id);
      if (!admin) return null;
      const libA = ((data && data.library) || {})[item.id];
      const libOffers = libA && libA.offers === true;
      if (libOffers) return null;
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
    if (!html) html = `<p class="empty-note">No data yet.</p>`;
    el.innerHTML = html;
  }

  function renderTransparencyOutcome(el, data) {
    const libDone  = libraryCompletion(data).answered > 0;
    const costDone = costingCompletion(data).answered > 0;

    if (!libDone || !costDone) {
      el.innerHTML = `<p class="empty-note">Needs answers from both <strong>Library</strong> and <strong>Institutional Finance/Costing</strong> to calculate.</p>`;
      return;
    }

    const ranked = INVENTORY.map((item) => {
      const lib  = libAnswers(data, item.id);
      const cost = costAnswers(data, item.id);
      if (!lib || !cost) return null;
      const adm = adminAnswers(data, item.id) || {};
      const total = (lib.cost_tracking || 0) + (adm.value || 0) + (cost.costcenter || 0);
      return { item, total };
    }).filter(Boolean).sort((a, b) => b.total - a.total);

    if (!ranked.length) { el.innerHTML = `<p class="empty-note">No services scored yet.</p>`; return; }

    el.innerHTML = `<ol class="outcome-list">` + ranked.slice(0, 8).map((r) => `
      <li>
        <span class="outcome-item-name">${r.item.name}</span>
        <span class="outcome-meter"><span class="outcome-meter-fill" style="width:${(r.total / 6) * 100}%;background:#52733E"></span></span>
        <span class="outcome-score">${r.total}/6</span>
      </li>`).join("") + `</ol>`;
  }

  function renderThresholdCard(el, data) {
    const thresholdData  = ((data && data.costing) || {})._threshold || {};
    const thresholdValue = thresholdData.threshold;
    const thresholdText  = thresholdData.threshold_text || "";
    const labels = { 2: "Yes", 1: "Depends", 0: "No" };
    if (thresholdValue === undefined) {
      el.innerHTML = `<p class="empty-note">Not yet answered — complete the Institutional Finance/Costing assessment to add this.</p>`;
      return;
    }
    const displayText = thresholdText ? ` &mdash; $${thresholdText}` : "";
    el.innerHTML = `<p class="threshold-result"><strong>${labels[thresholdValue]}</strong>${displayText}</p>`;
  }

  function renderLearnMoreOutcome(el, data) {
    const items = INVENTORY.map((item) => {
      const adminFlag = !!((data && data.admin || {})[item.id] || {}).learnmore;
      const costFlag  = !!((data && data.costing || {})[item.id] || {}).learnmore;
      if (!adminFlag && !costFlag) return null;
      const tags = [];
      if (adminFlag) tags.push("Research Admin");
      if (costFlag)  tags.push("Costing");
      return { item, tags };
    }).filter(Boolean);

    if (!items.length) {
      el.innerHTML = `<p class="empty-note">No services flagged yet.</p>`;
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

  function renderDetailVisual(el, data) {
    const rows = INVENTORY.map((item) => {
      const libA   = ((data && data.library) || {})[item.id] || {};
      const adminA = adminAnswers(data, item.id) || {};
      const costA  = costAnswers(data, item.id) || {};
      const notOffered = libA.offers !== true;
      const score = alignmentScore(libA, adminA, costA, notOffered, item.id);
      return { item, libA, adminA, costA, notOffered, score };
    }).sort((a, b) => b.score - a.score);

    el.innerHTML = `
      <h3>Full Detail by Service</h3>
      <p class="detail-intro">Services are sorted by the highest interest in exploring further.</p>

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
                ${r.notOffered ? ' <span class="tag tag-unknown">Not offered</span>' : ""}
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
                  <div class="detail-q-item">${chip(r.adminA.chargeable, "Open to direct charging")}<span>Open to direct charging grants to keep it sustainable</span></div>
                  <div class="detail-q-item">${learnMoreChip(data, r.item.id)}<span>Flagged: wants to learn more from the library</span></div>
                </div>
              </div>
              <div class="detail-group">
                <span class="detail-group-label" style="color:${ROLES.costing.color}">Finance/Costing</span>
                <div class="detail-q-list">
                  <div class="detail-q-item">${chip(r.costA.idc, "Cost recovered in indirect cost rate")}<span>Costs recovered in indirect cost rate</span></div>
                  <div class="detail-q-item">${chip(r.costA.costcenter, "Cost center available")}<span>Existing cost center available to direct charge departments or grants</span></div>
                  <div class="detail-q-item">${r.costA.learnmore ? `<span class="vchip-icon vchip-check" title="Wants to learn more">✓</span>` : `<span class="vchip vchip-empty">&middot;</span>`}<span>Flagged: wants to learn more from the library</span></div>
                </div>
              </div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // ---- Import ----
  function parseShareLink(url) {
    const hash = (url.split("#")[1] || "");
    const instMatch  = hash.match(/(?:^|&)institution=([^&]+)/);
    const shareMatch = hash.match(/(?:^|&)share=(.+?)(?:&institution=|$)/);
    const institution = instMatch ? decodeURIComponent(instMatch[1].replace(/\+/g, " ")) : null;
    let data = null;
    if (shareMatch) {
      try { data = JSON.parse(decodeURIComponent(escape(atob(shareMatch[1])))); } catch (e) {}
    }
    return { institution, data };
  }

  function mergeInstitutionData(name, incoming) {
    const existing = institutions[name] || {};
    ROLE_ORDER.forEach((roleId) => {
      if (incoming[roleId]) {
        existing[roleId] = Object.assign({}, existing[roleId] || {}, incoming[roleId]);
      }
    });
    existing.importedAt = Date.now();
    institutions[name] = existing;
    saveInstitutions();
  }

  function showImportMsg(text, ok) {
    const el = document.getElementById("import-msg");
    el.textContent = text;
    el.className = "import-msg " + (ok ? "import-msg-ok" : "import-msg-err");
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 4000);
  }

  // ---- Dashboard ----
  function formatDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function progRow(labelText, completion, color) {
    const pct = Math.round((completion.answered / completion.total) * 100);
    return `<div class="inst-prog-row">
      <span class="inst-prog-label">${labelText}</span>
      <span class="inst-prog-track"><span class="inst-prog-fill" style="width:${pct}%;background:${color}"></span></span>
      <span class="inst-prog-count">${completion.answered}/${completion.total}</span>
    </div>`;
  }

  function renderStatusPanel(name) {
    const panel = document.getElementById("inst-status-panel");
    if (!name || !institutions[name]) { panel.hidden = true; return; }

    const data = institutions[name];
    const libC = libraryCompletion(data);
    const admC = adminCompletion(data);
    const cstC = costingCompletion(data);

    panel.hidden = false;
    panel.innerHTML = `
      <div class="inst-status-card">
        <div class="inst-status-header">
          <div>
            <p class="inst-card-name">${name}</p>
            <p class="inst-card-date">Last updated: ${formatDate(data.importedAt)}</p>
          </div>
        </div>
        <div class="inst-progress-rows">
          ${progRow("Library", libC, ROLES.library.color)}
          ${progRow("Research Admin", admC, ROLES.admin.color)}
          ${progRow("Finance/Costing", cstC, ROLES.costing.color)}
        </div>
        <div class="inst-status-actions">
          <button class="btn btn-primary" id="status-view-btn">View Outcomes &rarr;</button>
          <button class="btn btn-secondary" id="status-clear-btn">Clear Assessment</button>
        </div>
      </div>`;

    panel.querySelector("#status-view-btn").addEventListener("click", () => openOutcomes(name));
    panel.querySelector("#status-clear-btn").addEventListener("click", () => {
      if (confirm(`Clear all assessment data for "${name}"? This cannot be undone.`)) {
        institutions[name] = { importedAt: Date.now() };
        saveInstitutions();
        // Also clear per-institution localStorage key (same device)
        try { localStorage.removeItem("rsra-answers-v1-" + name); } catch (e) {}
        renderStatusPanel(name);
      }
    });
  }

  function renderDashboard() {
    const select = document.getElementById("inst-select");
    const label  = document.getElementById("inst-count-label");
    const names  = Object.keys(institutions).sort();

    // Preserve current selection if still valid
    const prev = select.value;

    // Rebuild options
    select.innerHTML = `<option value="">— Select an institution —</option>` +
      names.map((n) => `<option value="${n}">${n}</option>`).join("");

    label.textContent = names.length
      ? `${names.length} institution${names.length !== 1 ? "s" : ""}`
      : "Institutions";

    if (prev && institutions[prev]) {
      select.value = prev;
      renderStatusPanel(prev);
    } else {
      renderStatusPanel(null);
    }
  }

  // ---- Outcomes view ----
  let currentOutcomesName = null;

  function openOutcomes(name) {
    currentOutcomesName = name;
    const data = institutions[name];

    document.getElementById("admin-app").hidden    = true;
    document.getElementById("outcomes-view").hidden = false;
    document.getElementById("outcomes-inst-name").textContent = name;

    const libC  = libraryCompletion(data);
    const admC  = adminCompletion(data);
    const cstC  = costingCompletion(data);
    const parts = [];
    if (libC.answered  === libC.total)  parts.push("Library complete");
    if (admC.answered  === admC.total)  parts.push("Research Admin complete");
    if (cstC.answered  === cstC.total)  parts.push("Finance/Costing complete");
    const remaining = 3 - parts.length;
    document.getElementById("outcomes-inst-sub").textContent =
      remaining === 0 ? "All three assessments complete" :
      `${remaining} assessment${remaining !== 1 ? "s" : ""} still in progress`;

    renderExpandOutcome      (document.querySelector("#oc-expand .outcome-body"),       data);
    renderTransparencyOutcome(document.querySelector("#oc-transparency .outcome-body"), data);
    renderThresholdCard      (document.querySelector("#oc-threshold .outcome-body"),    data);
    renderLearnMoreOutcome   (document.querySelector("#oc-learnmore .outcome-body"),    data);
    renderDetailVisual       (document.getElementById("oc-detail"),                     data);

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function closeOutcomes() {
    currentOutcomesName = null;
    document.getElementById("outcomes-view").hidden = true;
    document.getElementById("admin-app").hidden     = false;
  }

  // ---- Init ----
  loadInstitutions();
  checkUrlKey();

  const gate     = document.getElementById("gate");
  const adminApp = document.getElementById("admin-app");
  const pinInput = document.getElementById("pin-input");
  const pinError = document.getElementById("pin-error");

  function showDashboard() {
    gate.hidden     = true;
    adminApp.hidden = false;
    renderDashboard();
  }

  function tryPin() {
    if (pinInput.value === ADMIN_PIN) {
      grantAuth();
      showDashboard();
    } else {
      pinError.hidden = false;
      pinInput.select();
    }
  }

  if (isAuthed()) {
    showDashboard();
  } else {
    gate.hidden = false;
    document.getElementById("pin-btn").addEventListener("click", tryPin);
    pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryPin(); });
  }

  // Institution dropdown
  document.getElementById("inst-select").addEventListener("change", (e) => {
    renderStatusPanel(e.target.value);
  });

  // Import: share link
  document.getElementById("import-url-btn").addEventListener("click", () => {
    const url  = document.getElementById("import-url").value.trim();
    const name = document.getElementById("import-name").value.trim();
    if (!url) { showImportMsg("Paste a share link first.", false); return; }

    const { institution, data } = parseShareLink(url);
    const finalName = name || institution;

    if (!finalName) {
      showImportMsg("Could not detect institution name from the link — enter it in the name field.", false);
      return;
    }
    if (!data) {
      showImportMsg("Could not read assessment data from that link. Check that you pasted the full URL.", false);
      return;
    }

    mergeInstitutionData(finalName, data);
    document.getElementById("import-url").value  = "";
    document.getElementById("import-name").value = "";
    showImportMsg(`Imported data for "${finalName}" successfully.`, true);
    renderDashboard();
  });

  // Import: JSON file
  const fileInput = document.getElementById("import-file");

  document.getElementById("import-file-btn").addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = document.getElementById("import-file-name").value.trim();
    if (!name) { showImportMsg("Enter an institution name before uploading.", false); fileInput.value = ""; return; }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        mergeInstitutionData(name, incoming);
        document.getElementById("import-file-name").value = "";
        showImportMsg(`Imported JSON for "${name}" successfully.`, true);
        renderDashboard();
      } catch (err) {
        showImportMsg("That file could not be read as a valid assessment export.", false);
      }
      fileInput.value = "";
    };
    reader.readAsText(file);
  });

  // Outcomes nav
  document.getElementById("outcomes-back").addEventListener("click", closeOutcomes);
  document.getElementById("outcomes-print-btn").addEventListener("click", () => window.print());

})();
