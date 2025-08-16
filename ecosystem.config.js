// PM2 Ecosystem Configuration for UX Nevesht
// Production deployment configuration

module.exports = {
  apps: [
    {
      name: 'ux-nevesht-api',
      script: './apps/api/dist/index.js',
      cwd: '/var/www/ux-nevesht',
      instances: 1, // Can be increased based on server capacity
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      
      // Logging
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      
      // Memory and performance
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      
      // Restart policy
      autorestart: true,
      watch: false, // Disable in production
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Advanced PM2 features
      merge_logs: true,
      combine_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Source map support for better error tracking
      source_map_support: true,
      
      // Custom restart conditions
      restart_delay: 4000,
      
      // Environment-specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info'
      }
    },
    
    {
      name: 'ux-nevesht-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/ux-nevesht/apps/web',
      instances: 1, // Can be increased for high traffic
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      
      // Logging
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      log_file: '../../logs/web-combined.log',
      time: true,
      
      // Memory and performance
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      
      // Restart policy
      autorestart: true,
      watch: false, // Disable in production
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Advanced PM2 features
      merge_logs: true,
      combine_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Custom restart conditions
      restart_delay: 4000,
      
      // Environment-specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info'
      }
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'uxnevesht',
      host: 'uxw.payanekhosh.ir',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/uxNevesht.git', // Update with actual repo
      path: '/var/www/ux-nevesht',
      
      // Pre-deployment commands
      'pre-deploy-local': '',
      
      // Post-receive commands
      'post-deploy': 'pnpm install && pnpm build && pm2 reload ecosystem.config.js --env production',
      
      // Pre-setup commands
      'pre-setup': '',
      
      // Post-setup commands  
      'post-setup': 'ls -la'
    }
  }
};
