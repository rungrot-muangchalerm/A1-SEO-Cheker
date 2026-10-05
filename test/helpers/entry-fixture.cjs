// Preloaded only by the restart test's child process, never by the application entry point.
require('./transport').stubTransport({ mock: { method: (object, name, implementation) => { object[name] = implementation; } } }, [
  { html: '<title>PRIVATE_RESTART_FIXTURE</title><h1>Fixture</h1>' },
  { status: 404 }
]);
