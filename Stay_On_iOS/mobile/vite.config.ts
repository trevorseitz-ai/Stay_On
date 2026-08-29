import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files at config time; "" prefix loads every key,
  // not just VITE_-prefixed ones, so the Sentry secrets are visible here.
  const env = loadEnv(mode, process.cwd(), "");
  const sentryEnabled = Boolean(env.SENTRY_AUTH_TOKEN);

  return {
    plugins: [
      react(),
      // Uploads source maps to Sentry so stack traces are de-minified.
      // No-ops on any build without SENTRY_AUTH_TOKEN (local dev, CI).
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        disable: !sentryEnabled,
        sourcemaps: {
          // Strip the .map files from dist after upload so they never
          // ship inside the iOS app bundle.
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
      }),
    ],
    base: "./",
    build: {
      // Only emit maps when we have a token to upload them with; the
      // plugin deletes them from dist afterwards so they never ship.
      sourcemap: sentryEnabled,
    },
  };
});
