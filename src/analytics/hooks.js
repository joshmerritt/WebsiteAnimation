import { useState, useEffect, useCallback } from 'react';
import { fetchLiveData, getMockData } from './data.js';

/**
 * Animates a number from 0 → target with ease-out cubic easing.
 */
export function useAnimatedNumber(target, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return value;
}

/**
 * Fetches analytics data from the Cloudflare Worker.
 * Falls back to mock data if the worker is unavailable.
 *
 * Returns: { data, isLive, loading, error, refresh }
 */
export function useAnalyticsData(days = 90) {
  const [data, setData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const live = await fetchLiveData(days);
      setData(live);
      setIsLive(true);
    } catch (err) {
      console.warn('Live GA4 fetch failed, using mock data:', err.message);
      setData(getMockData(days));
      setIsLive(false);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLive, loading, error, refresh: load };
}
