import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trevorseitz.stayon",
  appName: "Stay On",
  webDir: "dist",
  ios: {
    contentInset: "never",
  },
};

export default config;
