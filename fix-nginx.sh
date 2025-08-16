#!/bin/bash

# Fix Nginx Configuration Script
# This script fixes the current Nginx configuration issues

APP_NAME="ux-nevesht"
DOMAIN="uxw.payanekhosh.ir"
API_PORT="3001"
WEB_PORT="3000"

echo "Fixing Nginx configuration..."

# Remove the problematic configuration
rm -f /etc/nginx/sites-enabled/ux-nevesht
rm -f /etc/nginx/sites-available/ux-nevesht

# Create the correct Nginx configuration
tee /etc/nginx/sites-available/$APP_NAME > /dev/null << 'EOF'
server {
    listen 80;
    server_name uxw.payanekhosh.ir www.uxw.payanekhosh.ir;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;
    
    # Client max body size for file uploads
    client_max_body_size 10M;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Socket.IO routes (WebSocket support)
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        
        # Cache static assets for 1 year
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        
        # Disable access logging for static assets
        access_log off;
    }
    
    # Next.js specific routes
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        
        # Cache Next.js static assets
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Main application routes
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Security: Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Security: Deny access to sensitive files
    location ~* \.(env|log|conf)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Robots.txt
    location = /robots.txt {
        proxy_pass http://localhost:3000/robots.txt;
        access_log off;
        log_not_found off;
    }
    
    # Sitemap
    location = /sitemap.xml {
        proxy_pass http://localhost:3000/sitemap.xml;
        access_log off;
    }
    
    # Logs
    access_log /var/log/nginx/ux-nevesht-access.log;
    error_log /var/log/nginx/ux-nevesht-error.log;
}
EOF

# Add rate limiting to the main nginx.conf if not already present
if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
    echo "Adding rate limiting to main nginx.conf..."
    
    # Create a backup of nginx.conf
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # Add rate limiting zones to the http block
    sed -i '/http {/a\\n\t# Rate limiting zones\n\tlimit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;\n\tlimit_req_zone $binary_remote_addr zone=web:10m rate=30r/s;\n\tlimit_req_zone $binary_remote_addr zone=upload:10m rate=5r/s;\n' /etc/nginx/nginx.conf
fi

# Add gzip configuration to main nginx.conf if not already present
if ! grep -q "gzip on" /etc/nginx/nginx.conf; then
    echo "Adding gzip configuration to main nginx.conf..."
    
    # Add gzip configuration to the http block
    sed -i '/http {/a\\n\t# Gzip Settings\n\tgzip on;\n\tgzip_vary on;\n\tgzip_min_length 1024;\n\tgzip_proxied expired no-cache no-store private auth;\n\tgzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;\n' /etc/nginx/nginx.conf
fi

# Enable the site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx configuration is valid. Reloading..."
    systemctl reload nginx
    echo "Nginx configuration fixed successfully!"
else
    echo "Nginx configuration test failed. Please check the configuration manually."
    exit 1
fi
