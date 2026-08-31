#!/bin/bash

# Build and run script for local production simulation.
# Replicates exactly what runs on Render.
# Usage: chmod +x run-local.sh && ./run-local.sh

echo "Installing dependencies..."
npm install

echo "Syncing database schema..."
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push

echo "Building frontend and backend..."
npm run build

echo "Starting production server..."
export APP_ENV=development
export NODE_ENV=production
node dist/index.cjs
