import { WeatherSnapshot } from './weather';

type Pool = readonly string[];

// Extreme heat — feels-like >= 100F
const HELL: Pool = [
  "It's hot as balls out there.",
  "It's fucking hot. Stay inside, you beautiful idiot.",
  'Satan called — he wants his thermostat back.',
  'This is the kind of heat that makes your car seat a war crime.',
  'Congratulations, you live on the sun now.',
  "The devil's armpit. That's the current temperature.",
  "Even the mosquitoes said 'nah' today.",
  'Hot enough to fry an egg on your forehead. Please don\'t.',
];

// Hot — 90–99F
const HOT: Pool = [
  "It's balls-hot. Not quite hell, but you'll sweat through your shirt.",
  'Swampass weather. Choose your seat wisely.',
  "It's the kind of hot where flip-flops become a bad decision.",
  'Drink some water, you sweaty bastard.',
  "Hot as hell's waiting room out there.",
  'Deodorant is not optional today.',
  'Your thighs are going to have a serious conversation with each other.',
];

// Warm and genuinely pleasant — 78–89F
const WARM: Pool = [
  'Genuinely nice out. Go touch some grass.',
  'Warm and lovely. Try not to squander it indoors, you gremlin.',
  "Perfect 'day-drink on a patio' weather.",
  "It's nice enough that even you should go outside.",
  "T-shirt weather. Don't screw it up.",
  'The sun is showing off. Let it.',
];

// Mild / comfortable — 60–77F
const NICE: Pool = [
  "Chef's kiss weather. Don't waste it doom-scrolling.",
  "This is the good shit. Get out there.",
  'Mild as hell. No excuses today.',
  "Weather so nice it's almost suspicious.",
  'Light jacket, big attitude. You got this.',
  'Absolutely nothing to complain about, which is weird for you.',
];

// Cool — 45–59F
const COOL: Pool = [
  'A little nippy. Grab a hoodie, princess.',
  'Sweater weather, you cozy little goblin.',
  'Cool enough to justify a second coffee. And a third.',
  "Crisp. Like a good apple, or your ex's heart.",
  'Perfect weather for pretending you enjoy jogging.',
];

// In-between chilly — 35–44F
const MEH: Pool = [
  'Cold-ish and blah. The weather equivalent of a shrug.',
  "Not freezing, but your nipples know something's up.",
  'Bundle up a bit, you fragile little bean.',
  "That annoying 'is it a coat day?' temperature. It is.",
  'Grey, cold, forgettable. Like a Monday with a body.',
];

// Cold — feels-like <= 34F
const COLD: Pool = [
  "It's tits-cold out. Layer the hell up.",
  'Cold enough to freeze your balls off. Plan accordingly.',
  'Your nostrils are gonna stick together. Enjoy!',
  "This is 'nipples could cut glass' weather.",
  "Fuck, it's cold. Find a fireplace and a bottle of something.",
  'Put on real pants. I mean it.',
];

// Deep freeze — feels-like <= 20F
const DEEP_FREEZE: Pool = [
  "It's colder than your ex's heart out there.",
  'Antarctica called — it\'s honestly impressed.',
  'This is the kind of cold that files a restraining order against your skin.',
  'Frostbite is out here recruiting. Cover up.',
  'Winterfell weather. Stay the fuck inside.',
  'Your snot will freeze mid-sneeze. Science!',
];

// Thunderstorm
const STORM: Pool = [
  "Thor's throwing a tantrum. Stay indoors.",
  'Big dramatic sky-rage happening. Unplug your shit.',
  "Thunderstorm rolling in like it owes God money.",
  "Zeus is pissed. Don't be the tallest thing in a field, dumbass.",
  "Lightning's auditioning out there. Enjoy the show from indoors.",
];

// Rain / showers — includes the mandatory Forrest Gump quotes
const RAIN: Pool = [
  "One day it started raining, and it didn't quit for four months. — Forrest was onto something.",
  "We been through every kind of rain there is. Little bitty stingin' rain, and big ol' fat rain.",
  "It's pissing down. Bring the damn umbrella.",
  'Rain with a bad attitude. Waterproof your soul.',
  'Wet-ass weather out there.',
  'Perfect day to stay in bed and ignore your responsibilities.',
  "It's raining sideways, which is just nature flipping you off.",
];

// Drizzle / light rain
const DRIZZLE: Pool = [
  'Just enough drizzle to be annoying, not enough to matter.',
  "God's spitting on you. Lightly.",
  "That wimpy 'is it even raining?' rain. Yes. Yes it is.",
  "Mist you not — it's damp as hell out.",
];

// Freezing rain / ice
const ICE: Pool = [
  'Freezing rain. The sidewalks want you dead.',
  'Ice storm vibes. Walk like a penguin or eat shit — your call.',
  "Everything's an ice rink now. Try not to break your ass.",
];

// Snow
const SNOW: Pool = [
  "It's snowing. Build a fort, throw a snowball, act like a child.",
  "Snow-day energy. Call in 'sick,' you legend.",
  "Winter's dandruff is falling. Bundle up.",
  "Snow's coming down. Drive like everyone else is an idiot — they are.",
  'Pretty as hell until you have to shovel it.',
];

// Fog
const FOG: Pool = [
  'Foggy as hell. Visibility: my future.',
  'Spooky-ass fog out there. Watch for horror-movie villains.',
  "Can't see shit. Drive slow, genius.",
  "It's giving 'Silent Hill.' Be careful.",
];

// Significantly windy (with no precipitation and non-extreme temps)
const WIND: Pool = [
  "It's blowing like a bastard out there. Hold onto your hat.",
  'Windy as hell. Your hair is a lost cause today.',
  'Wind strong enough to steal your soul and your napkins.',
  'Gusty as fuck. Trash cans are becoming projectiles.',
  'The wind is personally attacking you today. Lean into it.',
];

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
