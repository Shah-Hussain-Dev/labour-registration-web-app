import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Webcam from "react-webcam";
import {
  composeGeoTaggedPhotoBlob,
  fetchStaticMapForLocation,
  getGeoPosition,
  reverseGeocodeAddress,
} from "../utils/geoPhoto.js";

function geoErrorMessage(err) {
  if (!err) return "Location error.";
  const c = err.code;
  if (c === 1) return "Location permission denied. Enable location in browser settings.";
  if (c === 2) return "Location unavailable. Try again outdoors or enable GPS.";
  if (c === 3) return "Location request timed out. Try again.";
  return err.message || "Could not read GPS position.";
}

/**
 * Full-screen mobile-style camera: edge-to-edge preview, shutter center, close bottom-right.
 */
export default function LabourLivePhotoModal({ open, onClose, onCaptured }) {
  const webcamRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (open) setLocalError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleCapture = useCallback(async () => {
    const shot = webcamRef.current?.getScreenshot?.();
    if (!shot) {
      setLocalError("Camera is not ready. Allow camera access and try again.");
      return;
    }
    setBusy(true);
    setLocalError("");
    try {
      const position = await getGeoPosition();
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      const [address, mapBlob] = await Promise.all([
        reverseGeocodeAddress(lat, lng),
        fetchStaticMapForLocation(lat, lng),
      ]);
      const capturedAt = new Date().toISOString();
      const capturedAtLabel = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      });
      const blob = await composeGeoTaggedPhotoBlob(shot, {
        lat,
        lng,
        accuracyM: accuracy,
        address,
        capturedAt,
        capturedAtLabel,
        mapBlob,
      });
      const meta = {
        latitude: lat,
        longitude: lng,
        accuracyM: accuracy,
        address,
        capturedAt,
        capturedAtLabel,
      };
      onCaptured(blob, meta);
      onClose();
    } catch (e) {
      if (e?.code !== undefined && typeof e.code === "number") {
        setLocalError(geoErrorMessage(e));
      } else {
        setLocalError(e?.message || "Could not build geo-tagged photo.");
      }
    } finally {
      setBusy(false);
    }
  }, [onCaptured, onClose]);

  if (!open) return null;

  const content = (
    <div
      className="cam-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="labour-live-photo-title"
    >
      <div className="cam-fullscreen__viewport">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          className="cam-fullscreen__video"
            videoConstraints={{
              facingMode: "environment",
              aspectRatio: { ideal: 3 / 4 },
              width: { ideal: 1080, min: 540 },
              height: { ideal: 1440, min: 720 },
            }}
          onUserMediaError={() =>
            setLocalError("Camera permission denied or no camera found.")
          }
        />
        {busy ? (
          <div className="cam-fullscreen__busy" aria-live="polite">
            <span className="inline-spinner cam-fullscreen__spinner" aria-hidden />
            <span className="cam-fullscreen__busy-text">Getting GPS and saving photo…</span>
          </div>
        ) : null}
      </div>

      <header className="cam-fullscreen__top">
        <span className="cam-fullscreen__top-spacer" aria-hidden />
        <div className="cam-fullscreen__title-block">
          <h2 id="labour-live-photo-title" className="cam-fullscreen__title">
            Labour live photo
          </h2>
          <p className="cam-fullscreen__subtitle">
            Portrait 3:4 with a large geo strip at the bottom — hold phone upright.
          </p>
        </div>
        <span className="cam-fullscreen__top-spacer" aria-hidden />
      </header>

      {localError ? (
        <div className="cam-fullscreen__error" role="alert">
          {localError}
        </div>
      ) : null}

      <footer className="cam-fullscreen__bottom">
        <div className="cam-fullscreen__bottom-row">
          <div className="cam-fullscreen__bottom-slot" aria-hidden />
          <button
            type="button"
            className="cam-fullscreen__shutter"
            onClick={handleCapture}
            disabled={busy}
            aria-label="Take photo"
          >
            <span className="cam-fullscreen__shutter-inner" aria-hidden />
          </button>
          <div className="cam-fullscreen__bottom-slot cam-fullscreen__bottom-slot--end">
            <button
              type="button"
              className="cam-fullscreen__close"
              onClick={onClose}
              disabled={busy}
              aria-label="Close camera"
            >
              ×
            </button>
          </div>
        </div>
      </footer>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
