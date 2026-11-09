/**
 * Cloudflare Worker — proxy CORS para XuperTV Web
 *
 * Rutas:
 *   GET/POST /portal?url=https://host/api/portalCore/...
 *   GET /stream?url=...&auth=...&license=...
 *
 * Despliegue:
 *   1. Cuenta gratis en https://dash.cloudflare.com
 *   2. Workers & Pages → Create Worker
 *   3. Pega este código → Deploy
 *   4. Copia la URL (https://xxx.workers.dev) en js/config.js → proxyBase
 */

const ALLOW_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "xupertv-proxy" });
    }

    // Portal API proxy
    if (url.pathname === "/portal") {
      const target = url.searchParams.get("url");
      if (!target || !/^https:\/\//i.test(target)) {
        return json({ error: "url inválida" }, 400);
      }
      const headers = {
        "User-Agent": "okhttp/3.12.12",
        "Content-Type": request.headers.get("Content-Type") || "application/json;charset=utf-8",
        apk: request.headers.get("apk") || "com.android.msandroid",
        apkVer: request.headers.get("apkVer") || "43404",
        spkgVer: request.headers.get("spkgVer") || "2025-08-07 05:40:11_36_16_",
      };
      const init = { method: request.method, headers };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.arrayBuffer();
      }
      const resp = await fetch(target, init);
      const body = await resp.arrayBuffer();
      return new Response(body, {
        status: resp.status,
        headers: {
          "Content-Type": resp.headers.get("Content-Type") || "application/json",
          ...corsHeaders(),
        },
      });
    }

    // Stream proxy (inyecta Content-Auth / Content-License)
    if (url.pathname === "/stream") {
      const target = url.searchParams.get("url");
      const auth = url.searchParams.get("auth") || "";
      const license = url.searchParams.get("license") || "";
      if (!target || !/^https?:\/\//i.test(target)) {
        return json({ error: "url inválida" }, 400);
      }
      const headers = {
        "User-Agent": "Ranger/4.9.4-17294ac0",
        App: "com.android.msandroid",
        "App-Version": "49902",
      };
      if (auth) headers["Content-Auth"] = auth;
      if (license) headers["Content-License"] = license;
      if (target.includes(".m3u8")) headers["X-Buffer"] = "0";

      const range = request.headers.get("Range");
      if (range) headers["Range"] = range;

      const resp = await fetch(target, { headers });
      const outHeaders = {
        "Content-Type": resp.headers.get("Content-Type") || "application/octet-stream",
        ...corsHeaders(),
      };
      const cr = resp.headers.get("Content-Range");
      const cl = resp.headers.get("Content-Length");
      const ar = resp.headers.get("Accept-Ranges");
      if (cr) outHeaders["Content-Range"] = cr;
      if (cl) outHeaders["Content-Length"] = cl;
      if (ar) outHeaders["Accept-Ranges"] = ar;

      return new Response(resp.body, { status: resp.status, headers: outHeaders });
    }

    return json({ error: "ruta no encontrada" }, 404);
  },
};
