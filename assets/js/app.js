(() => {
  "use strict";

  const severity = {
    critical: { label: "\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e01\u0e49\u0e01\u0e48\u0e2d\u0e19", className: "bg-danger-subtle text-danger-emphasis border-danger-subtle" },
    warning: { label: "\u0e04\u0e27\u0e23\u0e1b\u0e23\u0e31\u0e1a", className: "bg-warning-subtle text-warning-emphasis border-warning-subtle" },
    review: { label: "\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19", className: "bg-light text-info-emphasis border-info-subtle" },
    pass: { label: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32", className: "bg-light text-success-emphasis border-success-subtle" },
    "not-checked": { label: "\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49", className: "bg-secondary-subtle text-secondary-emphasis border-secondary-subtle" }
  };
  const categories = {
    "site-files": "robots.txt / Sitemap",
    index: "\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32 index", onpage: "\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1a\u0e19\u0e2b\u0e19\u0e49\u0e32", links: "\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19",
    sitemap: "Sitemap", images: "\u0e23\u0e39\u0e1b\u0e20\u0e32\u0e1e", render: "JavaScript", sharing: "Open Graph"
  };
  const codeGuides = {
    'robots-file': ['ตั้งค่าให้ URL ราก /robots.txt ส่งข้อความ UTF-8 ถ้ามีแล้วให้แก้ของเดิม ตัวอย่างนี้สำหรับเว็บสาธารณะที่ตั้งใจให้ crawl ได้ ปรับกฎและโดเมนตามเว็บจริง', 'User-agent: *\nDisallow:\nSitemap: https://example.com/sitemap.xml'],
    'sitemap-file': ['สร้าง /sitemap.xml หรือใช้ตัวสร้าง sitemap ของ framework ใส่เฉพาะ URL หลักที่ตั้งใจให้ค้นพบ และอัปเดตเมื่อเพิ่มหรือลบหน้า', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/your-page</loc></url>\n</urlset>'],
    'title-content': ['แก้ใน <head> ของแต่ละหน้า ให้เหลือ title เดียวและเขียนชื่อให้ตรงเนื้อหา', '<title>ชื่อเนื้อหาของหน้านี้ | ชื่อเว็บไซต์</title>'],
    'description-content': ['แก้ใน <head> ของแต่ละหน้า ให้มีคำอธิบายเดียวที่สรุปเนื้อหาจริง ไม่ใช้ข้อความเดียวกันทุกหน้า', '<meta name="description" content="สรุปว่าหน้านี้ช่วยผู้เข้าชมเรื่องอะไร">'],
    'canonical-declaration': ['ยืนยัน URL หลักของเนื้อหาก่อน แล้วกำหนดใน <head> ให้ตรงกับ URL ที่ตั้งใจใช้จริง', '<link rel="canonical" href="https://example.com/your-page">'],
    'image-alt': ['แก้ที่แท็ก <img> ของรูปที่ระบุในหลักฐาน อธิบายความหมายของรูป ส่วนรูปตกแต่งใช้ alt ว่าง', '<img src="product.jpg" alt="กระเป๋าผ้าสีน้ำเงิน รุ่น A">\n<!-- รูปตกแต่งที่ไม่สื่อเนื้อหา -->\n<img src="decoration.svg" alt="">'],
    'open-graph': ['เพิ่มหรือแก้ข้อมูลใน <head> เพื่อกำหนดหน้าตาตัวอย่างตอนแชร์ลิงก์ ไม่ใช่เงื่อนไขรับประกันอันดับค้นหา', '<meta property="og:title" content="ชื่อเนื้อหาของหน้านี้">\n<meta property="og:description" content="สรุปเนื้อหา">\n<meta property="og:url" content="https://example.com/your-page">\n<meta property="og:image" content="https://example.com/share.jpg">'],
    'robots-indexing': ['ตรวจ meta robots ใน <head> และ HTTP header X-Robots-Tag ถ้าเป็นหน้าสาธารณะที่ต้องการให้ค้นพบ ให้เอา noindex ที่ไม่ตั้งใจออก ถ้าเป็นหน้าส่วนตัวให้คงข้อจำกัดไว้', '<!-- ตัวอย่างสำหรับหน้าสาธารณะที่ตั้งใจให้จัดทำดัชนี -->\n<meta name="robots" content="index, follow">'],
    'robots-following': ['ตรวจ meta robots และ X-Robots-Tag ก่อน ถ้า nofollow ไม่ใช่สิ่งที่ตั้งใจ ให้เอาคำสั่งนั้นออก การเปลี่ยน meta ไม่ได้ลบข้อจำกัดจาก HTTP header', '<meta name="robots" content="index, follow">'],
    'internal-link-target': ['แก้ href ในหน้าต้นทางให้ชี้ URL ที่มีอยู่จริง หรือแก้ route ของหน้าปลายทางให้ตอบได้ตามที่ตั้งใจ', '<a href="/services">ดูบริการ</a>'],
    'duplicate-title': ['แก้ตัวสร้าง <head> ให้แต่ละหน้ามีชื่อเฉพาะที่ตรงเนื้อหา ไม่ใช้ชื่อเดียวกันทั้งเว็บไซต์', '<title>บริการออกแบบเว็บไซต์ | ชื่อธุรกิจ</title>'],
    'duplicate-description': ['ส่งคำอธิบายเฉพาะของแต่ละหน้าเข้า template แทนการใช้ข้อความกลางเดียวกัน', '<meta name="description" content="สรุปเนื้อหาเฉพาะของหน้านี้">']
  };
  const skipReasons = {
    ROBOTS_BLOCKED: 'robots.txt \u0e44\u0e21\u0e48\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15 SEOChecker',
    ROBOTS_UNKNOWN: '\u0e22\u0e31\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e01\u0e0e robots.txt \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49',
    OUTSIDE_SCOPE: '\u0e2d\u0e2d\u0e01\u0e19\u0e2d\u0e01\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c',
    ALREADY_FETCHED: '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e16\u0e39\u0e01\u0e2d\u0e48\u0e32\u0e19\u0e41\u0e25\u0e49\u0e27',
    UNSUPPORTED_TYPE: '\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 HTML \u0e17\u0e35\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a',
    TIMEOUT: '\u0e40\u0e27\u0e47\u0e1a\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14',
    CRAWL_PAGE_LIMIT: '\u0e04\u0e23\u0e1a\u0e08\u0e33\u0e19\u0e27\u0e19 URL \u0e2a\u0e39\u0e07\u0e2a\u0e38\u0e14',
    CRAWL_REQUEST_LIMIT: '\u0e04\u0e23\u0e1a\u0e08\u0e33\u0e19\u0e27\u0e19\u0e04\u0e33\u0e02\u0e2d\u0e2a\u0e39\u0e07\u0e2a\u0e38\u0e14',
    CRAWL_DEADLINE: '\u0e16\u0e36\u0e07\u0e40\u0e27\u0e25\u0e32\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e39\u0e07\u0e2a\u0e38\u0e14',
    CRAWL_BYTE_LIMIT: '\u0e16\u0e36\u0e07\u0e02\u0e19\u0e32\u0e14 HTML \u0e23\u0e27\u0e21\u0e2a\u0e39\u0e07\u0e2a\u0e38\u0e14'
  };

  const state = { origin: null, page: 1, selectedIssue: null, report: null, busy: false, exporting: false, round: 0, controller: null };
  const downloadUrls = new Set();
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
      bootstrap.Tooltip.getOrCreateInstance(element, { trigger: "hover focus", animation: false });
    });
  }

  function replaceContent(element, html) {
    element.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((button) => {
      bootstrap.Tooltip.getInstance(button)?.dispose();
    });
    element.innerHTML = html;
    activateControls(element);
  }

  function linkedText(value) {
    const text = String(value ?? '');
    const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"'`\]\)]+)/g;
    let html = '', end = 0;
    for (const match of text.matchAll(pattern)) {
      html += escapeHtml(text.slice(end, match.index));
      const href = match[2] || match[3];
      html += '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(match[1] || href) + '</a>';
      end = match.index + match[0].length;
    }
    return html + escapeHtml(text.slice(end));
  }

  function detailButton(attribute, value, label) {
    return '<button type="button" class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2 text-nowrap" ' +
      attribute + '="' + escapeHtml(value) + '" aria-label="' + escapeHtml(label) +
      '" title="' + escapeHtml(label) + '" data-bs-toggle="tooltip">' +
      icon("chevron-right") + '<span class="d-none d-lg-inline">\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14</span></button>';
  }

  function pageIssues(url) {
    return (state.report?.issues || []).filter((issue) => issue.urls.includes(url));
  }

  function skipReason(code) {
    return Object.hasOwn(skipReasons, code) ? skipReasons[code] + ' (' + code + ')' : code;
  }

  function limitMessage(code, limits, fetched) {
    if (!code || !limits) return '\u0e01\u0e32\u0e23\u0e04\u0e49\u0e19\u0e2b\u0e32 URL \u0e16\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e08\u0e33\u0e01\u0e31\u0e14 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c';
    const bound = code === 'CRAWL_PAGE_LIMIT' ? limits.maxPages + ' URL' : code === 'CRAWL_REQUEST_LIMIT' ? limits.maxRequests + ' requests' :
      code === 'CRAWL_DEADLINE' ? limits.timeoutMs / 1000 + ' s' : code === 'CRAWL_BYTE_LIMIT' ? limits.maxHtmlBytes / 1024 / 1024 + ' MiB' : '';
    return '\u0e2b\u0e22\u0e38\u0e14\u0e15\u0e23\u0e27\u0e08: ' + skipReason(code) + ' ' + bound +
      ' \u00b7 \u0e2d\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 ' + fetched + ' \u0e2b\u0e19\u0e49\u0e32 \u00b7 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c';
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
    const priority = { critical: 0, warning: 1, review: 2 };
    const visible = filteredIssues().sort((a, b) => priority[a.severity] - priority[b.severity]);
    const grouped = byId('issue-view-groups').checked;
    const groups = visibleIssueGroups(visible);
    replaceContent(byId("issue-rows"), grouped ? groups.map((group) => (
      '<tr data-issue-group="' + escapeHtml(group.ruleId) + '"><td class="align-top"><div class="d-flex flex-column align-items-start gap-1">' +
      ['critical', 'warning', 'review'].filter((level) => group.severityCounts[level]).map((level) =>
        '<span data-group-severity="' + level + '">' + badge(level) + ' <span class="small">' + group.severityCounts[level] + '</span></span>').join('') +
      '</div></td><td><p class="fw-medium small text-break mb-1">' + escapeHtml(group.title) + '</p><p class="small mb-1">' +
      escapeHtml(categories[group.category]) + ' &middot; <span data-group-count>' + group.count + '</span> \u0e1b\u0e31\u0e0d\u0e2b\u0e32</p>' +
      '<p class="small mb-0 text-break">' + escapeHtml(group.urls[0]) + (group.urls.length > 1 ? ' \u0e41\u0e25\u0e30\u0e2d\u0e35\u0e01 ' +
        (group.urls.length - 1) + ' URL' : '') + '</p></td><td class="small text-nowrap d-none d-sm-table-cell">' + group.urls.length + ' URL</td>' +
      '<td class="text-end">' + detailButton('data-issue-id', group.id, '\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14: ' + group.title) + '</td></tr>'
    )).join('') : visible.map((issue) => (
      '<tr><td class="align-top">' + badge(issue.severity) + '</td><td>' +
      '<p class="fw-medium small text-break mb-1">' + escapeHtml(issue.title) + "</p>" +
      '<p class="small text-break mb-2"><strong>พบอะไร:</strong> ' + escapeHtml(issue.found) + '</p>' +
      '<p class="small text-break mb-2"><strong>ทำไมต้องดูข้อนี้:</strong> ' + escapeHtml(issue.impact) + '</p>' +
      '<p class="small text-break mb-2"><strong>' + (issue.severity === 'review' ? 'ต้องยืนยันก่อนแก้:' : 'เริ่มแก้ตรงนี้:') + '</strong> ' + linkedText(issue.steps?.[0] || 'เปิดรายละเอียดเพื่อดูหลักฐานและตรวจยืนยันสาเหตุก่อนแก้โค้ด') + '</p>' +
      '<p class="small mb-0 text-break">' + escapeHtml(categories[issue.category]) + " &middot; " +
      escapeHtml(issue.urls[0]) + (issue.urls.length > 1 ? " \u0e41\u0e25\u0e30\u0e2d\u0e35\u0e01 " + (issue.urls.length - 1) + " URL" : "") +
      '</p></td><td class="small text-nowrap d-none d-sm-table-cell">' + issue.urls.length + " URL</td>" +
      '<td class="text-end">' + detailButton("data-issue-id", issue.id, "\u0e14\u0e39\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49: " + issue.title) + "</td></tr>"
    )).join(""));
    byId("issue-count").textContent = "(" + issues.length + ")";
    byId("issue-empty").classList.toggle("d-none", visible.length > 0);
    byId("issue-empty-message").textContent = issues.length ? "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e32\u0e21\u0e15\u0e31\u0e27\u0e01\u0e23\u0e2d\u0e07\u0e19\u0e35\u0e49" : "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49";
    byId("reset-filters").classList.toggle("d-none", issues.length === 0);
    byId("issue-result-status").textContent = "\u0e41\u0e2a\u0e14\u0e07 " + visible.length + " \u0e08\u0e32\u0e01 " + issues.length + " \u0e1b\u0e31\u0e0d\u0e2b\u0e32";
    if (grouped) byId('issue-result-status').textContent += ' \u00b7 ' + groups.length + ' \u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17 \u00b7 ' +
      new Set(visible.flatMap((issue) => issue.urls)).size + ' URL';
    byId("export-button").disabled = visible.length === 0;
    byId('export-issues-xlsx-button').disabled = visible.length === 0 || state.exporting;
    byId('export-issue-count').textContent = '(' + visible.length + ')';
  }

  function visibleIssueGroups(issues) {
    const byIssueId = new Map(issues.map((issue) => [issue.id, issue]));
    return (state.report?.issueGroups || []).map((group) => {
      const members = group.issueIds.map((id) => byIssueId.get(id)).filter(Boolean);
      return {
        ...group, count: members.length, issueIds: members.map((issue) => issue.id),
        urls: [...new Set(members.flatMap((issue) => issue.urls))].sort(),
        severityCounts: Object.fromEntries(['critical', 'warning', 'review'].map((level) => [level, members.filter((issue) => issue.severity === level).length])),
        complete: members.every((issue) => issue.complete !== false)
      };
    }).filter((group) => group.count);
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
      (page.status >= 200 && page.status < 300 ? "bg-light text-success-emphasis" : "bg-danger-subtle text-danger-emphasis") +
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
    byId('export-menu-button').disabled = false;
    byId('export-json-button').disabled = false;
    byId('export-xlsx-button').disabled = state.exporting;
    const summary = state.report.summary;
    byId("summary-pages").textContent = summary.pages;
    ["critical", "warning", "review"].forEach((level) => {
      byId("summary-" + level).textContent = summary[level];
    });
    byId("affected-summary").textContent = "\u0e1e\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e01\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e43\u0e19 " + summary.affected + " URL \u00b7 \u0e2d\u0e48\u0e32\u0e19 HTML " + summary.pages + " \u0e2b\u0e19\u0e49\u0e32";
    byId("report-host").textContent = state.report.requestedUrl;
    const report = state.report;
    const unresolved = (report.core_technical_checks || []).filter(entry => entry.group !== 'agentic' && entry.scope !== 'outside-scope' && entry.status !== 'not-applicable' &&
      (entry.status === 'not-checked' || entry.status === 'unavailable' || entry.complete === false));
    byId('not-checked-section').open = true;
    byId('coverage-gaps').hidden = unresolved.length === 0;
    replaceContent(byId('coverage-gap-list'), unresolved.map(entry => '<li class="mb-2 text-break">' + escapeHtml(entry.title) + ': ' + escapeHtml(entry.found || 'ยังไม่มีหลักฐานเพียงพอ') + '</li>').join(''));
    byId("report-scope").textContent = "\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15: " + (report.scope.type === "single-page" ? "URL \u0e40\u0e14\u0e35\u0e22\u0e27" : report.scope.origin) +
      " \u00b7 \u0e1e\u0e1a " + report.coverage.discovered + " \u0e2b\u0e19\u0e49\u0e32 \u00b7 \u0e2d\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 " + report.coverage.fetched + " \u0e2b\u0e19\u0e49\u0e32 \u00b7 \u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c " + report.coverage.analyzed + " \u0e2b\u0e19\u0e49\u0e32" +
      " \u00b7 \u0e02\u0e49\u0e32\u0e21 " + report.coverage.skipped.length + " URL";
    byId("report-time").textContent = "\u0e40\u0e27\u0e25\u0e32\u0e15\u0e23\u0e27\u0e08: " + new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
      dateStyle: "medium", timeStyle: "medium"
    }).format(new Date(report.completedAt));
    byId("report-result").textContent = report.issues.length ? "\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e2b\u0e23\u0e37\u0e2d\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 " + report.issues.length + " \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23" : "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49";
    byId("report-result").dataset.result = report.issues.length ? "issues" : "none";
    const lighthouse = report.lighthouse;
    const scoreProvider = 'Lighthouse (\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07)';
    const scoreMessages = {
      'not-requested': '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08',
      BROWSER_UNAVAILABLE: 'Lighthouse: \u0e40\u0e1b\u0e34\u0e14 Chromium \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49',
      LIGHTHOUSE_TIMEOUT: 'Lighthouse: \u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14'
    };
    byId('lighthouse-status').textContent = lighthouse?.status === 'completed' ? scoreProvider : lighthouse?.status === 'partial' ?
      scoreProvider + ': \u0e1c\u0e25\u0e15\u0e23\u0e27\u0e08\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19 (' + (lighthouse.reason || 'score-unavailable') + ')' :
      (scoreMessages[lighthouse?.reason] || scoreProvider + ': \u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e04\u0e30\u0e41\u0e19\u0e19\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 (' + (lighthouse?.reason || 'unavailable') + ')');
    replaceContent(byId('lighthouse-categories'), '<div class="row g-3 mt-1">' + (lighthouse?.categories || []).map((category) => {
      const valid = category.status === 'completed' && Number.isFinite(category.score) && category.score >= 0 && category.score <= 1;
      const score = valid ? Math.round(category.score * 100) : null;
      const color = score === null ? 'secondary' : score >= 90 ? 'success' : score >= 50 ? 'warning' : 'danger';
      return '<div class="col-6 col-md-3 text-center" data-score-category="' + escapeHtml(category.id) + '"><div class="row justify-content-center">' +
        '<div class="col-6 col-lg-4"><div class="ratio ratio-1x1 rounded-circle border border-3 border-' + color + ' bg-' + color + '-subtle">' +
        '<span class="d-flex align-items-center justify-content-center font-monospace fs-4 text-' + color + '-emphasis" data-score-value>' +
        (score === null ? '--' : score) + '</span></div></div></div><p class="small text-break mt-2 mb-0">' + escapeHtml(category.title) + '</p>' +
        (score === null ? '<p class="small text-secondary mb-0">\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49</p>' : '') + '</div>';
    }).join('') + '</div>');
    byId('lighthouse-metadata').hidden = !lighthouse?.provider;
    const unknown = '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25';
    replaceContent(byId('lighthouse-metadata'), lighthouse?.provider ? [
      ['URL', lighthouse.requestedUrl || lighthouse.url], ['URL \u0e2a\u0e38\u0e14\u0e17\u0e49\u0e32\u0e22', lighthouse.finalUrl],
      ['\u0e42\u0e2b\u0e21\u0e14\u0e17\u0e35\u0e48\u0e02\u0e2d\u0e15\u0e23\u0e27\u0e08', lighthouse.strategy],
      ['\u0e40\u0e27\u0e25\u0e32\u0e08\u0e32\u0e01 engine', lighthouse.fetchTime], ['Lighthouse', lighthouse.engine?.version],
      ['Browser', lighthouse.engine?.userAgent], ['Form factor', lighthouse.mode?.formFactor], ['Throttling', lighthouse.mode?.throttlingMethod]
    ].map(([label, value]) => '<dt>' + escapeHtml(label) + '</dt><dd class="mb-2 text-break">' + escapeHtml(value || unknown) + '</dd>').join('') : '');
    const agentic = lighthouse?.agentic;
    byId('agentic-section').hidden = !lighthouse?.provider;
    byId('agentic-status').hidden = !lighthouse?.provider;
    byId('agentic-status').textContent = agentic?.total > 0 ?
      'Agentic Browsing: ' + agentic.passed + '/' + agentic.total + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e1c\u0e48\u0e32\u0e19' +
      (agentic.status === 'partial' ? ' (\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19)' : '') :
      'Agentic Browsing: \u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 (' + (lighthouse?.agentic?.reason || 'not-requested') + ')';
    byId('agentic-counts').textContent = agentic?.audits ?
      '\u0e44\u0e21\u0e48\u0e1c\u0e48\u0e32\u0e19 ' + agentic.failed + ' \u00b7 \u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 ' + agentic.notChecked +
      ' \u00b7 \u0e44\u0e21\u0e48\u0e40\u0e02\u0e49\u0e32\u0e02\u0e48\u0e32\u0e22/\u0e15\u0e23\u0e27\u0e08\u0e40\u0e2d\u0e07 ' + agentic.excluded +
      ' \u00b7 \u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a ' + agentic.informational : '';
    const agenticLabels = {
      pass: ['success', '\u0e1c\u0e48\u0e32\u0e19'], fail: ['danger', '\u0e44\u0e21\u0e48\u0e1c\u0e48\u0e32\u0e19'],
      'not-checked': ['warning', '\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49'], 'not-applicable': ['secondary', '\u0e44\u0e21\u0e48\u0e40\u0e02\u0e49\u0e32\u0e02\u0e48\u0e32\u0e22'],
      manual: ['secondary', '\u0e15\u0e49\u0e2d\u0e07\u0e15\u0e23\u0e27\u0e08\u0e40\u0e2d\u0e07'], informational: ['info', '\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a']
    };
    replaceContent(byId('agentic-audits'), (agentic?.audits || []).map(audit => {
      const [color, label] = agenticLabels[audit.status] || agenticLabels['not-checked'];
      return '<details class="border-top border-info-subtle py-2" data-agentic-audit="' + escapeHtml(audit.id) + '"><summary class="small text-break">' +
        '<span class="badge rounded-1 bg-' + color + '-subtle text-' + color + '-emphasis me-2">' + label + '</span>' + escapeHtml(audit.title) +
        '</summary><div class="small pt-2 text-break"><p>' + linkedText(audit.description) + '</p>' +
        '<p>' + escapeHtml(audit.reason || audit.explanation || audit.displayValue || '') + '</p>' +
        (audit.evidence || []).map(entry => '<dl class="mb-2">' + Object.entries(entry).map(([key, value]) => '<dt>' + escapeHtml(key) +
          '</dt><dd class="text-break mb-1">' + escapeHtml(value) + '</dd>').join('') + '</dl>').join('') +
        (audit.truncated ? '<p class="text-secondary">\u0e41\u0e2a\u0e14\u0e07\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19\u0e15\u0e32\u0e21\u0e25\u0e34\u0e21\u0e34\u0e15</p>' : '') + '</div></details>';
    }).join(''));
    byId('crawl-limit').hidden = !report.coverage.limitReached;
    byId('crawl-limit').textContent = report.coverage.limitReached ? limitMessage(report.crawl?.stopReason, report.crawl?.limits, report.coverage.fetched) : '';
    byId("not-checked-section").hidden = report.notChecked.length === 0;
    byId("not-checked-count").textContent = "(" + report.notChecked.length + ")";
    replaceContent(byId("not-checked-list"), report.notChecked.map((entry) => '<li class="mb-2 text-break">' +
      escapeHtml(entry.message) + ' <span class="text-secondary">(' + escapeHtml(entry.reason) + ')</span></li>').join(""));
    byId('discovery-section').hidden = !report.discovery;
    byId('discovery-count').textContent = report.discovery ? '(' + report.discovery.urls.length + ')' : '';
    replaceContent(byId('discovery-list'), (report.discovery?.urls || []).map((entry) => '<li class="mb-2 text-break" data-discovered-url="' +
      escapeHtml(entry.url) + '">' + escapeHtml(entry.url) + '<ul class="small ps-3">' + entry.sources.map((source) =>
        '<li class="text-break">' + escapeHtml(source.kind) + ' &middot; ' + escapeHtml(source.sourceUrl) +
        (source.selector ? ' &middot; ' + escapeHtml(source.selector) : '') + '</li>').join('') + '</ul></li>').join(''));
    byId('skipped-section').hidden = report.coverage.skipped.length === 0;
    byId('skipped-count').textContent = '(' + report.coverage.skipped.length + ')';
    replaceContent(byId('skipped-list'), report.coverage.skipped.map((entry) => '<li class="mb-2 text-break">' +
      escapeHtml(entry.url) + ' &middot; ' + escapeHtml(skipReason(entry.reason)) + '</li>').join(''));
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
    if (!issue) {
      const group = visibleIssueGroups(filteredIssues()).find((item) => item.id === id);
      if (!group) return;
      state.selectedIssue = null;
      const members = state.report.issues.filter((item) => group.issueIds.includes(item.id));
      openDrawer(group.title,
        '<p class="small text-break mb-2">' + escapeHtml(group.ruleId) + '</p><p class="small mb-3">' +
        group.count + ' \u0e1b\u0e31\u0e0d\u0e2b\u0e32 &middot; ' + group.urls.length + ' URL</p>' +
        (group.complete ? '' : '<p class="small mb-3">\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e1a\u0e32\u0e07\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a</p>') +
        '<section class="mb-4" data-group-members><h3 class="h6">\u0e1b\u0e31\u0e0d\u0e2b\u0e32</h3><ul class="list-unstyled small mb-0">' +
        members.map((item) => '<li class="mb-3">' + badge(item.severity) +
          '<button type="button" class="btn btn-link text-body text-decoration-none text-start text-break p-0 small d-block mt-1" data-issue-id="' +
          escapeHtml(item.id) + '">' + escapeHtml(item.title) + '</button><p class="text-break mb-0 mt-1">' + escapeHtml(item.url) + '</p></li>').join('') +
        '</ul></section><section data-group-urls><h3 class="h6">URL \u0e17\u0e35\u0e48\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07</h3><ul class="list-unstyled small mb-0">' +
        group.urls.map((url) => '<li class="mb-2 text-break">' + (state.report.pages.some((page) => page.finalUrl === url) ?
          '<button type="button" class="btn btn-link text-body text-decoration-none text-start text-break p-0 small" data-page-url="' +
          escapeHtml(url) + '">' + escapeHtml(url) + '</button>' : '<span data-unfetched-url="' + escapeHtml(url) + '">' + escapeHtml(url) + '</span>') +
          '</li>').join('') + '</ul></section>', trigger);
      return;
    }
    state.selectedIssue = issue;
    const guide = issue.ruleId === 'jsonld-semantics' && issue.details?.example ? ['แก้ JSON-LD บล็อกและตำแหน่งที่ระบุในหลักฐาน ตัวอย่างนี้เป็นแนวทาง ต้องแทนข้อมูลให้ตรงกับเนื้อหาจริง ห้ามสร้างราคา รีวิว หรือผู้เขียนที่ไม่มีอยู่จริง', issue.details.example] : codeGuides[issue.ruleId];
    openDrawer(issue.title,
      (issue.severity === 'review' ? '<p class="alert alert-warning small">ข้อนี้ต้องตรวจยืนยันเจตนาของหน้า ยังไม่ใช่ข้อผิดพลาดที่ควรเพิ่มโค้ดทันที</p>' : '') +
      '<section class="mb-4" data-code-guide><h3 class="h6">แก้ตรงไหน และเขียนอย่างไร</h3><p class="small text-break">' + escapeHtml(guide?.[0] || 'ดู URL และตำแหน่งในหลักฐานด้านล่าง แล้วแก้ template, route หรือการตั้งค่าที่สร้างหน้านั้น เครื่องมือไม่ทราบชื่อไฟล์ในโปรเจกต์ของคุณ') + '</p>' +
      (guide ? '<p class="small text-secondary">ตัวอย่างประกอบ ต้องปรับข้อความและ URL ให้ตรงเว็บจริง ถ้ามีโค้ดอยู่แล้วให้แก้ของเดิม ไม่เพิ่มซ้ำ</p><pre class="bg-dark text-light p-3 rounded-3 small overflow-auto"><code>' + escapeHtml(guide[1]) + '</code></pre>' : '') +
      '<p class="small mb-0">หลังแก้ ให้เปิด URL เดิมตรวจ HTML หรือ HTTP response ที่ส่งจริง แล้วตรวจซ้ำเพื่อยืนยันว่าปัญหาหาย</p></section>' +
      '<div class="d-flex align-items-center flex-wrap gap-2 mb-4">' + badge(issue.severity) +
      '<span class="small">' + escapeHtml(issue.ruleId) + '</span></div>' +
      '<section class="mb-4"><h3 class="h6">\u0e2a\u0e34\u0e48\u0e07\u0e17\u0e35\u0e48\u0e1e\u0e1a</h3><p class="small text-break mb-0">' + escapeHtml(issue.found) + '</p></section>' +
      (issue.details?.reuse ? '<section class="mb-4" data-metadata-reuse><h3 class="h6">\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e0b\u0e49\u0e33</h3>' +
        issue.details.reuse.pages.map(entry => '<details class="border-bottom border-info-subtle py-2 small"><summary class="text-break">' +
          escapeHtml(entry.url) + '</summary><dl class="mt-2 mb-0"><dt>H1</dt><dd class="text-break">' + escapeHtml(entry.h1.join(' | ') || '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a H1') +
          (!entry.h1Complete || entry.h1PreviewTruncated ? ' (\u0e41\u0e2a\u0e14\u0e07\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19)' : '') + '</dd><dt>Canonical</dt><dd class="text-break">' +
          escapeHtml(entry.canonicalTargets.join(' | ') || '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a canonical \u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e40\u0e1b\u0e47\u0e19 URL \u0e44\u0e14\u0e49') +
          (!entry.canonicalComplete || entry.canonicalTargetsOmitted ? ' (\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a)' : '') + '</dd><dt>Noindex</dt><dd>' +
          (entry.noindex ? '\u0e1e\u0e1a' : entry.noindexComplete ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49' : '\u0e22\u0e31\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49') + '</dd></dl>' +
          (entry.evidence.length ? '<details><summary>HTML / HTTP header</summary>' + entry.evidence.map(item =>
            '<pre class="bg-dark text-light p-3 rounded-1 small overflow-auto mt-2"><code>' + escapeHtml(item.source) + '</code></pre>').join('') + '</details>' : '') + '</details>').join('') +
        (issue.details.reuse.pagesOmitted ? '<p class="small mt-2">\u0e41\u0e2a\u0e14\u0e07 50 \u0e08\u0e32\u0e01 ' + issue.urls.length + ' \u0e2b\u0e19\u0e49\u0e32</p>' : '') + '</section>' : '') +
      '<section class="mb-4"><h3 class="h6">\u0e1c\u0e25\u0e01\u0e23\u0e30\u0e17\u0e1a</h3><p class="small mb-0">' + escapeHtml(issue.impact) + '</p></section>' +
      '<section class="mb-4"><div class="d-flex align-items-center justify-content-between mb-2"><h3 class="h6 mb-0">\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49</h3>' +
      '<button type="button" class="btn btn-sm btn-outline-primary" data-copy-kind="steps" aria-label="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49" title="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e27\u0e34\u0e18\u0e35\u0e41\u0e01\u0e49" data-bs-toggle="tooltip">' + icon('copy', 16) + '</button></div><ol class="small ps-3 mb-0">' +
      issue.steps.map((step) => '<li class="mb-2">' + linkedText(step) + '</li>').join('') + '</ol></section>' +
      '<section class="mb-4"><div class="d-flex align-items-center justify-content-between mb-2"><h3 class="h6 mb-0">\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19</h3>' +
      '<button type="button" class="btn btn-sm btn-outline-primary" data-copy-kind="evidence" aria-label="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19" title="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19" data-bs-toggle="tooltip">' + icon('copy', 16) + '</button></div>' +
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
        } else if (entry.kind === 'sitemap') {
          details = '<p class="small text-break mb-2">XML &middot; <code>' + escapeHtml(entry.selector) + '</code> &middot; loc #' +
            escapeHtml(entry.entryIndex) + '</p><pre class="bg-dark text-light p-3 rounded-1 small overflow-auto"><code>' + escapeHtml(entry.value) + '</code></pre>';
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
      '<section class="mb-4"><h3 class="h6">URL \u0e17\u0e35\u0e48\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07</h3><ul class="list-unstyled small mb-0">' +
      issue.urls.map((url) => '<li class="mb-2 text-break">' + (state.report.pages.some((page) => page.finalUrl === url) ?
        '<button type="button" class="btn btn-link text-body text-decoration-none text-start text-break p-0 small" data-page-url="' +
        escapeHtml(url) + '">' + escapeHtml(url) + '</button>' : '<span data-unfetched-url="' + escapeHtml(url) + '">' + escapeHtml(url) + '</span>') + '</li>').join('') + '</ul></section>' +
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
    const openGraph = page.metadata?.openGraph;
    const rendered = page.render;
    const indexing = page.checks.find((entry) => entry.ruleId === 'robots-indexing');
    openDrawer('\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2b\u0e19\u0e49\u0e32',
      '<p class="small text-break mb-3">' + escapeHtml(url) + '</p><div class="mb-4">' + badge(pageLevel(url)) + '</div>' +
      '<dl class="small"><dt>HTTP status</dt><dd class="mb-3">' + escapeHtml(page.status) +
      '</dd><dt>Title</dt><dd class="mb-3 text-break">' + escapeHtml(page.metadata?.title || '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21 title') +
      '</dd><dt>Canonical</dt><dd class="mb-3 text-break">' + escapeHtml(canonical.length ? canonical.map((item) => item.url || item.value).join('\n') : '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e01\u0e32\u0e23\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 canonical') +
      '</dd><dt>\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07 index</dt><dd class="mb-3 text-break">' + escapeHtml(indexing?.found || '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08') +
      '</dd></dl><section class="mb-4" data-open-graph><h3 class="h6">Open Graph &middot; \u0e41\u0e0a\u0e23\u0e4c\u0e25\u0e34\u0e07\u0e01\u0e4c</h3>' +
      (openGraph?.entries.length ? '<dl class="small mb-0">' + openGraph.entries.map((entry) => '<dt class="text-break"><code>' + escapeHtml(entry.property) +
        '</code></dt><dd class="mb-3 text-break" data-og-property="' + escapeHtml(entry.property) + '">' + escapeHtml(entry.content.slice(0, 1024) || '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21') +
        (entry.content.length > 1024 ? '<span class="d-block">\u0e41\u0e2a\u0e14\u0e07\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19</span>' : '') +
        (entry.resolvedUrl && entry.resolvedUrl !== entry.content ? '<span class="d-block mt-1">URL: ' + escapeHtml(entry.resolvedUrl.slice(0, 1024)) +
          (entry.resolvedUrl.length > 1024 ? ' (\u0e41\u0e2a\u0e14\u0e07\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19)' : '') + '</span>' : '') +
        '</dd>').join('') + '</dl>' :
        '<p class="small mb-0">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a Open Graph \u0e43\u0e19 HTML \u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49</p>') +
      (openGraph?.complete === false ? '<p class="small mt-2 mb-0">\u0e2d\u0e48\u0e32\u0e19 metadata \u0e44\u0e14\u0e49\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19</p>' : '') + '</section>' +
      (rendered ? '<section class="mb-4" data-render-comparison><h3 class="h6">JavaScript</h3><p class="small text-break">' +
        escapeHtml(rendered.status) + (rendered.reason ? ' &middot; ' + escapeHtml(rendered.reason) : '') + '</p>' +
        '<p class="small" data-google-index-status>\u0e2a\u0e16\u0e32\u0e19\u0e30 index \u0e02\u0e2d\u0e07 Google: \u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49</p>' +
        (rendered.after ? '<p class="small text-break">' + escapeHtml(rendered.engine.name + ' ' + rendered.engine.version) +
          ' &middot; ' + escapeHtml(rendered.completedAt) + '</p><p class="small text-break">DOM URL: ' + escapeHtml(rendered.after.documentUrl) +
          '</p><p class="small">\u0e2a\u0e34\u0e48\u0e07\u0e17\u0e35\u0e48\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19: ' + escapeHtml(rendered.changes.join(', ') || '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e17\u0e35\u0e48\u0e2a\u0e31\u0e07\u0e40\u0e01\u0e15') +
          '</p>' + ['before', 'after'].map((phase) => '<h4 class="h6 mt-3">' + (phase === 'before' ? 'HTML \u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19' : 'DOM \u0e2b\u0e25\u0e31\u0e07 JavaScript') +
            '</h4><dl class="small" data-render-phase="' + phase + '">' + ['title', 'description', 'canonical', 'h1'].map((key) =>
              '<dt>' + escapeHtml(key) + '</dt><dd class="text-break mb-2">' + escapeHtml(Array.isArray(rendered[phase][key]) ? rendered[phase][key].join('\n') : rendered[phase][key]) + '</dd>').join('') +
            '<dt>\u0e04\u0e27\u0e32\u0e21\u0e22\u0e32\u0e27\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e43\u0e19 body</dt><dd class="text-break mb-2">' + escapeHtml(rendered[phase].text.length) +
            ' \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23</dd></dl>').join('') : '') +
        (rendered.resources?.records.length ? '<details class="small mt-3"><summary>\u0e17\u0e23\u0e31\u0e1e\u0e22\u0e32\u0e01\u0e23\u0e02\u0e2d\u0e07 renderer</summary><ul class="ps-3 mt-2">' +
          rendered.resources.records.map((entry) => '<li class="text-break mb-2">' + escapeHtml(entry.url || '') + ' &middot; ' +
            escapeHtml(entry.reason || 'HTTP ' + entry.status) + '</li>').join('') + '</ul></details>' : '') + '</section>' : '') +
      '<section class="mb-4"><h3 class="h6">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08</h3><ul class="list-unstyled mb-0">' +
      page.checks.map((entry) => '<li class="mb-3">' + badge(entry.severity || entry.outcome) +
        '<p class="small text-break mt-1 mb-0">' + escapeHtml(entry.title) + ': ' + linkedText(entry.found) + '</p></li>').join('') +
      '</ul></section><section class="mb-4"><h3 class="h6">\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19</h3>' +
      (related.length ? '<ul class="list-unstyled mb-0">' + related.map((issue) => (
        '<li class="mb-2"><button type="button" class="btn btn-link text-body text-start text-break p-0 text-decoration-none small" data-issue-id="' +
        escapeHtml(issue.id) + '">' + escapeHtml(issue.title) + '</button></li>'
      )).join('') + '</ul>' : '<p class="small mb-0">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49</p>') +
      '</section>', trigger);
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

  function createExport(scope) {
    const metadata = { format: 'seo-checker-json', scope, exportedAt: new Date().toISOString() };
    if (scope === 'entire-round') return { ...state.report, export: metadata };
    const issues = filteredIssues();
    metadata.filters = {
      severity: byId('severity-filter').value, category: byId('category-filter').value,
      query: byId('issue-search').value, view: byId('issue-view-groups').checked ? 'groups' : 'list'
    };
    return {
      schemaVersion: state.report.schemaVersion, status: state.report.status, requestedUrl: state.report.requestedUrl,
      startedAt: state.report.startedAt, completedAt: state.report.completedAt, scope: state.report.scope,
      coverage: state.report.coverage, summary: state.report.summary, siteFiles: state.report.siteFiles || [],
      core_technical_checks: state.report.core_technical_checks || [],
      issues, issueGroups: visibleIssueGroups(issues), export: metadata
    };
  }

  function downloadBlob(content, type, filename) {
    const objectUrl = URL.createObjectURL(new Blob(content, { type }));
    downloadUrls.add(objectUrl);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    try { link.click(); } finally {
      link.remove();
      setTimeout(() => { URL.revokeObjectURL(objectUrl); downloadUrls.delete(objectUrl); }, 1000);
    }
  }

  function downloadFilename(kind) {
    const time = new Date(state.report.completedAt).toISOString().replace(/[:.]/g, '-');
    return 'seo-' + kind + '-' + time + '-round-' + state.round;
  }

  function clearRound(resetInput = false) {
    ++state.round;
    state.controller?.abort();
    state.controller = null;
    state.report = null;
    state.origin = null;
    state.selectedIssue = null;
    state.busy = false;
    state.exporting = false;
    state.page = 1;
    byId('report').hidden = true;
    byId('report').setAttribute('aria-busy', 'false');
    byId('core-technical-section').hidden = true;
    byId('core-technical-section').open = false;
    ['issue-rows', 'page-rows', 'detail-content', 'not-checked-list', 'lighthouse-categories', 'lighthouse-metadata', 'agentic-audits', 'discovery-list', 'skipped-list', 'progress-skipped-list', 'core-technical-list'].forEach((id) => replaceContent(byId(id), ''));
    byId('lighthouse-metadata').hidden = true;
    byId('agentic-status').hidden = true;
    byId('agentic-status').textContent = '';
    byId('agentic-counts').textContent = '';
    byId('agentic-section').hidden = true;
    ['summary-pages', 'summary-critical', 'summary-warning', 'summary-review', 'report-host', 'affected-summary',
      'issue-count', 'issue-result-status', 'page-result-status', 'pages-pager', 'report-scope', 'report-time', 'report-result',
      'not-checked-count', 'detail-title', 'app-message', 'scan-status', 'discovery-count', 'skipped-count', 'progress-counts', 'progress-url',
      'crawl-limit', 'progress-limit', 'core-technical-count'].forEach((id) => { byId(id).textContent = ''; });
    delete byId('report-result').dataset.result;
    byId('scan-status').dataset.state = 'idle';
    byId('scan-status').classList.remove('text-danger-emphasis');
    byId('not-checked-section').hidden = true;
    byId('not-checked-section').open = false;
    byId('discovery-section').hidden = true;
    byId('discovery-section').open = false;
    byId('skipped-section').hidden = true;
    byId('skipped-section').open = false;
    byId('crawl-progress').hidden = true;
    byId('progress-skips').hidden = true;
    byId('progress-skips').open = false;
    byId('crawl-limit').hidden = true;
    byId('progress-limit').hidden = true;
    ['issue-empty', 'page-empty', 'reset-filters', 'scan-spinner', 'cancel-button'].forEach((id) => byId(id).classList.add('d-none'));
    bootstrap.Dropdown.getInstance(byId('export-menu-button'))?.hide();
    byId('export-issue-count').textContent = '';
    ['export-menu-button', 'export-button', 'export-json-button', 'export-xlsx-button', 'export-issues-xlsx-button', 'pages-prev', 'pages-next'].forEach((id) => { byId(id).disabled = true; });
    byId('scan-icon').classList.remove('d-none');
    byId('scan-button').disabled = false;
    byId('scan-button-label').textContent = '\u0e15\u0e23\u0e27\u0e08\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c';
    byId('lighthouse-status').textContent = '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08';
    bootstrap.Collapse.getOrCreateInstance(byId('lighthouse-scores'), { toggle: false }).show();
    bootstrap.Tab.getOrCreateInstance(byId('issues-tab')).show();
    drawerTrigger = null;
    drawer.hide();
    ['severity-filter', 'category-filter', 'page-filter'].forEach((id) => { byId(id).value = 'all'; });
    ['issue-search', 'page-search'].forEach((id) => { byId(id).value = ''; });
    byId('issue-view-list').checked = true;
    byId('issue-view-groups').checked = false;
    if (resetInput) {
      byId('scan-form').reset();
      byId('website-url').value = '';
      byId('website-url').setCustomValidity('');
    }
  }

  function readAuditStream(response, onProgress) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '';
    let result;
    const consume = () => reader.read().then(({ done, value }) => {
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 512 * 1024 * 1024) throw new Error('Report frame too large');
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const frame = JSON.parse(line);
        if (result || !['progress', 'report', 'error'].includes(frame.type) || !frame.data) throw new Error('Invalid stream frame');
        if (frame.type === 'progress') onProgress(frame.data);
        else result = frame.data;
      }
      if (!done) return consume();
      if (buffer.trim() || !result) throw new Error('Incomplete report stream');
      return result;
    });
    return consume().then(undefined, (error) => reader.cancel().then(() => { throw error; }, () => { throw error; }))
      .finally(() => reader.releaseLock());
  }

  byId('export-button').addEventListener('click', () => {
    if (!state.report || state.busy) return;
    const report = createExport('filtered-issues');
    if (!report.issues.length) return;
    downloadBlob([JSON.stringify(report, null, 2), '\n'], 'application/json;charset=utf-8', downloadFilename('issues') + '.json');
  });

  byId('export-json-button').addEventListener('click', () => {
    if (!state.report || state.busy) return;
    const report = createExport('entire-round');
    downloadBlob([JSON.stringify(report, null, 2), '\n'], 'application/json;charset=utf-8', downloadFilename('report') + '.json');
  });

  for (const [id, scope] of [['export-xlsx-button', 'entire-round'], ['export-issues-xlsx-button', 'filtered-issues']]) {
    byId(id).addEventListener('click', () => {
      if (!state.report || state.busy || state.exporting) return;
      const report = createExport(scope);
      if (scope === 'filtered-issues' && !report.issues.length) return;
      const round = state.round;
      const filename = downloadFilename(scope === 'entire-round' ? 'report' : 'issues') + '.xlsx';
      state.exporting = true;
      byId('export-xlsx-button').disabled = true;
      byId('export-issues-xlsx-button').disabled = true;
      byId('app-message').textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e23\u0e49\u0e32\u0e07 XLSX';
      Promise.resolve().then(() => window.SEOReportExport.createWorkbook(report, window.ExcelJS).xlsx.writeBuffer()).then(buffer => {
        if (round !== state.round || state.busy || !state.report) return;
        downloadBlob([buffer], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename);
        byId('app-message').textContent = '';
      }).then(undefined, error => {
        if (round !== state.round) return;
        byId('app-message').textContent = error?.message === 'SPREADSHEET_TOO_LARGE' ?
          '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e43\u0e2b\u0e0d\u0e48\u0e40\u0e01\u0e34\u0e19\u0e44\u0e1b\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a XLSX \u0e01\u0e23\u0e38\u0e13\u0e32\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14 JSON' :
          '\u0e2a\u0e23\u0e49\u0e32\u0e07 XLSX \u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e22\u0e31\u0e07\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14 JSON \u0e44\u0e14\u0e49';
      }).finally(() => {
        if (round !== state.round || !state.report || state.busy) return;
        state.exporting = false;
        byId('export-xlsx-button').disabled = false;
        byId('export-issues-xlsx-button').disabled = filteredIssues().length === 0;
      });
    });
  }

  byId("scan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = byId("website-url");
    let url;
    try {
      const entered = input.value.trim();
      const local = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(entered);
      const explicitProtocol = /^[a-z][a-z\d+.-]*:/i.test(entered) && !/^[^/?#]+:\d+(?:[/?#]|$)/.test(entered);
      url = new URL(explicitProtocol ? entered : entered.startsWith('//') ? 'https:' + entered : (local ? 'http://' : 'https://') + entered);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
    } catch {
      input.setCustomValidity("\u0e01\u0e23\u0e2d\u0e01\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e40\u0e27\u0e47\u0e1a\u0e43\u0e2b\u0e49\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07 \u0e40\u0e0a\u0e48\u0e19 example.com / localhost:3000");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    clearRound();
    const round = state.round;
    const controller = new AbortController();
    state.controller = controller;
    state.busy = true;
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
      headers: { "Content-Type": "application/json", Accept: 'application/x-ndjson' },
      body: JSON.stringify({ url: url.href, strategy: byId('strategy-desktop').checked ? 'desktop' : 'mobile' })
    }).then((response) => {
      const body = (response.headers.get('content-type') || '').split(';')[0] === 'application/x-ndjson' ?
        readAuditStream(response, (progress) => {
          if (round !== state.round) return;
          if (!['discovered', 'fetched', 'analyzed', 'skipped'].every((key) => Number.isSafeInteger(progress[key]) && progress[key] >= 0) ||
            !Array.isArray(progress.skippedEntries) || progress.skippedEntries.length > 10000) throw new Error('Invalid progress');
          byId('crawl-progress').hidden = false;
          byId('progress-counts').textContent = '\u0e1e\u0e1a ' + progress.discovered + ' URL \u00b7 \u0e2d\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 ' + progress.fetched +
            ' \u00b7 \u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c ' + progress.analyzed + ' \u00b7 \u0e02\u0e49\u0e32\u0e21 ' + progress.skipped;
          byId('progress-url').textContent = progress.currentUrl || progress.origin;
          byId('progress-skips').hidden = progress.skippedEntries.length === 0;
          byId('progress-limit').hidden = !progress.limitReached;
          byId('progress-limit').textContent = progress.limitReached ? limitMessage(progress.stopReason, progress.limits, progress.fetched) : '';
          replaceContent(byId('progress-skipped-list'), progress.skippedEntries.map((entry) => '<li class="mb-1 text-break">' +
            escapeHtml(entry.url) + ' &middot; ' + escapeHtml(skipReason(entry.reason)) + '</li>').join(''));
        }) : response.json();
      return body.then((data) => {
        if (!response.ok || data.status === "failed") {
          throw Object.assign(new Error("Audit failed"), { publicMessage: data.message, code: data.error });
        }
        if (data.schemaVersion !== "2.0" || !["partial", "completed"].includes(data.status) || !Array.isArray(data.pages) ||
          !data.pages.length || !Array.isArray(data.issues) || !Array.isArray(data.notChecked) ||
          data.siteFiles !== undefined && !Array.isArray(data.siteFiles) ||
          data.core_technical_checks !== undefined && !Array.isArray(data.core_technical_checks)) {
          throw new Error("Invalid report");
        }
        return data;
      });
    }).then((data) => {
      if (round !== state.round) return;
      state.report = data;
      const coreChecks = (data.core_technical_checks || []).filter(entry => entry.group !== 'site-files');
      byId('core-technical-section').hidden = coreChecks.length === 0;
      byId('core-technical-count').textContent = '(' + coreChecks.length + ')';
      replaceContent(byId('core-technical-list'), coreChecks.map(entry => {
        const color = entry.status === 'pass' ? 'success' : ['fail', 'review'].includes(entry.status) ? 'warning' : 'secondary';
        return '<details class="border-bottom border-info-subtle py-2 small" data-core-check="' + escapeHtml(entry.id) + '" data-core-status="' + escapeHtml(entry.status) + '">' +
          '<summary class="text-break"><span class="badge rounded-1 fw-normal bg-' + color + '-subtle text-' + color + '-emphasis me-2">' + escapeHtml(entry.statusLabel) + '</span>' + escapeHtml(entry.title) + '</summary>' +
          '<div class="mt-2"><p class="text-break mb-2">' + linkedText(entry.found) + '</p>' +
          (entry.recommendation ? '<p class="text-break mb-2">' + linkedText(entry.recommendation) + '</p>' : '') +
          '<p class="text-break mb-2">' + escapeHtml(entry.group) + ' &middot; ' + escapeHtml(entry.scope) + (entry.url ? ' &middot; ' + escapeHtml(entry.url) : '') + '</p>' +
          (entry.reason ? '<p class="text-break mb-2">' + escapeHtml(entry.reason) + '</p>' : '') +
          (entry.complete === false ? '<p class="mb-2">\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a</p>' : '') +
          (entry.steps?.length ? '<ol class="ps-3 mb-2">' + entry.steps.map(step => '<li class="text-break mb-2">' + linkedText(step) + '</li>').join('') + '</ol>' : '') +
          (entry.evidence?.length ? '<pre class="bg-dark text-light p-3 rounded-1 small overflow-auto">' + escapeHtml(JSON.stringify(entry.evidence, null, 2)) + '</pre>' : '') +
          (entry.issueIds || []).map(id => '<button type="button" class="btn btn-link text-success-emphasis p-0 d-block text-start text-break mb-2" data-core-issue-id="' + escapeHtml(id) + '">' + escapeHtml(data.issues.find(issue => issue.id === id)?.title || id) + '</button>').join('') + '</div></details>';
      }).join(''));
      byId('crawl-progress').hidden = true;
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
      const cancelled = controller.signal.aborted;
      clearRound();
      if (cancelled) {
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
    clearRound(true);
    downloadUrls.forEach((url) => URL.revokeObjectURL(url));
    downloadUrls.clear();
  });
  window.addEventListener('pageshow', (event) => { if (event.persisted) clearRound(true); });
  byId("website-url").addEventListener("input", () => byId("website-url").setCustomValidity(""));

  ["severity-filter", "category-filter"].forEach((id) => byId(id).addEventListener("change", renderIssues));
  ['issue-view-list', 'issue-view-groups'].forEach((id) => byId(id).addEventListener('change', renderIssues));
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
    const coreIssueButton = event.target.closest('[data-core-issue-id]');
    if (coreIssueButton) { openIssue(coreIssueButton.dataset.coreIssueId, coreIssueButton); return; }
    const issueButton = event.target.closest("[data-issue-id]");
    if (issueButton) { openIssue(issueButton.dataset.issueId, issueButton); return; }
    const pageButton = event.target.closest("[data-page-url]");
    if (pageButton) { openPage(pageButton.dataset.pageUrl, pageButton); return; }
  });
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach((button) => {
    button.addEventListener("shown.bs.tab", () => {
      document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab) => {
        tab.classList.toggle("bg-light", tab.classList.contains("active"));
        tab.classList.toggle("bg-transparent", !tab.classList.contains("active"));
      });
    });
  });
  drawerElement.addEventListener("hidden.bs.offcanvas", () => {
    if (drawerTrigger?.isConnected && drawerTrigger.getClientRects().length) drawerTrigger.focus();
  });

  // Normal loads and back/forward restoration both start a fresh page-local round.
  clearRound(true);
  activateControls();
})();
