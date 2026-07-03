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
import { NIGHT } from './quips/night';

type Pool = readonly string[];

function randomFrom(pool: Pool): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Lines that only make sense in daylight (activities, sunshine, etc.). When it's
// dark out we strip these so the app never tells you to hit the park at midnight.
const DAYTIME_RE =
  /\b(parks?|beach(?:es)?|pool|sunbath\w*|suntan\w*|tan|tanning|picnic\w*|bbq|barbecue|barbeque|cookout|tailgate|sunshine|sunny|sunburn\w*|sunscreen|daylight|noon|midday|patio|frisbee|hammock|lemonade|sunglasses|shades|beer garden|touch grass|outdoors|daytime|morning|afternoon|dawn|go outside)\b/i;

// How often an after-dark quip comes from the night pool vs. the weather pool.
const NIGHT_BLEND = 0.32;

// Chooses the base pool from weather then temperature. Dramatic weather beats
// temperature; extreme temperatures beat wind; wind beats a merely mild day.
function selectPool(w: WeatherSnapshot): Pool {
  switch (w.condition) {
    case 'thunderstorm':
      return STORM;
    case 'freezing':
      return ICE;
    case 'snow':
      return SNOW;
    case 'rain':
      return RAIN;
    case 'drizzle':
      return DRIZZLE;
    case 'fog':
      return FOG;
    default:
      break;
  }

  const f = w.feelsLikeF;
  if (f >= 100) return HELL;
  if (f >= 90) return HOT;
  if (f <= 20) return DEEP_FREEZE;
  if (f <= 34) return COLD;
  if (w.isWindy) return WIND;
  if (f >= 78) return WARM;
  if (f >= 60) return NICE;
  if (f >= 45) return COOL;
  return MEH;
}

// Picks a one-liner, factoring in whether it's light out. After dark we drop
// daytime-only lines and mix in night-specific jabs.
export function pickQuip(w: WeatherSnapshot): string {
  const pool = selectPool(w);
  if (w.isDay) return randomFrom(pool);

  if (Math.random() < NIGHT_BLEND) return randomFrom(NIGHT);
  const nightSafe = pool.filter((q) => !DAYTIME_RE.test(q));
  return randomFrom(nightSafe.length >= 10 ? nightSafe : pool);
}
