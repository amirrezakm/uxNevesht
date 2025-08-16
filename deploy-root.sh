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
REPO_URL="https://github.com/your-username/uxNevesht.git"  # Update with your actual repo URL
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
    log "Cloning and setting up application..."
    
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

# Install dependencies
pnpm install

# Build the application
pnpm build

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
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'ux-nevesht-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/ux-nevesht/apps/web',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      log_file: '../../logs/web-combined.log',
      time: true,
      max_memory_restart: '1G'
    }
  ]
};
EOF
}

# Create Nginx configuration
create_nginx_config() {
    log "Creating Nginx configuration..."
    
    tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=web:10m rate=30r/s;
    
    # Client max body size for file uploads
    client_max_body_size 10M;
    
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
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
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
    
    # Setup PM2 startup script for the app user
    sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
    
    # The above command will output a command to run as root, but we'll handle it differently
    # Create a systemd service for PM2
    tee /etc/systemd/system/pm2-$APP_USER.service > /dev/null << EOF
[Unit]
Description=PM2 process manager for $APP_USER
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=$APP_USER
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
Environment=PM2_HOME=/home/$APP_USER/.pm2
PIDFile=/home/$APP_USER/.pm2/pm2.pid
Restart=on-failure

ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF

    systemctl enable pm2-$APP_USER
}

# Start services
start_services() {
    log "Starting application services..."
    
    # Switch to app user and start PM2
    sudo -u $APP_USER bash << EOF
cd $APP_DIR
pm2 start ecosystem.config.js --env production
pm2 save
EOF
    
    # Start the PM2 systemd service
    systemctl start pm2-$APP_USER
    
    log "Services started successfully"
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

# Pull latest changes
git fetch origin
git reset --hard origin/main

# Install dependencies
pnpm install

# Build application
pnpm build

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
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
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
    
    log "Deployment completed successfully!"
    log ""
    log "Next steps:"
    log "1. Update environment variables in $APP_DIR/.env"
    log "2. Configure your database and external services"
    log "3. Test your application at http://$DOMAIN"
    log "4. Use '/usr/local/bin/update-$APP_NAME' to update the application"
    log ""
    log "Useful commands:"
    log "- Check PM2 status: sudo -u $APP_USER pm2 status"
    log "- View logs: sudo -u $APP_USER pm2 logs"
    log "- Restart services: sudo -u $APP_USER pm2 restart all"
    log "- Check Nginx status: systemctl status nginx"
    log "- View Nginx logs: tail -f /var/log/nginx/$APP_NAME-*.log"
    log ""
    log "Application URLs:"
    log "- Main site: http://$DOMAIN"
    log "- API: http://$DOMAIN/api"
    log "- Health check: http://$DOMAIN/health"
}

# Run main function
main "$@"
