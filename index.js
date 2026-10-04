console.clear();
require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const port = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('layout', false);
app.use(expressLayouts);

// Body & cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static: /assets and fallback to assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'assets')));

// LiveReload (optional, when LIVERELOAD=true)
require('./tools/live_server.js')(app);

// Main router (frontend + API)
app.use(require('./app/routes/router.js'));

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
