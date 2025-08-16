#!/bin/bash

# UX Nevesht Deployment Script for Ubuntu Server
# Domain: http://uxw.payanekhosh.ir
# Author: Auto-generated deployment script

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

# Check if running as root and handle accordingly
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warn "Running as root. Creating a regular user for deployment..."
        
        # Create a regular user if it doesn't exist
        if ! id "deploy" &>/dev/null; then
            useradd -m -s /bin/bash deploy
            usermod -aG sudo deploy
            log "Created user 'deploy' with sudo privileges"
        fi
        
        # Set a temporary password for the deploy user
        echo "deploy:$(openssl rand -base64 12)" | chpasswd
        
        log "Switching to 'deploy' user to continue deployment..."
        log "You can also create your own user and run this script as that user instead."
        
        # Copy the script to the deploy user's home and run it
        cp "$0" /home/deploy/
        chown deploy:deploy /home/deploy/$(basename "$0")
        chmod +x /home/deploy/$(basename "$0")
        
        # Switch to deploy user and run the script
        sudo -u deploy bash /home/deploy/$(basename "$0")
        exit $?
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl wget git build-essential software-properties-common
}

# Install Node.js and pnpm
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    # Install Node.js via NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Install pnpm
    log "Installing pnpm..."
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    source ~/.bashrc
    
    # Verify installations
    node --version
    npm --version
    pnpm --version
}

# Install and configure Nginx
install_nginx() {
    log "Installing and configuring Nginx..."
    sudo apt install -y nginx
    
    # Enable and start Nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    
    # Allow Nginx through firewall
    sudo ufw allow 'Nginx Full'
}

# Install and configure PM2
install_pm2() {
    log "Installing PM2..."
    sudo npm install -g pm2
    
    # Setup PM2 startup script
    sudo pm2 startup systemd -u $USER --hp $HOME
}

# Create application user
create_app_user() {
    log "Creating application user: $APP_USER..."
    
    if ! id "$APP_USER" &>/dev/null; then
        sudo useradd -m -s /bin/bash $APP_USER
        sudo usermod -aG www-data $APP_USER
        log "User $APP_USER created successfully"
    else
        log "User $APP_USER already exists"
    fi
}

# Setup application directory
setup_app_directory() {
    log "Setting up application directory..."
    
    sudo mkdir -p $APP_DIR
    sudo chown -R $APP_USER:www-data $APP_DIR
    sudo chmod -R 755 $APP_DIR
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
NEXT_PUBLIC_API_URL=http://localhost:$API_PORT

# Database Configuration (Update these with your actual values)
DATABASE_URL=your_database_url_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Redis Configuration (if using Redis)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# OpenAI/AI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/var/www/$APP_NAME/uploads

# Logging
LOG_LEVEL=info
LOG_DIR=/var/www/$APP_NAME/logs
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
      script: './apps/web/server.js',
      cwd: '/var/www/ux-nevesht',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
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
    
    sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
# UX Nevesht Nginx Configuration
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=web:10m rate=30r/s;
    
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
    
    # Socket.IO routes (if using WebSocket)
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
    
    # Static files and Next.js app
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
    
    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        proxy_pass http://localhost:$WEB_PORT;
        proxy_set_header Host \$host;
    }
    
    # Security
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
    sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    
    # Remove default site if it exists
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    sudo nginx -t
    
    # Reload Nginx
    sudo systemctl reload nginx
}

# Setup SSL with Let's Encrypt (optional)
setup_ssl() {
    read -p "Do you want to setup SSL with Let's Encrypt? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Installing Certbot for SSL..."
        sudo apt install -y certbot python3-certbot-nginx
        
        log "Obtaining SSL certificate..."
        sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
        
        # Auto-renewal
        sudo systemctl enable certbot.timer
    fi
}

# Create log directories
setup_logging() {
    log "Setting up logging directories..."
    
    sudo -u $APP_USER mkdir -p $APP_DIR/logs
    sudo mkdir -p /var/log/nginx
    
    # Setup log rotation
    sudo tee /etc/logrotate.d/$APP_NAME > /dev/null << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $APP_USER www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    
    log "Firewall configured successfully"
}

# Start services
start_services() {
    log "Starting application services..."
    
    # Switch to app user and start PM2
    sudo -u $APP_USER bash << EOF
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save
EOF
    
    log "Services started successfully"
}

# Create deployment update script
create_update_script() {
    log "Creating update script..."
    
    sudo tee /usr/local/bin/update-$APP_NAME > /dev/null << EOF
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

    sudo chmod +x /usr/local/bin/update-$APP_NAME
    log "Update script created at /usr/local/bin/update-$APP_NAME"
}

# Main deployment function
main() {
    log "Starting UX Nevesht deployment..."
    
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
    start_services
    create_update_script
    setup_ssl
    
    log "Deployment completed successfully!"
    log ""
    log "Next steps:"
    log "1. Update environment variables in $APP_DIR/.env"
    log "2. Configure your database and external services"
    log "3. Test your application at http://$DOMAIN"
    log "4. Use 'sudo /usr/local/bin/update-$APP_NAME' to update the application"
    log ""
    log "Useful commands:"
    log "- Check PM2 status: sudo -u $APP_USER pm2 status"
    log "- View logs: sudo -u $APP_USER pm2 logs"
    log "- Restart services: sudo -u $APP_USER pm2 restart all"
    log "- Check Nginx status: sudo systemctl status nginx"
    log "- View Nginx logs: sudo tail -f /var/log/nginx/$APP_NAME-*.log"
}

# Run main function
main "$@"
