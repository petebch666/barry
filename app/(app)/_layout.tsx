import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/lib/theme';

const TABS = [
  { name: '(feed)', icon: '◎', label: 'Feed' },
  { name: '(profile)', icon: '◌', label: 'Me' },
] as const;

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.tabBarOuter,
        { bottom: Math.max(insets.bottom, 8) + 16 },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.tabBarInner}>
        <BlurView tint="dark" intensity={65} style={styles.absoluteFillNoEvents} pointerEvents="none" />
        <View style={styles.tabBarOverlay} />
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const isFocused = state.index === routeIndex;
          const isProfileRelated =
            tab.name === '(profile)' && activeName === '(groups)';
          const isActive = isFocused || isProfileRelated;

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => {
                const route = state.routes[routeIndex];
                if (!isFocused && route) {
                  navigation.navigate(route.name);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <View style={[styles.dot, isActive && styles.dotActive]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="(feed)" />
      <Tabs.Screen name="(groups)" options={{ href: null }} />
      <Tabs.Screen name="(map)" options={{ href: null }} />
      <Tabs.Screen name="(profile)" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    left: 48,
    right: 48,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  tabBarInner: {
    flex: 1,
    flexDirection: 'row',
  },
  absoluteFillNoEvents: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  tabBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,14,28,0.55)',
    pointerEvents: 'none',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIcon: {
    fontSize: 26,
    color: colors.textTertiary,
  },
  tabIconActive: {
    color: colors.text,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
});
