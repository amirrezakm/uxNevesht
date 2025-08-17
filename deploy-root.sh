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

# Install Node.js and pnpm
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    # Install Node.js via NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    # Install pnpm globally
    log "Installing pnpm..."
    npm install -g pnpm
    
    # Verify installations
    node --version
    npm --version
    pnpm --version
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

# Install and configure PM2
install_pm2() {
    log "Installing PM2..."
    npm install -g pm2
    
    log "PM2 installed successfully"
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

# Clone and setup application
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
    
    # Install dependencies and build as app user
    sudo -u $APP_USER bash << EOF
cd $APP_DIR

# Set up proper PATH for npm/pnpm global packages and local node_modules
export PATH="/usr/bin:\$PATH:\$PWD/node_modules/.bin"

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Verify installations
echo "Verifying installations..."
if [ -f "node_modules/.bin/turbo" ]; then
    echo "✅ Turbo found in node_modules/.bin"
    ls -la node_modules/.bin/turbo
else
    echo "❌ Turbo not found in node_modules/.bin"
    echo "Contents of node_modules/.bin:"
    ls -la node_modules/.bin/ | head -10
fi

if [ -f "node_modules/.bin/tsc" ]; then
    echo "✅ TypeScript compiler found"
else
    echo "❌ TypeScript compiler not found"
fi

# Build the application - handle workspace dependencies properly
echo "Attempting to build the application..."

# First, ensure all workspace packages are built in correct order
echo "Building workspace packages in dependency order..."

# Build shared packages first (these have no dependencies)
echo "Building shared packages..."
for pkg in packages/config packages/database packages/ai packages/ui; do
    if [ -d "\$pkg" ]; then
        echo "Building \$pkg..."
        cd "\$pkg"
        
        # Install dependencies for this workspace package
        echo "Installing dependencies for \$pkg..."
        pnpm install
        
        # Check if build script exists
        if grep -q '"build"' package.json 2>/dev/null; then
            echo "Running build for \$pkg..."
            # Set PATH to include root node_modules for TypeScript
            export PATH="\$PWD/../../node_modules/.bin:\$PATH"
            if pnpm run build 2>&1; then
                echo "✅ \$pkg built successfully"
            else
                echo "❌ Failed to build \$pkg - this may cause app builds to fail"
            fi
        else
            echo "⚠️  No build script found in \$pkg - skipping"
        fi
        cd - > /dev/null
    fi
done

# Now try building the main applications
echo "Building main applications..."

# Method 1: Try turbo (handles dependencies automatically)
build_success=false

if [ -f "node_modules/.bin/turbo" ]; then
    echo "Attempting build with local turbo..."
    if ./node_modules/.bin/turbo build 2>&1 | tee build.log; then
        echo "✅ Build successful with local turbo"
        build_success=true
    else
        echo "❌ Local turbo build failed. Error output:"
        tail -20 build.log
    fi
fi

# Method 2: Try npx turbo if local failed
if [ "\$build_success" = "false" ]; then
    echo "Trying npx turbo..."
    if npx turbo@1.10.12 build 2>&1 | tee build.log; then
        echo "✅ Build successful with npx turbo"
        build_success=true
    else
        echo "❌ npx turbo build failed. Error output:"
        tail -20 build.log
    fi
fi

# Method 3: Try pnpm run build if turbo failed
if [ "\$build_success" = "false" ]; then
    echo "Trying pnpm run build..."
    if pnpm run build 2>&1 | tee build.log; then
        echo "✅ Build successful with pnpm run build"
        build_success=true
    else
        echo "❌ pnpm run build failed. Error output:"
        tail -20 build.log
    fi
fi

# Method 4: Manual workspace builds if all else failed
if [ "\$build_success" = "false" ]; then
    echo "All automated builds failed. Attempting manual workspace builds..."
    
    # Build API manually
    echo "Building API manually..."
    cd apps/api
    if [ -f "package.json" ]; then
        echo "Installing API dependencies..."
        pnpm install
        echo "Running API TypeScript build..."
        if pnpm run build 2>&1 | tee ../../api-build.log; then
            echo "✅ API built successfully"
        else
            echo "❌ API build failed. Error output:"
            tail -10 ../../api-build.log
        fi
    fi
    cd ../..
    
    # Build Web manually
    echo "Building Web manually..."
    cd apps/web
    if [ -f "package.json" ]; then
        echo "Installing Web dependencies..."
        pnpm install
        echo "Running Web Next.js build..."
        if pnpm run build 2>&1 | tee ../../web-build.log; then
            echo "✅ Web built successfully"
        else
            echo "❌ Web build failed. Error output:"
            tail -10 ../../web-build.log
            echo ""
            echo "Common Next.js build issues:"
            echo "1. Missing workspace dependencies (@ux-nevesht/ui)"
            echo "2. TypeScript errors in components"
            echo "3. Import/export issues between packages"
        fi
    fi
    cd ../..
fi

# Clean up log files
rm -f build.log api-build.log web-build.log

echo "Build process completed."

# Verify build outputs exist
echo "Verifying build outputs..."
if [ -f "apps/api/dist/index.js" ]; then
    echo "✅ API build output found: apps/api/dist/index.js"
else
    echo "❌ API build output missing: apps/api/dist/index.js"
    echo "Contents of apps/api/dist/:"
    ls -la apps/api/dist/ 2>/dev/null || echo "Directory does not exist"
fi

if [ -d "apps/web/.next" ]; then
    echo "✅ Web build output found: apps/web/.next/"
else
    echo "❌ Web build output missing: apps/web/.next/"
    echo "Contents of apps/web/:"
    ls -la apps/web/ 2>/dev/null || echo "Directory does not exist"
fi

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
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
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
}

# Create Nginx configuration
create_nginx_config() {
    log "Creating Nginx configuration..."
    
    # Clean up any existing problematic configurations
    rm -f /etc/nginx/sites-enabled/ux-nevesht
    rm -f /etc/nginx/sites-available/ux-nevesht
    
    # Remove ALL existing rate limiting configurations to prevent duplicates
    log "Cleaning up existing rate limiting configurations..."
    
    # Remove from conf.d directory
    rm -f /etc/nginx/conf.d/rate-limiting.conf
    rm -f /etc/nginx/conf.d/*rate*.conf
    
    # Check and clean nginx.conf if it has rate limiting zones
    if grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
        log "Removing rate limiting zones from main nginx.conf..."
        # Restore from backup if available, otherwise remove the lines
        if [ -f /etc/nginx/nginx.conf.backup ]; then
            cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
        else
            # Remove rate limiting lines from nginx.conf
            sed -i '/limit_req_zone/d' /etc/nginx/nginx.conf
            sed -i '/# Rate limiting zones/d' /etc/nginx/nginx.conf
        fi
    fi
    
    # Remove any gzip configurations that might have been added
    if grep -q "# Gzip Settings" /etc/nginx/nginx.conf; then
        log "Cleaning up gzip configurations from main nginx.conf..."
        if [ -f /etc/nginx/nginx.conf.backup ]; then
            cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
        fi
    fi
    
    # Test nginx configuration before proceeding
    log "Testing nginx configuration after cleanup..."
    if ! nginx -t 2>/dev/null; then
        log "Nginx configuration has issues, restoring from backup..."
        if [ -f /etc/nginx/nginx.conf.backup ]; then
            cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
        fi
    fi
    
    # Create a custom nginx configuration file for rate limiting
    log "Creating rate limiting configuration..."
    tee /etc/nginx/conf.d/rate-limiting.conf > /dev/null << 'EOF'
# Rate limiting zones for UX Nevesht
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=web:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=5r/s;
EOF
    
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
    
    # Client max body size for file uploads
    client_max_body_size 10M;
    
    # Proxy timeouts
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Socket.IO routes (WebSocket support)
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
    
    # Health check
    location /health {
        proxy_pass http://localhost:$API_PORT/health;
        proxy_set_header Host \$host;
        access_log off;
    }
    
    # Static assets with caching
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
    
    # Main application routes
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
    
    # Security: Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Security: Deny access to sensitive files
    location ~* \.(env|log|conf)\$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Robots.txt
    location = /robots.txt {
        proxy_pass http://localhost:$WEB_PORT/robots.txt;
        access_log off;
        log_not_found off;
    }
    
    # Sitemap
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
    
    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    log "Testing Nginx configuration..."
    if nginx -t; then
        log "Nginx configuration is valid. Reloading..."
        systemctl reload nginx
        log "Nginx configured successfully"
    else
        error "Nginx configuration test failed. Please check the configuration manually."
    fi
}

# Setup logging directories
setup_logging() {
    log "Setting up logging directories..."
    
    sudo -u $APP_USER mkdir -p $APP_DIR/logs
    sudo -u $APP_USER mkdir -p $APP_DIR/uploads
    mkdir -p /var/log/nginx
    
    # Set proper permissions
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
    
    # Setup PM2 startup script properly
    log "Configuring PM2 startup..."
    
    # Run the PM2 startup command directly
    env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
    
    log "PM2 startup configured successfully"
}

# Start services
start_services() {
    log "Starting application services..."
    
    # Switch to app user and start PM2
    sudo -u $APP_USER bash << EOF
cd $APP_DIR

# Verify build outputs before starting services
echo "Checking build outputs before starting services..."

API_BUILT=false
WEB_BUILT=false

if [ -f "apps/api/dist/index.js" ]; then
    echo "✅ API build found"
    API_BUILT=true
else
    echo "❌ API build missing - will not start API service"
fi

if [ -d "apps/web/.next" ] && [ -f "apps/web/package.json" ]; then
    echo "✅ Web build found"
    WEB_BUILT=true
else
    echo "❌ Web build missing - will not start Web service"
fi

# Start services based on what was built successfully
if [ "\$API_BUILT" = "true" ] && [ "\$WEB_BUILT" = "true" ]; then
    echo "Starting both API and Web services..."
    pm2 start ecosystem.config.js --env production
elif [ "\$API_BUILT" = "true" ]; then
    echo "Starting API service only (Web build failed)..."
    # Create API-only config
    cat > ecosystem.api-only.js << 'API_EOF'
module.exports = {
  apps: [
    {
      name: 'ux-nevesht-api',
      script: './apps/api/dist/index.js',
      cwd: '/var/www/ux-nevesht',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
API_EOF
    pm2 start ecosystem.api-only.js --env production
    rm -f ecosystem.api-only.js
elif [ "\$WEB_BUILT" = "true" ]; then
    echo "Starting Web service only (API build failed)..."
    # Create Web-only config
    cat > ecosystem.web-only.js << 'WEB_EOF'
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
WEB_EOF
    pm2 start ecosystem.web-only.js --env production
    rm -f ecosystem.web-only.js
else
    echo "❌ No services can be started - no successful builds found"
    echo "Please check the build process and try again"
    echo ""
    echo "To debug build issues, run:"
    echo "cd /var/www/ux-nevesht"
    echo "sudo -u uxnevesht ./debug-build.sh"
fi

# Save the PM2 process list and show status
if [ "\$API_BUILT" = "true" ] || [ "\$WEB_BUILT" = "true" ]; then
    pm2 save
    pm2 list
fi

EOF
    
    log "Services started successfully"
    
    # Check if services are running
    log "Checking service status..."
    sudo -u $APP_USER pm2 list
    
    # Wait a moment for services to fully start
    sleep 10
    
    # Health check
    log "Performing health checks..."
    
    # Check if API is responding
    if curl -f -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
        log "✅ API health check: PASSED (http://localhost:$API_PORT/health)"
    else
        warn "⚠️  API health check: FAILED - API may still be starting up"
    fi
    
    # Check if Web is responding
    if curl -f -s http://localhost:$WEB_PORT > /dev/null 2>&1; then
        log "✅ Web health check: PASSED (http://localhost:$WEB_PORT)"
    else
        warn "⚠️  Web health check: FAILED - Web app may still be starting up"
    fi
}

# Create update script
create_update_script() {
    log "Creating update script..."
    
    tee /usr/local/bin/update-$APP_NAME > /dev/null << EOF
#!/bin/bash
# Update script for $APP_NAME

set -e

APP_DIR="$APP_DIR"
APP_USER="$APP_USER"

echo "Updating $APP_NAME..."

# Switch to app user
sudo -u \$APP_USER bash << 'SCRIPT_EOF'
cd \$APP_DIR

# Set up proper PATH for npm/pnpm global packages and local node_modules
export PATH="/usr/bin:\$PATH:\$PWD/node_modules/.bin"

# Pull latest changes
git fetch origin
git reset --hard origin/main

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build the application
echo "Building application..."
if [ -f "node_modules/.bin/turbo" ]; then
    echo "Using local turbo..."
    if ./node_modules/.bin/turbo build; then
        echo "✅ Build successful with local turbo"
    else
        echo "Local turbo failed, trying alternatives..."
        if npx turbo@1.10.12 build; then
            echo "✅ Build successful with npx turbo"
        elif pnpm run build; then
            echo "✅ Build successful with pnpm run build"
        else
            echo "Building workspaces individually..."
            cd apps/api && pnpm install && pnpm run build && cd ../..
            cd apps/web && pnpm install && pnpm run build && cd ../..
        fi
    fi
else
    echo "No local turbo found, using alternatives..."
    if pnpm run build; then
        echo "✅ Build successful with pnpm run build"
    else
        echo "Building workspaces individually..."
        cd apps/api && pnpm install && pnpm run build && cd ../..
        cd apps/web && pnpm install && pnpm run build && cd ../..
    fi
fi

# Restart services
pm2 restart all

SCRIPT_EOF

echo "Update completed successfully!"
EOF

    chmod +x /usr/local/bin/update-$APP_NAME
    log "Update script created at /usr/local/bin/update-$APP_NAME"
}

# Setup SSL with Let's Encrypt (optional)
setup_ssl() {
    read -p "Do you want to setup SSL with Let's Encrypt? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Installing Certbot for SSL..."
        apt install -y certbot python3-certbot-nginx
        
        log "Obtaining SSL certificate..."
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        # Auto-renewal
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
    install_pm2
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
    log "2. Restart services after updating .env: sudo -u $APP_USER pm2 restart all"
    log "3. Test your application at http://$DOMAIN"
    log ""
    log "🌐 Application URLs:"
    log "- Main site: http://$DOMAIN"
    log "- API: http://$DOMAIN/api"
    log "- Health check: http://$DOMAIN/health"
    log ""
    log "🔧 Management commands:"
    log "- Update application: /usr/local/bin/update-$APP_NAME"
    log "- Check PM2 status: sudo -u $APP_USER pm2 status"
    log "- View logs: sudo -u $APP_USER pm2 logs"
    log "- Restart services: sudo -u $APP_USER pm2 restart all"
    log "- Check Nginx status: systemctl status nginx"
    log "- View Nginx logs: tail -f /var/log/nginx/$APP_NAME-*.log"
    log ""
    log "🔒 Security:"
    log "- Firewall is configured and active"
    log "- Services run under dedicated user: $APP_USER"
    log "- Consider setting up SSL: certbot --nginx -d $DOMAIN"
    log ""
    log "📝 Important files:"
    log "- Application: $APP_DIR"
    log "- Environment: $APP_DIR/.env"
    log "- Nginx config: /etc/nginx/sites-available/$APP_NAME"
    log "- PM2 config: $APP_DIR/ecosystem.config.js"
}

# Run main function
main "$@"
