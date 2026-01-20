import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { ImageSwipeProvider } from "@/contexts/image-swipe-context";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <SubscriptionProvider>
          <ImageSwipeProvider>
            <Stack screenOptions={{ animation: 'none' }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="gallery" options={{ headerShown: false }} />
              <Stack.Screen name="account" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ImageSwipeProvider>
        </SubscriptionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
