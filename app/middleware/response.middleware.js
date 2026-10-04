module.exports = {
  headers: (req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      res.set("Cache-Control", "no-store");
    }
    next();
  },
  error: (error, req, res, next) => {
    if (res.headersSent) return next(error);
    // Do not log requests or upstream data; they may contain private site content.
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "INVALID_JSON", message: "Invalid JSON body." });
    }
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "BODY_TOO_LARGE", message: "Request body is too large." });
    }
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to complete this request." });
    }
    res.status(500).type("text/plain").send("Unable to display this page.");
  }
};
