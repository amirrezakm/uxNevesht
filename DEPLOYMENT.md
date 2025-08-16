# UX Nevesht Deployment Guide

This guide provides comprehensive instructions for deploying UX Nevesht to an Ubuntu server with the domain `uxw.payanekhosh.ir`.

## 📋 Prerequisites

- Ubuntu 20.04+ server with sudo access
- Domain name configured to point to your server IP
- At least 2GB RAM and 20GB disk space
- Git installed on the server

## 🚀 Quick Deployment

### Method 1: Automated Script Deployment (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/uxNevesht.git
   cd uxNevesht
   ```

2. **Make the deployment script executable:**
   ```bash
   chmod +x deploy.sh
   ```

3. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

4. **Update environment variables:**
   ```bash
   sudo -u uxnevesht nano /var/www/ux-nevesht/.env
   ```

5. **Restart services:**
   ```bash
   sudo -u uxnevesht pm2 restart all
   ```

### Method 2: Docker Deployment (Alternative)

1. **Install Docker and Docker Compose:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   sudo usermod -aG docker $USER
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Configure environment:**
   ```bash
   cp env.production.template .env
   # Edit .env with your configuration
   ```

3. **Start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🔧 Configuration

### Environment Variables

Copy `env.production.template` to `.env` and update the following critical variables:

```bash
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Security
JWT_SECRET=your_secure_jwt_secret_32_chars_minimum
ENCRYPTION_KEY=your_32_character_encryption_key

# Domain
NEXT_PUBLIC_API_URL=http://uxw.payanekhosh.ir/api
```

### Nginx Configuration

The deployment script automatically configures Nginx. The configuration includes:

- Reverse proxy for API and web applications
- Rate limiting
- Gzip compression
- Security headers
- Static file caching
- WebSocket support

### SSL/HTTPS Setup

To enable HTTPS with Let's Encrypt:

```bash
sudo certbot --nginx -d uxw.payanekhosh.ir -d www.uxw.payanekhosh.ir
```

## 📊 Monitoring and Management

### PM2 Process Management

```bash
# Check status
sudo -u uxnevesht pm2 status

# View logs
sudo -u uxnevesht pm2 logs

# Restart services
sudo -u uxnevesht pm2 restart all

# Monitor processes
sudo -u uxnevesht pm2 monit
```

### Application Logs

```bash
# API logs
sudo -u uxnevesht pm2 logs ux-nevesht-api

# Web logs
sudo -u uxnevesht pm2 logs ux-nevesht-web

# Nginx logs
sudo tail -f /var/log/nginx/ux-nevesht-access.log
sudo tail -f /var/log/nginx/ux-nevesht-error.log
```

### System Services

```bash
# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Check firewall status
sudo ufw status
```

## 🔄 Updates and Maintenance

### Quick Update

Use the provided update script:

```bash
sudo -u uxnevesht /usr/local/bin/update-ux-nevesht
```

Or use the update script in the project directory:

```bash
sudo -u uxnevesht ./update.sh
```

### Manual Update Process

1. **Switch to application user:**
   ```bash
   sudo -u uxnevesht -i
   cd /var/www/ux-nevesht
   ```

2. **Pull latest changes:**
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

3. **Install dependencies and build:**
   ```bash
   pnpm install
   pnpm build
   ```

4. **Restart services:**
   ```bash
   pm2 restart all
   ```

### Backup and Rollback

```bash
# Create backup
sudo -u uxnevesht ./update.sh backup

# Rollback to previous version
sudo -u uxnevesht ./update.sh rollback

# View available backups
ls -la /var/backups/ux-nevesht/
```

## 🛠️ Troubleshooting

### Common Issues

1. **Services not starting:**
   ```bash
   # Check PM2 status
   sudo -u uxnevesht pm2 status
   
   # Check logs for errors
   sudo -u uxnevesht pm2 logs
   
   # Restart services
   sudo -u uxnevesht pm2 restart all
   ```

2. **Nginx configuration errors:**
   ```bash
   # Test Nginx configuration
   sudo nginx -t
   
   # Reload Nginx
   sudo systemctl reload nginx
   ```

3. **Database connection issues:**
   ```bash
   # Check environment variables
   sudo -u uxnevesht cat /var/www/ux-nevesht/.env | grep -E "(DATABASE|SUPABASE)"
   
   # Test database connection
   sudo -u uxnevesht cd /var/www/ux-nevesht && npm run test-db
   ```

4. **File upload issues:**
   ```bash
   # Check upload directory permissions
   ls -la /var/www/ux-nevesht/uploads/
   
   # Fix permissions if needed
   sudo chown -R uxnevesht:www-data /var/www/ux-nevesht/uploads/
   sudo chmod -R 755 /var/www/ux-nevesht/uploads/
   ```

### Performance Optimization

1. **Increase PM2 instances:**
   ```javascript
   // In ecosystem.config.js
   instances: 'max', // Use all CPU cores
   ```

2. **Enable Redis caching:**
   ```bash
   # Install Redis
   sudo apt install redis-server
   
   # Update .env
   REDIS_URL=redis://localhost:6379
   ENABLE_REDIS_CACHE=true
   ```

3. **Database optimization:**
   - Enable connection pooling
   - Add database indexes
   - Configure query caching

## 📈 Monitoring Setup

### Basic Monitoring

The deployment includes basic monitoring through:
- PM2 process monitoring
- Nginx access/error logs
- System resource monitoring

### Advanced Monitoring (Optional)

For production environments, consider setting up:

1. **Application Performance Monitoring (APM):**
   - New Relic
   - DataDog
   - Sentry for error tracking

2. **Infrastructure Monitoring:**
   - Prometheus + Grafana
   - Uptime monitoring
   - Log aggregation (ELK stack)

3. **Alerts:**
   - Email notifications for errors
   - Slack/Discord webhooks
   - SMS alerts for critical issues

## 🔐 Security Considerations

### Firewall Configuration

```bash
# Basic firewall setup (done by deployment script)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
```

### Security Headers

The Nginx configuration includes security headers:
- X-Frame-Options
- X-XSS-Protection
- X-Content-Type-Options
- Content Security Policy
- HSTS (when HTTPS is enabled)

### Regular Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
sudo -u uxnevesht cd /var/www/ux-nevesht && pnpm audit fix
```

## 📞 Support

For deployment issues or questions:

1. Check the troubleshooting section above
2. Review application logs
3. Check system resources (CPU, memory, disk)
4. Verify network connectivity and DNS resolution

## 📝 File Structure

After deployment, the file structure will be:

```
/var/www/ux-nevesht/
├── apps/
│   ├── api/          # API application
│   └── web/          # Next.js web application
├── packages/         # Shared packages
├── logs/            # Application logs
├── uploads/         # File uploads
├── .env            # Environment configuration
├── ecosystem.config.js  # PM2 configuration
└── ...
```

## 🎯 Next Steps

After successful deployment:

1. Configure your database and external services
2. Set up monitoring and alerting
3. Configure backup strategies
4. Set up CI/CD pipeline for automated deployments
5. Performance testing and optimization
6. Security audit and penetration testing

---

**Note:** Remember to update the repository URL in the deployment scripts with your actual GitHub repository URL before running the deployment.
