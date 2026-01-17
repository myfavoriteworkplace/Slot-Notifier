#!/bin/bash

# Build and Run script for local production-like environment

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Syncing database schema..."
npm run db:push

echo "🏗️ Building frontend and backend..."
npm run build

echo "🚀 Starting production server..."
export NODE_ENV=production
node dist-backend/server.cjs
