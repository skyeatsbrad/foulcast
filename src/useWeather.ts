import { useCallback, useEffect, useState } from 'react';

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

export function useWeather(): WeatherState {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<WeatherStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    try {
      const snapshot = await fetchWeather();
      setData(snapshot);
      setStatus('ready');
      setErrorMessage(null);
    } catch (e) {
      if (e instanceof LocationPermissionError) {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrorMessage(
          e instanceof Error ? e.message : 'Something broke. Classic.'
        );
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    // Pull-to-refresh keeps the current view; retries do a full reload.
    load(status === 'ready');
  }, [load, status]);

  return { status, data, errorMessage, refreshing, refresh };
}
