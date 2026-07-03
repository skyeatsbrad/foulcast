import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import {
  useFonts,
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { Condition, WeatherSnapshot } from './src/weather';
import { pickQuip } from './src/quips';
import { useWeather } from './src/useWeather';
import { NICE_NOPES } from './src/nope';

const COLORS = {
  bg: '#000000',
  text: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.32)',
  chipBorder: 'rgba(255,255,255,0.16)',
  chipBg: 'rgba(255,255,255,0.06)',
};

const PRECIP_META: Record<Condition, { icon: string; word: string }> = {
  clear: { icon: '', word: '' },
  cloudy: { icon: '', word: '' },
  fog: { icon: '🌫', word: 'fog' },
  drizzle: { icon: '🌦', word: 'drizzle' },
  rain: { icon: '🌧', word: 'rain' },
  freezing: { icon: '🧊', word: 'ice' },
  snow: { icon: '🌨', word: 'snow' },
  thunderstorm: { icon: '⛈', word: 'storms' },
};

function precipLabel(w: WeatherSnapshot): string {
  const meta = PRECIP_META[w.condition];
  const word = meta.word || 'precip';
  const amount = w.precipInch >= 0.01 ? `${w.precipInch.toFixed(2)}" ` : '';
  return `${meta.icon} ${amount}${word}`.trim();
}

function windLabel(w: WeatherSnapshot): string {
  const wind = Math.round(w.windMph);
  const gust = Math.round(w.windGustMph);
  if (gust >= wind + 8) {
    return `💨 ${wind} mph · gusts ${gust}`;
  }
  return `💨 ${wind} mph wind`;
}

// The 69° easter egg. First it's just "Nice." Each extra pull-to-refresh escalates
// the app's flat refusal to say anything else — the giant NICE_NOPES list (many
// languages) lives in ./src/nope so we never run out of ways to say no.
const NICE_SPICY = [
  "It's nice as balls. Now piss off.",
  "It's fucking nice. Quit poking me.",
  'Nice. N-I-C-E. Learn to read.',
];

function niceQuip(streak: number): string {
  switch (streak) {
    case 1:
      return 'Nice.';
    case 2:
      return 'I SAID NICE';
    case 3:
      return NICE_SPICY[Math.floor(Math.random() * NICE_SPICY.length)];
    case 4:
      return 'nah fam';
    default:
      return `Nice (${NICE_NOPES[Math.floor(Math.random() * NICE_NOPES.length)]})`;
  }
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  ghost,
}: {
  label: string;
  onPress: () => void;
  ghost?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        ghost && styles.buttonGhost,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, ghost && styles.buttonTextGhost]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_200ExtraLight,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { status, data, errorMessage, refreshing, refresh } = useWeather();

  // A fresh quip per fetch; tapping the quip rerolls without refetching.
  const [quipSeed, setQuipSeed] = useState(0);
  const [quip, setQuip] = useState('');
  // 69° is Nice. Keep pulling for another and it escalates: I SAID NICE ->
  // spicy -> nah fam -> Nice (no/nope/no way jose...). Resets when temp leaves 69.
  const niceStreak = useRef(0);
  useEffect(() => {
    if (!data) {
      setQuip('');
      return;
    }
    if (Math.round(data.tempF) === 69) {
      niceStreak.current += 1;
      setQuip(niceQuip(niceStreak.current));
    } else {
      niceStreak.current = 0;
      setQuip(pickQuip(data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.fetchedAt, quipSeed]);

  const shotRef = useRef<View>(null);
  const handleShare = async () => {
    try {
      const uri = await captureRef(shotRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your Foulcast',
        });
      }
    } catch {
      // Sharing is best-effort; ignore cancellations and failures.
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  let content: ReactNode;

  if (status === 'denied') {
    content = (
      <View style={styles.center}>
        <Text style={styles.stateBig}>I can&apos;t see where you are.</Text>
        <Text style={styles.stateDim}>
          Foulcast needs your location to tell you how much the weather sucks.
          Flip it on and try again.
        </Text>
        <Button label="Open Settings" onPress={() => Linking.openSettings()} />
        <Button label="Try Again" onPress={refresh} ghost />
      </View>
    );
  } else if (status === 'error') {
    content = (
      <View style={styles.center}>
        <Text style={styles.stateBig}>Well, shit.</Text>
        <Text style={styles.stateDim}>{errorMessage}</Text>
        <Button label="Try Again" onPress={refresh} />
      </View>
    );
  } else if (status === 'loading' && !data) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.text} />
        <Text style={[styles.stateDim, styles.loadingText]}>
          Sniffing the air…
        </Text>
      </View>
    );
  } else if (data) {
    content = (
      <View style={styles.center}>
        <View ref={shotRef} collapsable={false} style={styles.card}>
          {data.city ? (
            <Text style={styles.city}>{data.city.toUpperCase()}</Text>
          ) : null}

          <Text style={styles.temp}>{Math.round(data.tempF)}°</Text>
          <Text style={styles.feels}>
            feels like {Math.round(data.feelsLikeF)}°
          </Text>

          <View style={styles.rule} />

          <Pressable onPress={() => setQuipSeed((s) => s + 1)} hitSlop={16}>
            <Text style={styles.quip}>{quip}</Text>
          </Pressable>

          {(data.isPrecipitating || data.isWindy) && (
            <View style={styles.chips}>
              {data.isPrecipitating ? <Chip label={precipLabel(data)} /> : null}
              {data.isWindy ? <Chip label={windLabel(data)} /> : null}
            </View>
          )}

          <Text style={styles.wordmark}>FOULCAST</Text>
        </View>

        <Text style={styles.hint}>tap for another take · pull to refresh</Text>

        <Pressable
          onPress={handleShare}
          hitSlop={14}
          style={({ pressed }) => [
            styles.shareBtn,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.shareBtnText}>share</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.text}
            colors={[COLORS.text]}
          />
        }
      >
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 72,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  city: {
    fontFamily: 'Inter_500Medium',
    color: COLORS.dim,
    fontSize: 14,
    letterSpacing: 3,
    marginBottom: 18,
  },
  temp: {
    fontFamily: 'Inter_200ExtraLight',
    color: COLORS.text,
    fontSize: 128,
    lineHeight: 138,
    includeFontPadding: false,
  },
  feels: {
    fontFamily: 'Inter_400Regular',
    color: COLORS.dim,
    fontSize: 17,
    marginTop: 2,
  },
  rule: {
    width: 44,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.chipBorder,
    marginVertical: 30,
  },
  quip: {
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
    fontSize: 27,
    lineHeight: 36,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 28,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.chipBg,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    color: COLORS.text,
    fontSize: 14,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    color: COLORS.faint,
    fontSize: 12,
    marginTop: 34,
    letterSpacing: 0.5,
  },
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  wordmark: {
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.faint,
    fontSize: 13,
    letterSpacing: 4,
    marginTop: 30,
  },
  shareBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  shareBtnText: {
    fontFamily: 'Inter_500Medium',
    color: COLORS.faint,
    fontSize: 12,
    letterSpacing: 2,
  },
  stateBig: {
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
    fontSize: 30,
    textAlign: 'center',
    marginBottom: 14,
  },
  stateDim: {
    fontFamily: 'Inter_400Regular',
    color: COLORS.dim,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 16,
    marginBottom: 0,
  },
  button: {
    backgroundColor: COLORS.text,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 6,
    marginBottom: 6,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.bg,
    fontSize: 16,
    textAlign: 'center',
  },
  buttonTextGhost: {
    color: COLORS.text,
  },
});
