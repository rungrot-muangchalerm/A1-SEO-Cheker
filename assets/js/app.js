(() => {
  "use strict";

  const severity = {
    critical: { label: "\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e01\u0e49\u0e01\u0e48\u0e2d\u0e19", className: "bg-danger-subtle text-danger-emphasis border-danger-subtle" },
    warning: { label: "\u0e04\u0e27\u0e23\u0e1b\u0e23\u0e31\u0e1a", className: "bg-warning-subtle text-warning-emphasis border-warning-subtle" },
    review: { label: "\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19", className: "bg-info-subtle text-info-emphasis border-info-subtle" },
    pass: { label: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32", className: "bg-success-subtle text-success-emphasis border-success-subtle" },
    "not-checked": { label: "\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49", className: "bg-secondary-subtle text-secondary-emphasis border-secondary-subtle" }
  };
  const categories = {
    index: "\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32 index", onpage: "\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1a\u0e19\u0e2b\u0e19\u0e49\u0e32", links: "\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19",
    sitemap: "Sitemap", images: "\u0e23\u0e39\u0e1b\u0e20\u0e32\u0e1e", render: "JavaScript"
  };

  const state = { origin: null, page: 1, selectedIssue: null, report: null, busy: false, round: 0, controller: null };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const icon = (name, size = 18) => '<i data-lucide="' + name + '" width="' + size + '" height="' + size + '" aria-hidden="true"></i>';
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

  function pageIssues(url) {
    return (state.report?.issues || []).filter((issue) => issue.urls.includes(url));
  }

  function pageLevel(url) {
    const matches = pageIssues(url);
    const level = ["critical", "warning", "review"].find((value) => matches.some((issue) => issue.severity === value));
    if (level) return level;
    const page = state.report?.pages.find((item) => item.finalUrl === url);
    return page?.analysisStatus === "complete" ? "pass" : "not-checked";
  }

  function filteredIssues() {
    if (!state.report) return [];
    const level = byId("severity-filter").value;
    const category = byId("category-filter").value;
    const query = byId("issue-search").value.trim().toLocaleLowerCase();
    return state.report.issues.filter((issue) => {
      const searchable = [issue.title, issue.ruleId, issue.found, categories[issue.category], ...issue.urls].join(" ").toLocaleLowerCase();
      return (level === "all" || issue.severity === level) &&
        (category === "all" || issue.category === category) && searchable.includes(query);
    });
  }

  function renderIssues() {
    const issues = state.report?.issues || [];
    const visible = filteredIssues();
    replaceContent(byId("issue-rows"), visible.map((issue) => (
      '<tr><td class="align-top">' + badge(issue.severity) + '</td><td>' +
      '<p class="fw-medium small mb-1">' + escapeHtml(issue.title) + "</p>" +
      '<p class="small mb-0 text-break">' + escapeHtml(categories[issue.category]) + " &middot; " +
      escapeHtml(issue.urls[0]) + (issue.urls.length > 1 ? " \u0e41\u0e25\u0e30\u0e2d\u0e35\u0e01 " + (issue.urls.length - 1) + " \u0e2b\u0e19\u0e49\u0e32" : "") +
      '</p></td><td class="small text-nowrap d-none d-sm-table-cell">' + issue.urls.length + " \u0e2b\u0e19\u0e49\u0e32</td>" +
      '<td class="text-end">' + detailButton("data-issue-id", issue.id, "\u0e14\u0e39\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49: " + issue.title) + "</td></tr>"
    )).join(""));
    byId("issue-count").textContent = "(" + issues.length + ")";
    byId("issue-empty").classList.toggle("d-none", visible.length > 0);
    byId("issue-empty-message").textContent = issues.length ? "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e32\u0e21\u0e15\u0e31\u0e27\u0e01\u0e23\u0e2d\u0e07\u0e19\u0e35\u0e49" : "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49";
    byId("reset-filters").classList.toggle("d-none", issues.length === 0);
    byId("issue-result-status").textContent = "\u0e41\u0e2a\u0e14\u0e07 " + visible.length + " \u0e08\u0e32\u0e01 " + issues.length + " \u0e1b\u0e31\u0e0d\u0e2b\u0e32";
    byId("export-button").disabled = visible.length === 0;
  }

  function renderPages() {
    const pages = state.report?.pages || [];
    const level = byId("page-filter").value;
    const query = byId("page-search").value.trim().toLocaleLowerCase();
    const visible = pages.filter((page) => (
      (level === "all" || pageLevel(page.finalUrl) === level) &&
      (page.finalUrl + " " + (page.metadata?.title || "")).toLocaleLowerCase().includes(query)
    ));
    const pageCount = Math.max(1, Math.ceil(visible.length / 10));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * 10;
    const slice = visible.slice(start, start + 10);
    replaceContent(byId("page-rows"), slice.map((page) => (
      '<tr><td><p class="small fw-medium text-break mb-1">' + escapeHtml(page.finalUrl) +
      '</p><p class="small mb-0 text-break">' + escapeHtml(page.metadata?.title) +
      '</p></td><td><span class="badge rounded-1 fw-normal ' +
      (page.status >= 200 && page.status < 300 ? "bg-success-subtle text-success-emphasis" : "bg-danger-subtle text-danger-emphasis") +
      '">' + escapeHtml(page.status) + "</span></td><td>" + badge(pageLevel(page.finalUrl)) +
      '</td><td class="text-end">' + detailButton("data-page-url", page.finalUrl, "\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2b\u0e19\u0e49\u0e32 " + page.finalUrl) + "</td></tr>"
    )).join(""));
    byId("page-empty").classList.toggle("d-none", visible.length > 0);
    byId("page-result-status").textContent = visible.length ?
      "\u0e41\u0e2a\u0e14\u0e07 " + (start + 1) + "-" + (start + slice.length) + " \u0e08\u0e32\u0e01 " + visible.length + " \u0e2b\u0e19\u0e49\u0e32" : "\u0e41\u0e2a\u0e14\u0e07 0 \u0e2b\u0e19\u0e49\u0e32";
    byId("pages-pager").textContent = visible.length ? state.page + " / " + pageCount : "0 / 0";
    byId("pages-prev").disabled = state.page === 1 || visible.length === 0;
    byId("pages-next").disabled = state.page === pageCount || visible.length === 0;
  }

  function renderSummary() {
    if (!state.report) return;
    const summary = state.report.summary;
    byId("summary-pages").textContent = summary.pages;
    ["critical", "warning", "review"].forEach((level) => {
      byId("summary-" + level).textContent = summary[level];
    });
    byId("affected-summary").textContent = "\u0e1e\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e01\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e43\u0e19 " + summary.affected + " \u0e08\u0e32\u0e01 " + summary.pages + " \u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08";
    byId("report-host").textContent = state.report.requestedUrl;
    const report = state.report;
    byId("report-scope").textContent = "\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15: " + (report.scope.type === "single-page" ? "URL \u0e40\u0e14\u0e35\u0e22\u0e27" : report.scope.origin) +
      " \u00b7 \u0e1e\u0e1a " + report.coverage.discovered + " \u0e2b\u0e19\u0e49\u0e32 \u00b7 \u0e2d\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 " + report.coverage.fetched + " \u0e2b\u0e19\u0e49\u0e32 \u00b7 \u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c " + report.coverage.analyzed + " \u0e2b\u0e19\u0e49\u0e32";
    byId("report-time").textContent = "\u0e40\u0e27\u0e25\u0e32\u0e15\u0e23\u0e27\u0e08: " + new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
      dateStyle: "medium", timeStyle: "medium"
    }).format(new Date(report.completedAt));
    byId("report-result").textContent = report.issues.length ? "\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e2b\u0e23\u0e37\u0e2d\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 " + report.issues.length + " \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23" : "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49";
    byId("report-result").dataset.result = report.issues.length ? "issues" : "none";
    byId("not-checked-section").hidden = report.notChecked.length === 0;
    byId("not-checked-count").textContent = "(" + report.notChecked.length + ")";
    replaceContent(byId("not-checked-list"), report.notChecked.map((entry) => '<li class="mb-2 text-break">' +
      escapeHtml(entry.message) + ' <span class="text-secondary">(' + escapeHtml(entry.reason) + ')</span></li>').join(""));
  }

  function openDrawer(title, content, trigger) {
    if (!drawerElement.classList.contains("show") && !drawerElement.classList.contains("showing")) {
      drawerTrigger = trigger;
    }
    bootstrap.Tooltip.getInstance(trigger)?.hide();
    byId("detail-title").textContent = title;
    replaceContent(byId("detail-content"), content);
    byId("detail-content").scrollTop = 0;
    drawer.show(trigger);
  }

  function openIssue(id, trigger) {
    const issue = state.report?.issues.find((item) => item.id === id);
    if (!issue) return;
    state.selectedIssue = issue;
    openDrawer(issue.title,
      '<div class="d-flex align-items-center flex-wrap gap-2 mb-4">' + badge(issue.severity) +
      '<span class="small">' + escapeHtml(issue.ruleId) + '</span></div>' +
      '<section class="mb-4"><h3 class="h6">\u0e2a\u0e34\u0e48\u0e07\u0e17\u0e35\u0e48\u0e1e\u0e1a</h3><p class="small text-break mb-0">' + escapeHtml(issue.found) + '</p></section>' +
      '<section class="mb-4"><h3 class="h6">\u0e1c\u0e25\u0e01\u0e23\u0e30\u0e17\u0e1a</h3><p class="small mb-0">' + escapeHtml(issue.impact) + '</p></section>' +
      '<section class="mb-4"><div class="d-flex align-items-center justify-content-between mb-2"><h3 class="h6 mb-0">\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49</h3>' +
      '<button type="button" class="btn btn-sm btn-outline-success" data-copy-kind="steps" aria-label="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49" title="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49" data-bs-toggle="tooltip">' + icon('copy', 16) + '</button></div><ol class="small ps-3 mb-0">' +
      issue.steps.map((step) => '<li class="mb-2">' + escapeHtml(step) + '</li>').join('') + '</ol></section>' +
      '<section class="mb-4"><div class="d-flex align-items-center justify-content-between mb-2"><h3 class="h6 mb-0">\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19</h3>' +
      '<button type="button" class="btn btn-sm btn-outline-success" data-copy-kind="evidence" aria-label="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19" title="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19" data-bs-toggle="tooltip">' + icon('copy', 16) + '</button></div>' +
      issue.evidence.slice(0, 50).map((entry) => {
        let details = '';
        if (entry.kind === 'html') {
          details = '<p class="small text-break mb-2">HTML &middot; <code>' + escapeHtml(entry.selector) + '</code>' +
            (entry.location ? ' &middot; \u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14 ' + escapeHtml(entry.location.startLine) + ':' + escapeHtml(entry.location.startColumn) : '') + '</p>';
        } else if (entry.kind === 'header') {
          details = '<p class="small mb-2">HTTP header: <code>' + escapeHtml(entry.name) + '</code></p>';
        } else if (entry.kind === 'robots') {
          details = '<p class="small mb-2">robots.txt &middot; HTTP ' + escapeHtml(entry.httpStatus) + '</p>' +
            (entry.rules || []).filter((rule) => rule.line).map((rule) => '<p class="small mb-1 text-break">' +
              escapeHtml(rule.agent) + ' &middot; \u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14 ' + escapeHtml(rule.line) + '</p><pre class="bg-dark text-light p-3 rounded-1 small overflow-auto"><code>' +
              escapeHtml(rule.source) + '</code></pre>').join('');
        } else if (entry.kind === 'response') {
          details = '<p class="small mb-2">HTTP ' + escapeHtml(entry.status) + '</p>' +
            (entry.redirects?.length ? '<pre class="bg-dark text-light p-3 rounded-1 small overflow-auto"><code>' + escapeHtml(JSON.stringify(entry.redirects, null, 2)) + '</code></pre>' : '');
        } else {
          details = '<p class="small mb-2 text-break">' + (entry.selector ? 'HTML: <code>' + escapeHtml(entry.selector) + '</code>' : '') +
            (entry.header ? ' &middot; HTTP header: <code>' + escapeHtml(entry.header) + '</code>' : '') +
            (entry.count !== undefined ? ' &middot; \u0e1e\u0e1a ' + escapeHtml(entry.count) + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23' : '') + '</p>';
        }
        return '<div class="mb-3 border-bottom border-info-subtle pb-3" data-evidence-kind="' + escapeHtml(entry.kind) + '">' +
          '<p class="small text-break mb-2">' + escapeHtml(entry.sourceUrl) + '</p>' +
          (entry.finalUrl && entry.finalUrl !== entry.sourceUrl ? '<p class="small text-break mb-2">URL \u0e2a\u0e38\u0e14\u0e17\u0e49\u0e32\u0e22: ' + escapeHtml(entry.finalUrl) + '</p>' : '') +
          details + (entry.source !== undefined ? '<pre class="bg-dark text-light p-3 rounded-1 small overflow-auto mb-2"><code>' + escapeHtml(entry.source) + '</code></pre>' : '') +
          (entry.sourceFormat === 'serialized-html' ? '<p class="small mb-0">HTML \u0e08\u0e32\u0e01 parser</p>' : '') +
          (entry.sourceTruncated ? '<p class="small mb-0">\u0e2a\u0e48\u0e27\u0e19\u0e02\u0e2d\u0e07\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e16\u0e39\u0e01\u0e15\u0e31\u0e14\u0e17\u0e2d\u0e19</p>' : '') +
          (entry.complete === false ? '<p class="small mb-0">\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a</p>' : '') + '</div>';
      }).join('') + (issue.evidence.length > 50 ? '<p class="small">\u0e41\u0e2a\u0e14\u0e07 50 \u0e08\u0e32\u0e01 ' + issue.evidence.length + ' \u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19</p>' : '') + '</section>' +
      '<p class="small mb-3" id="copy-status" role="status" aria-live="polite"></p>' +
      '<section class="mb-4"><h3 class="h6">\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e1e\u0e1a</h3><ul class="list-unstyled small mb-0">' +
      issue.urls.map((url) => '<li class="mb-2"><button type="button" class="btn btn-link text-primary-emphasis text-decoration-none text-start text-break p-0 small" data-page-url="' +
        escapeHtml(url) + '">' + escapeHtml(url) + '</button></li>').join('') + '</ul></section>' +
      issue.references.map((reference) => {
        let url;
        try { url = new URL(reference.url); } catch { return ''; }
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        return '<a class="small text-success-emphasis d-flex align-items-center gap-2 mb-2 text-break" href="' + escapeHtml(url.href) +
          '" target="_blank" rel="noopener noreferrer">' + escapeHtml(reference.title) + icon('external-link', 14) + '</a>';
      }).join(''), trigger);
  }

  function openPage(url, trigger) {
    const page = state.report?.pages.find((item) => item.finalUrl === url);
    if (!page) return;
    state.selectedIssue = null;
    const related = pageIssues(url);
    const canonical = page.metadata?.canonical || [];
    const indexing = page.checks.find((entry) => entry.ruleId === 'robots-indexing');
    openDrawer('\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2b\u0e19\u0e49\u0e32',
      '<p class="small text-break mb-3">' + escapeHtml(url) + '</p><div class="mb-4">' + badge(pageLevel(url)) + '</div>' +
      '<dl class="small"><dt>HTTP status</dt><dd class="mb-3">' + escapeHtml(page.status) +
      '</dd><dt>Title</dt><dd class="mb-3 text-break">' + escapeHtml(page.metadata?.title || '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21 title') +
      '</dd><dt>Canonical</dt><dd class="mb-3 text-break">' + escapeHtml(canonical.length ? canonical.map((item) => item.url || item.value).join('\n') : '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e01\u0e32\u0e23\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 canonical') +
      '</dd><dt>\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07 index</dt><dd class="mb-3 text-break">' + escapeHtml(indexing?.found || '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08') +
      '</dd></dl><section class="mb-4"><h3 class="h6">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08</h3><ul class="list-unstyled mb-0">' +
      page.checks.map((entry) => '<li class="mb-3">' + badge(entry.severity || entry.outcome) +
        '<p class="small text-break mt-1 mb-0">' + escapeHtml(entry.title) + ': ' + escapeHtml(entry.found) + '</p></li>').join('') +
      '</ul></section><section class="mb-4"><h3 class="h6">\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19</h3>' +
      (related.length ? '<ul class="list-unstyled mb-0">' + related.map((issue) => (
        '<li class="mb-2"><button type="button" class="btn btn-link text-primary-emphasis text-start text-break p-0 text-decoration-none small" data-issue-id="' +
        escapeHtml(issue.id) + '">' + escapeHtml(issue.title) + '</button></li>'
      )).join('') + '</ul>' : '<p class="small mb-0">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49</p>') +
      '</section><details class="mb-4"><summary class="small">HTTP headers</summary><pre class="bg-dark text-light small p-3 mt-2 rounded-1 overflow-auto"><code>' +
      escapeHtml(JSON.stringify(page.headers, null, 2)) + '</code></pre></details>' +
      '<details><summary class="small">HTML \u0e17\u0e35\u0e48\u0e14\u0e36\u0e07\u0e44\u0e14\u0e49</summary><pre class="bg-dark text-light small p-3 mt-2 rounded-1 overflow-auto"><code>' +
      escapeHtml(page.html.slice(0, 16384)) + '</code></pre>' +
      (page.html.length > 16384 ? '<p class="small">\u0e41\u0e2a\u0e14\u0e07 HTML \u0e40\u0e09\u0e1e\u0e32\u0e30 16,384 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23\u0e41\u0e23\u0e01</p>' : '') + '</details>', trigger);
  }

  function resetIssueFilters() {
    byId("severity-filter").value = "all";
    byId("category-filter").value = "all";
    byId("issue-search").value = "";
    renderIssues();
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const input = document.createElement('textarea');
    const focus = document.activeElement;
    input.value = text;
    input.className = 'visually-hidden';
    byId('detail-content').appendChild(input);
    let copied = false;
    try {
      input.select();
      copied = document.execCommand('copy');
    } finally {
      input.remove();
      focus?.focus();
    }
    return copied ? Promise.resolve() : Promise.reject(new Error('Clipboard unavailable'));
  }

  function csvCell(value) {
    let text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    // Spreadsheet-facing export: neutralize formula prefixes without mutating the report.
    if (/^(?:[\u0000-\u0020]*[=+@\-\uff1d\uff0b\uff0d\uff20]|[\t\r\n])/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  byId('export-button').addEventListener('click', () => {
    if (!state.report || state.busy) return;
    const issues = filteredIssues();
    if (!issues.length) return;
    const fields = ['ruleId', 'ruleVersion', 'outcome', 'severity', 'category', 'title', 'urls', 'found', 'impact', 'steps', 'evidence', 'references'];
    const csv = [fields.map(csvCell).join(','), ...issues.map((issue) => fields.map((field) => csvCell(issue[field])).join(','))].join('\r\n');
    const objectUrl = URL.createObjectURL(new Blob(['\ufeff', csv, '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'seo-issues.csv';
    document.body.appendChild(link);
    try { link.click(); } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  });

  byId("scan-form").addEventListener("submit", (event) => {
    event.preventDefault();
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
    const round = ++state.round;
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    state.report = null;
    state.origin = null;
    state.busy = true;
    byId("report").hidden = true;
    replaceContent(byId("issue-rows"), "");
    replaceContent(byId("page-rows"), "");
    replaceContent(byId("detail-content"), "");
    replaceContent(byId("not-checked-list"), "");
    ["summary-pages", "summary-critical", "summary-warning", "summary-review", "report-host", "affected-summary",
      "issue-count", "issue-result-status", "page-result-status", "pages-pager", "report-scope", "report-time", "report-result", "not-checked-count"].forEach((id) => { byId(id).textContent = ""; });
    byId("export-button").disabled = true;
    byId("app-message").textContent = "";
    state.selectedIssue = null;
    drawer.hide();
    byId("scan-button").disabled = false;
    byId("scan-button-label").textContent = "\u0e15\u0e23\u0e27\u0e08\u0e43\u0e2b\u0e21\u0e48";
    byId("scan-status").textContent = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08 " + url.href;
    byId("scan-status").dataset.state = "loading";
    byId("scan-status").classList.remove("text-danger-emphasis");
    byId("scan-spinner").classList.remove("d-none");
    byId("scan-icon").classList.add("d-none");
    byId("cancel-button").classList.remove("d-none");
    byId("report").setAttribute("aria-busy", "true");
    fetch("/api/audits", {
      credentials: "include", method: "POST", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.href })
    }).then((response) => response.json().then((data) => {
      if (!response.ok || data.status === "failed") {
        throw Object.assign(new Error("Audit failed"), { publicMessage: data.message, code: data.error });
      }
      if (data.schemaVersion !== "1.0" || !["partial", "completed"].includes(data.status) || !Array.isArray(data.pages) ||
          !data.pages.length || !Array.isArray(data.issues) || !Array.isArray(data.notChecked)) {
        throw new Error("Invalid report");
      }
      return data;
    })).then((data) => {
      if (round !== state.round) return;
      state.report = data;
      state.origin = data.scope.origin;
      state.page = 1;
      resetIssueFilters();
      byId("page-filter").value = "all";
      byId("page-search").value = "";
      renderSummary();
      renderPages();
      bootstrap.Tab.getOrCreateInstance(byId("issues-tab")).show();
      const partial = data.status === "partial" || data.notChecked.length > 0 || data.pages.some((page) => page.analysisStatus !== "complete");
      byId("scan-status").textContent = (partial ? "\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19" : "\u0e15\u0e23\u0e27\u0e08\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e41\u0e25\u0e49\u0e27") + ": " + data.requestedUrl;
      byId("scan-status").dataset.state = partial ? "partial" : "completed";
      byId("report").hidden = false;
    }).then(undefined, (error) => {
      if (round !== state.round) return;
      state.report = null;
      state.origin = null;
      if (controller.signal.aborted) {
        byId("scan-status").textContent = "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08\u0e41\u0e25\u0e49\u0e27";
        byId("scan-status").dataset.state = "cancelled";
        return;
      }
      byId("scan-status").textContent = error.publicMessage || "\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48";
      byId("scan-status").dataset.state = "failed";
      byId("scan-status").classList.add("text-danger-emphasis");
    }).finally(() => {
      if (round !== state.round) return;
      state.busy = false;
      state.controller = null;
      byId("scan-button").disabled = false;
      byId("scan-button-label").textContent = "\u0e15\u0e23\u0e27\u0e08\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c";
      byId("scan-spinner").classList.add("d-none");
      byId("scan-icon").classList.remove("d-none");
      byId("cancel-button").classList.add("d-none");
      byId("report").setAttribute("aria-busy", "false");
    });
  });
  byId('cancel-button').addEventListener('click', () => {
    bootstrap.Tooltip.getInstance(byId('cancel-button'))?.hide();
    state.controller?.abort();
  });
  window.addEventListener('pagehide', () => {
    ++state.round;
    state.controller?.abort();
    state.controller = null;
  });
  byId("website-url").addEventListener("input", () => byId("website-url").setCustomValidity(""));

  ["severity-filter", "category-filter"].forEach((id) => byId(id).addEventListener("change", renderIssues));
  byId("issue-search").addEventListener("input", renderIssues);
  byId("reset-filters").addEventListener("click", resetIssueFilters);
  ["page-filter", "page-search"].forEach((id) => byId(id).addEventListener(id === "page-search" ? "input" : "change", () => {
    state.page = 1;
    renderPages();
  }));
  byId("pages-prev").addEventListener("click", () => { state.page -= 1; renderPages(); });
  byId("pages-next").addEventListener("click", () => { state.page += 1; renderPages(); });

  document.addEventListener("click", (event) => {
    const copyButton = event.target.closest('[data-copy-kind]');
    if (copyButton) {
      const issue = state.selectedIssue;
      if (!issue || !state.report || copyButton.disabled) return;
      const text = copyButton.dataset.copyKind === 'evidence' ? JSON.stringify(issue.evidence, null, 2) :
        issue.steps.map((step, index) => (index + 1) + '. ' + step).join('\n');
      bootstrap.Tooltip.getInstance(copyButton)?.hide();
      copyButton.disabled = true;
      byId('copy-status').textContent = '';
      Promise.resolve().then(() => copyText(text)).then(() => {
        if (state.selectedIssue === issue && copyButton.isConnected) byId('copy-status').textContent = '\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27';
      }, () => {
        if (state.selectedIssue === issue && copyButton.isConnected) byId('copy-status').textContent = '\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08';
      }).finally(() => { if (copyButton.isConnected) copyButton.disabled = false; });
      return;
    }
    const issueButton = event.target.closest("[data-issue-id]");
    if (issueButton) { openIssue(issueButton.dataset.issueId, issueButton); return; }
    const pageButton = event.target.closest("[data-page-url]");
    if (pageButton) { openPage(pageButton.dataset.pageUrl, pageButton); return; }
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
