#!/usr/bin/env bash
# scripts/update-tax-data.sh
#
# Generates missing tax-data TOML files in app/data/ by scraping HMRC pages
# and using `gh copilot` to extract structured data into the project's TOML schema.
#
# Local-only: this script runs on a developer machine using the locally-authenticated
# `gh` CLI. After it completes, review the generated files manually and commit if happy.
# (The previous GitHub Actions workflow that did the same thing has been moved to
#  _developers/archive/update-tax-data.yml — running an LLM call inside CI and
#  committing the output back to the repo is the kind of automation pattern that
#  triggers GitHub's abuse heuristics.)
#
# Usage:
#   scripts/update-tax-data.sh [year]
#   scripts/update-tax-data.sh                # uses current calendar year
#
# Prerequisites:
#   gh CLI authenticated (with the copilot scope), node, python3, curl

set -euo pipefail

YEAR="${1:-$(date +%Y)}"
WORKDIR="${TMPDIR:-/tmp}/update-tax-data"
mkdir -p "$WORKDIR/scraped"

cd "$(dirname "$0")/.."

echo "Generating HMRC URLs for base year $YEAR..."
node scripts/hmrc-rate-urls.cjs "$YEAR" > "$WORKDIR/urls.txt"
URL_COUNT=$(wc -l < "$WORKDIR/urls.txt" | tr -d ' ')
echo "  $URL_COUNT URLs to fetch"

echo "Scraping HMRC pages..."
while IFS= read -r url; do
  slug=$(echo "$url" | sed 's|https://www.gov.uk/||; s|/|__|g')
  echo "  $url"
  curl -sL --max-time 30 "$url" | python3 -c "
import sys, re
html = sys.stdin.read()
text = re.sub(r'<[^>]+>', ' ', html)
text = re.sub(r'\s+', ' ', text).strip()
print(text[:50000])
" > "$WORKDIR/scraped/${slug}.txt" 2>/dev/null || echo "    failed"
done < "$WORKDIR/urls.txt"
echo "  Scraped $(ls "$WORKDIR/scraped" | wc -l | tr -d ' ') pages"

echo "Identifying missing tax data files..."
MISSING=""
for y in $(seq $((YEAR + 1)) -1 $((YEAR - 5))); do
  next=$((y + 1))
  [ -f "app/data/se-${y}-${next}.toml" ] || MISSING="$MISSING se-${y}-${next}"
  [ -f "app/data/ltd-${y}.toml" ] || MISSING="$MISSING ltd-${y}"
done
FIRST=$(echo $MISSING | awk '{print $1}')
if [ -z "$FIRST" ]; then
  echo "  All tax data files exist — nothing to create"
  exit 0
fi
echo "  Next to create: $FIRST"
echo "  All missing: $MISSING"

echo "Building LLM prompt..."
EXAMPLE=$(cat app/data/ltd-2025.toml)
SE_EXAMPLE=$(cat app/data/se-2025-2026.toml)

cat > "$WORKDIR/prompt.txt" << PROMPTEOF
You are a UK tax data extraction assistant. From the HMRC rate pages below,
create the missing TOML tax data files. Output ONLY valid TOML content for
each file, separated by a line containing just "---FILE: filename.toml---".

Missing files: $MISSING

For ltd-YYYY.toml files, use this exact schema (example from ltd-2025.toml):
$EXAMPLE

For se-YYYY-YYYY.toml files, use this exact schema (example from se-2025-2026.toml):
$SE_EXAMPLE

Rules:
- Only create files for years where the scraped data contains authoritative rates
- If rates are not yet published for a year, carry forward from the previous year and add a comment "PROVISIONAL"
- Corporation Tax: 19% small profits (up to 50000), 25% main rate (from FY2023). Before FY2023 it was 19% flat.
- WDA main rate changed from 18% to 14% from 1 April 2026 (FY2026+)
- Employer NI changed to 15% with 5000 secondary threshold from April 2025
- VAT threshold changed from 85000 to 90000 from April 2024
- Dividend allowance: 2000 (pre-2023), 1000 (2023-24), 500 (2024+)
- Output dates as bare TOML dates (YYYY-MM-DD without quotes)

HMRC scraped data follows:
PROMPTEOF

if [ -f .github/agents/tax-data-updater.agent.md ]; then
  echo "" >> "$WORKDIR/prompt.txt"
  echo "=== AGENT INSTRUCTIONS ===" >> "$WORKDIR/prompt.txt"
  cat .github/agents/tax-data-updater.agent.md >> "$WORKDIR/prompt.txt"
fi

echo "" >> "$WORKDIR/prompt.txt"
echo "=== SCRAPED HMRC DATA ===" >> "$WORKDIR/prompt.txt"
for f in "$WORKDIR/scraped"/*.txt; do
  echo "--- SOURCE: $(basename "$f" .txt) ---" >> "$WORKDIR/prompt.txt"
  head -c 8000 "$f" >> "$WORKDIR/prompt.txt"
  echo "" >> "$WORKDIR/prompt.txt"
done
echo "  Prompt: $(wc -c < "$WORKDIR/prompt.txt" | tr -d ' ') bytes"

echo "Calling gh copilot to generate TOML files..."
RESPONSE=$(gh copilot -- --model 'gpt-5-mini' --prompt "$(cat "$WORKDIR/prompt.txt")" 2>&1) || true
echo "$RESPONSE" > "$WORKDIR/response.txt"
echo "  Response: $(wc -c < "$WORKDIR/response.txt" | tr -d ' ') bytes"

for name in $MISSING; do
  filename="${name}.toml"
  content=$(echo "$RESPONSE" | sed -n "/---FILE: ${filename}---/,/---FILE:/p" | sed '$d' | tail -n +2)
  if [ -n "$content" ]; then
    echo "$content" > "app/data/${filename}"
    echo "  Created: app/data/${filename}"
  else
    echo "  WARNING: Could not extract ${filename} from LLM response (see $WORKDIR/response.txt)"
  fi
done

echo "Validating TOML files..."
node -e "
  const { parse } = require('smol-toml');
  const fs = require('fs');
  const files = fs.readdirSync('app/data').filter(f => f.endsWith('.toml'));
  let ok = 0, fail = 0;
  for (const f of files) {
    try { parse(fs.readFileSync('app/data/' + f, 'utf8')); ok++; }
    catch (e) { console.error('  INVALID: ' + f + ' — ' + e.message); fail++; }
  }
  console.log('  ' + ok + ' valid, ' + fail + ' invalid');
  if (fail > 0) process.exit(1);
"

echo
echo "Generated:"
for name in $MISSING; do
  if [ -f "app/data/${name}.toml" ]; then
    echo "  app/data/${name}.toml"
  fi
done
echo
echo "Next: review the files, run 'npm test', and commit manually."
echo "Workdir (raw response, prompt, scraped pages): $WORKDIR"
