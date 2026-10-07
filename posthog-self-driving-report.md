# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured for this interactive portfolio. Session Replay and Error Tracking were already enabled, Support was enabled, native health/error/support responders were enabled, and GitHub Issues was connected as a warehouse source and inbox responder.

The focused scout troop and two approved portfolio-specific scouts are active. Findings should begin appearing in the [Self-driving inbox](https://us.posthog.com/project/605146/inbox) within about 30 minutes.

## AI data processing

Approved. The organization-level AI data-processing approval was in place before setup.

## GitHub

Connected during this setup. The existing PostHog GitHub App had access to the single repository `joshmerritt/WebsiteAnimation`; the GitHub Issues warehouse source was created from it.

## Products enabled

| Product | Result | Notes |
| --- | --- | --- |
| Session Replay | Already enabled | Browser `posthog.init` does not disable session recording. |
| Error Tracking | Already enabled | Browser `posthog.init` enables unhandled exception and rejection capture. |
| Support (Conversations) | Enabled | Tickets will reach Self-driving only after an inbound Support channel is connected. |

## Signal sources

| Signal source | Action |
| --- | --- |
| `health_checks` / `health_issue` | Enabled — setup and instrumentation health findings. |
| `error_tracking` / `issue_created` | Enabled. |
| `error_tracking` / `issue_reopened` | Enabled. |
| `error_tracking` / `issue_spiking` | Enabled. |
| `conversations` / `ticket` | Enabled; dormant until an inbound Support channel exists. |
| `github` / `issue` | Enabled. |
| `signals_scout` / `cross_source_issue` | Left on by server default; no config row is needed. |
| Session Replay source row | Deliberately skipped; Replay Vision scanners own this route. |
| Replay Vision source row | Deliberately skipped; scanners self-authorize through `emits_signals`. |

## Connected tools

| Tool | Result |
| --- | --- |
| GitHub Issues | Connected by this setup — warehouse source `01a1141c-36e5-0000-d6f0-1372c396c594` was created and its first sync started. Only the responder-consumed `issues` table is syncing; additional GitHub tables can be enabled in PostHog later. |
| Linear, Jira, Sentry, Zendesk, and other catalog tools | Not used — not selected in the connected-tools prompt. |

## Scout troop

The project has a verified budget of **100 runs/day**, with **0 used** and **100 remaining** at setup time. Announcement: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

### Active scouts (7)

| Scout | Why it is active |
| --- | --- |
| General | Covers cross-product patterns that do not belong to a specialist. |
| Product analytics | Watches portfolio interaction and conversion flows. |
| Web analytics | Watches visitor, channel, landing-page, and traffic-health changes. |
| Web vitals | Watches page-performance regressions. |
| Anomaly detection | Watches existing analytics for unexpected trend changes. |
| Portfolio interaction journey | Custom scout for stage-specific liveness in the interactive portfolio journey. |
| Canvas playability | Custom scout for physics-canvas performance and repeated gameplay struggle. |

### Disabled built-in scouts (23)

| Scouts | Reason |
| --- | --- |
| AI observability, APM, Logs, MCP tool calls | Those product surfaces are not evidenced in this web portfolio. |
| Conversations | Support was enabled for future ticket intake, but no inbound channel or ticket volume exists yet. |
| CSP violations | A CSP is present, but no CSP reporting stream is configured. |
| Customer analytics | No B2B account/group analytics surface is evidenced. |
| Data pipelines, Data warehouse | No CDP, export, hog-flow, or warehouse-monitoring surface is active beyond the new GitHub Issues sync. |
| Error tracking | Covered by the enabled native error-tracking responder. |
| Experiments, Feature flags, Surveys | No active experiments, flags, or surveys were found. |
| Inbox validation | Fresh setup; there are no resolved Self-driving reports to validate yet. |
| Insight alerts | Not selected because alert activity was not established in the available project profile. |
| Observability gaps | Kept off to preserve a focused troop; existing analytics and custom scouts cover the highest-value portfolio surfaces. |
| PR follow-up | No established merged-PR deployment telemetry surface was identified. |
| Replay vision | No pre-existing Replay Vision scanner estate was found; the scanner creation API is unavailable on this deployment. |
| Revenue analytics | No payment or revenue surface was found. |
| Session replay | Covered by Replay Vision scanners when scanner creation becomes available. |
| Skills store, Tasks, Workflows | Those PostHog operational products are not in use for this portfolio. |

## Custom scouts

| Scout | What it watches | Discriminator | Why it adds coverage |
| --- | --- | --- | --- |
| `signals-scout-portfolio-interaction-journey` | The portfolio journey from loading, to ball launch, to project open, to outbound project link. | A localized stage decline while the preceding stage stays at its normal volume. | The built-in product-analytics scout follows saved behavioral flows and derived-rate regressions; this scout also detects stage liveness and interaction entry collapse in the product’s specific game journey. |
| `signals-scout-canvas-playability` | Canvas frame-rate degradation and repeated scoring struggle. | Performance or struggle must move while gameplay entry remains stable. | Web Vitals watches page experience, not the p5/Matter canvas playability surface. |

Considered but ruled out: error bursts and replay capture health are already routed through the native error responder and Replay Vision respectively; revenue, AI, surveys, support operations, flags, experiments, and logs lack product evidence.

Both custom scouts were proposed and approved. If either becomes noisy, set `emit: false` on its scout config in PostHog to keep it running in dry-run mode without writing inbox reports.

## Replay Vision scanners

A Replay Vision scanner is an LLM that watches individual session recordings on a schedule and pushes findings to the inbox. It is the only component of this setup that spends Replay Vision quota; each finding has half weight and needs independent corroboration before it can promote an inbox report.

| Monitor brief | Status | Intended scope | Sampling / estimate |
| --- | --- | --- | --- |
| Breakage monitor | Not created — scanner creation API is not available on this deployment. | The interactive portfolio completion flow: reaching the game, launching a project ball, and opening project details. This is the portfolio’s meaningful completion path because it is how visitors discover work and follow its outbound links. | Not available because the API cannot create or estimate the scanner. |
| Frustration monitor | Not created — scanner creation API is not available on this deployment. | Sessions containing `$rageclick`, with no URL filter. | Not available because the API cannot create or estimate the scanner. |

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Support responder can receive tickets.
- [ ] Create the two Replay Vision monitors in PostHog once the scanner creation API is available: a URL-scoped interactive-portfolio breakage monitor and a `$rageclick`-gated frustration monitor, both with `emits_signals` enabled.

## What happens next

The scout coordinator picks up fresh configs within about 30 minutes. Scout runs draw from the daily run budget, cluster corroborated findings into reports in the Self-driving inbox, and can start coding tasks for immediately actionable issues.

## Files modified or created

- Created `posthog-self-driving-report.md`.

No product source files were modified.
