"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
} from "@capacitor-community/admob";
import { Purchases, PURCHASES_ERROR_CODE } from "@revenuecat/purchases-capacitor";
import posthog from "posthog-js";

type GameState = "ready" | "countdown" | "playing" | "crashed";

const REVENUECAT_IOS_API_KEY = "appl_dZSneUxWQOUORrPlotrOQWefBCF";
const AD_FREE_ENTITLEMENT_ID = "ad_free"; // must match RevenueCat dashboard entitlement id
const INTERSTITIAL_AD_ID = "ca-app-pub-4738248194115302/3809716597";
const INTERSTITIAL_RUN_INTERVAL = 2;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState("fun");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [lastDistance, setLastDistance] = useState(0);
  const [steeringPressed, setSteeringPressed] = useState(false);
  const [muted, setMuted] = useState(
    () => localStorage.getItem("stay-on-muted") === "1"
  );
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [adFree, setAdFree] = useState(
    () => localStorage.getItem("stay-on-ad-free") === "1"
  );
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [adFreePrice, setAdFreePrice] = useState<string | null>(null);
  const adFreeRef = useRef(adFree);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    adFreeRef.current = adFree;
  }, [adFree]);

  const markAdFree = (owns: boolean) => {
    setAdFree(owns);
    adFreeRef.current = owns;
    localStorage.setItem("stay-on-ad-free", owns ? "1" : "0");
    if (owns && Capacitor.isNativePlatform()) {
      AdMob.removeBanner().catch(() => {});
    }
  };

  const removeAds = async () => {
    setPurchaseError(null);
    setPurchasing(true);
    posthog.capture("ad_free_purchase_started");
    try {
      const { current } = await Purchases.getOfferings();
      const pkg = current?.lifetime;
      if (!pkg) {
        setPurchaseError("Unavailable right now.");
        posthog.capture("ad_free_purchase_failed", { failure_stage: "offering_unavailable" });
        return;
      }
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      const owns = Boolean(customerInfo.entitlements.active[AD_FREE_ENTITLEMENT_ID]);
      markAdFree(owns);
      posthog.capture("ad_free_purchase_completed", { entitlement_active: owns });
    } catch (err) {
      const code = (err as { code?: PURCHASES_ERROR_CODE })?.code;
      if (code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        setPurchaseError("Purchase failed. Try again.");
        posthog.capture("ad_free_purchase_failed", { failure_stage: "purchase" });
      }
    } finally {
      setPurchasing(false);
    }
  };

  const restorePurchases = async () => {
    setPurchaseError(null);
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const owns = Boolean(customerInfo.entitlements.active[AD_FREE_ENTITLEMENT_ID]);
      markAdFree(owns);
      posthog.capture("purchases_restored", { entitlement_active: owns });
      if (!owns) setPurchaseError("Nothing to restore.");
    } catch {
      setPurchaseError("Restore failed. Try again.");
      posthog.capture("purchases_restored", { entitlement_active: false, restore_succeeded: false });
    }
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("stay-on-muted", next ? "1" : "0");
    const music = musicRef.current;
    if (music) {
      music.muted = next;
      if (!next) music.play().catch(() => {});
    }
    posthog.capture("audio_setting_changed", { muted: next });
  };

  const sendFeedback = (event: FormEvent) => {
    event.preventDefault();
    posthog.capture("feedback_submitted", { reason: feedbackReason });
    setFeedbackSent(true);
    setFeedbackOpen(false);
  };

  useEffect(() => {
    let bannerAdShown = false;

    const showBannerAd = async () => {
      if (bannerAdShown || adFreeRef.current || !Capacitor.isNativePlatform()) return;
      bannerAdShown = true;
      try {
        await AdMob.initialize();
        const consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdmobConsentStatus.REQUIRED
        ) {
          await AdMob.showConsentForm();
        }
        await AdMob.showBanner({
          adId: "ca-app-pub-4738248194115302/4821502245",
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.TOP_CENTER,
          margin: 0,
        });
      } catch (err) {
        console.error("AdMob initialization failed:", err);
        bannerAdShown = false;
      }
    };

    let interstitialRuns = Number(localStorage.getItem("stay-on-interstitial-runs") || 0);
    let interstitialReady = false;
    let interstitialListenerHandles: { remove: () => Promise<void> }[] = [];

    const prepareInterstitial = async () => {
      if (adFreeRef.current || !Capacitor.isNativePlatform()) return;
      try {
        await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
      } catch (err) {
        console.error("Interstitial prepare failed:", err);
      }
    };

    if (Capacitor.isNativePlatform()) {
      Promise.all([
        AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
          interstitialReady = true;
        }),
        AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
          interstitialReady = false;
        }),
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          interstitialReady = false;
          prepareInterstitial();
        }),
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
          interstitialReady = false;
          prepareInterstitial();
        }),
      ]).then((handles) => {
        interstitialListenerHandles = handles;
      });

      const initPurchases = async () => {
        try {
          await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
          const { customerInfo } = await Purchases.getCustomerInfo();
          const owns = Boolean(customerInfo.entitlements.active[AD_FREE_ENTITLEMENT_ID]);
          setAdFree(owns);
          adFreeRef.current = owns;
          localStorage.setItem("stay-on-ad-free", owns ? "1" : "0");
          if (owns) return;
          try {
            const { current } = await Purchases.getOfferings();
            const price = current?.lifetime?.product.priceString;
            if (price) setAdFreePrice(price);
          } catch {
            // Non-fatal: button falls back to "REMOVE ADS" with no price.
          }
          await showBannerAd();
          await prepareInterstitial();
        } catch (err) {
          console.error("Purchases initialization failed:", err);
        }
      };
      initPurchases();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let audioCtx: AudioContext | null = null;
    const playCrashSound = () => {
      if (mutedRef.current) return;
      try {
        audioCtx ??= new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const ctx2 = audioCtx;
        const now = ctx2.currentTime;

        const noiseBuffer = ctx2.createBuffer(1, ctx2.sampleRate * 0.3, ctx2.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx2.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = ctx2.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        noise.connect(noiseGain).connect(ctx2.destination);
        noise.start(now);

        const thud = ctx2.createOscillator();
        thud.type = "sine";
        thud.frequency.setValueAtTime(140, now);
        thud.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        const thudGain = ctx2.createGain();
        thudGain.gain.setValueAtTime(0.6, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        thud.connect(thudGain).connect(ctx2.destination);
        thud.start(now);
        thud.stop(now + 0.25);
      } catch {
        // Web Audio unavailable — fail silently, crash sound is non-critical.
      }
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let state: GameState = "ready";
    let pressed = false;
    let distance = 0;
    let playerX = 0;
    let steerVelocity = 0;
    let speed = 205;
    let countdownLeft = 1.2;
    let countdownEndsAt = 0;
    let goFlash = 0;
    let difficultyLevel = 0;
    let levelFlash = 0;
    let levelMessage = "";
    let lastTime = performance.now();
    let shake = 0;
    let best = Number(localStorage.getItem("stay-on-best") || 0);
    let runNumber = Number(localStorage.getItem("stay-on-runs") || 0);
    let crashIsNewBest = false;
    let frameNow = performance.now();

    const baseRoadWidth = () => Math.max(155, Math.min(235, width * 0.56));
    const speedSteps = () =>
      difficultyLevel === 1 ? 1 : difficultyLevel >= 3 ? difficultyLevel - 2 : 0;
    const narrowSteps = () =>
      difficultyLevel === 2 ? 1 : difficultyLevel >= 3 ? difficultyLevel - 2 : 0;
    const roadWidth = () => Math.max(118, baseRoadWidth() - narrowSteps() * 14);
    const carY = () => height * 0.57;
    const steerStrength = () => (distance < 200 ? 110 : 145);

    const hash = (n: number) => {
      const x = Math.sin(n * 91.127 + 42.51) * 43758.5453;
      return (x - Math.floor(x)) * 2 - 1;
    };

    const roadCenter = (worldY: number) => {
      const spacing = 270;
      const knot = Math.floor(worldY / spacing);
      const t = (worldY - knot * spacing) / spacing;
      const smooth = t * t * (3 - 2 * t);
      const margin = baseRoadWidth() * 0.62;
      const amplitude = Math.max(28, width / 2 - margin);
      const a = hash(knot) * amplitude;
      const b = hash(knot + 1) * amplitude;
      return width / 2 + a + (b - a) * smooth;
    };

    let safeTop = 50;

    const updateSafeTop = () => {
      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.top = "env(safe-area-inset-top, 0px)";
      document.body.appendChild(el);
      const measured = parseFloat(window.getComputedStyle(el).top) || 0;
      document.body.removeChild(el);
      const isMobile =
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        "ontouchstart" in window;
      safeTop = measured > 0 ? measured : isMobile ? 50 : 0;
    };

    const resize = () => {
      updateSafeTop();
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state === "ready") playerX = roadCenter(0);
    };

    const begin = () => {
      setShowFeedback(false);
      setFeedbackOpen(false);
      setFeedbackSent(false);
      runNumber += 1;
      localStorage.setItem("stay-on-runs", String(runNumber));
      posthog.capture("run_started");
      state = "countdown";
      countdownLeft = 1.2;
      countdownEndsAt = performance.now() + 1200;
      goFlash = 0;
      difficultyLevel = 0;
      levelFlash = 0;
      levelMessage = "";
      distance = 0;
      speed = 205;
      steerVelocity = 0;
      playerX = roadCenter(0);
      shake = 0;
      crashIsNewBest = false;
    };

    const startSteering = (pointerId?: number) => {
      if (pointerId !== undefined) canvas.setPointerCapture?.(pointerId);
      setSteeringPressed(true);
      const music = musicRef.current;
      if (music && music.paused) music.play().catch(() => {});
      if (state === "ready" || state === "crashed") begin();
      pressed = true;
      if (state === "playing" && steerVelocity >= 0) {
        steerVelocity = -steerStrength() * 0.72;
      }
    };

    const stopSteering = () => {
      pressed = false;
      setSteeringPressed(false);
      if (state === "playing" && steerVelocity <= 0) {
        steerVelocity = steerStrength() * 0.72;
      }
    };

    const actionDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      event.preventDefault();
      startSteering(event.pointerId);
    };
    const actionUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      event.preventDefault();
      stopSteering();
    };

    // iOS can show its loupe even when CSS disables selection. An active,
    // non-passive touchstart handler must cancel that native long-press UI.
    const touchDown = (event: TouchEvent) => {
      event.preventDefault();
      startSteering();
    };
    const touchUp = (event: TouchEvent) => {
      event.preventDefault();
      stopSteering();
    };

    // Prevent iOS from opening its long-press selection/magnifier UI while
    // the player holds the steering control.
    const preventNativeGesture = (event: Event) => event.preventDefault();

    const drawRoad = () => {
      const step = 8;
      ctx.beginPath();
      for (let y = -step; y <= height + step; y += step) {
        const world = distance + (carY() - y);
        const x = roadCenter(world) - roadWidth() / 2;
        if (y === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let y = height + step; y >= -step; y -= step) {
        const world = distance + (carY() - y);
        ctx.lineTo(roadCenter(world) + roadWidth() / 2, y);
      }
      ctx.closePath();
      const roadGradient = ctx.createLinearGradient(0, 0, 0, height);
      roadGradient.addColorStop(0, "#151a1f");
      roadGradient.addColorStop(1, "#232a2f");
      ctx.fillStyle = roadGradient;
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = "#d7ff3f";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#baff29";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let y = -step; y <= height + step; y += step) {
          const world = distance + (carY() - y);
          const x = roadCenter(world) + side * roadWidth() / 2;
          if (y === -step) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.setLineDash([22, 26]);
      ctx.lineDashOffset = -distance % 48;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.beginPath();
      for (let y = -step; y <= height + step; y += step) {
        const world = distance + (carY() - y);
        const x = roadCenter(world);
        if (y === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawCar = () => {
      const x = playerX;
      const y = carY();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.max(-0.13, Math.min(0.13, steerVelocity / 750)));
      ctx.shadowBlur = state === "crashed" ? 22 : 12;
      ctx.shadowColor = state === "crashed" ? "#ffb000" : "#ff3b30";
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.roundRect(-17, -30, 34, 60, 9);
      ctx.fill();
      ctx.fillStyle = "#111a24";
      ctx.fillRect(-12, -15, 24, 17);
      ctx.fillStyle = "#ffe66d";
      ctx.fillRect(-13, -27, 7, 4);
      ctx.fillRect(6, -27, 7, 4);
      ctx.restore();
    };

    const roadsideAds = [
      { top: "STAY ON", bottom: "ROADSIDE", color: "#ff5050" },
      { top: "DRIVE", bottom: "COFFEE", color: "#ffb74d" },
      { top: "OCTANE", bottom: "ENERGY", color: "#d7ff3f" },
      { top: "NEON", bottom: "MOTEL", color: "#ff47bb" },
      { top: "TURBO", bottom: "TIRES", color: "#4bd7ff" },
      { top: "MILE 8", bottom: "DINER", color: "#ffd447" },
      { top: "PIXEL", bottom: "FUEL", color: "#d47cff" },
    ];

    const drawRoadsideAds = () => {
      const spacing = 360;
      const visibleMin = distance - (height - carY()) - spacing;
      const visibleMax = distance + carY() + spacing;
      const first = Math.floor(visibleMin / spacing);
      const last = Math.ceil(visibleMax / spacing);

      for (let index = first; index <= last; index += 1) {
        const world = index * spacing + 170;
        const y = carY() - (world - distance);
        if (y < safeTop + 112 || y > height + 50) continue;
        const ad = roadsideAds[Math.abs(index) % roadsideAds.length];
        const scale = Math.max(0.58, Math.min(1.08, 0.54 + y / height * 0.58));
        const boardW = 88 * scale;
        const boardH = 40 * scale;
        const side = index % 2 === 0 ? -1 : 1;
        const rawX = roadCenter(world) + side * (roadWidth() / 2 + 13 + boardW / 2);
        const x = Math.max(boardW / 2 + 5, Math.min(width - boardW / 2 - 5, rawX));

        ctx.save();
        ctx.strokeStyle = "rgba(225,235,236,.56)";
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath();
        ctx.moveTo(x, y + boardH / 2);
        ctx.lineTo(x, y + boardH / 2 + 22 * scale);
        ctx.stroke();
        ctx.fillStyle = "#070b0e";
        ctx.strokeStyle = ad.color;
        ctx.shadowBlur = 9 * scale;
        ctx.shadowColor = ad.color;
        ctx.fillRect(x - boardW / 2, y - boardH / 2, boardW, boardH);
        ctx.strokeRect(x - boardW / 2, y - boardH / 2, boardW, boardH);
        ctx.shadowBlur = 0;
        ctx.fillStyle = ad.color;
        ctx.textAlign = "center";
        ctx.font = `900 ${Math.max(8, 11 * scale)}px Arial, sans-serif`;
        ctx.fillText(ad.top, x, y - 2 * scale);
        ctx.fillStyle = "rgba(245,250,250,.88)";
        ctx.font = `700 ${Math.max(6, 8 * scale)}px ui-monospace, monospace`;
        ctx.fillText(ad.bottom, x, y + 11 * scale);
        ctx.restore();
      }
    };

    const drawSteeringControl = () => {
      const x = width / 2;
      const y = height * 0.84;
      const radius = Math.min(43, width * 0.105);
      ctx.save();
      ctx.globalAlpha = state === "playing" ? 0.56 : 0.9;
      ctx.strokeStyle = pressed ? "#d7ff3f" : "rgba(235,245,246,.72)";
      ctx.fillStyle = "rgba(4,8,10,.62)";
      ctx.lineWidth = 5;
      ctx.shadowBlur = pressed ? 18 : 8;
      ctx.shadowColor = pressed ? "#d7ff3f" : "rgba(220,240,240,.35)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.22, 0, Math.PI * 2);
      ctx.moveTo(x, y - radius * 0.22);
      ctx.lineTo(x, y - radius * 0.94);
      ctx.moveTo(x - radius * 0.19, y + radius * 0.12);
      ctx.lineTo(x - radius * 0.78, y + radius * 0.56);
      ctx.moveTo(x + radius * 0.19, y + radius * 0.12);
      ctx.lineTo(x + radius * 0.78, y + radius * 0.56);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(240,248,249,.78)";
      ctx.textAlign = "center";
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.fillText("PLACE THUMB HERE", x, y + radius + 21);
      ctx.restore();
    };

    const drawBannerAd = () => {
      if (Capacitor.isNativePlatform()) return;
      const boardW = width - 8;
      const x = width / 2 - boardW / 2;
      const top = safeTop + 4;
      ctx.fillStyle = "rgba(5,8,10,.97)";
      ctx.strokeStyle = "rgba(235,245,246,.42)";
      ctx.lineWidth = 2;
      ctx.fillRect(x, top, boardW, 44);
      ctx.strokeRect(x, top, boardW, 44);
      ctx.fillStyle = "rgba(235,245,246,.38)";
      ctx.textAlign = "left";
      ctx.font = "600 7px ui-monospace, monospace";
      ctx.fillText("ADVERTISEMENT", x + 6, top + 9);
      ctx.fillStyle = "rgba(235,245,246,.72)";
      ctx.textAlign = "center";
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillText("YOUR AD HERE", width / 2, top + 28);
    };

    const drawHud = () => {
      const top = safeTop + 52;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(233,244,246,.58)";
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillText("DISTANCE", 18, top + 10);
      ctx.fillStyle = "#f2fbfc";
      ctx.font = "700 24px ui-monospace, monospace";
      ctx.fillText(`${Math.floor(distance / 10).toString().padStart(4, "0")} m`, 18, top + 33);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(233,244,246,.58)";
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillText("BEST", width - 18, top + 10);
      ctx.fillStyle = "#f2fbfc";
      ctx.font = "700 18px ui-monospace, monospace";
      ctx.fillText(`${Math.floor(best / 10)} m`, width - 18, top + 32);
      ctx.textAlign = "center";
      const isCrashed = state === "crashed";
      if (isCrashed) {
        ctx.fillStyle = "#d7ff3f";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#baff29";
        ctx.font = "900 15px ui-monospace, monospace";
        ctx.fillText(`LEVEL ${difficultyLevel + 1}`, width / 2, top + 26);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(215,255,63,.72)";
        ctx.font = "700 10px ui-monospace, monospace";
        ctx.fillText(`LEVEL ${difficultyLevel + 1}`, width / 2, top + 23);
      }
    };

    const drawCountdown = () => {
      const number = Math.max(1, Math.ceil(countdownLeft));
      const centerY = safeTop + (height - safeTop) * 0.37;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#d7ff3f";
      ctx.shadowBlur = 28;
      ctx.shadowColor = "#baff29";
      ctx.font = `900 ${Math.min(112, width * 0.28)}px Arial, sans-serif`;
      ctx.fillText(String(number), width / 2, centerY);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(244,251,252,.72)";
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillText("GET YOUR THUMB READY", width / 2, centerY + 34);
      ctx.restore();
    };

    const overlay = (title: string, subtitle: string) => {
      ctx.fillStyle = "rgba(3,6,8,.70)";
      ctx.fillRect(0, 0, width, height);
      ctx.textAlign = "center";
      const centerY = safeTop + (height - safeTop) * 0.4;
      ctx.fillStyle = "#f4fbfc";
      ctx.font = `900 ${Math.min(54, width * 0.14)}px Arial, sans-serif`;
      ctx.fillText(title, width / 2, centerY);

      if (state === "crashed") {
        const metres = Math.floor(distance / 10);
        const flashOn = crashIsNewBest && Math.floor(frameNow / 650) % 2 === 0;
        const bannerY = centerY + 46;

        if (flashOn) {
          const bannerText = "NEW HIGH SCORE";
          ctx.font = `900 ${Math.min(30, width * 0.078)}px Arial, sans-serif`;
          const textWidth = ctx.measureText(bannerText).width;
          const bannerW = textWidth + 36;
          const bannerH = 44;
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#ff9f1c";
          ctx.fillStyle = "#ffdb45";
          ctx.fillRect(width / 2 - bannerW / 2, bannerY - bannerH * 0.72, bannerW, bannerH);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#0a0d0f";
          ctx.fillText(bannerText, width / 2, bannerY);
          ctx.restore();
        } else {
          ctx.fillStyle = "#d7ff3f";
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#baff29";
          ctx.font = `900 ${Math.min(58, width * 0.15)}px Arial, sans-serif`;
          ctx.fillText(`${metres} m`, width / 2, bannerY + 8);
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = "#f4fbfc";
        ctx.font = "900 18px ui-monospace, monospace";
        ctx.fillText(`REACHED LEVEL ${difficultyLevel + 1}`, width / 2, centerY + 88);

        ctx.font = "700 15px ui-monospace, monospace";
        ctx.fillText(subtitle, width / 2, centerY + 116);

        ctx.fillStyle = "rgba(244,251,252,.88)";
        ctx.font = "700 15px ui-monospace, monospace";
        ctx.fillText("HOLD = LEFT  •  RELEASE = RIGHT", width / 2, centerY + 148);
      } else {
        ctx.fillStyle = "#d7ff3f";
        ctx.font = "700 15px ui-monospace, monospace";
        ctx.fillText(subtitle, width / 2, centerY + 37);

        ctx.fillStyle = "rgba(244,251,252,.88)";
        ctx.font = "700 15px ui-monospace, monospace";
        ctx.fillText("HOLD = LEFT  •  RELEASE = RIGHT", width / 2, centerY + 74);
      }
    };

    let animation = 0;
    let disposed = false;

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - lastTime) / 1000, 0.035);
      lastTime = now;
      frameNow = now;
      if (state === "countdown") {
        countdownLeft = Math.max(0, (countdownEndsAt - now) / 1000);
        if (countdownLeft <= 0) {
          state = "playing";
          goFlash = 0.55;
        }
      }
      if (state === "playing") {
        const nextLevel = Math.floor(distance / 3000);
        if (nextLevel > difficultyLevel) {
          difficultyLevel = nextLevel;
          levelMessage =
            nextLevel === 1
              ? "FASTER"
              : nextLevel === 2
                ? "ROAD NARROWER"
                : "FASTER  •  NARROWER";
          levelFlash = 1.35;
        }
        speed = Math.min(420, 205 + distance * 0.035 + speedSteps() * 18);
        distance += speed * dt;
        const driftMultiplier = 1 + Math.floor(difficultyLevel / 5) * 0.05;
        const target = pressed ? -steerStrength() : steerStrength() * driftMultiplier;
        steerVelocity += (target - steerVelocity) * Math.min(1, dt * 12);
        playerX += steerVelocity * dt;
        const safe = roadWidth() / 2 - 17;
        if (Math.abs(playerX - roadCenter(distance)) > safe) {
          state = "crashed";
          shake = 11;
          playCrashSound();
          const metres = Math.floor(distance / 10);
          setLastDistance(metres);
          setShowFeedback(true);
          const isNewBest = distance > best;
          crashIsNewBest = isNewBest;
          posthog.capture("run_ended", {
            distance_metres: metres,
            level_reached: difficultyLevel + 1,
            is_new_best: isNewBest,
          });
          if (isNewBest) {
            best = distance;
            localStorage.setItem("stay-on-best", String(best));
          }
          if (!adFreeRef.current && Capacitor.isNativePlatform()) {
            interstitialRuns += 1;
            localStorage.setItem("stay-on-interstitial-runs", String(interstitialRuns));
            if (interstitialRuns % INTERSTITIAL_RUN_INTERVAL === 0 && interstitialReady) {
              interstitialReady = false;
              AdMob.showInterstitial().catch(() => {});
            }
          }
        }
        if (goFlash > 0) goFlash -= dt;
        if (levelFlash > 0) levelFlash -= dt;
      }

      // Reset the WebView canvas completely before each frame. This prevents
      // iOS GPU compositing from retaining a ghost of the pressed steering wheel.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "copy";
      ctx.fillStyle = "#060a0c";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.91;
      }
      ctx.fillStyle = "#060a0c";
      ctx.fillRect(-20, -20, width + 40, height + 40);
      drawRoad();
      drawRoadsideAds();
      drawCar();
      drawHud();
      if (state === "ready") overlay("STAY ON", "TAP TO DRIVE");
      if (state === "countdown") drawCountdown();
      if (state === "crashed") overlay("CRASHED", "TAP FOR ONE MORE RUN");
      if (goFlash > 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#d7ff3f";
        ctx.font = `900 ${Math.min(72, width * 0.18)}px Arial, sans-serif`;
        ctx.fillText("GO!", width / 2, height * 0.35);
      }
      if (levelFlash > 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffdb45";
        ctx.shadowBlur = 22;
        ctx.shadowColor = "#ff9f1c";
        ctx.font = `900 ${Math.min(46, width * 0.12)}px Arial, sans-serif`;
        ctx.fillText(`LEVEL ${difficultyLevel + 1}`, width / 2, height * 0.32);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(245,250,250,.82)";
        ctx.font = "700 11px ui-monospace, monospace";
        ctx.fillText(levelMessage, width / 2, height * 0.32 + 25);
      }
      drawBannerAd();
      ctx.restore();
      animation = requestAnimationFrame(frame);
    };

    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", actionDown, { passive: false });
    canvas.addEventListener("pointerup", actionUp, { passive: false });
    canvas.addEventListener("pointercancel", actionUp, { passive: false });
    canvas.addEventListener("touchstart", touchDown, { passive: false });
    canvas.addEventListener("touchend", touchUp, { passive: false });
    canvas.addEventListener("touchcancel", touchUp, { passive: false });
    canvas.addEventListener("contextmenu", preventNativeGesture, { passive: false });
    canvas.addEventListener("selectstart", preventNativeGesture, { passive: false });
    canvas.addEventListener("dragstart", preventNativeGesture, { passive: false });
    resize();
    animation = requestAnimationFrame(frame);

    return () => {
      if (Capacitor.isNativePlatform()) {
        AdMob.removeBanner().catch(() => {});
        interstitialListenerHandles.forEach((handle) => handle.remove().catch(() => {}));
      }
      disposed = true;
      setSteeringPressed(false);
      cancelAnimationFrame(animation);
      audioCtx?.close().catch(() => {});
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", actionDown);
      canvas.removeEventListener("pointerup", actionUp);
      canvas.removeEventListener("pointercancel", actionUp);
      canvas.removeEventListener("touchstart", touchDown);
      canvas.removeEventListener("touchend", touchUp);
      canvas.removeEventListener("touchcancel", touchUp);
      canvas.removeEventListener("contextmenu", preventNativeGesture);
      canvas.removeEventListener("selectstart", preventNativeGesture);
      canvas.removeEventListener("dragstart", preventNativeGesture);
    };
  }, []);

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} aria-label="Stay On driving game" />
      <audio
        ref={musicRef}
        src="/audio/neon-drift-circuit.mp3"
        loop
        muted={muted}
        preload="auto"
      />
      <button
        className="mute-toggle"
        type="button"
        aria-label={muted ? "Unmute music" : "Mute music"}
        aria-pressed={muted}
        onClick={toggleMuted}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="4,9 8,9 13,4 13,20 8,15 4,15" fill="currentColor" stroke="none" />
            <line x1="16" y1="9" x2="22" y2="15" />
            <line x1="22" y1="9" x2="16" y2="15" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="4,9 8,9 13,4 13,20 8,15 4,15" fill="currentColor" stroke="none" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a9 9 0 0 1 0 12" />
          </svg>
        )}
      </button>
      {!showFeedback && (
        <div className={`steering-control ${steeringPressed ? "is-pressed" : ""}`} aria-hidden="true">
          <span className="steering-spoke spoke-top" />
          <span className="steering-spoke spoke-left" />
          <span className="steering-spoke spoke-right" />
          <span className="steering-hub" />
          <span className="steering-label">PLACE THUMB HERE</span>
        </div>
      )}
      {showFeedback && !feedbackOpen && (
        <button
          className="feedback-trigger"
          onClick={() => {
            posthog.capture("feedback_opened");
            setFeedbackOpen(true);
          }}
        >
          {feedbackSent ? "THANKS!" : "QUICK FEEDBACK"}
        </button>
      )}
      {showFeedback && !feedbackOpen && !adFree && Capacitor.isNativePlatform() && (
        <div className="remove-ads-wrap">
          <button className="remove-ads-trigger" onClick={removeAds} disabled={purchasing}>
            {purchasing
              ? "…"
              : adFreePrice
                ? `REMOVE ADS · ${adFreePrice}`
                : "REMOVE ADS"}
          </button>
          <button className="restore-purchases-link" onClick={restorePurchases}>
            Restore purchase
          </button>
          {purchaseError && <p className="purchase-error">{purchaseError}</p>}
        </div>
      )}
      {feedbackOpen && (
        <div className="feedback-backdrop" role="dialog" aria-modal="true" aria-label="Game feedback">
          <form className="feedback-card" onSubmit={sendFeedback}>
            <button
              type="button"
              className="feedback-close"
              aria-label="Close feedback"
              onClick={() => setFeedbackOpen(false)}
            >
              ×
            </button>
            <p className="feedback-kicker">YOU MADE IT {lastDistance} m</p>
            <h2>What made you stop?</h2>
            <div className="feedback-options">
              {[
                ["fun", "Nothing—I’d keep playing"],
                ["hard", "It got too hard"],
                ["controls", "The controls felt off"],
                ["easy", "It was too easy"],
                ["other", "Something else"],
              ].map(([value, label]) => (
                <label key={value} className={feedbackReason === value ? "selected" : ""}>
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={feedbackReason === value}
                    onChange={() => setFeedbackReason(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <textarea
              value={feedbackNote}
              onChange={(event) => setFeedbackNote(event.target.value)}
              placeholder="Anything else? (optional)"
              maxLength={600}
            />
            <button className="feedback-submit" type="submit">SEND FEEDBACK</button>
            <p className="feedback-privacy">Anonymous—no name or email collected.</p>
          </form>
        </div>
      )}
    </main>
  );
}
