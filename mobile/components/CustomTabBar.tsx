import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

/** Логотип и иконки из одной папки assets — так Metro гарантированно их подхватывает */
const LOGO_SOURCE = require("../assets/logo.png");
const FEED_ICON_SOURCE = require("../assets/feed-icon.png");

type TabBarProps = {
  state: { routes: { key: string; name: string; params?: object }[]; index: number };
  descriptors: Record<string, { options: { tabBarAccessibilityLabel?: string } }>;
  navigation: { emit: (e: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
};

/** Символы вместо иконок — всегда видны без шрифтов */
const TAB_CONFIG = [
  { name: "index", label: "Чаты", symbol: "💬" },
  { name: "feed", label: "Лента", customIcon: FEED_ICON_SOURCE },
  { name: "board", label: "Борд", symbol: "⊞" },
  { name: "settings", label: "Настройки", symbol: "⚙" },
] as const;

export function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  const routes = state.routes;
  const routeNames = routes.map((r) => r.name);
  const index0 = routeNames.indexOf("index");
  const index1 = routeNames.indexOf("feed");
  const index2 = routeNames.indexOf("board");
  const index3 = routeNames.indexOf("settings");

  const leftTabs = [
    index0 >= 0 ? { route: routes[index0], index: index0 } : null,
    index1 >= 0 ? { route: routes[index1], index: index1 } : null,
  ].filter(Boolean) as { route: (typeof routes)[0]; index: number }[];
  const rightTabs = [
    index2 >= 0 ? { route: routes[index2], index: index2 } : null,
    index3 >= 0 ? { route: routes[index3], index: index3 } : null,
  ].filter(Boolean) as { route: (typeof routes)[0]; index: number }[];

  const renderTab = (route: (typeof routes)[0], index: number) => {
    const config = TAB_CONFIG.find((c) => c.name === route.name);
    const isActive = state.index === index;
    const { options } = descriptors[route.key];
    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };
    if (!config) return null;
    const label = "label" in config ? config.label : route.name;
    const iconColor = isActive ? colors.primary : colors.mutedForeground;
    const hasCustomIcon = "customIcon" in config && config.customIcon;
    const symbol = "symbol" in config ? config.symbol : null;
    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isActive ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        onPress={onPress}
        style={styles.tab}
      >
        {hasCustomIcon ? (
          <Image
            source={(config as { customIcon: number }).customIcon}
            style={[styles.tabIconImage, !isActive && styles.tabIconImageInactive]}
            resizeMode="contain"
          />
        ) : symbol ? (
          <Text style={[styles.tabSymbol, { color: iconColor }]}>{symbol}</Text>
        ) : null}
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {leftTabs.map(({ route, index }) => renderTab(route, index))}
        </View>
        <View style={styles.logoWrap}>
          <Image
            source={LOGO_SOURCE}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="PING"
          />
        </View>
        <View style={styles.side}>
          {rightTabs.map(({ route, index }) => renderTab(route, index))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  side: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "stretch",
  },
  logoWrap: {
    width: 56,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 40,
    height: 36,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 2,
    minHeight: spacing.touchMin - 8,
  },
  tabIconImage: { width: 24, height: 24 },
  tabIconImageInactive: { opacity: 0.6 },
  tabSymbol: { fontSize: 22 },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.mutedForeground,
  },
  tabLabelActive: {
    color: colors.primary,
  },
});
