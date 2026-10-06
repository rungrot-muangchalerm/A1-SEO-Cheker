(() => {
  'use strict';

  const limits = Object.freeze({ maxCells: 1000000, maxRows: 100000, maxCellCharacters: 30000 });

  function text(value) {
    let result = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    result = result.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,
      character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
    // Keep untrusted spreadsheet text literal; the source JSON is never changed.
    if (/^(?:[\u0000-\u0020]*[=+@\-\uff1d\uff0b\uff0d\uff20]|[\t\r\n])/.test(result)) result = "'" + result;
    return result;
  }

  function createWorkbook(report, ExcelJS) {
    if (!ExcelJS?.Workbook) throw new Error('SPREADSHEET_LIBRARY_UNAVAILABLE');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SEO Checker';
    workbook.created = new Date(report.export.exportedAt);
    workbook.modified = workbook.created;
    const longText = [];
    let cells = 0;

    const sheet = (name, headers, rows) => {
      if (cells + headers.length > limits.maxCells) throw new Error('SPREADSHEET_TOO_LARGE');
      const worksheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }],
        properties: { defaultRowHeight: 30, tabColor: { argb: 'FF15803D' } } });
      worksheet.columns = headers.map(header => ({ header, width: /URL|Text|Source|Found|Steps|Impact|Details/i.test(header) ? 60 : 28 }));
      cells += headers.length;
      const header = worksheet.getRow(1);
      header.height = 24;
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
      for (const values of rows) {
        if (worksheet.rowCount >= limits.maxRows || cells + headers.length > limits.maxCells) throw new Error('SPREADSHEET_TOO_LARGE');
        cells += headers.length;
        const row = worksheet.addRow(values.map(value => (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean' ? value : text(value)));
        row.alignment = { vertical: 'top', wrapText: true };
        row.eachCell(cell => {
          if (typeof cell.value !== 'string') return;
          cell.numFmt = '@';
          if (cell.value.length <= limits.maxCellCharacters) return;
          const original = cell.value;
          let offset = 0;
          let part = 0;
          while (offset < original.length) {
            let end = Math.min(original.length, offset + Math.floor(limits.maxCellCharacters / 6) - 1);
            if (end < original.length && /[\ud800-\udbff]/.test(original[end - 1])) --end;
            if (cells + (longText.length + 1) * 4 > limits.maxCells || longText.length >= limits.maxRows - 1) throw new Error('SPREADSHEET_TOO_LARGE');
            longText.push([name, cell.address, ++part, JSON.stringify(original.slice(offset, end))]);
            offset = end;
          }
          cell.value = '[Full text: Long Text / ' + name + ' / ' + cell.address + ']';
        });
      }
      worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: worksheet.rowCount, column: headers.length } };
      return worksheet;
    };

    const summary = [
      ['Schema', report.schemaVersion], ['Status', report.status], ['Requested URL', report.requestedUrl],
      ['Started At', report.startedAt], ['Completed At', report.completedAt], ['Exported At', report.export.exportedAt],
      ['Export Scope', report.export.scope], ['Filters', report.export.filters || {}], ['Scope', report.scope],
      ['Coverage', report.coverage], ['Summary', report.summary], ['Selected Issues', report.issues.length],
      ['Crawl', report.crawl], ['PageSpeed Status', report.lighthouse?.status], ['PageSpeed Reason', report.lighthouse?.reason]
    ];
    sheet('Summary', ['Field', 'Value'], summary);
    if (report.pages) sheet('Pages', ['Requested URL', 'Final URL', 'HTTP Status', 'Fetch Status', 'Analysis Status', 'Title', 'Description', 'Canonical', 'Googlebot Allowed'],
      report.pages.map(page => [page.requestedUrl, page.finalUrl, page.status, page.fetchStatus, page.analysisStatus,
        page.metadata?.title, page.metadata?.description, page.metadata?.canonical, page.robots?.googlebotAllowed]));
    sheet('Issues', ['Issue ID', 'Rule ID', 'Rule Version', 'Outcome', 'Severity', 'Category', 'Title', 'Found', 'Impact', 'Steps', 'Complete', 'Reason', 'Details', 'References'],
      report.issues.map(issue => [issue.id, issue.ruleId, issue.ruleVersion, issue.outcome, issue.severity, issue.category, issue.title,
        issue.found, issue.impact, issue.steps, issue.complete, issue.reason, issue.details, issue.references]));
    function* issueUrls() {
      for (const issue of report.issues) for (const url of issue.urls || []) yield [issue.id, issue.ruleId, url];
    }
    sheet('Issue URLs', ['Issue ID', 'Rule ID', 'URL'], issueUrls());
    function* evidence() {
      for (const issue of report.issues) for (const entry of issue.evidence || []) yield [issue.id, entry.sourceUrl || entry.url,
        entry.kind, entry.selector || entry.name, entry.location?.startLine, entry.location?.startColumn, entry];
    }
    sheet('Evidence', ['Issue ID', 'Source URL', 'Kind', 'Selector', 'Line', 'Column', 'Evidence JSON'], evidence());
    if (report.pages) {
      sheet('Scores', ['Category ID', 'Title', 'Score', 'Display Score', 'URL', 'Strategy', 'Provider', 'Fetched At'],
        (report.lighthouse?.categories || []).map(category => [category.id, category.title, category.score, category.displayScore,
          report.lighthouse.url, report.lighthouse.strategy, report.lighthouse.provider, report.lighthouse.fetchTime]));
      sheet('Not Checked', ['Rule ID', 'URL', 'Reason', 'Message'], (report.notChecked || []).map(entry => [entry.id, entry.url, entry.reason, entry.message]));
      sheet('Discovered', ['URL', 'Sources'], (report.discovery?.urls || []).map(entry => [entry.url, entry.sources]));
      sheet('Skipped', ['URL', 'Reason'], (report.coverage?.skipped || []).map(entry => [entry.url, entry.reason]));
    }
    if (longText.length) sheet('Long Text', ['Sheet', 'Cell', 'Part', 'Text JSON'], longText);
    return workbook;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createWorkbook, limits };
  else window.SEOReportExport = { createWorkbook, limits };
})();
