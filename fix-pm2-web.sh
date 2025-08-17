#!/bin/bash

# Quick fix for PM2 web service configuration
# Run this on your server to fix the Next.js path issue

echo "🔧 Fixing PM2 Web Service Configuration"
echo "======================================="

# Stop and delete existing processes
echo "Cleaning up existing PM2 processes..."
sudo -u uxnevesht pm2 delete all 2>/dev/null || true
sudo -u uxnevesht pm2 kill 2>/dev/null || true

# Go to the web app directory
cd /var/www/ux-nevesht/apps/web

# Check if Next.js binary exists
if [ -f "node_modules/.bin/next" ]; then
    echo "✅ Next.js binary found at: $(pwd)/node_modules/.bin/next"
else
    echo "❌ Next.js binary not found. Installing dependencies..."
    sudo -u uxnevesht pnpm install
fi

# Create a proper PM2 ecosystem config for web only
echo "Creating fixed PM2 configuration..."
sudo -u uxnevesht tee /var/www/ux-nevesht/ecosystem.web-fixed.js > /dev/null << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ux-nevesht-web',
      script: './node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/ux-nevesht/apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/var/www/ux-nevesht/node_modules/.bin:/var/www/ux-nevesht/apps/web/node_modules/.bin'
      },
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      log_file: '../../logs/web-combined.log',
      time: true,
      max_memory_restart: '1G',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
EOF

# Start the web service with the fixed configuration
echo "Starting web service with fixed configuration..."
cd /var/www/ux-nevesht
sudo -u uxnevesht pm2 start ecosystem.web-fixed.js

# Save the PM2 configuration
sudo -u uxnevesht pm2 save

# Check status
echo ""
echo "PM2 Status:"
sudo -u uxnevesht pm2 list

# Test if the service is responding
echo ""
echo "Testing web service..."
sleep 5
if curl -I http://localhost:3000 2>/dev/null | head -1; then
    echo "✅ Web service is responding!"
    echo ""
    echo "🎉 Your website should now be working at:"
    echo "   https://uxw.payanekhosh.ir"
else
    echo "❌ Web service is not responding yet. Check logs:"
    echo "   sudo -u uxnevesht pm2 logs ux-nevesht-web"
fi

echo ""
echo "🔧 Management commands:"
echo "- Check status: sudo -u uxnevesht pm2 list"
echo "- View logs: sudo -u uxnevesht pm2 logs ux-nevesht-web"
echo "- Restart: sudo -u uxnevesht pm2 restart ux-nevesht-web"

