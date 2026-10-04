require("dotenv").config({ quiet: true });
const express = require("express");
const path = require("node:path");
const expressLayouts = require("express-ejs-layouts");
const config = require("./app/config/server.config");
const responseMiddleware = require("./app/middleware/response.middleware");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.set("layout", "layouts/main.layout.ejs");
  app.use(expressLayouts);
  app.use(responseMiddleware.headers);
  app.use(express.json({ limit: "4kb" }));
  app.use("/assets", express.static(path.join(__dirname, "assets"), {
    dotfiles: "deny", index: false
  }));
  app.use(require("./app/routes/router"));
  app.use(responseMiddleware.error);
  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log("SEO Checker: http://" + config.host + ":" + config.port);
  }).on("error", () => {
    console.error("Unable to start SEO Checker. Check HOST and PORT.");
    process.exitCode = 1;
  });
}

module.exports = { createApp };
