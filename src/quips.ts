import { WeatherSnapshot } from './weather';
import { HELL } from './quips/hell';
import { HOT } from './quips/hot';
import { WARM } from './quips/warm';
import { NICE } from './quips/nice';
import { COOL } from './quips/cool';
import { MEH } from './quips/meh';
import { COLD } from './quips/cold';
import { DEEP_FREEZE } from './quips/deepFreeze';
import { STORM } from './quips/storm';
import { RAIN } from './quips/rain';
import { DRIZZLE } from './quips/drizzle';
import { ICE } from './quips/ice';
import { SNOW } from './quips/snow';
import { FOG } from './quips/fog';
import { WIND } from './quips/wind';

type Pool = readonly string[];

function randomFrom(pool: Pool): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Picks a one-liner. Dramatic weather beats temperature; extreme temperatures
// beat wind; wind beats a merely mild day.
export function pickQuip(w: WeatherSnapshot): string {
  switch (w.condition) {
    case 'thunderstorm':
      return randomFrom(STORM);
    case 'freezing':
      return randomFrom(ICE);
    case 'snow':
      return randomFrom(SNOW);
    case 'rain':
      return randomFrom(RAIN);
    case 'drizzle':
      return randomFrom(DRIZZLE);
    case 'fog':
      return randomFrom(FOG);
    default:
      break;
  }

  const f = w.feelsLikeF;
  if (f >= 100) return randomFrom(HELL);
  if (f >= 90) return randomFrom(HOT);
  if (f <= 20) return randomFrom(DEEP_FREEZE);
  if (f <= 34) return randomFrom(COLD);
  if (w.isWindy) return randomFrom(WIND);
  if (f >= 78) return randomFrom(WARM);
  if (f >= 60) return randomFrom(NICE);
  if (f >= 45) return randomFrom(COOL);
  return randomFrom(MEH);
}
