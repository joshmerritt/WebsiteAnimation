#!/bin/bash
# Run from your WebsiteAnimation project root
# Usage: bash dump_codebase.sh

OUTPUT="codebase_dump.txt"
> "$OUTPUT"

FILES=(
  # Root config
  "index.html"
  "portfolio.html"
  "analytics-dashboard.html"
  "analytics-v2.html"
  "analytics-v3.html"
  "analytics-v4.html"
  "vite.config.js"
  "package.json"
  ".env.production"

  # Entry points
  "src/main.jsx"
  "src/App.jsx"
  "src/portfolio-main.jsx"
  "src/analytics-main.jsx"
  "src/analytics-v2-main.jsx"
  "src/analytics-v3-main.jsx"
  "src/analytics-v4-main.jsx"

  # Data
  "src/data/projects.js"

  # Accessible portfolio
  "src/AccessiblePortfolio.jsx"

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
  "src/game/posthog.js"
  "src/game/sessionBridge.js"

  # Components
  "src/components/GameCanvas.jsx"
  "src/components/HUD.jsx"
  "src/components/LoadingScreen.jsx"
  "src/components/StatsOverlay.jsx"
  "src/components/DetailModal.jsx"

  # Styles
  "src/styles/index.css"
  "src/styles/portfolio.css"
  "src/styles/analytics.css"
  "src/styles/analytics-v2.css"
  "src/styles/analytics-v4.css"

  # Analytics
  "src/analytics/telemetry.js"
  "src/analytics/data.js"
  "src/analytics/legacyShape.js"
  "src/analytics/hooks.js"
  "src/analytics/StatCard.jsx"
  "src/analytics/Sparkline.jsx"
  "src/analytics/AreaChart.jsx"
  "src/analytics/DonutChart.jsx"
  "src/analytics/FunnelViz.jsx"
  "src/analytics/ShotChart.jsx"
  "src/analytics/BallEngagement.jsx"
  "src/analytics/BallEngagementV2.jsx"
  "src/analytics/AnalyticsDashboard.jsx"
  "src/analytics/AnalyticsDashboardV2.jsx"
  "src/analytics/AnalyticsDashboardV3.jsx"

  # Analytics dashboard v4
  "src/analytics/v4/DashboardV4.jsx"
  "src/analytics/v4/ShotChart.jsx"
  "src/analytics/v4/charts.jsx"
  "src/analytics/v4/sections.jsx"
  "src/analytics/v4/HowItWorks.jsx"
  "src/analytics/v4/ui.jsx"
  "src/analytics/v4/api.js"
  "src/analytics/v4/session.js"
  "src/analytics/v4/court.js"
  "src/analytics/v4/meta.js"
  "src/analytics/v4/format.js"
  "src/analytics/v4/sample.js"

  # Analytics worker (Cloudflare Worker -> PostHog)
  "analytics-worker/analytics-worker.js"
  "analytics-worker/aggregate.js"
  "analytics-worker/wrangler.toml"

  # Public
  "public/.htaccess"
  "public/robots.txt"
  "public/sitemap.xml"
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
