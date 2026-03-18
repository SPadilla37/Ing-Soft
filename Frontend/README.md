# Frontend (Vanilla HTML/CSS/JS)

Este frontend mantiene la misma tecnologia original (sin React, sin Vite) y el mismo comportamiento visual/funcional.

## Estructura

- `index.html`: plantilla principal de la app.
- `public/`: archivos estaticos publicos.
- `src/assets/styles.css`: estilos globales.
- `src/main.js`: logica principal del frontend.
- `src/components/`: espacio para modulos UI reutilizables.
- `src/context/`: espacio para estado global modular.
- `src/hooks/`: espacio para utilidades reutilizables.
- `src/pages/`: espacio para separar vistas por modulo.
- `src/services/`: espacio para llamadas API separadas.

## Nota

La URL del backend se define en `src/config/constants.js` mediante `API_BASE`.
