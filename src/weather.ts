import * as Location from 'expo-location';

export type Condition =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezing'
  | 'snow'
  | 'thunderstorm';

export interface WeatherSnapshot {
  tempF: number;
  feelsLikeF: number;
  precipInch: number;
  isPrecipitating: boolean;
  windMph: number;
  windGustMph: number;
  isWindy: boolean;
  humidity: number;
  isDay: boolean;
  weatherCode: number;
  condition: Condition;
  city: string | null;
  fetchedAt: number;
}

// "Significantly windy" — sustained wind or hard gusts. Tunable.
export const WIND_MPH_THRESHOLD = 20;
export const GUST_MPH_THRESHOLD = 32;
export const PRECIP_INCH_THRESHOLD = 0.005;

const PRECIP_CONDITIONS: Condition[] = [
  'drizzle',
  'rain',
  'freezing',
  'snow',
  'thunderstorm',
];

// Maps WMO weather interpretation codes (Open-Meteo) to a coarse condition.
export function codeToCondition(code: number): Condition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 66 || code === 67) return 'freezing';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return 'cloudy';
}

export class LocationPermissionError extends Error {
  constructor(message = 'Location permission denied') {
    super(message);
    this.name = 'LocationPermissionError';
  }
}

// Rejects if the promise doesn't settle in time, so a stuck GPS lock or a dead
// network can never leave the app spinning on "Sniffing the air…" forever.
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Resolves with the first promise to fulfill; only rejects once every promise
// has rejected. Lets us race weather providers so one dead host can't stall the
// whole refresh — whoever answers first wins.
function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let remaining = promises.length;
    let done = false;
    let lastErr: unknown = new Error('No providers to try.');
    if (remaining === 0) {
      reject(lastErr);
      return;
    }
    for (const p of promises) {
      p.then(
        (value) => {
          if (!done) {
            done = true;
            resolve(value);
          }
        },
        (err) => {
          lastErr = err;
          remaining -= 1;
          if (remaining === 0 && !done) {
            done = true;
            reject(lastErr);
          }
        }
      );
    }
  });
}

async function getCoords(): Promise<{ latitude: number; longitude: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionError();
  }

  // A cached fix is instant and sidesteps the slow (sometimes never-ending)
  // fresh GPS lock, so use it whenever one exists.
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  if (last) {
    return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  }

  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled) {
    throw new Error('Your location is switched off. Flip on GPS and try again.');
  }

  // Lowest accuracy uses wifi/cell instead of satellites — fast and works
  // indoors. Race it so we bail with a clear message instead of hanging.
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
    15000,
    "Couldn't pin down where you are. Get some open sky and try again."
  );
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

async function reverseCity(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    // City is cosmetic — never let a slow geocoder block the forecast.
    const results = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      6000,
      'reverse-geocode timed out'
    );
    const r = results?.[0];
    if (!r) return null;
    return r.city || r.subregion || r.region || r.district || null;
  } catch {
    return null;
  }
}

type WeatherCore = Omit<WeatherSnapshot, 'city' | 'fetchedAt'>;

const MS_TO_MPH = 2.2369362920544;
// MET Norway rejects requests without an identifying User-Agent.
const MET_USER_AGENT = 'Foulcast/1.1.4 (github.com/skyeatsbrad/foulcast)';

async function fetchWithTimeout(
  url: string,
  init: { headers?: Record<string, string> },
  ms: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  is_day: number;
}

async function fetchFromOpenMeteo(
  latitude: number,
  longitude: number
): Promise<WeatherCore> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
    'precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' +
    '&timezone=auto';

  const res = await fetchWithTimeout(url, {}, 15000);
  if (!res.ok) {
    throw new Error(`Weather service coughed up a ${res.status}.`);
  }
  const json = (await res.json()) as { current?: OpenMeteoCurrent };
  const c = json.current;
  if (!c) {
    throw new Error('Weather service sent back a whole lot of nothing.');
  }

  const condition = codeToCondition(c.weather_code);
  const precipInch = c.precipitation ?? 0;
  const windMph = c.wind_speed_10m ?? 0;
  const windGustMph = c.wind_gusts_10m ?? 0;

  return {
    tempF: c.temperature_2m,
    feelsLikeF: c.apparent_temperature,
    precipInch,
    isPrecipitating:
      precipInch > PRECIP_INCH_THRESHOLD ||
      PRECIP_CONDITIONS.includes(condition),
    windMph,
    windGustMph,
    isWindy: windMph >= WIND_MPH_THRESHOLD || windGustMph >= GUST_MPH_THRESHOLD,
    humidity: c.relative_humidity_2m,
    isDay: c.is_day === 1,
    weatherCode: c.weather_code,
    condition,
  };
}

// MET Norway symbol_code (e.g. "clearsky_night", "lightrain", "snow") -> Condition.
function metSymbolToCondition(symbol: string): Condition {
  const s = symbol.toLowerCase();
  if (s.includes('thunder')) return 'thunderstorm';
  if (s.includes('sleet')) return 'freezing';
  if (s.includes('snow')) return 'snow';
  if (s.includes('fog')) return 'fog';
  if (s.includes('drizzle') || s.includes('lightrain')) return 'drizzle';
  if (s.includes('rain')) return 'rain';
  if (s.includes('cloud')) return 'cloudy';
  if (s.includes('clearsky') || s.includes('fair')) return 'clear';
  return 'cloudy';
}

interface MetInstantDetails {
  air_temperature?: number;
  wind_speed?: number;
  wind_speed_of_gust?: number;
  relative_humidity?: number;
}
interface MetTimeseries {
  data?: {
    instant?: { details?: MetInstantDetails };
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
    next_6_hours?: { summary?: { symbol_code?: string } };
  };
}

// Fallback provider. Metric units (we convert); is_day from the symbol suffix
// when present, otherwise a rough local-hour guess (good enough for a backup).
async function fetchFromMet(
  latitude: number,
  longitude: number
): Promise<WeatherCore> {
  const url =
    'https://api.met.no/weatherapi/locationforecast/2.0/compact' +
    `?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`;
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': MET_USER_AGENT } },
    15000
  );
  if (!res.ok) {
    throw new Error(`Backup weather service coughed up a ${res.status}.`);
  }
  const json = (await res.json()) as {
    properties?: { timeseries?: MetTimeseries[] };
  };
  const ts = json.properties?.timeseries?.[0];
  const inst = ts?.data?.instant?.details;
  if (!inst || inst.air_temperature == null) {
    throw new Error('Backup weather service sent back a whole lot of nothing.');
  }

  const symbol =
    ts?.data?.next_1_hours?.summary?.symbol_code ??
    ts?.data?.next_6_hours?.summary?.symbol_code ??
    'cloudy';
  const tempF = (inst.air_temperature * 9) / 5 + 32;
  const windMph = (inst.wind_speed ?? 0) * MS_TO_MPH;
  const windGustMph = (inst.wind_speed_of_gust ?? inst.wind_speed ?? 0) * MS_TO_MPH;
  const precipInch =
    (ts?.data?.next_1_hours?.details?.precipitation_amount ?? 0) / 25.4;
  const condition = metSymbolToCondition(symbol);

  let isDay: boolean;
  if (symbol.endsWith('_day')) {
    isDay = true;
  } else if (symbol.endsWith('_night')) {
    isDay = false;
  } else {
    const h = new Date().getHours();
    isDay = h >= 7 && h < 20;
  }

  return {
    tempF,
    feelsLikeF: tempF,
    precipInch,
    isPrecipitating:
      precipInch > PRECIP_INCH_THRESHOLD ||
      PRECIP_CONDITIONS.includes(condition),
    windMph,
    windGustMph,
    isWindy: windMph >= WIND_MPH_THRESHOLD || windGustMph >= GUST_MPH_THRESHOLD,
    humidity: inst.relative_humidity ?? 0,
    isDay,
    weatherCode: -1,
    condition,
  };
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const { latitude, longitude } = await getCoords();

  // Race both providers instead of waiting out a dead host. Open-Meteo is
  // primary (richer data), so it starts first and gets a short head start;
  // MET Norway kicks off a beat later. Whoever answers first wins, and the
  // outer timeout is a hard cap so a fetch that ignores its abort signal can
  // never leave the refresh spinning. When api.open-meteo.com is down, MET
  // resolves in ~1.5s instead of the app hanging on ~30s of timeouts.
  const openMeteo = withTimeout(
    fetchFromOpenMeteo(latitude, longitude),
    10000,
    'Open-Meteo timed out.'
  );
  const met = wait(600).then(() =>
    withTimeout(fetchFromMet(latitude, longitude), 10000, 'MET timed out.')
  );

  let core: WeatherCore | null = null;
  try {
    core = await firstSuccess<WeatherCore>([openMeteo, met]);
  } catch {
    // Both providers are down.
    core = null;
  }
  if (!core) {
    throw new Error(
      'Weather service ghosted us. Check your connection and try again.'
    );
  }

  const city = await reverseCity(latitude, longitude);
  return { ...core, city, fetchedAt: Date.now() };
}
