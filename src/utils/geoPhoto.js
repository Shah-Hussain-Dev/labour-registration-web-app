/**
 * Geo-tagged photo helpers: GPS, reverse geocode, optional static map, canvas composite.
 * Static map / Google geocode use same-origin `/api/maps/*` in dev (Vite proxy); configure the same routes in production if needed.
 */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.decoding = "async";
    img.src = src;
  });
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || "—")
    .trim()
    .split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function truncateToWidth(ctx, text, maxW) {
  const t = String(text || "");
  if (!t) return "—";
  if (ctx.measureText(t).width <= maxW) return t;
  let s = t;
  while (s.length > 3 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

/** e.g. `Friday, 10 Apr 2026, 16:36:13` (local time, 24h, English weekday) */
function formatGeoPhotoTimestamp(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pad = (n) => String(n).padStart(2, "0");
    return `${wd[d.getDay()]}, ${d.getDate()} ${mo[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return "";
  }
}

function drawMapPlaceholder(ctx, x, y, w, h, lat, lng) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#1e5a7a");
  g.addColorStop(1, "#2d8bba");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const tx = (i * w) / 4;
    const ty = (i * h) / 4;
    ctx.beginPath();
    ctx.moveTo(x + tx, y);
    ctx.lineTo(x + tx, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + ty);
    ctx.lineTo(x + w, y + ty);
    ctx.stroke();
  }
  const pinR = Math.max(8, Math.round(Math.min(w, h) * 0.045));
  ctx.fillStyle = "#c62828";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, pinR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const labelPx = Math.max(11, Math.round(Math.min(w, h) * 0.09));
  ctx.font = `${labelPx}px system-ui, sans-serif`;
  ctx.fillText(`${lat.toFixed(4)}`, x + Math.round(w * 0.04), y + h - Math.round(h * 0.06));
}

export function getGeoPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 22000,
      maximumAge: 0,
      ...options,
    });
  });
}

export async function reverseGeocodeAddress(lat, lng) {
  try {
    const res = await fetch(`/api/maps/geocode?latlng=${encodeURIComponent(`${lat},${lng}`)}`);
    if (res.ok) {
      const data = await res.json();
      const addr = data?.results?.[0]?.formatted_address;
      if (addr) return addr;
    }
  } catch {
    /* proxy may be absent in production */
  }

  try {
    const nom = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { Accept: "application/json" } },
    );
    if (nom.ok) {
      const j = await nom.json();
      if (j.display_name) return j.display_name;
    }
  } catch {
    /* network */
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export async function fetchStaticMapForLocation(lat, lng) {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "16",
    size: "280x280",
    scale: "2",
    maptype: "roadmap",
    markers: `color:red|${lat},${lng}`,
  });
  try {
    const res = await fetch(`/api/maps/static?${params}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 200 ? blob : null;
  } catch {
    return null;
  }
}

/** Portrait 3:4 — tall frame; footer uses ~30% height with fonts/map scaled to canvas width. */
const OUTPUT_PORTRAIT_W = 1080;
const OUTPUT_PORTRAIT_H = Math.round((OUTPUT_PORTRAIT_W * 4) / 3);

/**
 * Geo-tagged JPEG: portrait 3:4, large readable geo strip (map + Lat/Lng, accuracy, time, address).
 *
 * @param {string} photoDataUrl
 * @param {{ lat: number, lng: number, accuracyM?: number|null, address: string, capturedAt?: string, capturedAtLabel: string, mapBlob?: Blob|null }} meta
 * @returns {Promise<Blob>}
 */
export async function composeGeoTaggedPhotoBlob(photoDataUrl, meta) {
  const img = await loadImage(photoDataUrl);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  let mapImg = null;
  if (meta.mapBlob) {
    try {
      const url = URL.createObjectURL(meta.mapBlob);
      mapImg = await loadImage(url);
      URL.revokeObjectURL(url);
    } catch {
      mapImg = null;
    }
  }

  const cw = OUTPUT_PORTRAIT_W;
  const ch = OUTPUT_PORTRAIT_H;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");

  const hasAcc = meta.accuracyM != null && Number.isFinite(meta.accuracyM);
  const pad = Math.max(18, Math.round(cw * 0.024));
  /* Taller footer (~28–34%): map and text stay legible when the JPEG is shown small in the form */
  let footerH = Math.round(ch * 0.31);
  footerH = Math.min(Math.max(footerH, Math.round(ch * 0.28)), Math.round(ch * 0.34));
  const photoH = ch - footerH;

  const mapGap = Math.max(16, Math.round(cw * 0.018));
  const seedBody = Math.min(22, Math.max(15, Math.round(cw / 50)));

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cw, photoH);
  ctx.clip();
  const scale = Math.max(cw / iw, photoH / ih);
  const dw = Math.round(iw * scale);
  const dh = Math.round(ih * scale);
  const ox = Math.round((cw - dw) / 2);
  const oy = Math.round((photoH - dh) / 2);
  ctx.drawImage(img, ox, oy, dw, dh);
  ctx.restore();

  const innerH = footerH - pad * 2;
  const minTextColW = 260;
  const maxMapW = cw - 2 * pad - mapGap - minTextColW;
  /* Small square map — shorter than the text column; vertically centered in the footer band */
  const mapSize = Math.max(
    112,
    Math.min(maxMapW, Math.round(innerH * 0.46), 200),
  );

  const mapY2 = photoH + pad + Math.round((innerH - mapSize) / 2);
  const textX = pad + mapSize + mapGap;
  const maxTextW = cw - textX - pad;

  const whenLine =
    formatGeoPhotoTimestamp(meta.capturedAt) ||
    (meta.capturedAtLabel ? String(meta.capturedAtLabel) : "");

  const coordLine = `Lat ${meta.lat.toFixed(6)} - Lng ${meta.lng.toFixed(6)}`;
  const accLine = hasAcc ? `GPS accuracy ~${Math.round(meta.accuracyM)} m` : "";

  const linesMeta = [{ text: coordLine, primary: true }];
  if (hasAcc) linesMeta.push({ text: accLine, primary: true });
  if (whenLine) linesMeta.push({ text: whenLine, primary: false });

  const measure = document.createElement("canvas").getContext("2d");
  const layoutColumn = (fb) => {
    measure.font = `600 ${fb}px system-ui, -apple-system, sans-serif`;
    const addr = wrapLines(measure, meta.address || "—", maxTextW);
    const rows = [...linesMeta, ...addr.map((t) => ({ text: t, primary: false }))];
    return rows;
  };

  /* Text uses full footer inner height so the right column is taller than the small map */
  const textPadY = Math.round(innerH * 0.04);
  const textTop = photoH + pad + textPadY;
  const textBottom = photoH + pad + innerH - textPadY;
  const columnH = Math.max(1, textBottom - textTop);

  let rows = layoutColumn(seedBody);
  for (let pass = 0; pass < 2; pass++) {
    const n = rows.length;
    const slotH = columnH / n;
    const fpPass = Math.min(34, Math.max(17, Math.floor(slotH * 0.82)));
    let fbPass = Math.min(30, Math.max(15, Math.floor(slotH * 0.76)));
    fbPass = Math.min(fbPass, fpPass - 1);
    rows = layoutColumn(fbPass);
  }

  const nLines = rows.length;
  const slot = columnH / nLines;
  let fp = Math.min(34, Math.max(17, Math.floor(slot * 0.82)));
  let fb = Math.min(30, Math.max(15, Math.floor(slot * 0.76)));
  fb = Math.min(fb, fp - 1);

  ctx.fillStyle = "#ffffff";

  for (let i = 0; i < nLines; i++) {
    const { text: lineText, primary } = rows[i];
    const sz = primary ? fp : fb;
    ctx.font = `600 ${sz}px system-ui, -apple-system, sans-serif`;
    const slotTop = textTop + i * slot;
    const baseline = slotTop + slot / 2 + sz * 0.32;
    ctx.fillText(truncateToWidth(ctx, lineText, maxTextW), textX, baseline);
  }

  if (mapImg) {
    ctx.drawImage(mapImg, pad, mapY2, mapSize, mapSize);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pad + 1, mapY2 + 1, mapSize - 2, mapSize - 2);
  } else {
    drawMapPlaceholder(ctx, pad, mapY2, mapSize, mapSize, meta.lat, meta.lng);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.9,
    );
  });
}

export function downloadBlob(blob, filename = "geo-tagged-registration.jpg") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
