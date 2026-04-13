import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatReader } from "@zxing/browser";

/**
 * Phones / tablets → rear camera (environment). Laptops / desktop → front / selfie camera (user).
 */
function shouldUseBackCamera() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const shortSide = Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0);
  if (coarsePointer && shortSide > 0 && shortSide <= 1024) {
    return true;
  }
  return false;
}

function mediaConstraints(useBack) {
  return {
    video: {
      facingMode: { ideal: useBack ? "environment" : "user" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };
}

/**
 * EAN-13 / 1D / 2D via @zxing/browser (works in Chrome, Firefox, Safari, Edge with camera).
 * Note: npm `next-barcode` only generates barcodes to display; it does not read from the camera.
 */
export default function BarcodeScanModal({ open, onClose, onDetected, title }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [message, setMessage] = useState("");

  onDetectedRef.current = onDetected;

  const scanHint = shouldUseBackCamera()
    ? "Point the back camera at the barcode. Good lighting helps."
    : "Use your laptop's front camera and hold the barcode in view. Good lighting helps.";

  useEffect(() => {
    if (!open) {
      setMessage("");
      return;
    }

    let cancelled = false;

    async function run() {
      setMessage("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("Camera access is not available in this browser.");
        return;
      }

      const video = videoRef.current;
      if (!video) {
        setMessage("Could not start the camera preview.");
        return;
      }

      const reader = new BrowserMultiFormatReader();
      const preferBack = shouldUseBackCamera();

      async function startWithFacing(useBack) {
        return reader.decodeFromConstraints(mediaConstraints(useBack), video, (result, _err, controls) => {
          if (cancelled || !result) return;
          try {
            controls.stop();
          } catch {
            /* ignore */
          }
          const text = result.getText?.() ?? String(result);
          if (text) onDetectedRef.current(text.trim());
        });
      }

      try {
        controlsRef.current = await startWithFacing(preferBack);
      } catch (first) {
        const retry =
          first?.name === "OverconstrainedError" ||
          first?.name === "NotFoundError" ||
          first?.name === "ConstraintNotSatisfiedError";
        if (retry && !cancelled) {
          try {
            controlsRef.current = await startWithFacing(!preferBack);
          } catch {
            setMessage(mapCameraError(first));
            return;
          }
        } else {
          setMessage(mapCameraError(first));
          return;
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
      const v = videoRef.current;
      if (v) {
        v.srcObject = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div className="scan-modal-root" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <button type="button" className="scan-modal-backdrop" aria-label="Close scanner" onClick={onClose} />
      <div className="scan-modal-panel">
        <div className="scan-modal-head">
          <h2 id="scan-title" className="scan-modal-title">
            {title ?? "Scan EAN-13 barcode"}
          </h2>
          <button type="button" className="scan-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="scan-modal-hint">{scanHint}</p>
        <div className="scan-video-wrap">
          <video ref={videoRef} className="scan-video" playsInline muted />
        </div>
        {message ? (
          <p className="scan-modal-message" role="status">
            {message}
          </p>
        ) : null}
        <button type="button" className="btn btn-ghost btn-block scan-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}

function mapCameraError(e) {
  const name = e && e.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow camera access to scan, or use a USB scanner on the field below.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  return "Could not open the camera. Try another browser or plug in a USB barcode scanner.";
}
