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
    this._listeners.get(event)?.forEach((fn) => fn(data));
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
 *   'stats:update'   { shots, makes, opens }  — Game → React: live stats
 */
