#!/bin/bash

# Debug Build Script for UX Nevesht
# This script helps diagnose and fix build issues

set -e

APP_DIR="/var/www/ux-nevesht"
APP_USER="uxnevesht"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if running as correct user
if [[ $USER != $APP_USER ]]; then
    error "This script should be run as the $APP_USER user. Current user: $USER"
    echo "Run: sudo -u $APP_USER $0"
    exit 1
fi

log "Starting build diagnostics..."

cd $APP_DIR

# 1. Check Node.js and package manager versions
log "=== Environment Check ==="
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "pnpm version: $(pnpm --version)"
echo "Current directory: $(pwd)"
echo "Current user: $(whoami)"

# 2. Check if root node_modules exists and has TypeScript
log "=== Checking Dependencies ==="
if [ -d "node_modules" ]; then
    echo "✅ Root node_modules exists"
    
    if [ -f "node_modules/.bin/tsc" ]; then
        echo "✅ TypeScript compiler found in root node_modules"
        echo "TypeScript version: $(./node_modules/.bin/tsc --version)"
    else
        echo "❌ TypeScript compiler not found in root node_modules"
        echo "Contents of node_modules/.bin:"
        ls -la node_modules/.bin/ | head -10
    fi
    
    if [ -f "node_modules/.bin/turbo" ]; then
        echo "✅ Turbo found in root node_modules"
        echo "Turbo version: $(./node_modules/.bin/turbo --version)"
    else
        echo "❌ Turbo not found in root node_modules"
    fi
else
    echo "❌ Root node_modules does not exist"
fi

# 3. Check workspace structure
log "=== Workspace Structure ==="
echo "Root package.json exists: $([ -f package.json ] && echo "✅ Yes" || echo "❌ No")"
echo "Turbo config exists: $([ -f turbo.json ] && echo "✅ Yes" || echo "❌ No")"
echo "pnpm workspace config exists: $([ -f pnpm-workspace.yaml ] && echo "✅ Yes" || echo "❌ No")"

echo ""
echo "Workspace packages:"
for pkg in packages/* apps/*; do
    if [ -d "$pkg" ]; then
        echo "  - $pkg: $([ -f "$pkg/package.json" ] && echo "✅ package.json" || echo "❌ no package.json")"
    fi
done

# 4. Check specific build requirements
log "=== Build Requirements Check ==="

# Check API
echo "API (apps/api):"
if [ -f "apps/api/package.json" ]; then
    echo "  ✅ package.json exists"
    echo "  TypeScript config: $([ -f "apps/api/tsconfig.json" ] && echo "✅ Yes" || echo "❌ No")"
    echo "  Source files: $(find apps/api/src -name "*.ts" 2>/dev/null | wc -l) TypeScript files"
    echo "  Build script: $(grep -q '"build"' apps/api/package.json && echo "✅ Yes" || echo "❌ No")"
else
    echo "  ❌ package.json missing"
fi

# Check Web
echo "Web (apps/web):"
if [ -f "apps/web/package.json" ]; then
    echo "  ✅ package.json exists"
    echo "  Next.js config: $([ -f "apps/web/next.config.js" ] && echo "✅ Yes" || echo "❌ No")"
    echo "  TypeScript config: $([ -f "apps/web/tsconfig.json" ] && echo "✅ Yes" || echo "❌ No")"
    echo "  Source files: $(find apps/web/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l) TypeScript/React files"
    echo "  Build script: $(grep -q '"build"' apps/web/package.json && echo "✅ Yes" || echo "❌ No")"
else
    echo "  ❌ package.json missing"
fi

# 5. Try to fix common issues
log "=== Attempting Fixes ==="

# Fix 1: Ensure all dependencies are installed
log "Reinstalling dependencies..."
rm -rf node_modules
pnpm install

# Fix 2: Set up proper PATH
export PATH="$PWD/node_modules/.bin:$PATH"
echo "Updated PATH to include: $PWD/node_modules/.bin"

# Fix 3: Check if TypeScript is now available
if [ -f "node_modules/.bin/tsc" ]; then
    log "✅ TypeScript compiler is now available"
    echo "TypeScript version: $(./node_modules/.bin/tsc --version)"
else
    warn "TypeScript still not found, installing globally..."
    npm install -g typescript
fi

# Fix 4: Try building each workspace package individually
log "=== Building Workspace Packages ==="

# Build packages in dependency order
for pkg in packages/config packages/database packages/ai packages/ui; do
    if [ -d "$pkg" ]; then
        log "Building $pkg..."
        cd "$pkg"
        
        # Ensure package has its own node_modules if needed
        if [ -f "package.json" ] && grep -q '"build"' package.json; then
            echo "Installing dependencies for $pkg..."
            pnpm install
            
            echo "Building $pkg..."
            if pnpm run build; then
                echo "✅ $pkg built successfully"
            else
                warn "❌ Failed to build $pkg"
                echo "Build output:"
                pnpm run build 2>&1 | tail -20
            fi
        else
            echo "⚠️  No build script in $pkg, skipping"
        fi
        
        cd "$APP_DIR"
    fi
done

# Fix 5: Build applications
log "=== Building Applications ==="

# Build API
log "Building API..."
cd apps/api
if [ -f "package.json" ]; then
    echo "Installing API dependencies..."
    pnpm install
    
    echo "Building API..."
    if pnpm run build; then
        echo "✅ API built successfully"
        echo "Build output location: $(pwd)/dist/"
        ls -la dist/ 2>/dev/null || echo "No dist directory found"
    else
        warn "❌ API build failed"
        echo "Trying manual TypeScript compilation..."
        if [ -f "tsconfig.json" ]; then
            ../../../node_modules/.bin/tsc
        fi
    fi
else
    error "API package.json not found"
fi
cd "$APP_DIR"

# Build Web
log "Building Web..."
cd apps/web
if [ -f "package.json" ]; then
    echo "Installing Web dependencies..."
    pnpm install
    
    echo "Building Web..."
    if pnpm run build; then
        echo "✅ Web built successfully"
        echo "Build output location: $(pwd)/.next/"
        ls -la .next/ 2>/dev/null || echo "No .next directory found"
    else
        warn "❌ Web build failed"
        echo "Checking for common Next.js issues..."
        
        # Check for missing dependencies
        echo "Checking workspace dependencies..."
        if ! npm list @ux-nevesht/ui >/dev/null 2>&1; then
            echo "❌ @ux-nevesht/ui not found - workspace dependency issue"
        fi
        
        # Try building with more verbose output
        echo "Trying build with verbose output..."
        pnpm run build --verbose 2>&1 | tail -30
    fi
else
    error "Web package.json not found"
fi
cd "$APP_DIR"

# 6. Final verification
log "=== Final Verification ==="
echo "API build output:"
if [ -f "apps/api/dist/index.js" ]; then
    echo "✅ apps/api/dist/index.js exists"
    ls -la apps/api/dist/index.js
else
    echo "❌ apps/api/dist/index.js missing"
    echo "Contents of apps/api/dist/:"
    ls -la apps/api/dist/ 2>/dev/null || echo "Directory does not exist"
fi

echo ""
echo "Web build output:"
if [ -d "apps/web/.next" ]; then
    echo "✅ apps/web/.next/ exists"
    ls -la apps/web/.next/ | head -5
else
    echo "❌ apps/web/.next/ missing"
fi

# 7. Provide next steps
log "=== Next Steps ==="
if [ -f "apps/api/dist/index.js" ] && [ -d "apps/web/.next" ]; then
    echo "🎉 Both builds successful! You can now start the services:"
    echo "pm2 start ecosystem.config.js --env production"
elif [ -f "apps/api/dist/index.js" ]; then
    echo "✅ API build successful, but Web build failed"
    echo "You can start just the API service:"
    echo "pm2 start ecosystem.config.js --only ux-nevesht-api --env production"
elif [ -d "apps/web/.next" ]; then
    echo "✅ Web build successful, but API build failed"
    echo "You can start just the Web service:"
    echo "pm2 start ecosystem.config.js --only ux-nevesht-web --env production"
else
    echo "❌ Both builds failed. Please check the error messages above."
    echo ""
    echo "Common solutions:"
    echo "1. Check TypeScript errors in source files"
    echo "2. Ensure all workspace dependencies are properly linked"
    echo "3. Check for missing environment variables"
    echo "4. Verify all package.json files have correct dependencies"
fi

log "Build diagnostics completed!"