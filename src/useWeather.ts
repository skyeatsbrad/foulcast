import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchWeather,
  LocationPermissionError,
  WeatherSnapshot,
} from './weather';

export type WeatherStatus = 'loading' | 'ready' | 'denied' | 'error';

export interface WeatherState {
  status: WeatherStatus;
  data: WeatherSnapshot | null;
  errorMessage: string | null;
  refreshing: boolean;
  refresh: () => void;
}

// Weather barely moves minute to minute, so ignore the network on rapid pulls.
// This is what stops the 69° "keep pulling" easter egg from hammering the
// weather + geocoding APIs (which could get us rate-limited).
const MIN_REFRESH_MS = 60_000;

export function useWeather(): WeatherState {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<WeatherStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const lastFetchAt = useRef(0);
  const mounted = useRef(true);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (spinTimer.current) clearTimeout(spinTimer.current);
    };
  }, []);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    try {
      const snapshot = await fetchWeather();
      lastFetchAt.current = Date.now();
      if (!mounted.current) return;
      setData(snapshot);
      setStatus('ready');
      setErrorMessage(null);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof LocationPermissionError) {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrorMessage(
          e instanceof Error ? e.message : 'Something broke. Classic.'
        );
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    // Retries from an error/denied state always do a full reload. From a good
    // state, throttle the actual fetch — a too-soon pull just flashes the
    // spinner and reuses the current reading instead of spamming the APIs.
    if (status === 'ready' && Date.now() - lastFetchAt.current < MIN_REFRESH_MS) {
      setRefreshing(true);
      if (spinTimer.current) clearTimeout(spinTimer.current);
      spinTimer.current = setTimeout(() => {
        if (mounted.current) setRefreshing(false);
      }, 400);
      return;
    }
    load(status === 'ready');
  }, [load, status]);

  return { status, data, errorMessage, refreshing, refresh };
}
