/**
 * telemetry.js — PostHog for the dashboard pages
 *
 * The dashboards used to send nothing at all: no page views, no errors, no
 * replay. So when one of them failed to load there was no record of it, only a
 * memory that "it broke once and a reload fixed it".
 *
 * PostHog is ~100 kB gzipped, so it is imported on demand and never sits in the
 * way of the dashboard's own first paint. Everything here is fire-and-forget:
 * if PostHog fails to load, or this host isn't allowed to track (anything but
 * dadatadad.com — see shouldTrack() in src/game/posthog.js), calls do nothing.
 *
 * Dashboard page views are tracked but are NOT counted as visits to the
 * portfolio: the worker separates them by path. Otherwise the owner checking
 * his own numbers would become the site's most frequent visitor.
 */

let loading = null;

/** Start PostHog (page view, autocapture, replay, error capture). Idempotent. */
export function initTelemetry() {
  if (!loading) {
    loading = import('../game/posthog.js')
      .then((mod) => { mod.initPostHog(); return mod; })
      .catch(() => null);   // a blocked or failed chunk must never break the page
  }
  return loading;
}

/** Capture a custom event once PostHog is up. */
export function track(event, props) {
  initTelemetry().then((mod) => mod?.captureEvent(event, props));
}

/** Send a caught error to PostHog error tracking. */
export function reportError(error, props) {
  initTelemetry().then((mod) => mod?.captureException(error, props));
}
