#!/bin/bash

# Debug Build Script for UX Nevesht
# This script helps diagnose build issues step by step

set -e

echo "🔍 UX Nevesht Build Diagnostics"
echo "================================"

# Check current directory
echo "📁 Current directory: $(pwd)"
echo "📁 Contents:"
ls -la

# Check if we're in the right place
if [ ! -f "package.json" ] || [ ! -f "turbo.json" ]; then
    echo "❌ Not in project root. Please run from the uxNevesht directory."
    exit 1
fi

echo ""
echo "🔧 Checking tools..."
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "pnpm version: $(pnpm --version)"

# Check if turbo is available
if [ -f "node_modules/.bin/turbo" ]; then
    echo "✅ Local turbo found: $(./node_modules/.bin/turbo --version)"
else
    echo "❌ Local turbo not found"
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🏗️  Building workspace packages in order..."

# Build each package individually with error handling
packages=("packages/config" "packages/database" "packages/ai" "packages/ui")

for pkg in "${packages[@]}"; do
    if [ -d "$pkg" ]; then
        echo ""
        echo "Building $pkg..."
        cd "$pkg"
        
        if [ -f "package.json" ]; then
            echo "Package.json found in $pkg"
            
            # Check if build script exists
            if pnpm run build --dry-run 2>/dev/null; then
                echo "Running build for $pkg..."
                if pnpm run build; then
                    echo "✅ $pkg built successfully"
                    
                    # Check build output
                    if [ -d "dist" ]; then
                        echo "Build output in dist/:"
                        ls -la dist/
                    fi
                else
                    echo "❌ $pkg build failed"
                    echo "This will likely cause app builds to fail"
                fi
            else
                echo "⚠️  No build script found in $pkg"
            fi
        else
            echo "⚠️  No package.json found in $pkg"
        fi
        
        cd - > /dev/null
    else
        echo "⚠️  Directory $pkg not found"
    fi
done

echo ""
echo "🏗️  Building applications..."

# Try building with turbo
echo ""
echo "Attempting turbo build..."
if [ -f "node_modules/.bin/turbo" ]; then
    if ./node_modules/.bin/turbo build; then
        echo "✅ Turbo build successful"
    else
        echo "❌ Turbo build failed"
        echo ""
        echo "Trying individual app builds..."
        
        # Build API
        echo ""
        echo "Building API..."
        cd apps/api
        echo "API dependencies:"
        pnpm list --depth=0 2>/dev/null || echo "Could not list dependencies"
        
        if pnpm run build; then
            echo "✅ API built successfully"
            if [ -f "dist/index.js" ]; then
                echo "✅ API output file exists: dist/index.js"
            else
                echo "❌ API output file missing: dist/index.js"
                echo "Contents of dist/:"
                ls -la dist/ 2>/dev/null || echo "dist/ directory doesn't exist"
            fi
        else
            echo "❌ API build failed"
        fi
        cd ../..
        
        # Build Web
        echo ""
        echo "Building Web..."
        cd apps/web
        echo "Web dependencies:"
        pnpm list --depth=0 2>/dev/null || echo "Could not list dependencies"
        
        if pnpm run build; then
            echo "✅ Web built successfully"
            if [ -d ".next" ]; then
                echo "✅ Web output directory exists: .next/"
            else
                echo "❌ Web output directory missing: .next/"
            fi
        else
            echo "❌ Web build failed"
            echo ""
            echo "Common Web build issues:"
            echo "1. @ux-nevesht/ui package not built"
            echo "2. TypeScript errors in components"
            echo "3. Missing environment variables"
        fi
        cd ../..
    fi
else
    echo "❌ Turbo not available, cannot run turbo build"
fi

echo ""
echo "📋 Build Summary"
echo "================"

# Check final build outputs
if [ -f "apps/api/dist/index.js" ]; then
    echo "✅ API: Ready for deployment"
else
    echo "❌ API: Build output missing"
fi

if [ -d "apps/web/.next" ]; then
    echo "✅ Web: Ready for deployment"
else
    echo "❌ Web: Build output missing"
fi

echo ""
echo "🔍 Troubleshooting Tips:"
echo "1. Make sure all workspace packages build successfully first"
echo "2. Check that @ux-nevesht/* imports are working"
echo "3. Verify TypeScript configurations are correct"
echo "4. Check for missing environment variables"
echo ""
echo "To run this script: chmod +x debug-build.sh && ./debug-build.sh"
