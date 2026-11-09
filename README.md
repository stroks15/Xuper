# XuperTV Web

Cliente web del portal Magis/Xuper. Funciona en **móvil, PC y TV (navegador)**.

## Subir a GitHub + GitHub Pages (paso a paso)

### 1. Crear el repositorio

1. Entra en [https://github.com/new](https://github.com/new)
2. Nombre, por ejemplo: `xupertv-web`
3. Público → **Create repository**

### 2. Subir estos archivos

En la carpeta del repo deben quedar así:

```
xupertv-web/
├── index.html
├── css/tv.css
├── js/
│   ├── config.js
│   ├── crypto-portal.js
│   ├── portal.js
│   └── catalog.json
├── worker/
│   ├── worker.js
│   └── README.md
└── README.md
```

**Desde el móvil (app GitHub):**

1. Abre el repo vacío → **Add file** → **Upload files**
2. Sube todas las carpetas/archivos de este zip
3. Commit

**Desde el PC:**

```bash
git clone https://github.com/TU_USUARIO/xupertv-web.git
cd xupertv-web
# copia aquí el contenido de este paquete
git add .
git commit -m "XuperTV web"
git push
```

### 3. Activar GitHub Pages

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` (o `master`), carpeta `/ (root)`
4. Save

En 1–2 minutos tendrás:

```text
https://TU_USUARIO.github.io/xupertv-web/
```

### 4. Proxy CORS (recomendado)

Sin proxy, el navegador suele bloquear las llamadas al portal (CORS).

1. Sigue las instrucciones de `worker/README.md`
2. Pon la URL del worker en `js/config.js`:

```js
window.XUPER_CONFIG = {
  proxyBase: "https://TU-WORKER.workers.dev"
};
```

3. Vuelve a hacer commit/push

## Uso

| Pestaña | Qué hace |
|---------|----------|
| Películas / Series | Catálogo local + búsqueda en portal |
| En vivo | Canales del portal |
| Solo enlaces | URL + headers para VLC / otros players |

## Notas

- Los tokens caducan; vuelve a abrir el título si falla.
- En móvil, para reproducir con headers usa **Solo enlaces** + un player que los acepte (PlayiFy, etc.), o configura el worker y reproduce en el navegador.
- Este proyecto es un cliente técnico del protocolo ya público del portal.
