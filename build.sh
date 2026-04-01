#!/usr/bin/env bash
set -e

echo "==> Installing Frontend dependencies..."
cd Frontend
npm install

echo "==> Building Frontend..."
npm run build

echo "==> Installing Backend dependencies..."
cd ../Backend
npm install

echo "==> Build complete!"
