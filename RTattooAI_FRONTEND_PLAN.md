# RTattooAI — Plan del Frontend (Angular 21)

Enfoque: construir primero los **Must** (flujo central de la herramienta de apoyo) y dejar la arquitectura preparada para ir sumando el backlog (HU-01..HU-14) sin rehacer. Consume el backend que ya está funcional (contrato §B/§C, camelCase).

---

## 1. Mapeo HU → frontend

| HU | Épica | Frontend | Fase | Depende de backend |
|---|---|---|---|---|
| Login | Usuarios | Pantalla login + guard JWT | **Must** | Listo |
| HU-01 carga de imagen | Gestión Tatuajes | Upload con preview + rechazo >10MB (JPG/PNG) | **Must** | Listo (WEBP pendiente) |
| HU-04 detección | Detección IA | Imagen + bounding boxes + score | **Must** | Listo |
| HU-05 comparación | Detección IA | Top-5 con % similitud + banda | **Must** | Listo (umbral configurable: después) |
| HU-06 disclaimer + semáforo | Detección IA | Disclaimer permanente + semáforo de confianza | **Must** | Listo (derivable de verdict/similitud) |
| HU-03 registrar tatuaje | Gestión Tatuajes | Formulario imagen + banda | **Must (mínimo)** | Listo (campos ricos + dedup: después) |
| HU-08 historial | Reportes | Lista de análisis | **Must (básico)** | Listo (filtros/paginación: después) |
| HU-02 recorte/ajuste | Gestión Tatuajes | Herramienta de recorte/brillo | Fase 2 | No (100% frontend) |
| HU-07 reporte PDF | Reportes | Botón generar/descargar PDF | Fase 2 | Falta backend (tabla Reportes existe) |
| HU-08 filtros/supervisor | Reportes | Filtros, paginación, vista supervisor | Fase 3 | Falta backend |
| HU-09 gestión usuarios | Administración | CRUD usuarios | Fase 3 | Falta backend |
| HU-10 dashboard métricas | Administración | Gráficos + export CSV | Fase 3 | Falta backend |
| HU-13/HU-14 seguridad/auditoría | Seguridad | (transversal, poca UI) | Fase 3 | Falta backend |

HU-11/HU-12 (dataset) son del repo ML, sin frontend.

---

## 2. Arquitectura Angular 21 (anticipa el backlog)

Standalone components, signals, zoneless, rutas lazy con guards por rol. Las features futuras quedan como rutas declaradas y protegidas, listas para implementarse sin tocar el núcleo.

```
src/app/
  core/
    auth/         auth.service, auth.guard, role.guard, jwt.interceptor
    api/          analysis.service, catalog.service (HttpClient -> /api)
    models/       analysis, detection, match, user, catalog-item (espejo del contrato, camelCase)
  features/
    auth/login/                 (Must)
    analysis/
      upload/                   (Must — HU-01)
      results/                  (Must — HU-04/05/06)
    history/                    (Must — HU-08 básico)
    catalog/enroll/             (Must — HU-03 mínimo)
    reports/        (Fase 2 — HU-07)   ruta declarada, placeholder
    admin/
      users/        (Fase 3 — HU-09)   ruta con role.guard [admin]
      dashboard/    (Fase 3 — HU-10)   ruta con role.guard [admin/supervisor]
  shared/
    components/   disclaimer-banner, confidence-semaforo, bbox-overlay, image-dropzone
    ui/           botones, cards, etc. (según diseño en Claude Design)
  app.routes.ts   loadComponent lazy + canActivate (authGuard / roleGuard)
```

Claves para que el backlog sea aditivo:
- **Role guard desde el día 1** aunque hoy solo exista un rol: las rutas de admin/supervisor ya quedan gateadas, y cuando el backend exponga RBAC solo se activan.
- **Modelos espejo del contrato** en `core/models`: si el contrato cambia, se toca un solo lugar.
- **Componentes compartidos** (`disclaimer-banner`, `confidence-semaforo`, `bbox-overlay`) reutilizables en results y en el futuro PDF/reporte.

---

## 3. Fase 1 — Must (lo que se construye ahora)

1. **Login** — formulario, guarda el JWT, redirige; interceptor agrega el token y maneja 401.
2. **Upload (HU-01 parcial)** — drag&drop, **preview antes de enviar**, rechazo de >10MB y de formatos != JPG/PNG con mensaje claro. (WEBP queda fuera de esta fase.)
3. **Results (HU-04/05/06)** — imagen original con **bounding boxes** y score por detección; por cada detección, **top-5** coincidencias con % de similitud y banda; **verdict** (`match`/`no_match`); **semáforo de confianza** (ver §6); **disclaimer permanente**. `no_match` se muestra como "sin coincidencia concluyente", nunca como certeza.
4. **Historial (HU-08 básico)** — lista de análisis con fecha, estado, mejor coincidencia; abrir cada uno. Sin filtros ni paginación todavía; `thumbnailUrl` puede venir `null` → usar placeholder.
5. **Enrolar al catálogo (HU-03 mínimo)** — formulario imagen + banda; al guardar llama `POST /api/catalog`. Los campos categoría/ubicación/descripción/tags y la validación de duplicados son fase posterior.

Criterio de "terminado" de la fase: login → upload → results (con semáforo y disclaimer) → historial → enrolar, todo contra el backend real, con el disclaimer siempre visible.

---

## 4. Fases siguientes (incrementales)

- **Fase 2:** HU-02 (recorte/brillo, 100% frontend), HU-07 (PDF — requiere endpoint backend + tabla Reportes), completar HU-08 (filtros, paginación, descarga del reporte).
- **Fase 3:** RBAC real (vistas de supervisor/admin), HU-09 (gestión de usuarios), HU-10 (dashboard + export CSV), apoyo de UI para HU-13/HU-14.
- **Transversal:** WEBP (HU-01) cuando backend+contrato lo habiliten; calibración del semáforo con fotos reales (ligado a la brecha de dominio del informe).

---

## 5. Decisiones a cerrar antes de arrancar

1. **CORS/proxy:** usar `proxy.conf.json` de Angular en dev (`/api` → URL local del backend; revisar `launchSettings`, típicamente `https://localhost:7xxx`). Backend agrega `AddCors` para el dominio del frontend antes del despliegue.
2. **Unidades de bbox:** confirmar que `GET /api/analyses/{id}` devuelve bbox en **píxeles** (contrato) y no normalizado (DBML) antes de escribir el escalado.
3. **WEBP:** fuera de la Fase Must (JPG/PNG, como el backend).
4. **Enrolar:** Must = imagen+banda; campos ricos del DBML después.
5. **Roles:** el backend siembra `analyst`; el DBML usa Perito/Supervisor/Admin/Analista. El frontend trata el rol como string y gatea rutas futuras por rol; alinear nomenclatura más adelante, sin bloquear.
6. **Semáforo:** ver §6; umbrales tunables, subordinados al disclaimer.

---

## 6. Semáforo de confianza (propuesta, HU-06)

Derivado de `verdict` + `similarity`, framing de apoyo (sin certeza absoluta):
- 🔴 **Rojo** — `verdict = no_match`: "El sistema no encontró una coincidencia confiable."
- 🟡 **Amarillo** — `verdict = match` con similitud moderada (≈ 0.55–0.75): "Posible coincidencia; requiere validación."
- 🟢 **Verde** — `verdict = match` con similitud alta (≈ ≥ 0.75): "Coincidencia fuerte; aún requiere validación humana."

Los cortes son un punto de partida y deben **calibrarse con fotos reales** (las métricas de identificación actuales son sobre consultas sintéticas; brecha de dominio documentada en el informe). El semáforo nunca sustituye al disclaimer.
