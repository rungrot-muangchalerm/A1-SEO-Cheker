// Google Search Central rules reviewed 2026-10-17. No remote contexts are fetched.
const base = 'https://developers.google.com/search/docs/appearance/structured-data/';
const rules = {
  Article: { guide: 'article', recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author'], sample: { headline: 'ชื่อบทความจริง', image: 'https://example.com/article.jpg', datePublished: '2026-10-17T09:00:00+07:00', author: { '@type': 'Person', name: 'ชื่อผู้เขียนจริง' } } },
  Organization: { guide: 'organization', recommended: ['name', 'url', 'logo'], sample: { name: 'ชื่อองค์กรจริง', url: 'https://example.com', logo: 'https://example.com/logo.png' } },
  Product: { guide: 'product-snippet', required: ['name'], sample: { name: 'ชื่อสินค้าจริง', offers: { '@type': 'Offer', price: '100.00', priceCurrency: 'THB' } } },
  BreadcrumbList: { guide: 'breadcrumb', required: ['itemListElement'], sample: { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: 'https://example.com/' }, { '@type': 'ListItem', position: 2, name: 'หน้าปัจจุบัน' }] } }
};
const types = value => (Array.isArray(value) ? value : [value]).filter(item => typeof item === 'string').map(item => item.replace(/^https?:\/\/schema.org\//, ''));
const text = value => typeof value === 'string' && value.trim().length > 0;
const present = value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
const list = value => Array.isArray(value) ? value : [value];
const webUrl = value => { try { return text(value) && ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
const money = value => (typeof value === 'number' || typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) && Number.isFinite(Number(value)) && Number(value) >= 0;
const isoDate = value => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
};

module.exports = {
  analyze: (page, script, value) => {
    const nodes = [], queue = [{ value, path: '$', context: null, depth: 0 }];
    let visited = 0;
    while (queue.length) {
      const node = queue.pop();
      if (++visited > 10000 || node.depth > 64) return [];
      if (!node.value || typeof node.value !== 'object') continue;
      const context = Object.hasOwn(node.value, '@context') ? node.value['@context'] : node.context;
      if (!Array.isArray(node.value)) nodes.push({ ...node, context });
      for (const [key, child] of Object.entries(node.value)) if (key !== '@context') queue.push({ value: child, path: node.path + '.' + key, context, depth: node.depth + 1 });
    }
    const ids = new Map();
    for (const node of nodes) if (text(node.value['@id']) && Object.keys(node.value).length > 1) ids.set(node.value['@id'], node.value);
    const resolve = object => object && typeof object === 'object' && Object.keys(object).length === 1 && text(object['@id']) ? ids.get(object['@id']) || object : object;
    const results = [];
    for (const node of nodes) {
      const object = node.value;
      const declared = types(object['@type']);
      if (!declared.length && (node.path !== '$' || object['@graph'])) continue;
      if (results.length >= 100) {
        const last = results.at(-1);
        last.complete = false;
        last.reason = 'jsonld-semantic-limit';
        last.outcome = last.outcome === 'pass' ? 'review' : last.outcome;
        last.severity ||= 'review';
        last.found += ' · ถึงขีดจำกัด 100 วัตถุต่อบล็อก ยังตรวจไม่ครบ';
        break;
      }
      const type = declared.find(type => Object.hasOwn(rules, type) || ['NewsArticle', 'BlogPosting'].includes(type));
      if (!type && node.path !== '$' && declared.some(type => ['Person', 'Offer', 'AggregateOffer', 'ListItem', 'ImageObject', 'PostalAddress', 'PriceSpecification'].includes(type))) continue;
      // Nested supporting objects are validated through their owning supported type.
      if (!type && node.path !== '$' && !/\.\@graph\.\d+$/.test(node.path) && !/^\$\.\d+$/.test(node.path)) continue;
      const normalized = ['NewsArticle', 'BlogPosting'].includes(type) ? 'Article' : type;
      const rule = Object.hasOwn(rules, normalized) ? rules[normalized] : undefined;
      const required = [], recommended = [], invalid = [], pending = [];
      const standardContext = typeof node.context === 'string' && /^https?:\/\/schema.org\/?$/.test(node.context);
      if (!standardContext) pending.push('ยังไม่รองรับการขยาย @context นี้ ใช้ Rich Results Test ตรวจต่อ');
      if (!rule) pending.push('ยังไม่มีกฎสำหรับ @type ' + (declared.join(', ') || '(ไม่ระบุ)'));
      if (rule && standardContext) {
        for (const key of rule.required || []) if (!present(object[key])) required.push(key);
        for (const key of rule.recommended || []) if (!present(object[key])) recommended.push(key);
        for (const key of ['name', 'headline']) if (present(object[key]) && !text(object[key])) invalid.push(key + ' ต้องเป็นข้อความ');
        for (const key of ['url', 'logo', 'image']) if (present(object[key])) {
          if (!list(object[key]).every(item => { item = resolve(item); return webUrl(item) || item && typeof item === 'object' && webUrl(item.url || item.contentUrl || item['@id']); })) invalid.push(key + ' ต้องเป็น URL HTTP/HTTPS หรือวัตถุที่ระบุ URL');
        }
        if (normalized === 'Article') {
          for (const key of ['datePublished', 'dateModified']) if (present(object[key]) && !isoDate(object[key])) invalid.push(key + ' ต้องเป็นวันที่ ISO 8601');
          if (present(object.author)) for (let author of list(object.author)) {
            author = resolve(author);
            if (author?.['@id'] && Object.keys(author).length === 1) pending.push('ยังไม่พบข้อมูล author ที่อ้างด้วย @id');
            else if (!author || typeof author !== 'object' || !types(author['@type']).some(type => ['Person', 'Organization'].includes(type)) || !text(author.name)) recommended.push('author ต้องระบุ @type Person/Organization และ name');
          }
        }
        if (normalized === 'BreadcrumbList' && present(object.itemListElement)) {
          const items = object.itemListElement;
          if (!Array.isArray(items) || items.length < 2) required.push('itemListElement ต้องมี ListItem อย่างน้อย 2 รายการ');
          else items.forEach((raw, i) => {
            const item = resolve(raw);
            const path = 'itemListElement[' + i + ']';
            if (item?.['@id'] && Object.keys(item).length === 1) { pending.push(path + ' ยังแก้ @id ไม่ได้'); return; }
            if (!item || !types(item['@type']).includes('ListItem')) { invalid.push(path + '.@type ต้องเป็น ListItem'); return; }
            if (!Number.isInteger(item.position) || item.position !== i + 1) invalid.push(path + '.position ต้องเรียงจาก 1');
            if (!text(item.name) && !text(resolve(item.item)?.name)) required.push(path + '.name');
            if (i < items.length - 1 || present(item.item)) if (!webUrl(item.item) && !webUrl(item.item?.['@id'])) required.push(path + '.item ต้องเป็น URL');
          });
        }
        if (normalized === 'Product') {
          if (!['offers', 'review', 'aggregateRating'].some(key => present(object[key]))) required.push('offers หรือ review หรือ aggregateRating อย่างน้อยหนึ่งรายการ');
          if (present(object.review) || present(object.aggregateRating)) pending.push('กฎรีวิวและคะแนนรีวิวยังต้องตรวจต่อด้วย Rich Results Test');
          if (present(object.offers)) for (let offer of list(object.offers)) {
            offer = resolve(offer);
            if (!offer || typeof offer !== 'object' || !types(offer['@type']).some(type => ['Offer', 'AggregateOffer'].includes(type))) { pending.push('offers ต้องเป็น Offer/AggregateOffer หรือ @id ที่แก้ได้'); continue; }
            if (types(offer['@type']).includes('AggregateOffer')) {
              if (!money(offer.lowPrice)) required.push('offers.lowPrice ต้องเป็นราคาตั้งแต่ 0 ขึ้นไป');
              if (!/^[A-Z]{3}$/.test(offer.priceCurrency || '')) required.push('offers.priceCurrency ต้องเป็นรหัสสกุลเงิน 3 ตัว');
            } else {
              const price = offer.price ?? resolve(offer.priceSpecification)?.price;
              if (!money(price)) required.push('offers.price หรือ offers.priceSpecification.price ต้องเป็นราคาตั้งแต่ 0 ขึ้นไป');
              if (!/^[A-Z]{3}$/.test(offer.priceCurrency || resolve(offer.priceSpecification)?.priceCurrency || '')) recommended.push('offers.priceCurrency เช่น THB');
            }
          }
        }
      }
      const outcome = !rule || !standardContext ? 'not-checked' : required.length || invalid.length ? 'fail' : recommended.length || pending.length ? 'review' : 'pass';
      const sample = rule ? { '@context': 'https://schema.org', '@type': type, ...rule.sample } : null;
      results.push({
        id: 'jsonld-semantics:' + script.index + ':' + results.length, ruleId: 'jsonld-semantics', ruleVersion: '2026-10-17',
        url: page.finalUrl, urls: [page.finalUrl], category: 'onpage', title: 'Structured Data: ' + (type || declared.join(', ') || 'ไม่ระบุชนิด') + ' — บล็อก #' + script.index,
        outcome, severity: outcome === 'fail' ? 'warning' : outcome === 'review' ? 'review' : null, complete: pending.length === 0,
        ...(pending.length ? { reason: 'structured-data-partial-support' } : {}),
        found: [required.length ? 'ขาดข้อมูลบังคับ: ' + required.join('; ') : '', invalid.length ? 'ข้อมูลผิดรูปแบบ: ' + invalid.join('; ') : '', recommended.length ? 'แนะนำให้เพิ่มหรือปรับ: ' + recommended.join('; ') : '', ...pending].filter(Boolean).join(' · ') || 'ผ่านกฎโครงสร้างที่รองรับสำหรับชนิดนี้',
        impact: 'ข้อมูลนี้ช่วยให้ Google เข้าใจชนิดและรายละเอียดของเนื้อหา ช่องบังคับที่ขาดอาจทำให้ไม่เข้าเงื่อนไขผลค้นหารูปแบบนั้น ช่องแนะนำช่วยเติมรายละเอียด ต้องใช้ข้อมูลจริงที่ตรงกับสิ่งที่ผู้ใช้เห็น',
        steps: [...required.map(key => 'เพิ่มหรือแก้ช่องบังคับ ' + key + ' ในวัตถุที่ระบุ'), ...invalid.map(message => 'แก้รูปแบบ: ' + message), ...recommended.map(key => 'เพิ่มข้อมูลแนะนำ ' + key + ' เมื่อเกี่ยวข้องกับเนื้อหาจริง'), ...pending,
          'แก้ script[type="application/ld+json"] บล็อก #' + script.index + ' ตำแหน่ง ' + node.path + ' แล้วตรวจซ้ำ พร้อมยืนยันข้อมูลกับหน้าเว็บและ Rich Results Test'],
        evidence: [{ kind: script.kind, selector: script.selector, source: script.source, sourceTruncated: script.sourceTruncated, location: script.location, sourceUrl: page.finalUrl, scriptIndex: script.index, complete: script.contentComplete }],
        details: { required, recommended, invalid, pending, path: node.path, example: sample ? JSON.stringify(sample, null, 2) : null, scope: 'supported-google-properties', reviewedAt: '2026-10-17', contentAccuracy: 'manual-review' },
        references: [{ title: 'Google Search Central', url: base + (rule?.guide || 'intro-structured-data') }, { title: 'Rich Results Test', url: 'https://search.google.com/test/rich-results' }]
      });
    }
    return results;
  }
};
