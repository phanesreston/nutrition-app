"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";
import { parseBarcode } from "@/domain/barcode";
import { BASE_PATH } from "@/lib/base-path";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

interface DetectedCode {
  rawValue: string;
  format: string;
}
interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}

/**
 * Use the browser's built-in BarcodeDetector where it supports retail
 * barcodes (Chrome on Android); otherwise load the `barcode-detector`
 * ponyfill (ZXing compiled to WebAssembly, served from this app).
 */
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: BarcodeDetectorStatic }).BarcodeDetector;
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (FORMATS.every((f) => supported.includes(f))) return new native({ formats: [...FORMATS] });
    } catch {
      // fall through to the ponyfill
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (file: string, prefix: string) =>
        file.endsWith(".wasm") ? `${BASE_PATH}/vendor/zxing_reader.wasm` : prefix + file,
    },
  });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

interface BarcodeDetectorStatic {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

type CameraError = "insecure" | "denied" | "no-camera" | "failed";

const ERROR_TEXT: Record<CameraError, { title: string; text: string }> = {
  insecure: {
    title: "Camera needs a secure connection",
    text: "Browsers only allow camera access over HTTPS (or on localhost). Type the barcode number below instead.",
  },
  denied: {
    title: "Camera access was blocked",
    text: "Allow camera access for this site in your browser settings and try again, or type the barcode below.",
  },
  "no-camera": {
    title: "No camera found",
    text: "This device has no camera available. Type the barcode number below instead.",
  },
  failed: {
    title: "The camera could not be started",
    text: "Another app may be using it. Close other camera apps and try again, or type the barcode below.",
  },
};

/**
 * Live camera viewfinder that reports the first valid retail barcode it
 * sees. A code must be read identically twice in a row and pass its check
 * digit, which filters out the misreads that single frames produce.
 */
export function BarcodeScanner({ onDetect }: { onDetect: (code: string, format: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [state, setState] = useState<"starting" | "scanning" | CameraError>("starting");

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState(window.isSecureContext ? "no-camera" : "insecure");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (error) {
        const name = (error as Error).name;
        if (!cancelled) {
          setState(
            name === "NotAllowedError" || name === "SecurityError"
              ? "denied"
              : name === "NotFoundError" || name === "OverconstrainedError"
                ? "no-camera"
                : "failed",
          );
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current!;
      video.srcObject = stream;
      let detector: Detector;
      try {
        await video.play();
        detector = await createDetector();
      } catch {
        if (!cancelled) setState("failed");
        return;
      }
      if (cancelled) return;
      setState("scanning");

      let previous = "";
      const tick = async () => {
        if (cancelled) return;
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const found = (await detector.detect(video)).find((c) => parseBarcode(c.rawValue, { format: c.format }));
            if (found && !cancelled) {
              if (found.rawValue === previous) {
                navigator.vibrate?.(60);
                onDetectRef.current(found.rawValue, found.format);
                return; // stop scanning; the parent unmounts us
              }
              previous = found.rawValue;
            }
          }
        } catch {
          // A failed frame is not fatal; try the next one.
        }
        timer = setTimeout(tick, 140);
      };
      tick();
    }

    start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const error = state !== "starting" && state !== "scanning" ? ERROR_TEXT[state] : null;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-950 text-white sm:aspect-video">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Camera viewfinder"
        className={`size-full object-cover ${state === "scanning" ? "" : "invisible"}`}
      />
      {state === "scanning" ? (
        <>
          {/* Viewfinder frame */}
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-2/5 w-4/5 max-w-md rounded-2xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)] ring-2 ring-white/90">
              <div className="absolute inset-x-4 top-1/2 h-px animate-pulse bg-red-500/90" />
            </div>
          </div>
          <p role="status" className="absolute inset-x-0 bottom-3 text-center text-sm font-medium drop-shadow">
            Hold the barcode inside the frame
          </p>
        </>
      ) : null}
      {state === "starting" ? (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-white/80">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          Starting camera…
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <CameraOff className="size-7 text-white/70" aria-hidden />
          <p className="font-medium">{error.title}</p>
          <p className="max-w-sm text-sm text-white/75">{error.text}</p>
        </div>
      ) : null}
    </div>
  );
}
