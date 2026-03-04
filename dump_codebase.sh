#!/bin/bash
# Run from your WebsiteAnimation project root
# Usage: bash dump_codebase.sh

OUTPUT="codebase_dump.txt"
> "$OUTPUT"

FILES=(
  # Root config
  "index.html"
  "analytics-dashboard.html"
  "analytics-v2.html"
  "vite.config.js"
  "package.json"
  ".env.production"

  # Entry points
  "src/main.jsx"
  "src/App.jsx"
  "src/analytics-main.jsx"
  "src/analytics-v2-main.jsx"

  # Data
  "src/data/projects.js"

  # Game
  "src/game/Game.js"
  "src/game/Ball.js"
  "src/game/Boundary.js"
  "src/game/Goal.js"
  "src/game/Net.js"
  "src/game/Particles.js"
  "src/game/Menu.js"
  "src/game/config.js"
  "src/game/EventBus.js"
  "src/game/ga4.js"

  # Components
  "src/components/GameCanvas.jsx"
  "src/components/HUD.jsx"
  "src/components/LoadingScreen.jsx"
  "src/components/StatsOverlay.jsx"
  "src/components/DetailModal.jsx"

  # Styles
  "src/styles/index.css"
  "src/styles/analytics.css"
  "src/styles/analytics-v2.css"

  # Analytics
  "src/analytics/data.js"
  "src/analytics/hooks.js"
  "src/analytics/StatCard.jsx"
  "src/analytics/Sparkline.jsx"
  "src/analytics/AreaChart.jsx"
  "src/analytics/DonutChart.jsx"
  "src/analytics/FunnelViz.jsx"
  "src/analytics/BallEngagement.jsx"
  "src/analytics/BallEngagementV2.jsx"
  "src/analytics/AnalyticsDashboard.jsx"
  "src/analytics/AnalyticsDashboardV2.jsx"

  # GA4 Worker
  "ga4-worker/ga4-worker.js"
  "ga4-worker/wrangler.toml"

  # Public
  "public/.htaccess"
)

echo "=============================" >> "$OUTPUT"
echo " CODEBASE DUMP - $(date)" >> "$OUTPUT"
echo "=============================" >> "$OUTPUT"
echo "" >> "$OUTPUT"

for ENTRY in "${FILES[@]}"; do
  if [ -f "$ENTRY" ]; then
    echo "" >> "$OUTPUT"
    echo "========================================" >> "$OUTPUT"
    echo "FILE: $ENTRY" >> "$OUTPUT"
    echo "========================================" >> "$OUTPUT"
    cat "$ENTRY" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
  else
    echo "" >> "$OUTPUT"
    echo "# MISSING: $ENTRY" >> "$OUTPUT"
  fi
done

LINES=$(wc -l < "$OUTPUT")
FILES_COUNT=$(grep -c "^FILE:" "$OUTPUT")
echo ""
echo "✅ Done! $FILES_COUNT files, $LINES lines → $OUTPUT"
