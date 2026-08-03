import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.ymd.kuroshiro",
  appName: "黒白侵攻",
  webDir: "www",
  // Bundled static build (hotseat / CPU offline). Online needs VITE_WS_URL at web build time.
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#f3e6d0",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#f3e6d0",
    },
    Keyboard: {
      resize: "body",
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f3e6d0",
  },
  ios: {
    backgroundColor: "#f3e6d0",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Kuroshiro",
  },
};

export default config;
