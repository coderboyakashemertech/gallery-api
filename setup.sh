#!/bin/bash
set -e

echo "🚀 Starting Gallery API Setup..."

# Ensure we are in the correct directory
cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Initializing database..."
npm run db:setup

echo "🏗️ Building application..."
npm run build

echo "✅ Setup complete! You can now start the server with 'npm start'."
