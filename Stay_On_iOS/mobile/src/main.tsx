import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { Capacitor, registerPlugin } from "@capacitor/core";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import App from "./App";
import "./styles.css";

// Where this build came from (ios/App/App/BuildChannel.swift). get() returns
// "appstore", "testflight", "xcode" or "simulator" from the signed AppTransaction,
// which can be slow, so it is asked once and shared. buildInfo() answers at once
// from compile-time flags.
const BuildChannel = registerPlugin<{
  get(): Promise<{ channel: string }>;
  buildInfo(): Promise<{ simulator: boolean; debug: boolean }>;
}>("BuildChannel");
const isNative = Capacitor.isNativePlatform();
const nativeChannel = isNative
  ? BuildChannel.get()
      .then(({ channel }) => channel)
      .catch(() => "unknown")
  : null;

// Sentry fixes the environment at init, and native reports (app hangs, crashes)
// use it too, so simulator and Debug builds have to be known before init. The web
// bundle is always a production Vite build, so import.meta.env.PROD alone tagged
// simulator runs as "production" (see HANDOVER.md, 2026-11-09).
async function sentryEnvironment(): Promise<string> {
  if (import.meta.env.DEV) return "development";
  if (!isNative) return "production";
  try {
    const { simulator, debug } = await BuildChannel.buildInfo();
    if (simulator) return "simulator";
    if (debug) return "development";
  } catch {
    // A native shell without buildInfo(): fall through to "production".
  }
  return "production";
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  void sentryEnvironment().then((environment) => {
    Sentry.init(
      {
        dsn: sentryDsn,
        // Native iOS crashes are captured automatically by the Capacitor plugin.
        tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
        environment,
      },
      SentryReact.init,
    );
    // Separates TestFlight and Xcode installs from App Store players. Tags set
    // here are synced to the native SDK, so native reports carry it too.
    void nativeChannel?.then((channel) => Sentry.setTag("build_channel", channel));
  });
}

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;

if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    defaults: "2026-05-30",
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  });

  // Tag every event with where this build came from, so launch metrics can exclude
  // test installs. Events sent before the native answer carry "native-pending".
  if (import.meta.env.DEV) {
    posthog.register({ build_channel: "dev" });
  } else if (!nativeChannel) {
    posthog.register({ build_channel: "web" });
  } else {
    posthog.register({ build_channel: "native-pending" });
    void nativeChannel.then((channel) => posthog.register({ build_channel: channel }));
  }
} else if (import.meta.env.DEV) {
  const missingVariable = posthogKey ? "VITE_POSTHOG_HOST" : "VITE_POSTHOG_KEY";
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
