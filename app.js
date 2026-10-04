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

  const issues = [
    {
      id: "noindex", severity: "critical", category: "index",
      title: "\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e21\u0e35\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e2b\u0e49\u0e32\u0e21\u0e40\u0e02\u0e49\u0e32 index",
      paths: ["/services/seo"],
      found: '\u0e1e\u0e1a <meta name="robots" content="noindex, follow"> \u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48',
      impact: "\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07 noindex \u0e2b\u0e49\u0e32\u0e21\u0e19\u0e33\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49\u0e44\u0e1b\u0e41\u0e2a\u0e14\u0e07\u0e43\u0e19\u0e1c\u0e25\u0e04\u0e49\u0e19\u0e2b\u0e32 \u0e41\u0e21\u0e49\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e08\u0e30\u0e40\u0e1b\u0e34\u0e14\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49\u0e15\u0e32\u0e21\u0e1b\u0e01\u0e15\u0e34",
      location: "\u0e2a\u0e48\u0e27\u0e19 <head> \u0e02\u0e2d\u0e07 HTML \u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e32\u0e23\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32 robots \u0e02\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49",
      steps: [
        "\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e19\u0e35\u0e49\u0e41\u0e2a\u0e14\u0e07\u0e43\u0e19\u0e1c\u0e25\u0e04\u0e49\u0e19\u0e2b\u0e32 \u0e2b\u0e32\u0e01\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e2a\u0e48\u0e27\u0e19\u0e15\u0e31\u0e27\u0e43\u0e2b\u0e49\u0e04\u0e07 noindex \u0e44\u0e27\u0e49",
        "\u0e19\u0e33\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07 noindex \u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01 metadata \u0e02\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49 \u0e41\u0e25\u0e30\u0e15\u0e23\u0e27\u0e08 HTTP header X-Robots-Tag \u0e14\u0e49\u0e27\u0e22",
        "\u0e2b\u0e25\u0e31\u0e07\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48 \u0e15\u0e23\u0e27\u0e08\u0e2b\u0e19\u0e49\u0e32 live \u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07\u0e43\u0e19 URL Inspection \u0e02\u0e2d\u0e07 Search Console"
      ],
      before: '<meta name="robots" content="noindex, follow">',
      after: '<!-- Remove the noindex directive from this public page. -->\n<title>SEO Services | Example Studio</title>',
      doc: "https://developers.google.com/search/docs/crawling-indexing/block-indexing"
    },
    {
      id: "broken-links", severity: "critical", category: "links",
      title: "\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19\u0e1e\u0e32\u0e44\u0e1b\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e41\u0e25\u0e49\u0e27",
      paths: ["/pricing", "/faq", "/old-pricing"],
      found: "\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e08\u0e32\u0e01 /pricing \u0e41\u0e25\u0e30 /faq \u0e0a\u0e35\u0e49\u0e44\u0e1b /old-pricing \u0e0b\u0e36\u0e48\u0e07\u0e15\u0e2d\u0e1a HTTP 404",
      impact: "\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e44\u0e1b\u0e15\u0e48\u0e2d\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u0e41\u0e25\u0e30\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19\u0e1e\u0e32 crawler \u0e44\u0e1b\u0e22\u0e31\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32",
      location: '\u0e25\u0e34\u0e07\u0e01\u0e4c <a href="/old-pricing"> \u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e15\u0e49\u0e19\u0e17\u0e32\u0e07',
      steps: [
        "\u0e41\u0e01\u0e49\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e43\u0e19 /pricing \u0e41\u0e25\u0e30 /faq \u0e43\u0e2b\u0e49\u0e0a\u0e35\u0e49\u0e44\u0e1b\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e32\u0e04\u0e32\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19",
        "\u0e16\u0e49\u0e32\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e14\u0e34\u0e21\u0e22\u0e49\u0e32\u0e22\u0e08\u0e23\u0e34\u0e07\u0e41\u0e25\u0e30\u0e21\u0e35\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48\u0e17\u0e35\u0e48\u0e17\u0e14\u0e41\u0e17\u0e19\u0e44\u0e14\u0e49 \u0e43\u0e2b\u0e49\u0e15\u0e31\u0e49\u0e07 redirect 301 \u0e08\u0e32\u0e01 URL \u0e40\u0e14\u0e34\u0e21\u0e44\u0e1b URL \u0e43\u0e2b\u0e21\u0e48",
        "\u0e16\u0e49\u0e32\u0e25\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e14\u0e41\u0e17\u0e19 \u0e43\u0e2b\u0e49\u0e04\u0e07 404 \u0e41\u0e25\u0e30\u0e19\u0e33\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19\u0e2d\u0e2d\u0e01"
      ],
      before: '<a href="/old-pricing">Pricing</a>',
      after: '<a href="/pricing">Pricing</a>',
      samplePath: "/faq",
      doc: "https://developers.google.com/search/docs/crawling-indexing/links-crawlable"
    },
    {
      id: "canonical", severity: "critical", category: "index",
      title: "Canonical \u0e02\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e0a\u0e35\u0e49\u0e44\u0e1b\u0e1c\u0e34\u0e14\u0e2b\u0e19\u0e49\u0e32",
      paths: ["/services/web-design"],
      found: "\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e2d\u0e2d\u0e01\u0e41\u0e1a\u0e1a\u0e40\u0e27\u0e47\u0e1a\u0e21\u0e35\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e40\u0e09\u0e1e\u0e32\u0e30 \u0e41\u0e15\u0e48\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 /services \u0e40\u0e1b\u0e47\u0e19 URL \u0e2b\u0e25\u0e31\u0e01",
      impact: "\u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e31\u0e0d\u0e0d\u0e32\u0e13\u0e43\u0e2b\u0e49 Google \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e27\u0e21\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e41\u0e17\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e41\u0e2a\u0e14\u0e07\u0e41\u0e22\u0e01\u0e01\u0e31\u0e19",
      location: '<link rel="canonical"> \u0e43\u0e19\u0e2a\u0e48\u0e27\u0e19 <head>',
      steps: [
        "\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32 /services/web-design \u0e40\u0e1b\u0e47\u0e19\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e41\u0e2a\u0e14\u0e07\u0e41\u0e22\u0e01\u0e08\u0e32\u0e01 /services",
        "\u0e15\u0e31\u0e49\u0e07 canonical \u0e02\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e2d\u0e2d\u0e01\u0e41\u0e1a\u0e1a\u0e40\u0e27\u0e47\u0e1a\u0e43\u0e2b\u0e49\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a URL \u0e2b\u0e25\u0e31\u0e01\u0e02\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49",
        "\u0e43\u0e0a\u0e49 URL \u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e43\u0e19\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19\u0e41\u0e25\u0e30 sitemap \u0e2b\u0e32\u0e01\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e33\u0e40\u0e19\u0e32\u0e42\u0e14\u0e22\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08 canonical \u0e40\u0e14\u0e34\u0e21\u0e2d\u0e32\u0e08\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07"
      ],
      before: '<link rel="canonical" href="{origin}/services">',
      after: '<link rel="canonical" href="{origin}/services/web-design">',
      doc: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"
    },
    {
      id: "duplicate-title", severity: "warning", category: "onpage",
      title: "\u0e2b\u0e25\u0e32\u0e22\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e0a\u0e49 Title \u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19",
      paths: ["/about", "/services"],
      found: '\u0e2a\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e21\u0e35\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19\u0e43\u0e0a\u0e49 <title>Example Studio</title> \u0e40\u0e2b\u0e21\u0e37\u0e2d\u0e19\u0e01\u0e31\u0e19',
      impact: "\u0e0a\u0e37\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e21\u0e48\u0e0a\u0e48\u0e27\u0e22\u0e41\u0e22\u0e01\u0e27\u0e48\u0e32\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e08\u0e30\u0e40\u0e08\u0e2d\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e2d\u0e30\u0e44\u0e23 \u0e40\u0e1b\u0e47\u0e19\u0e08\u0e38\u0e14\u0e17\u0e35\u0e48\u0e04\u0e27\u0e23\u0e1b\u0e23\u0e31\u0e1a \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e2b\u0e49\u0e32\u0e21 index",
      location: "Title \u0e02\u0e2d\u0e07\u0e41\u0e15\u0e48\u0e25\u0e30\u0e2b\u0e19\u0e49\u0e32 \u0e2b\u0e23\u0e37\u0e2d template \u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e2b\u0e21\u0e37\u0e2d\u0e19\u0e01\u0e31\u0e19\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c",
      steps: [
        "\u0e15\u0e31\u0e49\u0e07 title \u0e02\u0e2d\u0e07 /about \u0e43\u0e2b\u0e49\u0e1a\u0e2d\u0e01\u0e27\u0e48\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e29\u0e31\u0e17",
        "\u0e15\u0e31\u0e49\u0e07 title \u0e02\u0e2d\u0e07 /services \u0e43\u0e2b\u0e49\u0e1a\u0e2d\u0e01\u0e27\u0e48\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 \u0e40\u0e0a\u0e48\u0e19 Services | Example Studio",
        "\u0e43\u0e0a\u0e49\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e48\u0e2a\u0e37\u0e48\u0e2d\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e08\u0e23\u0e34\u0e07\u0e02\u0e2d\u0e07\u0e41\u0e15\u0e48\u0e25\u0e30\u0e2b\u0e19\u0e49\u0e32 \u0e41\u0e25\u0e49\u0e27\u0e15\u0e23\u0e27\u0e08\u0e27\u0e48\u0e32\u0e04\u0e48\u0e32\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e15\u0e32\u0e21 URL \u0e2b\u0e25\u0e31\u0e07\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48"
      ],
      before: "<title>Example Studio</title>",
      after: "<title>About Us | Example Studio</title>",
      doc: "https://developers.google.com/search/docs/appearance/title-link"
    },
    {
      id: "missing-description", severity: "warning", category: "onpage",
      title: "\u0e1a\u0e17\u0e04\u0e27\u0e32\u0e21\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35 Meta Description",
      paths: ["/blog/seo-basics", "/blog/website-checklist"],
      found: "\u0e44\u0e21\u0e48\u0e1e\u0e1a meta description \u0e43\u0e19 HTML \u0e02\u0e2d\u0e07\u0e2a\u0e2d\u0e07\u0e1a\u0e17\u0e04\u0e27\u0e32\u0e21",
      impact: "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e17\u0e35\u0e48\u0e40\u0e2a\u0e19\u0e2d\u0e43\u0e2b\u0e49\u0e43\u0e0a\u0e49\u0e43\u0e19\u0e1c\u0e25\u0e04\u0e49\u0e19\u0e2b\u0e32 Google \u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e08\u0e32\u0e01\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e40\u0e2d\u0e07\u0e44\u0e14\u0e49\u0e2d\u0e22\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27",
      location: "Metadata \u0e43\u0e19\u0e2a\u0e48\u0e27\u0e19 <head> \u0e02\u0e2d\u0e07\u0e41\u0e15\u0e48\u0e25\u0e30\u0e1a\u0e17\u0e04\u0e27\u0e32\u0e21",
      steps: [
        "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e2a\u0e31\u0e49\u0e19 \u0e46 \u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e41\u0e15\u0e48\u0e25\u0e30\u0e1a\u0e17\u0e04\u0e27\u0e32\u0e21",
        "\u0e40\u0e02\u0e35\u0e22\u0e19\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e43\u0e2b\u0e49\u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19\u0e15\u0e32\u0e21\u0e1a\u0e17\u0e04\u0e27\u0e32\u0e21\u0e41\u0e25\u0e30\u0e2b\u0e25\u0e35\u0e01\u0e40\u0e25\u0e35\u0e48\u0e22\u0e07\u0e01\u0e32\u0e23\u0e22\u0e31\u0e14\u0e04\u0e33\u0e04\u0e49\u0e19",
        "\u0e15\u0e23\u0e27\u0e08\u0e27\u0e48\u0e32\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e08\u0e23\u0e34\u0e07\u0e43\u0e19 content \u0e02\u0e2d\u0e07 meta description \u0e2b\u0e25\u0e31\u0e07\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48"
      ],
      before: "<head>\n  <title>SEO Basics | Example Studio</title>\n</head>",
      after: '<meta name="description" content="Learn how titles, crawlable links and indexing rules help search engines understand your website.">',
      doc: "https://developers.google.com/search/docs/appearance/snippet"
    },
    {
      id: "sitemap", severity: "warning", category: "sitemap",
      title: "Sitemap \u0e22\u0e31\u0e07\u0e21\u0e35 URL \u0e17\u0e35\u0e48\u0e15\u0e2d\u0e1a 404",
      paths: ["/old-pricing"],
      found: "/sitemap.xml \u0e22\u0e31\u0e07\u0e23\u0e30\u0e1a\u0e38 /old-pricing \u0e0b\u0e36\u0e48\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27",
      impact: "Sitemap \u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e48\u0e07 URL \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e43\u0e2b\u0e49 crawler \u0e04\u0e27\u0e23\u0e23\u0e30\u0e1a\u0e38\u0e2b\u0e19\u0e49\u0e32\u0e2b\u0e25\u0e31\u0e01\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e41\u0e2a\u0e14\u0e07\u0e43\u0e19\u0e1c\u0e25\u0e04\u0e49\u0e19\u0e2b\u0e32",
      location: "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 URL \u0e43\u0e19 /sitemap.xml \u0e2b\u0e23\u0e37\u0e2d\u0e42\u0e04\u0e49\u0e14\u0e17\u0e35\u0e48\u0e2a\u0e23\u0e49\u0e32\u0e07 sitemap",
      steps: [
        "\u0e19\u0e33 /old-pricing \u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01 sitemap",
        "\u0e04\u0e07 URL \u0e2b\u0e25\u0e31\u0e01\u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e44\u0e14\u0e49\u0e41\u0e25\u0e30\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e1e\u0e1a \u0e23\u0e27\u0e21\u0e16\u0e36\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e32\u0e04\u0e32\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19",
        "\u0e2b\u0e32\u0e01\u0e43\u0e0a\u0e49 sitemap generator \u0e43\u0e2b\u0e49\u0e41\u0e01\u0e49\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e15\u0e49\u0e19\u0e17\u0e32\u0e07\u0e41\u0e25\u0e30\u0e15\u0e23\u0e27\u0e08\u0e44\u0e1f\u0e25\u0e4c\u0e17\u0e35\u0e48\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e43\u0e2b\u0e21\u0e48"
      ],
      before: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>{origin}/pricing</loc></url>\n  <url><loc>{origin}/old-pricing</loc></url>\n</urlset>',
      after: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>{origin}/pricing</loc></url>\n  <!-- Keep the other valid canonical URLs here. -->\n</urlset>',
      samplePath: "/sitemap.xml",
      doc: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap"
    },
    {
      id: "missing-alt", severity: "warning", category: "images",
      title: "\u0e23\u0e39\u0e1b\u0e17\u0e35\u0e48\u0e2a\u0e37\u0e48\u0e2d\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22",
      paths: ["/team", "/projects/portfolio"],
      found: "\u0e23\u0e39\u0e1b\u0e17\u0e35\u0e21\u0e07\u0e32\u0e19\u0e41\u0e25\u0e30\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e1c\u0e25\u0e07\u0e32\u0e19\u0e44\u0e21\u0e48\u0e21\u0e35 alt attribute",
      impact: "\u0e42\u0e1b\u0e23\u0e41\u0e01\u0e23\u0e21\u0e2d\u0e48\u0e32\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e08\u0e2d\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e23\u0e39\u0e1b \u0e41\u0e25\u0e30 search engine \u0e21\u0e35\u0e1a\u0e23\u0e34\u0e1a\u0e17\u0e02\u0e2d\u0e07\u0e23\u0e39\u0e1b\u0e19\u0e49\u0e2d\u0e22\u0e25\u0e07",
      location: "<img> \u0e02\u0e2d\u0e07\u0e23\u0e39\u0e1b\u0e17\u0e35\u0e48\u0e2a\u0e37\u0e48\u0e2d\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e21\u0e07\u0e32\u0e19\u0e41\u0e25\u0e30\u0e1c\u0e25\u0e07\u0e32\u0e19",
      steps: [
        "\u0e40\u0e1e\u0e34\u0e48\u0e21 alt \u0e17\u0e35\u0e48\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e2a\u0e34\u0e48\u0e07\u0e17\u0e35\u0e48\u0e23\u0e39\u0e1b\u0e41\u0e2a\u0e14\u0e07\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e01\u0e23\u0e30\u0e0a\u0e31\u0e1a",
        "\u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e43\u0e2b\u0e49\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a\u0e23\u0e39\u0e1b\u0e08\u0e23\u0e34\u0e07 \u0e44\u0e21\u0e48\u0e43\u0e2a\u0e48\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e04\u0e33\u0e04\u0e49\u0e19\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07",
        '\u0e16\u0e49\u0e32\u0e23\u0e39\u0e1b\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e1e\u0e35\u0e22\u0e07\u0e02\u0e2d\u0e07\u0e15\u0e01\u0e41\u0e15\u0e48\u0e07 \u0e43\u0e2b\u0e49\u0e43\u0e0a\u0e49 alt="" \u0e41\u0e17\u0e19\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19'
      ],
      before: '<img src="/images/team.jpg">',
      after: '<img src="/images/team.jpg" alt="Example Studio team at work">',
      doc: "https://developers.google.com/search/docs/appearance/google-images"
    },
    {
      id: "javascript-content", severity: "review", category: "render",
      title: "\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e1b\u0e23\u0e32\u0e01\u0e0f\u0e2b\u0e25\u0e31\u0e07\u0e23\u0e31\u0e19 JavaScript \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19",
      paths: ["/tools/seo-preview"],
      found: 'HTML \u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19\u0e21\u0e35\u0e40\u0e1e\u0e35\u0e22\u0e07 <div id="app"></div> \u0e2a\u0e48\u0e27\u0e19\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e21\u0e32\u0e2b\u0e25\u0e31\u0e07 JavaScript \u0e17\u0e33\u0e07\u0e32\u0e19',
      impact: "Google \u0e23\u0e31\u0e19 JavaScript \u0e44\u0e14\u0e49 \u0e41\u0e15\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e2a\u0e33\u0e04\u0e31\u0e0d\u0e1b\u0e23\u0e32\u0e01\u0e0f\u0e15\u0e2d\u0e19 render \u0e1c\u0e25\u0e19\u0e35\u0e49\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e23\u0e38\u0e1b\u0e27\u0e48\u0e32\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e02\u0e49\u0e32 index \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49",
      location: "HTML \u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19\u0e41\u0e25\u0e30 DOM \u0e2b\u0e25\u0e31\u0e07\u0e23\u0e31\u0e19 JavaScript",
      steps: [
        "\u0e43\u0e0a\u0e49 URL Inspection \u0e2b\u0e23\u0e37\u0e2d Rich Results Test \u0e15\u0e23\u0e27\u0e08 HTML \u0e2b\u0e25\u0e31\u0e07 render",
        "\u0e15\u0e23\u0e27\u0e08\u0e27\u0e48\u0e32\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e2a\u0e33\u0e04\u0e31\u0e0d\u0e1b\u0e23\u0e32\u0e01\u0e0f \u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e21\u0e35 resource \u0e17\u0e35\u0e48\u0e16\u0e39\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2b\u0e23\u0e37\u0e2d\u0e42\u0e2b\u0e25\u0e14\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14",
        "\u0e1e\u0e34\u0e08\u0e32\u0e23\u0e13\u0e32 server-side rendering \u0e2b\u0e23\u0e37\u0e2d pre-rendering \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2a\u0e48\u0e07\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e2a\u0e33\u0e04\u0e31\u0e0d\u0e43\u0e19 HTML \u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19"
      ],
      before: '<div id="app"></div>\n<script src="/assets/app.js"></script>',
      after: "<main>\n  <h1>SEO Preview</h1>\n  <p>Check website metadata and crawlability.</p>\n</main>",
      doc: "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics"
    }
  ];

  const pageData = [
    ["/", "Example Studio | Home"], ["/about", "Example Studio"], ["/services", "Example Studio"],
    ["/services/web-design", "Web Design | Example Studio"], ["/services/seo", "SEO Services | Example Studio"],
    ["/blog", "Blog | Example Studio"], ["/blog/seo-basics", "SEO Basics | Example Studio"],
    ["/blog/website-checklist", "Website Checklist | Example Studio"], ["/blog/site-speed", "Site Speed | Example Studio"],
    ["/blog/robots-guide", "Robots Guide | Example Studio"], ["/blog/sitemap-guide", "Sitemap Guide | Example Studio"],
    ["/blog/canonical-guide", "Canonical Guide | Example Studio"], ["/projects", "Projects | Example Studio"],
    ["/projects/storefront", "Storefront | Example Studio"], ["/projects/portfolio", "Portfolio | Example Studio"],
    ["/projects/booking", "Booking | Example Studio"], ["/contact", "Contact | Example Studio"],
    ["/pricing", "Pricing | Example Studio"], ["/faq", "FAQ | Example Studio"],
    ["/privacy", "Privacy | Example Studio"], ["/terms", "Terms | Example Studio"],
    ["/team", "Team | Example Studio"], ["/tools/seo-preview", "SEO Preview | Example Studio"],
    ["/old-pricing", "Page Not Found"]
  ];
  const pages = pageData.map(([path, title]) => ({
    path, title, status: path === "/old-pricing" ? 404 : 200,
    noindex: path === "/services/seo",
    canonical: path === "/services/web-design" ? "/services" : path
  }));
  const state = { origin: null, page: 1, selectedIssue: null };
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

  byId("scan-form").addEventListener("submit", async (event) => {
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
    byId("report").hidden = true;
    byId("export-button").disabled = true;
    byId("app-message").textContent = "";
    state.selectedIssue = null;
    drawer.hide();
    byId("scan-button").disabled = true;
    byId("scan-button-label").textContent = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e15\u0e23\u0e35\u0e22\u0e21...";
    byId("scan-status").textContent = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e15\u0e23\u0e35\u0e22\u0e21\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07";
    byId("report").setAttribute("aria-busy", "true");
    // This preview only reuses local fixtures; it never fetches the submitted website.
    await new Promise((resolve) => setTimeout(resolve, 450));
    state.origin = url.origin;
    state.page = 1;
    resetIssueFilters();
    byId("page-filter").value = "all";
    byId("page-search").value = "";
    renderSummary();
    renderPages();
    bootstrap.Tab.getOrCreateInstance(byId("issues-tab")).show();
    byId("scan-status").textContent = "\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e02\u0e2d\u0e07 " + url.hostname + " \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e41\u0e25\u0e49\u0e27 \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c\u0e08\u0e23\u0e34\u0e07";
    byId("scan-button").disabled = false;
    byId("scan-button-label").textContent = "\u0e15\u0e23\u0e27\u0e08\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07";
    byId("report").setAttribute("aria-busy", "false");
    byId("report").hidden = false;
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
