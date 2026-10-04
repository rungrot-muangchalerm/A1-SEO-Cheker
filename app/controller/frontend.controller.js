module.exports = {
  index: (req, res) => {
    res.set("Cache-Control", "no-store");
    res.render("page/index", {
      title: "SEO Checker",
      scripts: ["https://cdn.jsdelivr.net/npm/lucide@1.51.0/dist/umd/lucide.min.js", "/assets/js/app.js"]
    });
  },
  notFound: (req, res) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Endpoint not found." });
    }
    res.status(404).render("page/404", { title: "404 | SEO Checker", scripts: [] });
  }
};
