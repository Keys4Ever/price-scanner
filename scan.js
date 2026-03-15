import "dotenv/config";
import fetch from "node-fetch";
import { load } from "cheerio";

const URL =
  process.env.PRODUCT_URL ||
  "https://fullh4rd.com.ar/prod/30733/monitor-gamer-25-msi-mag-255f-e20-ips-fhd-200hz-05ms-hdmi-dp-q-24";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const INTERVAL_MS =
  (Number(process.env.INTERVAL_MINUTES) || 10) * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 price-scanner/1.0";

let lastStock = null;
let checksSinCambios = 6;

/**
 * Extrae disponibilidad del JSON-LD de Fullh4rd.
 * Estructura: Product con "offers" como objeto (no array): { "@type": "Offer", "availability": "OutOfStock", "price": "...", ... }
 */
function parseStockFromHtml(html) {
  const $ = load(html);
  const ldJson = $('script[type="application/ld+json"]').first().text();
  if (ldJson) {
    try {
      const data = JSON.parse(ldJson);
      const offers = data.offers;
      if (offers && typeof offers === "object") {
        const availability =
          offers.availability ?? offers["availability"];
        if (availability != null) {
          const value =
            typeof availability === "string"
              ? availability
              : availability["@id"] ?? "";
          return !value.includes("OutOfStock");
        }
      }
    } catch (_) {}
  }
  return !html.includes('"availability": "OutOfStock"');
}

async function notifyDiscord(message) {
  if (!DISCORD_WEBHOOK) {
    console.warn("DISCORD_WEBHOOK no configurado; no se envía notificación.");
    return;
  }
  const res = await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  }
}

async function checkStock() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(URL, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const html = await res.text();
      const inStock = parseStockFromHtml(html);

      if (lastStock === null) {
        lastStock = inStock;
        console.log("Estado inicial:", inStock ? "con stock" : "sin stock");
      }

      if (inStock !== lastStock) {
        lastStock = inStock;
        checksSinCambios = 0;
        const message = inStock
          ? "🟢 HAY STOCK DEL MONITOR @everyone\n" + URL
          : "🔴 SIN STOCK\n" + URL;
        await notifyDiscord(message);
        console.log("Cambio detectado:", message);
      } else {
        checksSinCambios += 1;
        console.log("Sin cambios", new Date().toLocaleTimeString());
        if (checksSinCambios >= 6) {
          await notifyDiscord("⏳ Sin cambios (última hora) @everyone\n" + URL);
          checksSinCambios = 0;
        }
      }
      return;
    } catch (err) {
      console.error(`Error (intento ${attempt}/${MAX_RETRIES}):`, err.message);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error("Se agotaron los reintentos.");
      }
    }
  }
}

if (!DISCORD_WEBHOOK) {
  console.warn("Configura DISCORD_WEBHOOK en .env para recibir avisos por Discord.");
}

checkStock();
setInterval(checkStock, INTERVAL_MS);
