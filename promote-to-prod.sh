#!/bin/bash
# Promote Convex dev data to production
# Usage: ./promote-to-prod.sh

set -e

echo "📦 Exporting dev data..."
npx convex export --path ./export

echo "📂 Unzipping export..."
unzip -o export -d export_unzipped

echo "🚀 Importing paddlers to prod..."
npx convex import --prod ./export_unzipped/paddlers/documents.jsonl --table paddlers

echo "🚀 Importing canoes to prod..."
npx convex import --prod ./export_unzipped/canoes/documents.jsonl --table canoes

echo "🧹 Cleaning up..."
rm -rf export export_unzipped

echo "✅ Done! Dev data promoted to production."
