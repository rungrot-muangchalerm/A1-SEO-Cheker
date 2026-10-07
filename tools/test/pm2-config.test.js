const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const config = require('../../ecosystem.config');
const manifest = require('../../package.json');

test('PM2 runs one fork without file watching or LiveReload and preserves the dotenv port', () => {
  assert.equal(config.apps.length, 1);
  const [app] = config.apps;
  assert.equal(app.name, 'seo-checker');
  assert.equal(app.instances, 1);
  assert.equal(app.exec_mode, 'fork');
  assert.equal(app.watch, false);
  assert.equal(app.autorestart, true);
  assert.equal(app.restart_delay, 3000);
  assert.deepEqual(app.env, { NODE_ENV: 'production', LIVERELOAD: 'false' });
});

test('PM2 resolves the project entry and dotenv working directory from another directory', () => {
  const file = path.resolve(__dirname, '../../ecosystem.config.js');
  const result = spawnSync(process.execPath, ['-e',
    'const config = require(process.argv[1]); console.log(JSON.stringify(config.apps[0]));', file],
  { cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const app = JSON.parse(result.stdout);
  assert.equal(app.cwd, path.resolve(__dirname, '../..'));
  assert.equal(path.resolve(app.cwd, app.script), path.resolve(__dirname, '../../index.js'));
});

test('npm keeps the normal entry and targets only SEO Checker when starting or restarting PM2', () => {
  assert.equal(manifest.scripts.start, 'node index.js');
  assert.equal(manifest.scripts.dev, 'nodemon index.js');
  assert.equal(manifest.scripts['pm2:start'], 'pm2 start ecosystem.config.js --only seo-checker');
  assert.equal(manifest.scripts['pm2:restart'], 'pm2 restart ecosystem.config.js --only seo-checker --update-env');
  assert.equal(manifest.scripts['pm2:stop'], 'pm2 stop seo-checker');
  assert.ok(manifest.files.includes('ecosystem.config.js'));
});
