#!/bin/bash
# Deploy script for production

set -e  # Stop on error

echo "🚀 Starting deployment..."

# Pull latest code
echo "📦 Pulling latest code..."
git pull origin main

# Install dependencies (only if package.json changed)
if git diff HEAD~1 --name-only | grep -q "package.json"; then
    echo "📦 package.json changed, installing dependencies..."
    npm install --production
else
    echo "⏭️  No dependency changes, skipping npm install"
fi

# Reload PM2 (zero-downtime with cluster mode)
echo "🔄 Reloading PM2..."
pm2 reload football-api --update-env || pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

echo ""
echo "✅ Deployment complete!"
echo "📊 Status:"
pm2 status
echo ""
echo "📋 Recent logs:"
pm2 logs football-api --lines 5 --nostream
