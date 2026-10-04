const express = require('express');
const path = require('path');
const router = express.Router();

// Home
router.get('/', (req, res) => {
  res.render(path.join(__dirname, '../../../views/page/index.ejs'), {
    layout: path.join(__dirname, '../../../views/layouts/main.layout.ejs'),
    styles: [], // เช่น '/assets/css/home.css'
    scripts: [], // เช่น '/assets/js/home.js'
  });
});

module.exports = router;
