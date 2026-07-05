import { describe, it, expect, jest } from '@jest/globals';
import {
  codeToCondition,
  metSymbolToCondition,
  firstSuccess,
  WeatherSnapshot,
} from '../weather';
import { selectPool } from '../quips';

import { STORM } from '../quips/storm';
import { ICE } from '../quips/ice';
import { SNOW } from '../quips/snow';
import { RAIN } from '../quips/rain';
import { DRIZZLE } from '../quips/drizzle';
import { FOG } from '../quips/fog';
import { HELL } from '../quips/hell';
import { HOT } from '../quips/hot';
import { WARM } from '../quips/warm';
import { NICE } from '../quips/nice';
import { COOL } from '../quips/cool';
import { MEH } from '../quips/meh';
import { COLD } from '../quips/cold';
import { DEEP_FREEZE } from '../quips/deepFreeze';
import { WIND } from '../quips/wind';

// weather.ts imports expo-location at module scope; the pure functions under
// test never touch it, so a bare mock keeps the native module out of Node.
jest.mock('expo-location', () => ({ Accuracy: { Lowest: 1 } }));

function snap(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    tempF: 70,
    feelsLikeF: 70,
    precipInch: 0,
    isPrecipitating: false,
    windMph: 0,
    windGustMph: 0,
    isWindy: false,
    humidity: 50,
    isDay: true,
    weatherCode: 0,
    condition: 'clear',
    city: null,
    fetchedAt: 0,
    ...overrides,
  };
}

const delay = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('codeToCondition (WMO codes)', () => {
  it.each([
    [0, 'clear'],
    [1, 'clear'],
    [3, 'cloudy'],
    [45, 'fog'],
    [51, 'drizzle'],
    [63, 'rain'],
    [81, 'rain'],
    [66, 'freezing'],
    [73, 'snow'],
    [86, 'snow'],
    [95, 'thunderstorm'],
    [99, 'thunderstorm'],
    [4, 'cloudy'],
    [90, 'cloudy'],
  ])('code %i -> %s', (code, expected) => {
    expect(codeToCondition(code as number)).toBe(expected);
  });
});

describe('metSymbolToCondition', () => {
  it.each([
    ['clearsky_night', 'clear'],
    ['fair_day', 'clear'],
    ['partlycloudy_day', 'cloudy'],
    ['cloudy', 'cloudy'],
    ['fog', 'fog'],
    ['lightrain', 'drizzle'],
    ['rain', 'rain'],
    ['heavyrain', 'rain'],
    ['lightsnow', 'snow'],
    ['sleet', 'freezing'],
    ['rainandthunder', 'thunderstorm'],
    ['something_unknown', 'cloudy'],
  ])('symbol %s -> %s', (symbol, expected) => {
    expect(metSymbolToCondition(symbol)).toBe(expected);
  });
});

describe('selectPool', () => {
  it('dramatic weather beats temperature', () => {
    expect(selectPool(snap({ condition: 'thunderstorm', feelsLikeF: 105 }))).toBe(STORM);
    expect(selectPool(snap({ condition: 'freezing' }))).toBe(ICE);
    expect(selectPool(snap({ condition: 'snow' }))).toBe(SNOW);
    expect(selectPool(snap({ condition: 'rain' }))).toBe(RAIN);
    expect(selectPool(snap({ condition: 'drizzle' }))).toBe(DRIZZLE);
    expect(selectPool(snap({ condition: 'fog' }))).toBe(FOG);
  });

  it('picks temperature bands for plain conditions', () => {
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 105 }))).toBe(HELL);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 92 }))).toBe(HOT);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 15 }))).toBe(DEEP_FREEZE);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 30 }))).toBe(COLD);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 80 }))).toBe(WARM);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 65 }))).toBe(NICE);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 50 }))).toBe(COOL);
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 40 }))).toBe(MEH);
  });

  it('wind beats a mild day but not extreme temps', () => {
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 65, isWindy: true }))).toBe(WIND);
    // Extreme cold still wins over wind.
    expect(selectPool(snap({ condition: 'clear', feelsLikeF: 30, isWindy: true }))).toBe(COLD);
  });
});

describe('firstSuccess', () => {
  it('resolves with the first fulfilled promise', async () => {
    await expect(
      firstSuccess([Promise.reject(new Error('a')), Promise.resolve('b')])
    ).resolves.toBe('b');
  });

  it('resolves with the fastest winner even if another is slower', async () => {
    await expect(
      firstSuccess([delay(50, 'slow'), delay(5, 'fast')])
    ).resolves.toBe('fast');
  });

  it('rejects only when every promise rejects', async () => {
    await expect(
      firstSuccess([Promise.reject(new Error('x')), Promise.reject(new Error('y'))])
    ).rejects.toBeInstanceOf(Error);
  });
});
