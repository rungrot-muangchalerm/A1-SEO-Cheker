const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: wait } = require('node:timers/promises');

module.exports = {
  start: async (t, env = {}) => {
    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const child = spawn(process.execPath, ['index.js'], { cwd: path.resolve(__dirname, '../..'), windowsHide: true,
      env: { ...process.env, PORT: String(port), LIVERELOAD: 'false', NODE_DEBUG: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    const stop = async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    };
    t.after(stop);
    const origin = 'http://127.0.0.1:' + port;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error('Server startup failed');
      try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) return { child, origin, port, stop, logs: () => ({ stdout, stderr }) }; } catch {}
      await wait(50);
    }
    throw new Error('Server startup timed out');
  }
};
