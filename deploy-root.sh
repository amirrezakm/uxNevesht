#!/bin/bash

# UX Nevesht Root Deployment Script for Ubuntu Server
# This version is designed to be run as root
# Domain: http://uxw.payanekhosh.ir

set -e  # Exit on any error

# Configuration
DOMAIN="uxw.payanekhosh.ir"
APP_NAME="ux-nevesht"
APP_USER="uxnevesht"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="https://github.com/amirrezakm/uxNevesht.git"
NODE_VERSION="18"
API_PORT="3001"
WEB_PORT="3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root (required for this version)
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root. Use: sudo ./deploy-root.sh"
    fi
    log "Running as root - proceeding with deployment..."
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt update && apt upgrade -y
    apt install -y curl wget git build-essential software-properties-common
}

# Install Node.js and package managers
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    # Install Node.js via NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    # Install pnpm and other tools globally
    log "Installing package managers and tools..."
    npm install -g pnpm typescript turbo pm2
    
    # Verify installations
    log "Verifying installations..."
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo "pnpm: $(pnpm --version)"
    echo "TypeScript: $(tsc --version)"
    echo "PM2: $(pm2 --version)"
}

# Install and configure Nginx
install_nginx() {
    log "Installing and configuring Nginx..."
    apt install -y nginx
    
    # Enable and start Nginx
    systemctl enable nginx
    systemctl start nginx
    
    # Allow Nginx through firewall
    ufw allow 'Nginx Full'
}

# Create application user
create_app_user() {
    log "Creating application user: $APP_USER..."
    
    if ! id "$APP_USER" &>/dev/null; then
        useradd -m -s /bin/bash $APP_USER
        usermod -aG www-data $APP_USER
        log "User $APP_USER created successfully"
    else
        log "User $APP_USER already exists"
    fi
}

# Setup application directory
setup_app_directory() {
    log "Setting up application directory..."
    
    mkdir -p $APP_DIR
    chown -R $APP_USER:www-data $APP_DIR
    chmod -R 755 $APP_DIR
}

# Clone and setup application with robust build process
setup_application() {
    log "Setting up application..."
    
    # Check if we're running from the source directory
    CURRENT_DIR=$(pwd)
    if [[ -f "$CURRENT_DIR/package.json" && -f "$CURRENT_DIR/turbo.json" ]]; then
        log "Found application source in current directory. Copying to $APP_DIR..."
        
        # Copy current directory to app directory
        cp -r "$CURRENT_DIR"/* "$APP_DIR/"
        cp -r "$CURRENT_DIR"/.[^.]* "$APP_DIR/" 2>/dev/null || true
        
        # Set proper ownership
        chown -R $APP_USER:www-data $APP_DIR
        
    else
        log "Cloning from repository..."
        
        # Switch to app user for git operations
        sudo -u $APP_USER bash << EOF
cd $APP_DIR

# Clone repository if it doesn't exist
if [ ! -d ".git" ]; then
    git clone $REPO_URL .
else
    git fetch origin
    git reset --hard origin/main
fi
EOF
    fi
    
    # Build application with robust error handling
    sudo -u $APP_USER bash << 'EOF'
cd $APP_DIR

# Set up proper PATH including global and local tools
export PATH="/usr/local/bin:/usr/bin:$PATH:$PWD/node_modules/.bin"

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

warn() {
    echo -e "\033[1;33m[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1\033[0m"
}

log "Starting build process..."

# Clean install dependencies
log "Installing dependencies..."
rm -rf node_modules package-lock.json yarn.lock
pnpm install

# Verify tools are available
log "Verifying build tools..."
if command -v tsc >/dev/null 2>&1; then
    log "✅ TypeScript compiler available: $(tsc --version)"
else
    warn "❌ TypeScript not found, installing locally..."
    pnpm add -D typescript
fi

if command -v turbo >/dev/null 2>&1; then
    log "✅ Turbo available: $(turbo --version)"
elif [ -f "node_modules/.bin/turbo" ]; then
    log "✅ Local Turbo available"
else
    warn "❌ Turbo not found"
fi

# Build strategy: Try multiple approaches
build_success=false

# Method 1: Try turbo build (preferred)
if ! $build_success; then
    log "Attempting build with Turbo..."
    if command -v turbo >/dev/null 2>&1; then
        if turbo build 2>&1 | tee build.log; then
            log "✅ Build successful with global turbo"
            build_success=true
        fi
    elif [ -f "node_modules/.bin/turbo" ]; then
        if ./node_modules/.bin/turbo build 2>&1 | tee build.log; then
            log "✅ Build successful with local turbo"
            build_success=true
        fi
    fi
fi

# Method 2: Try pnpm build
if ! $build_success; then
    log "Attempting build with pnpm..."
    if pnpm build 2>&1 | tee build.log; then
        log "✅ Build successful with pnpm"
        build_success=true
    fi
fi

# Method 3: Build packages individually
if ! $build_success; then
    log "Building packages individually..."
    
    # Build shared packages first
    for pkg in packages/config packages/database packages/ai packages/ui; do
        if [ -d "$pkg" ] && [ -f "$pkg/package.json" ]; then
            log "Building $pkg..."
            cd "$pkg"
            pnpm install
            if grep -q '"build"' package.json; then
                if pnpm run build; then
                    log "✅ $pkg built successfully"
                else
                    warn "❌ Failed to build $pkg"
                fi
            fi
            cd "$APP_DIR"
        fi
    done
    
    # Build API
    log "Building API..."
    if [ -d "apps/api" ]; then
        cd apps/api
        pnpm install
        
        # Try different build methods for API
        if pnpm run build; then
            log "✅ API built with pnpm"
        elif command -v tsc >/dev/null 2>&1; then
            log "Trying global TypeScript..."
            tsc && log "✅ API built with global tsc"
        elif [ -f "../../node_modules/.bin/tsc" ]; then
            log "Trying root TypeScript..."
            ../../node_modules/.bin/tsc && log "✅ API built with root tsc"
        else
            warn "❌ API build failed"
        fi
        cd "$APP_DIR"
    fi
    
    # Build Web
    log "Building Web..."
    if [ -d "apps/web" ]; then
        cd apps/web
        pnpm install
        
        # Set Next.js environment
        export NODE_ENV=production
        export NEXT_TELEMETRY_DISABLED=1
        
        if pnpm run build; then
            log "✅ Web built successfully"
        else
            warn "❌ Web build failed"
        fi
        cd "$APP_DIR"
    fi
fi

# Verify build outputs
log "Verifying build outputs..."
API_BUILT=false
WEB_BUILT=false

if [ -f "apps/api/dist/index.js" ]; then
    log "✅ API build output found: apps/api/dist/index.js"
    API_BUILT=true
else
    warn "❌ API build output missing"
    # List what we have
    if [ -d "apps/api/dist" ]; then
        log "Contents of apps/api/dist/:"
        ls -la apps/api/dist/
    fi
fi

if [ -d "apps/web/.next" ]; then
    log "✅ Web build output found: apps/web/.next/"
    WEB_BUILT=true
else
    warn "❌ Web build output missing"
fi

# Clean up
rm -f build.log

log "Build process completed."
log "API Built: $API_BUILT"
log "Web Built: $WEB_BUILT"

EOF
}

# Create environment file
create_env_file() {
    log "Creating environment configuration..."
    
    sudo -u $APP_USER tee $APP_DIR/.env > /dev/null << EOF
# Environment Configuration
NODE_ENV=production

# API Configuration
API_PORT=$API_PORT
API_HOST=0.0.0.0

# Web Configuration  
WEB_PORT=$WEB_PORT
NEXT_PUBLIC_API_URL=http://$DOMAIN/api

# Database Configuration (Update these with your actual values)
DATABASE_URL=your_database_url_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Redis Configuration (if using Redis)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret_here_minimum_32_characters
ENCRYPTION_KEY=your_encryption_key_here_32_characters

# OpenAI/AI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/var/www/$APP_NAME/uploads

# Logging
LOG_LEVEL=info
LOG_DIR=/var/www/$APP_NAME/logs

# Domain
DOMAIN=$DOMAIN
NEXT_PUBLIC_DOMAIN=$DOMAIN

# Next.js
NEXT_TELEMETRY_DISABLED=1
EOF

    log "Environment file created. Please update the values in $APP_DIR/.env"
}

# Create PM2 ecosystem file
create_pm2_config() {
    log "Creating PM2 ecosystem configuration..."
    
    sudo -u $APP_USER tee $APP_DIR/ecosystem.config.js > /dev/null << 'EOF'
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
      max_memory_restart: '1G',
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
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
EOF
}

# Create Nginx configuration
create_nginx_config() {
    log "Creating Nginx configuration..."
    
    # Clean up any existing configurations
    rm -f /etc/nginx/sites-enabled/ux-nevesht
    rm -f /etc/nginx/sites-available/ux-nevesht
    rm -f /etc/nginx/conf.d/rate-limiting.conf
    rm -f /etc/nginx/conf.d/*rate*.conf
    
    # Restore nginx.conf from backup if it exists
    if [ -f /etc/nginx/nginx.conf.backup ]; then
        log "Restoring nginx.conf from backup..."
        cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
    fi
    
    # Create rate limiting configuration
    log "Creating rate limiting configuration..."
    tee /etc/nginx/conf.d/rate-limiting.conf > /dev/null << 'EOF'
# Rate limiting zones for UX Nevesht
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=web:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=5r/s;
EOF
    
    # Create server configuration
    log "Creating server configuration..."
    tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;
    
    # Client settings
    client_max_body_size 10M;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:$API_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:$API_PORT/health;
        proxy_set_header Host \$host;
        access_log off;
    }
    
    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)\$ {
        proxy_pass http://localhost:$WEB_PORT;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Next.js static files
    location /_next/static/ {
        proxy_pass http://localhost:$WEB_PORT;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Main application
    location / {
        limit_req zone=web burst=50 nodelay;
        
        proxy_pass http://localhost:$WEB_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Security
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~* \.(env|log|conf)\$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # SEO files
    location = /robots.txt {
        proxy_pass http://localhost:$WEB_PORT/robots.txt;
        access_log off;
    }
    
    location = /sitemap.xml {
        proxy_pass http://localhost:$WEB_PORT/sitemap.xml;
        access_log off;
    }
    
    # Logs
    access_log /var/log/nginx/$APP_NAME-access.log;
    error_log /var/log/nginx/$APP_NAME-error.log;
}
EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    log "Testing Nginx configuration..."
    if nginx -t; then
        log "Nginx configuration is valid. Reloading..."
        systemctl reload nginx
        log "Nginx configured successfully"
    else
        error "Nginx configuration test failed"
    fi
}

# Setup logging directories
setup_logging() {
    log "Setting up logging directories..."
    
    sudo -u $APP_USER mkdir -p $APP_DIR/logs
    sudo -u $APP_USER mkdir -p $APP_DIR/uploads
    mkdir -p /var/log/nginx
    
    chown -R $APP_USER:www-data $APP_DIR/logs
    chown -R $APP_USER:www-data $APP_DIR/uploads
    chmod -R 755 $APP_DIR/logs
    chmod -R 755 $APP_DIR/uploads
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 'Nginx Full'
    
    log "Firewall configured successfully"
}

# Setup PM2 for app user
setup_pm2_for_user() {
    log "Setting up PM2 for application user..."
    
    # Configure PM2 startup
    env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
    
    log "PM2 startup configured successfully"
}

# Start services intelligently
start_services() {
    log "Starting application services..."
    
    sudo -u $APP_USER bash << 'EOF'
cd $APP_DIR

# Check what we can start
API_BUILT=false
WEB_BUILT=false

if [ -f "apps/api/dist/index.js" ]; then
    echo "✅ API build found"
    API_BUILT=true
else
    echo "❌ API build missing"
fi

if [ -d "apps/web/.next" ]; then
    echo "✅ Web build found"
    WEB_BUILT=true
else
    echo "❌ Web build missing"
fi

# Create appropriate PM2 config based on what's available
if [ "$API_BUILT" = "true" ] && [ "$WEB_BUILT" = "true" ]; then
    echo "Starting both API and Web services..."
    pm2 start ecosystem.config.js
elif [ "$API_BUILT" = "true" ]; then
    echo "Starting API service only..."
    pm2 start ecosystem.config.js --only ux-nevesht-api
elif [ "$WEB_BUILT" = "true" ]; then
    echo "Starting Web service only..."
    pm2 start ecosystem.config.js --only ux-nevesht-web
else
    echo "❌ No services can be started - no successful builds found"
    echo "Run: sudo -u uxnevesht ./debug-build.sh"
    exit 1
fi

pm2 save
pm2 list

EOF
    
    log "Services started successfully"
    
    # Health checks
    sleep 10
    log "Performing health checks..."
    
    if curl -f -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
        log "✅ API health check: PASSED"
    else
        warn "⚠️  API health check: FAILED"
    fi
    
    if curl -f -s http://localhost:$WEB_PORT > /dev/null 2>&1; then
        log "✅ Web health check: PASSED"
    else
        warn "⚠️  Web health check: FAILED"
    fi
}

# Create update script
create_update_script() {
    log "Creating update script..."
    
    tee /usr/local/bin/update-$APP_NAME > /dev/null << 'EOF'
#!/bin/bash
# Update script for ux-nevesht

set -e

APP_DIR="/var/www/ux-nevesht"
APP_USER="uxnevesht"

echo "Updating ux-nevesht..."

sudo -u $APP_USER bash << 'SCRIPT_EOF'
cd $APP_DIR

export PATH="/usr/local/bin:/usr/bin:$PATH:$PWD/node_modules/.bin"

# Pull latest changes
git fetch origin
git reset --hard origin/main

# Install dependencies
pnpm install

# Build application
if command -v turbo >/dev/null 2>&1; then
    turbo build
elif [ -f "node_modules/.bin/turbo" ]; then
    ./node_modules/.bin/turbo build
else
    pnpm build
fi

# Restart services
pm2 restart all

SCRIPT_EOF

echo "Update completed successfully!"
EOF

    chmod +x /usr/local/bin/update-$APP_NAME
    log "Update script created at /usr/local/bin/update-$APP_NAME"
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    read -p "Do you want to setup SSL with Let's Encrypt? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Installing Certbot for SSL..."
        apt install -y certbot python3-certbot-nginx
        
        log "Obtaining SSL certificate..."
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        systemctl enable certbot.timer
        log "SSL certificate installed successfully"
    fi
}

# Main deployment function
main() {
    log "Starting UX Nevesht deployment as root..."
    
    check_root
    update_system
    install_nodejs
    install_nginx
    create_app_user
    setup_app_directory
    setup_application
    create_env_file
    create_pm2_config
    setup_logging
    create_nginx_config
    setup_firewall
    setup_pm2_for_user
    start_services
    create_update_script
    setup_ssl
    
    log ""
    log "🎉 Deployment completed successfully!"
    log ""
    log "📋 Next steps:"
    log "1. Update environment variables in $APP_DIR/.env"
    log "   - Add your Supabase credentials"
    log "   - Add your OpenAI API key"
    log "   - Configure other service keys"
    log "2. Restart services: sudo -u $APP_USER pm2 restart all"
    log "3. Test your application at http://$DOMAIN"
    log ""
    log "🌐 Application URLs:"
    log "- Main site: http://$DOMAIN"
    log "- API: http://$DOMAIN/api"
    log "- Health check: http://$DOMAIN/health"
    log ""
    log "🔧 Management commands:"
    log "- Update: /usr/local/bin/update-$APP_NAME"
    log "- Status: sudo -u $APP_USER pm2 status"
    log "- Logs: sudo -u $APP_USER pm2 logs"
    log "- Restart: sudo -u $APP_USER pm2 restart all"
    log ""
    log "🔒 Security:"
    log "- Firewall configured and active"
    log "- Services run under dedicated user: $APP_USER"
    log "- SSL available: certbot --nginx -d $DOMAIN"
    log ""
    log "📝 Important files:"
    log "- Application: $APP_DIR"
    log "- Environment: $APP_DIR/.env"
    log "- Nginx config: /etc/nginx/sites-available/$APP_NAME"
    log "- PM2 config: $APP_DIR/ecosystem.config.js"
    log ""
    log "If you encounter build issues, run: sudo -u $APP_USER ./debug-build.sh"
}

# Run main function
main "$@"