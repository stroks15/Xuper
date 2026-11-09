/**
 * Configuración pública de XuperTV Web.
 *
 * Si el portal bloquea CORS desde el navegador (lo normal),
 * despliega el worker de Cloudflare (carpeta /worker) y pega aquí su URL.
 *
 * Ejemplo:
 *   proxyBase: "https://xupertv-proxy.TU_USUARIO.workers.dev"
 *
 * Déjalo vacío ("") para intentar conexión directa.
 */
window.XUPER_CONFIG = {
  proxyBase: ""
};
