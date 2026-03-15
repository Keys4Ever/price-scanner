import fetch from "node-fetch";
import { load } from "cheerio";

const URL = "https://fullh4rd.com.ar/prod/30733/monitor-gamer-25-msi-mag-255f-e20-ips-fhd-200hz-05ms-hdmi-dp-q-24";
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1482540177858629785/8i9scA43efwOjaOnQ3SpmoL7e6LLqLvUb5IcHl7E5-M942XcQRd-_dWRjG9sT2hz95rj";

let lastStock = null;

async function checkStock() {
  try {
    const res = await fetch(URL);
    const html = await res.text();

    const $ = load(html);

    const inStock = !html.includes('"availability": "OutOfStock"')

    if (lastStock === null) {
      lastStock = inStock;
      console.log("Estado inicial:", inStock);
    }

    if (inStock !== lastStock) {
      lastStock = inStock;

      const message = inStock
        ? "🟢 HAY STOCK DEL MONITOR\n" + URL
        : "🔴 SIN STOCK\n" + URL;

      await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message,
        }),
      });

      console.log("Cambio detectado:", message);
    } else {
      console.log("Sin cambios", new Date().toLocaleTimeString());
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkStock();

// cada 10 minutos
setInterval(checkStock, 10 * 60 * 1000);