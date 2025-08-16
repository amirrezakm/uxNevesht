#!/bin/bash

# UX Nevesht Update Script
# Quick update script for production deployments
# Domain: http://uxw.payanekhosh.ir

set -e  # Exit on any error

# Configuration
APP_NAME="ux-nevesht"
APP_USER="uxnevesht"
APP_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"

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

# Check if running as correct user
check_user() {
    if [[ $USER != $APP_USER ]]; then
        error "This script should be run as the $APP_USER user. Current user: $USER"
    fi
}

# Create backup
create_backup() {
    log "Creating backup before update..."
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current application
    cp -r "$APP_DIR" "$BACKUP_PATH"
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +6 | xargs -r rm -rf
    
    log "Backup created at: $BACKUP_PATH"
}

# Pull latest changes
pull_changes() {
    log "Pulling latest changes from repository..."
    
    cd "$APP_DIR"
    
    # Stash any local changes
    git stash
    
    # Fetch and pull latest changes
    git fetch origin
    git reset --hard origin/main
    
    log "Latest changes pulled successfully"
}

# Install dependencies
install_dependencies() {
    log "Installing/updating dependencies..."
    
    cd "$APP_DIR"
    
    # Clean install to ensure consistency
    rm -rf node_modules
    pnpm install --frozen-lockfile
    
    log "Dependencies installed successfully"
}

# Build application
build_application() {
    log "Building application..."
    
    cd "$APP_DIR"
    
    # Clean previous build
    pnpm clean
    
    # Build all packages and applications
    pnpm build
    
    log "Application built successfully"
}

# Update environment if needed
update_environment() {
    log "Checking environment configuration..."
    
    if [[ -f "$APP_DIR/env.production.template" ]]; then
        if [[ ! -f "$APP_DIR/.env" ]]; then
            warn "No .env file found. Creating from template..."
            cp "$APP_DIR/env.production.template" "$APP_DIR/.env"
            warn "Please update the .env file with your actual configuration values"
        else
            log "Environment file exists. Checking for new variables..."
            
            # Check for new environment variables in template
            while IFS= read -r line; do
                if [[ $line =~ ^[A-Z_]+=.* ]]; then
                    var_name=$(echo "$line" | cut -d'=' -f1)
                    if ! grep -q "^$var_name=" "$APP_DIR/.env"; then
                        echo "$line" >> "$APP_DIR/.env"
                        warn "Added new environment variable: $var_name"
                    fi
                fi
            done < "$APP_DIR/env.production.template"
        fi
    fi
}

# Restart services
restart_services() {
    log "Restarting application services..."
    
    cd "$APP_DIR"
    
    # Restart PM2 processes
    pm2 restart ecosystem.config.js --env production
    
    # Wait for services to start
    sleep 5
    
    # Check if services are running
    if pm2 list | grep -q "online"; then
        log "Services restarted successfully"
    else
        error "Failed to restart services. Check PM2 status: pm2 list"
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check API health
    if curl -f -s http://localhost:3001/health > /dev/null; then
        log "API health check: PASSED"
    else
        warn "API health check: FAILED"
    fi
    
    # Check Web health
    if curl -f -s http://localhost:3000 > /dev/null; then
        log "Web health check: PASSED"
    else
        warn "Web health check: FAILED"
    fi
    
    # Check PM2 status
    log "PM2 Status:"
    pm2 list
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    # Get latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -n 1)
    
    if [[ -n "$LATEST_BACKUP" ]]; then
        log "Rolling back to: $LATEST_BACKUP"
        
        # Stop services
        pm2 stop all
        
        # Restore backup
        rm -rf "$APP_DIR"
        cp -r "$BACKUP_DIR/$LATEST_BACKUP" "$APP_DIR"
        
        # Restart services
        cd "$APP_DIR"
        pm2 start ecosystem.config.js --env production
        
        log "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  update    - Update application (default)"
    echo "  rollback  - Rollback to previous version"
    echo "  status    - Show application status"
    echo "  logs      - Show application logs"
    echo "  restart   - Restart services only"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                # Update application"
    echo "  $0 update         # Update application"
    echo "  $0 rollback       # Rollback to previous version"
    echo "  $0 status         # Show status"
}

# Show status
show_status() {
    log "Application Status:"
    echo ""
    
    # PM2 status
    echo "PM2 Processes:"
    pm2 list
    echo ""
    
    # Disk usage
    echo "Disk Usage:"
    df -h "$APP_DIR"
    echo ""
    
    # Memory usage
    echo "Memory Usage:"
    free -h
    echo ""
    
    # Service status
    echo "Service Health:"
    curl -s http://localhost:3001/health || echo "API: DOWN"
    curl -s http://localhost:3000 > /dev/null && echo "Web: UP" || echo "Web: DOWN"
}

# Show logs
show_logs() {
    log "Application Logs:"
    echo ""
    
    echo "Choose log to view:"
    echo "1) API logs"
    echo "2) Web logs"
    echo "3) Combined logs"
    echo "4) Nginx access logs"
    echo "5) Nginx error logs"
    
    read -p "Enter choice (1-5): " choice
    
    case $choice in
        1)
            pm2 logs ux-nevesht-api --lines 50
            ;;
        2)
            pm2 logs ux-nevesht-web --lines 50
            ;;
        3)
            pm2 logs --lines 50
            ;;
        4)
            sudo tail -f /var/log/nginx/ux-nevesht-access.log
            ;;
        5)
            sudo tail -f /var/log/nginx/ux-nevesht-error.log
            ;;
        *)
            echo "Invalid choice"
            ;;
    esac
}

# Main update function
main_update() {
    log "Starting UX Nevesht update process..."
    
    check_user
    create_backup
    pull_changes
    install_dependencies
    update_environment
    build_application
    restart_services
    health_check
    
    log "Update completed successfully!"
    log ""
    log "Application is running at:"
    log "- Web: http://uxw.payanekhosh.ir"
    log "- API: http://uxw.payanekhosh.ir/api"
    log ""
    log "Useful commands:"
    log "- Check status: $0 status"
    log "- View logs: $0 logs"
    log "- Restart services: $0 restart"
    log "- Rollback: $0 rollback"
}

# Main script logic
case "${1:-update}" in
    update)
        main_update
        ;;
    rollback)
        rollback
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    restart)
        restart_services
        health_check
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo "Unknown option: $1"
        usage
        exit 1
        ;;
esac
