const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../index");

test("DevTeam scaffold serves the existing UI and only public assets", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const origin = "http://127.0.0.1:" + server.address().port;
  const response = await fetch(origin);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<html lang="th">/);
  assert.match(html, /id="scan-form"/);
  assert.match(html, /id="report"[^>]* hidden/);
  assert.match(html, /src="\/assets\/js\/app.js"/);
  assert.equal((html.match(/bootstrap\.bundle\.min\.js/g) || []).length, 1);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  const script = await fetch(origin + "/assets/js/app.js");
  assert.equal(script.status, 200);
  assert.match(await script.text(), /Each page load starts a fresh round/);
  for (const target of ["/TODO.md", "/package.json", "/.env", "/views/page/index.ejs", "/app/controller/frontend.controller.js"]) {
    assert.equal((await fetch(origin + target)).status, 404);
  }
  const unknown = await fetch(origin + "/api/missing");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("cache-control"), "no-store");
  assert.deepEqual(await unknown.json(), { error: "NOT_FOUND", message: "Endpoint not found." });
});
