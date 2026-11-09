# Proxy Cloudflare Worker (opcional pero recomendado)

GitHub Pages solo sirve archivos estáticos. El portal Magis **no permite CORS** desde el navegador, por eso hace falta este proxy gratis.

## Pasos (5 minutos)

1. Entra en https://dash.cloudflare.com y crea cuenta (gratis).
2. Menú **Workers & Pages** → **Create** → **Create Worker**.
3. Borra el código de ejemplo y pega el contenido de `worker.js`.
4. **Deploy**.
5. Copia la URL, por ejemplo:
   `https://xupertv-proxy.tu-usuario.workers.dev`
6. En el repo, edita `js/config.js`:

```js
window.XUPER_CONFIG = {
  proxyBase: "https://xupertv-proxy.tu-usuario.workers.dev"
};
```

7. Sube el cambio a GitHub. Listo.
