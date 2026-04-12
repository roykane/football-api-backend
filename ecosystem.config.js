// PM2 Configuration for Production
module.exports = {
  apps: [{
    name: 'football-api',
    script: './server.js',
    instances: 'max',        // Tận dụng tất cả CPU cores
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Graceful restart
    kill_timeout: 5000,
    listen_timeout: 10000,
    // Auto restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
  }]
};
