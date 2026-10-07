module.exports = {
  apps: [{
    name: 'seo-checker',
    script: './index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    env: {
      NODE_ENV: 'production',
      LIVERELOAD: 'false'
    }
  }]
};
