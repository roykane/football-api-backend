#!/bin/bash
# Deploy script for production

echo "🚀 Starting deployment..."

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Restart PM2
pm2 restart api-football || pm2 start server.js --name api-football

# Save PM2 process list
pm2 save

echo "✅ Deployment complete!"
echo "📊 Checking status..."
pm2 status
