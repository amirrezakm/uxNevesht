#!/bin/bash

# Quick Fix Script for UX Nevesht Build Issues
# Run this as root to fix the current deployment issues

set -e

APP_DIR="/var/www/ux-nevesht"
APP_USER="uxnevesht"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

log "Quick fix for UX Nevesht deployment issues..."

# 1. Stop any errored PM2 processes
log "Cleaning up PM2 processes..."
sudo -u $APP_USER pm2 delete all 2>/dev/null || true
sudo -u $APP_USER pm2 kill 2>/dev/null || true

# 2. Fix the build issues
log "Fixing build issues..."
sudo -u $APP_USER bash << 'EOF'
cd /var/www/ux-nevesht

# Set proper PATH
export PATH="/usr/bin:$PATH:$PWD/node_modules/.bin"

# Clean install
rm -rf node_modules
pnpm install

# Install TypeScript globally if not available
if ! command -v tsc >/dev/null 2>&1 && [ ! -f "node_modules/.bin/tsc" ]; then
    echo "Installing TypeScript globally..."
    npm install -g typescript
fi

# Build API manually with proper error handling
echo "Building API..."
cd apps/api
if [ -f "package.json" ]; then
    pnpm install
    
    # Try different build methods
    if pnpm run build 2>/dev/null; then
        echo "✅ API built with pnpm"
    elif ../../node_modules/.bin/tsc 2>/dev/null; then
        echo "✅ API built with root tsc"
    elif tsc 2>/dev/null; then
        echo "✅ API built with global tsc"
    else
        echo "❌ API build failed, but continuing..."
    fi
fi
cd ../..

# Build Web manually
echo "Building Web..."
cd apps/web
if [ -f "package.json" ]; then
    pnpm install
    
    # Set environment variables for build
    export NODE_ENV=production
    export NEXT_TELEMETRY_DISABLED=1
    
    if pnpm run build 2>/dev/null; then
        echo "✅ Web built successfully"
    else
        echo "❌ Web build failed, but continuing..."
    fi
fi
cd ../..

EOF

# 3. Create a simplified PM2 config that works with what we have
log "Creating simplified PM2 configuration..."
sudo -u $APP_USER tee $APP_DIR/ecosystem.simple.js > /dev/null << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ux-nevesht-api',
      script: './apps/api/dist/index.js',
      cwd: '/var/www/ux-nevesht',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 4000
    },
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
        NEXT_TELEMETRY_DISABLED: 1
      },
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      log_file: '../../logs/web-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
EOF

# 4. Start services based on what's available
log "Starting services..."
sudo -u $APP_USER bash << 'EOF'
cd /var/www/ux-nevesht

# Check what we can start
API_READY=false
WEB_READY=false

if [ -f "apps/api/dist/index.js" ]; then
    echo "✅ API build found"
    API_READY=true
else
    echo "❌ API build missing"
fi

if [ -d "apps/web/.next" ] && [ -f "apps/web/package.json" ]; then
    echo "✅ Web build found"
    WEB_READY=true
else
    echo "❌ Web build missing"
fi

# Start what we can
if [ "$API_READY" = "true" ] && [ "$WEB_READY" = "true" ]; then
    echo "Starting both services..."
    pm2 start ecosystem.simple.js
elif [ "$API_READY" = "true" ]; then
    echo "Starting API only..."
    pm2 start ecosystem.simple.js --only ux-nevesht-api
elif [ "$WEB_READY" = "true" ]; then
    echo "Starting Web only..."
    pm2 start ecosystem.simple.js --only ux-nevesht-web
else
    echo "No services can be started - builds failed"
    exit 1
fi

# Save PM2 configuration
pm2 save

# Show status
pm2 list

EOF

# 5. Test the services
log "Testing services..."
sleep 5

# Test API if it should be running
if sudo -u $APP_USER pm2 list | grep -q "ux-nevesht-api.*online"; then
    if curl -f -s http://localhost:3001/health >/dev/null 2>&1; then
        log "✅ API is responding"
    else
        warn "⚠️  API is running but not responding to health check"
    fi
fi

# Test Web if it should be running
if sudo -u $APP_USER pm2 list | grep -q "ux-nevesht-web.*online"; then
    if curl -f -s http://localhost:3000 >/dev/null 2>&1; then
        log "✅ Web is responding"
    else
        warn "⚠️  Web is running but not responding"
    fi
fi

# 6. Show final status
log "Final status:"
sudo -u $APP_USER pm2 list

log ""
log "🎉 Quick fix completed!"
log ""
log "Next steps:"
log "1. Check PM2 logs if services are not working: sudo -u $APP_USER pm2 logs"
log "2. Update environment variables: nano $APP_DIR/.env"
log "3. Restart services after env changes: sudo -u $APP_USER pm2 restart all"
log "4. Test your application: curl http://localhost:3000"
log ""
log "If you still have build issues, run: sudo -u $APP_USER ./debug-build.sh"
