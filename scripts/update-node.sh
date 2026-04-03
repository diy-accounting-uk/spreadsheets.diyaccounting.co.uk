#!/usr/bin/env bash
# scripts/update.sh
# Usage: ./scripts/update-node.sh
#

rm -f package-lock.json
rm -rf node-modules
rm -rf cdk-spreadsheets.out
npm install
npm run update-to-greatest
npm update
npm upgrade
npm install
npm link
