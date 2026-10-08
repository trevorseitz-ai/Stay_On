import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { Capacitor, registerPlugin } from "@capacitor/core";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import App from "./App";
import "./styles.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init(
    {
      dsn: sentryDsn,
      // Native iOS crashes are captured automatically by the Capacitor plugin.
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      environment: import.meta.env.PROD ? "production" : "development",
    },
    SentryReact.init,
  );
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
  // test installs. Native builds ask BuildChannelPlugin (ios/App/App/BuildChannel.swift);
  // events sent before it answers carry "native-pending".
  const BuildChannel = registerPlugin<{ get(): Promise<{ channel: string }> }>("BuildChannel");
  if (import.meta.env.DEV) {
    posthog.register({ build_channel: "dev" });
  } else if (!Capacitor.isNativePlatform()) {
    posthog.register({ build_channel: "web" });
  } else {
    posthog.register({ build_channel: "native-pending" });
    BuildChannel.get()
      .then(({ channel }) => posthog.register({ build_channel: channel }))
      .catch(() => posthog.register({ build_channel: "unknown" }));
  }
} else if (import.meta.env.DEV) {
  const missingVariable = posthogKey ? "VITE_POSTHOG_HOST" : "VITE_POSTHOG_KEY";
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
