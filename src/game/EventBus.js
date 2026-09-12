/**
 * EventBus.js — Lightweight pub/sub
 *
 * Replaces window.ui / window.onReset / window.onDetailClosed global bridge.
 * Both the Game (p5 side) and React components subscribe/emit through this.
 */

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }

  emit(event, data) {
    this._listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(`EventBus [${event}]:`, e); }
    });
  }

  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }
}

// Single shared instance
const bus = new EventBus();
export default bus;

/**
 * Event catalog:
 *
 *   'detail:open'    { project }     — Game → React: open the detail modal
 *   'detail:close'   —                React → Game: modal was closed
 *   'game:reset'     —                React → Game: reset all balls
 *                                     ⚠ NO EMITTER: there is no reset control
 *                                     in the UI, so Game._onReset() and the
 *                                     PostHog `game_reset` listener is
 *                                     wired but never fire. Add a reset button
 *                                     that emits this and it all lights up.
 *   'stats:update'   { shots, makes, opens }  — Game → React: live stats
 *   'load:progress'  number (0–1)   — Game → React: image loading progress
 *   'load:complete'  —               Game → React: all assets loaded, setup done
 *   'ball:launched'  { name, category, ballLaunches, ballMakes }  — Game → analytics
 *   'ball:scored'    { name, category, ballLaunches, ballMakes }  — Game → analytics
 *   'cta:click'      { name, link, category } — React → analytics
 *   'miss:hint'      boolean         — Game → React: show/hide miss hint
 *   'impact:first'   { ballId, ballName, ballCategory, hitType, hitLabel,
 *                       isGoal, x, y, px, py, vpWidth, vpHeight,
 *                       shotNumber, timestamp }  — Game → analytics/dashboard
 *   'perf:sample'    { avg_fps, min_fps, active_frames, hardware_threads,
 *                       device_memory_gb, canvas_px }  — Game → PostHog:
 *                     emitted ONCE, ~30s after load:complete, averaged over
 *                     active (non-idle) frames only
 */
