(() => {
  "use strict";

  const severity = {
    critical: { label: "\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e01\u0e49\u0e01\u0e48\u0e2d\u0e19", className: "bg-danger-subtle text-danger-emphasis border-danger-subtle" },
    warning: { label: "\u0e04\u0e27\u0e23\u0e1b\u0e23\u0e31\u0e1a", className: "bg-warning-subtle text-warning-emphasis border-warning-subtle" },
    review: { label: "\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19", className: "bg-info-subtle text-info-emphasis border-info-subtle" },
    pass: { label: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32", className: "bg-success-subtle text-success-emphasis border-success-subtle" }
  };
  const categories = {
    index: "\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32 index", onpage: "\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1a\u0e19\u0e2b\u0e19\u0e49\u0e32", links: "\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19",
    sitemap: "Sitemap", images: "\u0e23\u0e39\u0e1b\u0e20\u0e32\u0e1e", render: "JavaScript"
  };

  const issues = [];
  const pages = [];
  const state = { origin: null, page: 1, selectedIssue: null, report: null, busy: false };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const icon = (name, size = 18) => '<i data-lucide="' + name + '" width="' + size + '" height="' + size + '" aria-hidden="true"></i>';
  const urlFor = (path) => new URL(path, state.origin).href;
  const codeFor = (code) => code.replaceAll("{origin}", state.origin);
  const badge = (level) => '<span class="badge border rounded-1 fw-normal ' + severity[level].className + '">' + severity[level].label + "</span>";
  const drawerElement = byId("issue-drawer");
  const drawer = bootstrap.Offcanvas.getOrCreateInstance(drawerElement);
  let drawerTrigger = null;

  function activateControls(root = document) {
    window.lucide?.createIcons({ root, attrs: { "stroke-width": 1.8 } });
    root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
      bootstrap.Tooltip.getOrCreateInstance(element, { trigger: "hover focus" });
    });
  }

  function replaceContent(element, html) {
    element.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((button) => {
      bootstrap.Tooltip.getInstance(button)?.dispose();
    });
    element.innerHTML = html;
    activateControls(element);
  }

  function detailButton(attribute, value, label) {
    return '<button type="button" class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-2 text-nowrap" ' +
      attribute + '="' + escapeHtml(value) + '" aria-label="' + escapeHtml(label) +
      '" title="' + escapeHtml(label) + '" data-bs-toggle="tooltip">' +
      icon("chevron-right") + '<span class="d-none d-lg-inline">\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14</span></button>';
  }

  function pageIssues(path) {
    return issues.filter((issue) => issue.paths.includes(path));
  }

  function pageLevel(path) {
    const matches = pageIssues(path);
    return ["critical", "warning", "review"].find((level) => matches.some((issue) => issue.severity === level)) || "pass";
  }

  function filteredIssues() {
    if (!state.origin) return [];
    const level = byId("severity-filter").value;
    const category = byId("category-filter").value;
    const query = byId("issue-search").value.trim().toLocaleLowerCase();
    return issues.filter((issue) => {
      const searchable = [issue.title, issue.id, categories[issue.category], ...issue.paths.map(urlFor)].join(" ").toLocaleLowerCase();
      return (level === "all" || issue.severity === level) &&
        (category === "all" || issue.category === category) && searchable.includes(query);
    });
  }

  function renderIssues() {
    const visible = filteredIssues();
    replaceContent(byId("issue-rows"), visible.map((issue) => (
      '<tr><td class="align-top">' + badge(issue.severity) + '</td><td>' +
      '<p class="fw-medium small mb-1">' + escapeHtml(issue.title) + "</p>" +
      '<p class="small mb-0 text-break">' + escapeHtml(categories[issue.category]) + " &middot; " +
      escapeHtml(issue.paths[0]) + (issue.paths.length > 1 ? " \u0e41\u0e25\u0e30\u0e2d\u0e35\u0e01 " + (issue.paths.length - 1) + " \u0e2b\u0e19\u0e49\u0e32" : "") +
      '</p></td><td class="small text-nowrap d-none d-sm-table-cell">' + issue.paths.length + " \u0e2b\u0e19\u0e49\u0e32</td>" +
      '<td class="text-end">' + detailButton("data-issue-id", issue.id, "\u0e14\u0e39\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49: " + issue.title) + "</td></tr>"
    )).join(""));
    byId("issue-count").textContent = "(" + issues.length + ")";
    byId("issue-empty").classList.toggle("d-none", visible.length > 0);
    byId("issue-result-status").textContent = "\u0e41\u0e2a\u0e14\u0e07 " + visible.length + " \u0e08\u0e32\u0e01 " + issues.length + " \u0e1b\u0e31\u0e0d\u0e2b\u0e32";
    byId("export-button").disabled = visible.length === 0;
  }

  function renderPages() {
    const level = byId("page-filter").value;
    const query = byId("page-search").value.trim().toLocaleLowerCase();
    const visible = pages.filter((page) => (
      (level === "all" || pageLevel(page.path) === level) &&
      (urlFor(page.path) + " " + page.title).toLocaleLowerCase().includes(query)
    ));
    const pageCount = Math.max(1, Math.ceil(visible.length / 10));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * 10;
    const slice = visible.slice(start, start + 10);
    replaceContent(byId("page-rows"), slice.map((page) => (
      '<tr><td><p class="small fw-medium text-break mb-1">' + escapeHtml(page.path) +
      '</p><p class="small mb-0 text-break">' + escapeHtml(page.title) +
      '</p></td><td><span class="badge rounded-1 fw-normal ' +
      (page.status === 200 ? "bg-success-subtle text-success-emphasis" : "bg-danger-subtle text-danger-emphasis") +
      '">' + page.status + "</span></td><td>" + badge(pageLevel(page.path)) +
      '</td><td class="text-end">' + detailButton("data-page-path", page.path, "\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2b\u0e19\u0e49\u0e32 " + page.path) + "</td></tr>"
    )).join(""));
    byId("page-empty").classList.toggle("d-none", visible.length > 0);
    byId("page-result-status").textContent = visible.length ?
      "\u0e41\u0e2a\u0e14\u0e07 " + (start + 1) + "-" + (start + slice.length) + " \u0e08\u0e32\u0e01 " + visible.length + " \u0e2b\u0e19\u0e49\u0e32" : "\u0e41\u0e2a\u0e14\u0e07 0 \u0e2b\u0e19\u0e49\u0e32";
    byId("pages-pager").textContent = visible.length ? state.page + " / " + pageCount : "0 / 0";
    byId("pages-prev").disabled = state.page === 1 || visible.length === 0;
    byId("pages-next").disabled = state.page === pageCount || visible.length === 0;
  }

  function renderSummary() {
    byId("summary-pages").textContent = pages.length;
    ["critical", "warning", "review"].forEach((level) => {
      byId("summary-" + level).textContent = issues.filter((issue) => issue.severity === level).length;
    });
    const affected = pages.filter((page) => pageIssues(page.path).length > 0).length;
    byId("affected-summary").textContent = "\u0e1e\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e01\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e43\u0e19 " + affected + " \u0e08\u0e32\u0e01 " + pages.length +
      " \u0e2b\u0e19\u0e49\u0e32 \u0e2d\u0e35\u0e01 " + (pages.length - affected) + " \u0e2b\u0e19\u0e49\u0e32\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08";
    byId("report-host").textContent = new URL(state.origin).hostname;
  }

  function openDrawer(title, content, trigger) {
    if (!drawerElement.classList.contains("show") && !drawerElement.classList.contains("showing")) {
      drawerTrigger = trigger;
    }
    bootstrap.Tooltip.getInstance(trigger)?.hide();
    byId("detail-title").textContent = title;
    replaceContent(byId("detail-content"), content);
    drawer.show(trigger);
  }

  function openIssue(id, trigger) {
    const issue = issues.find((item) => item.id === id);
    if (!issue) return;
    state.selectedIssue = issue;
    const samplePath = issue.samplePath || issue.paths[0];
    openDrawer(issue.title,
      '<div class="d-flex align-items-center flex-wrap gap-2 mb-4">' + badge(issue.severity) +
      '<span class="small">' + escapeHtml(categories[issue.category]) + " &middot; " + issue.paths.length + " \u0e2b\u0e19\u0e49\u0e32</span></div>" +
      '<section class="mb-4"><h3 class="h6">\u0e1e\u0e1a\u0e2d\u0e30\u0e44\u0e23</h3><p class="small text-break mb-0">' + escapeHtml(issue.found) + "</p></section>" +
      '<section class="mb-4"><h3 class="h6">\u0e01\u0e23\u0e30\u0e17\u0e1a\u0e2d\u0e30\u0e44\u0e23</h3><p class="small mb-0">' + escapeHtml(issue.impact) + "</p></section>" +
      '<section class="mb-4"><h3 class="h6">\u0e41\u0e01\u0e49\u0e15\u0e23\u0e07\u0e44\u0e2b\u0e19</h3><p class="small text-break">' + escapeHtml(issue.location) +
      '</p><ol class="small ps-3 mb-0">' + issue.steps.map((step) => '<li class="mb-2">' + escapeHtml(step) + "</li>").join("") + "</ol></section>" +
      '<section class="mb-4"><h3 class="h6">\u0e42\u0e04\u0e49\u0e14\u0e17\u0e35\u0e48\u0e1e\u0e1a</h3><pre class="bg-dark text-light p-3 rounded-1 small overflow-auto mb-0"><code>' +
      escapeHtml(codeFor(issue.before)) + "</code></pre></section>" +
      '<section class="mb-4"><div class="d-flex justify-content-between align-items-center gap-2 mb-2"><h3 class="h6 mb-0">\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e2b\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49</h3>' +
      '<button type="button" class="btn btn-sm btn-outline-success" id="copy-fix" aria-label="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e42\u0e04\u0e49\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" title="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e42\u0e04\u0e49\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" data-bs-toggle="tooltip">' +
      icon("copy", 16) + '</button></div><p class="small text-break mb-2">' + escapeHtml(samplePath) +
      '</p><pre class="bg-dark text-light p-3 rounded-1 small overflow-auto mb-0"><code>' +
      escapeHtml(codeFor(issue.after)) + '</code></pre><p class="small text-success-emphasis mt-2 mb-0" id="copy-status" role="status" aria-live="polite"></p></section>' +
      '<section class="mb-4"><h3 class="h6">\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e1e\u0e1a</h3><ul class="list-unstyled small mb-0">' +
      issue.paths.map((path) => '<li class="mb-2"><button type="button" class="btn btn-link text-primary-emphasis text-decoration-none text-start text-break p-0 small" data-page-path="' +
        escapeHtml(path) + '">' + escapeHtml(urlFor(path)) + "</button></li>").join("") +
      '</ul></section><a class="small text-success-emphasis d-inline-flex align-items-center gap-2" href="' + issue.doc +
      '" target="_blank" rel="noopener noreferrer">\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49' + icon("external-link", 14) + "</a>",
      trigger);
  }

  function openPage(path, trigger) {
    const page = pages.find((item) => item.path === path);
    if (!page) return;
    state.selectedIssue = null;
    const related = pageIssues(path);
    const html = page.status === 404 ? "HTTP/1.1 404 Not Found" :
      "<head>\n  <title>" + page.title + "</title>\n" +
      (page.noindex ? '  <meta name="robots" content="noindex, follow">\n' : "") +
      '  <link rel="canonical" href="' + urlFor(page.canonical) + '">\n</head>';
    openDrawer("\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2b\u0e19\u0e49\u0e32",
      '<p class="small text-break mb-3">' + escapeHtml(urlFor(path)) + '</p><div class="mb-4">' + badge(pageLevel(path)) + "</div>" +
      '<dl class="small"><dt>HTTP Status</dt><dd class="mb-3">' + page.status +
      '</dd><dt>Title</dt><dd class="mb-3 text-break">' + escapeHtml(page.title) +
      '</dd><dt>Canonical \u0e17\u0e35\u0e48\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28</dt><dd class="mb-3 text-break">' + (page.status === 200 ? escapeHtml(urlFor(page.canonical)) : "\u0e44\u0e21\u0e48\u0e21\u0e35 HTML \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e44\u0e14\u0e49") +
      '</dd><dt>\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07 noindex</dt><dd class="mb-3">' + (page.status === 404 ? "\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49\u0e15\u0e2d\u0e1a 404" : page.noindex ? "\u0e1e\u0e1a noindex" : "\u0e44\u0e21\u0e48\u0e1e\u0e1a noindex \u0e43\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07") +
      '</dd></dl><section class="mb-4"><h3 class="h6">\u0e2a\u0e48\u0e27\u0e19\u0e17\u0e35\u0e48\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07\u0e43\u0e19 HTML</h3><pre class="bg-dark text-light small p-3 rounded-1 overflow-auto"><code>' +
      escapeHtml(html) + '</code></pre></section><section><h3 class="h6">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49</h3>' +
      (related.length ? '<ul class="list-unstyled mb-0">' + related.map((issue) => (
        '<li class="mb-3">' + badge(issue.severity) + '<button type="button" class="btn btn-link text-primary-emphasis text-start p-0 mt-2 text-decoration-none small d-block" data-issue-id="' +
        issue.id + '">' + escapeHtml(issue.title) + "</button></li>"
      )).join("") + "</ul>" : '<p class="small mb-0">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08\u0e43\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07</p>') +
      "</section>",
      trigger);
  }

  async function copyFix() {
    const issue = state.selectedIssue;
    if (!issue) return;
    const text = codeFor(issue.after);
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const input = document.createElement("textarea");
        input.value = text;
        input.className = "position-fixed top-0 start-0 opacity-0";
        byId("detail-content").append(input);
        input.select();
        let copied;
        try { copied = document.execCommand("copy"); } finally { input.remove(); }
        if (!copied) throw new Error("Copy unavailable");
      }
      if (state.selectedIssue === issue) byId("copy-status").textContent = "\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e42\u0e04\u0e49\u0e14\u0e41\u0e25\u0e49\u0e27";
    } catch {
      if (state.selectedIssue === issue) byId("copy-status").textContent = "\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e43\u0e19\u0e0a\u0e48\u0e2d\u0e07\u0e42\u0e04\u0e49\u0e14\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e14\u0e49";
    }
  }

  function exportCsv() {
    if (!state.origin || byId("report").hidden) return;
    const visible = filteredIssues();
    if (visible.length === 0) return;
    const rows = [["\u0e23\u0e30\u0e14\u0e31\u0e1a", "\u0e1b\u0e31\u0e0d\u0e2b\u0e32", "\u0e2b\u0e21\u0e27\u0e14", "\u0e08\u0e33\u0e19\u0e27\u0e19\u0e2b\u0e19\u0e49\u0e32", "URL", "\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49", "\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07"],
    ...visible.map((issue) => [severity[issue.severity].label, issue.title, categories[issue.category],
    issue.paths.length, issue.paths.map(urlFor).join(" | "), issue.steps.join(" | "), issue.doc])];
    const csv = rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "seo-issues-" + new URL(state.origin).hostname + ".csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    byId("app-message").textContent = "\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07 " + visible.length + " \u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e41\u0e25\u0e49\u0e27";
  }

  function resetIssueFilters() {
    byId("severity-filter").value = "all";
    byId("category-filter").value = "all";
    byId("issue-search").value = "";
    renderIssues();
  }

  byId("scan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.busy) return;
    const input = byId("website-url");
    let url;
    try {
      url = new URL(input.value.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
    } catch {
      input.setCustomValidity("\u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e0a\u0e49 URL \u0e17\u0e35\u0e48\u0e02\u0e36\u0e49\u0e19\u0e15\u0e49\u0e19\u0e14\u0e49\u0e27\u0e22 http:// \u0e2b\u0e23\u0e37\u0e2d https://");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    state.report = null;
    state.origin = null;
    state.busy = true;
    byId("report").hidden = true;
    replaceContent(byId("issue-rows"), "");
    replaceContent(byId("page-rows"), "");
    replaceContent(byId("detail-content"), "");
    ["summary-pages", "summary-critical", "summary-warning", "summary-review", "report-host", "affected-summary",
      "issue-count", "issue-result-status", "page-result-status", "pages-pager"].forEach((id) => { byId(id).textContent = ""; });
    byId("export-button").disabled = true;
    byId("app-message").textContent = "";
    state.selectedIssue = null;
    drawer.hide();
    byId("scan-button").disabled = true;
    byId("scan-button-label").textContent = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08...";
    byId("scan-status").textContent = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08 " + url.href;
    byId("scan-status").dataset.state = "loading";
    byId("report").setAttribute("aria-busy", "true");
    fetch("/api/audits", {
      credentials: "include", method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.href })
    }).then((response) => response.json().then((data) => {
      if (!response.ok || data.status === "failed") {
        throw Object.assign(new Error("Audit failed"), { publicMessage: data.message, code: data.error });
      }
      if (data.schemaVersion !== "1.0" || !Array.isArray(data.pages) || !data.pages.length || !Array.isArray(data.issues)) {
        throw new Error("Invalid report");
      }
      return data;
    })).then((data) => {
      state.report = data;
      state.origin = data.scope.origin;
      state.page = 1;
      byId("report-host").textContent = data.pages[0].finalUrl;
      byId("scan-status").textContent = "\u0e2d\u0e48\u0e32\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e23\u0e34\u0e07\u0e41\u0e25\u0e49\u0e27 " + data.pages.length + " \u0e2b\u0e19\u0e49\u0e32: " + data.pages[0].finalUrl;
      byId("scan-status").dataset.state = "ready";
    }).then(undefined, (error) => {
      state.report = null;
      state.origin = null;
      byId("scan-status").textContent = error.publicMessage || "\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48";
      byId("scan-status").dataset.state = "failed";
    }).finally(() => {
      state.busy = false;
      byId("scan-button").disabled = false;
      byId("scan-button-label").textContent = "\u0e15\u0e23\u0e27\u0e08\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c";
      byId("report").setAttribute("aria-busy", "false");
    });
  });
  byId("website-url").addEventListener("input", () => byId("website-url").setCustomValidity(""));

  ["severity-filter", "category-filter"].forEach((id) => byId(id).addEventListener("change", renderIssues));
  byId("issue-search").addEventListener("input", renderIssues);
  byId("reset-filters").addEventListener("click", resetIssueFilters);
  byId("export-button").addEventListener("click", exportCsv);
  ["page-filter", "page-search"].forEach((id) => byId(id).addEventListener(id === "page-search" ? "input" : "change", () => {
    state.page = 1;
    renderPages();
  }));
  byId("pages-prev").addEventListener("click", () => { state.page -= 1; renderPages(); });
  byId("pages-next").addEventListener("click", () => { state.page += 1; renderPages(); });

  document.addEventListener("click", (event) => {
    const issueButton = event.target.closest("[data-issue-id]");
    if (issueButton) { openIssue(issueButton.dataset.issueId, issueButton); return; }
    const pageButton = event.target.closest("[data-page-path]");
    if (pageButton) { openPage(pageButton.dataset.pagePath, pageButton); return; }
    if (event.target.closest("#copy-fix")) copyFix();
  });
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach((button) => {
    button.addEventListener("shown.bs.tab", () => {
      document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab) => {
        tab.classList.toggle("bg-success-subtle", tab.classList.contains("active"));
        tab.classList.toggle("bg-transparent", !tab.classList.contains("active"));
      });
    });
  });
  drawerElement.addEventListener("hidden.bs.offcanvas", () => {
    if (drawerTrigger?.isConnected && drawerTrigger.getClientRects().length) drawerTrigger.focus();
  });

  // Each page load starts a fresh round, including browser-restored form values.
  byId("scan-form").reset();
  byId("website-url").value = "";
  ["severity-filter", "category-filter", "page-filter"].forEach((id) => { byId(id).value = "all"; });
  ["issue-search", "page-search"].forEach((id) => { byId(id).value = ""; });
  activateControls();
})();
