import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Stella's Sky",
  slug: "stellas-sky",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "myapp",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0B0D16",
  },
  ios: {
    supportsTablet: true,
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: ["expo-router", "expo-font", "expo-web-browser", "expo-notifications"],
  experiments: {
    typedRoutes: true,
  },
  android: {
    package: "com.bahaeddin.stellassky",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0B0D16",
    },
  },
  notification: {
    icon: "./assets/images/notification-icon.png",
    color: "#FFD93D",
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
