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

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const { latitude, longitude } = await getCoords();

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
    'precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' +
    '&timezone=auto';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch {
    throw new Error(
      'Weather service ghosted us. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timeout);
  }
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

  const isPrecipitating =
    precipInch > PRECIP_INCH_THRESHOLD || PRECIP_CONDITIONS.includes(condition);
  const isWindy =
    windMph >= WIND_MPH_THRESHOLD || windGustMph >= GUST_MPH_THRESHOLD;

  const city = await reverseCity(latitude, longitude);

  return {
    tempF: c.temperature_2m,
    feelsLikeF: c.apparent_temperature,
    precipInch,
    isPrecipitating,
    windMph,
    windGustMph,
    isWindy,
    humidity: c.relative_humidity_2m,
    isDay: c.is_day === 1,
    weatherCode: c.weather_code,
    condition,
    city,
    fetchedAt: Date.now(),
  };
}
