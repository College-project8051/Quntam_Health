#!/usr/bin/env bash
set -e

echo "==> Installing Frontend dependencies (including devDependencies for build)..."
cd Frontend
npm install --include=dev

echo "==> Building Frontend..."
npm run build

echo "==> Installing Backend dependencies..."
cd ../Backend
npm install

echo "==> Build complete!"
