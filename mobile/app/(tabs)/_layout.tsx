import { Tabs } from "expo-router";
import { colors } from "../../theme";
import { CustomTabBar } from "../../components/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBar: (props) => <CustomTabBar {...props} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Чаты", tabBarLabel: "Чаты" }} />
      <Tabs.Screen name="feed" options={{ title: "Лента", tabBarLabel: "Лента" }} />
      <Tabs.Screen name="board" options={{ title: "Борд", tabBarLabel: "Борд" }} />
      <Tabs.Screen name="settings" options={{ title: "Настройки", tabBarLabel: "Настройки" }} />
    </Tabs>
  );
}
