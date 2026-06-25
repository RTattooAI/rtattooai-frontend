# RTattooAI Frontend — Reporte de Entrega

Rama: `feature/scaffold-fase-must` (sin mergear a `main`).
Commits: `4eae408` (scaffold + diseño Fase Must), `bab7c49` (fix orden de matches).
Verificado contra backend real (ASP.NET Core en `localhost:5155` + Azurite) el 2026-06-24.

---

## 1. Qué se construyó

| Módulo | Estado | Notas |
|---|---|---|
| `core/auth` (service, guard, role.guard, jwt.interceptor) | **Funcional** | JWT en `localStorage`. Guard solo valida presencia de token, no expiración (ver §5). |
| `core/api` (auth.api, analysis, catalog) | **Funcional** | `analysis.service.ts` normaliza `matches[]` (ver §2/§5). |
| `core/models` | **Funcional** | Espejo en camelCase del contrato (Analysis, Detection, Match, Bbox, CatalogItem, User). |
| Login (HU implícita) | **Funcional** | Contra `/api/auth/login` real. "Ingresar con token PNP" y "¿Olvidó su contraseña?" son placeholders inertes (sin handler), no rompen nada. |
| Upload (HU-01) | **Funcional** | Dropzone con validación cliente (solo JPG/PNG, máx. 10 MB) + `POST /api/analyses` real. |
| Resultados (HU-04/05/06) | **Funcional** | bbox sobre imagen real (escalado px), semáforo verdict-based, top-5 matches con miniaturas reales. Botones "Guardar borrador", "Compartir", "Generar reporte PDF", "Validar coincidencia/Solicitar revisión/Descartar" y el textarea de observaciones son **decorativos** (sin `(click)`, sin endpoint backend) — heredados del diseño, no hacen nada. |
| Historial (HU-08 básico) | **Funcional, con extra** | Lista contra `GET /api/analyses`, con buscador y filtro por estado (no estaban en el alcance mínimo original). Sin paginación. |
| Catálogo / Enrolar (HU-03 mínimo) | **Funcional, con extra** | Lista + stats (total, bandas, validados/pendientes) + modal de alta contra `POST /api/catalog`. Sin deduplicación ni campos ricos (categoría, ubicación, tags). |
| Reportes (`/reports`) | **Placeholder** | `FeaturePlaceholder`, ruta gateada, badge "Fase 2 · HU-07". Sin lógica. |
| Admin Usuarios (`/admin/users`) | **Placeholder** | Ruta gateada por `roleGuard`, badge "Fase 3 · HU-09". |
| Admin Dashboard (`/admin/dashboard`) | **Placeholder** | Ruta gateada por `roleGuard`, badge "Fase 3 · HU-10". |
| Shell / navegación | **Funcional, con deuda** | Sidebar muestra siempre los links de "Gestión" (Reportes/Usuarios/Panel) sin ocultarlos por rol — el `roleGuard` sí bloquea la ruta y redirige a `/upload`, pero el menú no refleja el rol del usuario actual (ver §5). |
| Disclaimer | **Funcional** | Visible siempre en resultados (campo `disclaimer` del backend), nunca se omite. |
| Tests | **Mínimo** | 1 archivo / 1 test (smoke test default de `ng new`). Sin tests de guards, interceptor, servicios ni componentes. |

---

## 2. Contrato real implementado

Todos los endpoints de Sección B del contrato, consumidos vía `environment.apiUrl` (`/api` en local, proxeado).

### `POST /api/auth/login`
Request: `{ "email": "string", "password": "string" }`
Response 200:
```json
{
  "token": "<jwt>",
  "expiresAt": "2026-06-25T03:00:00Z",
  "user": { "id": "guid", "name": "string", "role": "analyst" }
}
```
**Deviación:** `expiresAt` se modela en `LoginResponse` pero el frontend **no lo usa** para expirar la sesión proactivamente; el logout solo ocurre reactivamente cuando el backend responde 401.

### `POST /api/analyses` (multipart, campo `image`) y `GET /api/analyses/{id}`
Response 200 (`Analysis`):
```json
{
  "id": "guid",
  "status": "completed",
  "imageUrl": "https://.../blob/sas...",
  "thumbnailUrl": "https://.../blob/sas...",
  "imageWidth": 1024,
  "imageHeight": 768,
  "createdAt": "2026-06-24T18:00:00Z",
  "modelVersion": "yolo-v8-tattoo-1.2",
  "processingMs": 842,
  "disclaimer": "Resultado preliminar, requiere validación humana.",
  "detections": [
    {
      "bbox": { "x": 120, "y": 80, "width": 200, "height": 150 },
      "confidence": 0.91,
      "verdict": "match",
      "matches": [
        { "catalogId": "guid", "band": "Tren_1", "similarity": 0.92, "referenceImageUrl": "https://..." }
      ]
    }
  ]
}
```
**Deviación confirmada contra datos reales:** el contrato no garantiza (ni el backend cumple) que `matches[]` venga ordenado por `similarity` descendente. Se confirmó un caso real donde el mejor match (92%) estaba en el índice 3 de 5. El frontend ahora ordena `matches` del lado cliente (`withSortedMatches` en `analysis.service.ts`) antes de exponer `Analysis` a cualquier componente.

**Otra deviación observada:** las fechas (`createdAt`) vienen con sufijo `Z` cuando el registro es recién creado, pero **sin** sufijo de zona al releerse desde SQL Server (queda `Kind=Unspecified`). El frontend lo compensa en `core/utils/parse-api-date.ts` asumiendo UTC si no hay timezone explícita. Esto no está documentado en el contrato.

### `GET /api/analyses` (lista)
Response 200: array de `AnalysisListItem` — `{ id, thumbnailUrl, status, createdAt, topBand, topSimilarity }`. `thumbnailUrl` puede ser `null` → se usa placeholder (`TattooThumb`), conforme a lo indicado en CLAUDE.md.

### `POST /api/catalog` (multipart: `image`, `band`) y `GET /api/catalog`
Response 200 (`CatalogItem`): `{ catalogId, band, imageUrl, source, addedBy, addedAt, validated }`.
**Bug de backend observado durante pruebas (no del frontend):** al menos una vez `POST /api/catalog` devolvió un 500 con el cuerpo siendo un stack trace de .NET en texto plano (no JSON). El frontend ya degradaba con seguridad (`err.error?.error ?? mensaje genérico`), pero vale la pena reportarlo al equipo de backend.

### General
- Todos los endpoints (excepto login) requieren `Authorization: Bearer <jwt>` — confirmado vía `jwtInterceptor`.
- `bbox` viene en píxeles de la imagen original — confirmado contra datos reales, sin necesidad de reescalar antes de aplicar el factor de render.
- Roles: el backend solo emite `"analyst"` hoy. El DBML/plan mencionan Perito/Supervisor/Admin/Analista — la nomenclatura aún no está alineada (riesgo conocido, documentado también en `RTattooAI_FRONTEND_PLAN.md` §5).
- JPG/PNG únicamente; WEBP fuera de alcance en ambos lados, sin deviation.

---

## 3. Cómo correrlo en local

Requisitos: Node 22.x LTS, npm ≥ 11. Backend ASP.NET Core corriendo en `http://localhost:5155` (o ajustar `proxy.conf.json`), con Azurite si se usa Blob storage local.

```bash
npm install
npm start          # ng serve, usa proxy.conf.json (/api -> http://localhost:5155)
```

Otros comandos:
```bash
npm run build       # build de producción
npm test            # vitest, 1 test (smoke)
```

Variables de entorno / configuración (sin secretos):
- `src/environments/environment.ts` y `environment.development.ts`: ambos `{ apiUrl: '/api' }`. No hay `environment.production.ts` separado todavía — el build de producción usa el mismo `/api` relativo, lo que asume que frontend y backend comparten dominio o hay un reverse proxy (ver §6).
- `proxy.conf.json`: `{ "/api": { "target": "http://localhost:5155", "secure": false, "changeOrigin": true } }` — ajustar `target` al puerto real del backend local.
- No hay archivo `.env` ni claves de API en el repo. Las credenciales de login son las que entregue el equipo de backend (usuario seed con rol `analyst`); no se incluyen aquí.

---

## 4. User stories y criterios de aceptación

| HU | Cubierta | Detalle |
|---|---|---|
| Login | ✅ Sí | Contra backend real, maneja 401 y otros errores. |
| HU-01 Upload | ✅ Sí | Validación de tipo/tamaño en cliente, envío real, navega a resultados. |
| HU-04/05/06 Resultados (bbox, semáforo, disclaimer) | ✅ Sí | Semáforo: 🔴 `no_match`, 🟡 `match` con similarity < 0.75, 🟢 `match` con similarity ≥ 0.75 (alineado con el rango sugerido en el plan §6; cutoff exacto aún sin calibrar contra fotos reales variadas). Disclaimer siempre visible. |
| HU-03 Enrolar (mínimo) | ✅ Sí | Alta + listado contra backend real. |
| HU-08 Historial (básico) | ✅ Sí, con extra | Incluye buscador y filtro de estado no contemplados en el "básico" original; **sin paginación**. |
| HU-02 (detalle/variantes no especificadas en plan) | ❌ No | Fuera del documento revisado, no implementada. |
| HU-07 Reportes PDF | ❌ No | Placeholder de ruta + botón decorativo en resultados, sin lógica ni endpoint. |
| HU-08 filtros avanzados/paginación | ❌ No | Solo búsqueda+estado simples; sin paginación ni filtros por fecha/banda. |
| HU-09 Admin usuarios | ❌ No | Placeholder, gateado por rol. |
| HU-10 Admin dashboard | ❌ No | Placeholder, gateado por rol. |
| HU-13/HU-14 | ❌ No | No mencionadas en el alcance Must, no abordadas. |
| Flujo de validación humana (botones Validar/Revisión/Descartar en resultados) | ❌ No | Visual únicamente; no existe endpoint en el contrato para persistir esta decisión. |

Definición de "terminado" de CLAUDE.md (login → upload → resultados → historial contra backend real, con disclaimer siempre visible): **cumplida**. Enrolar también funciona contra backend real.

---

## 5. Bugs conocidos, deuda técnica y supuestos

**Bugs corregidos en esta sesión:**
- Orden de `matches[]` no garantizado por el backend causaba que el "mejor match" mostrado y el color del semáforo fueran incorrectos cuando el match de mayor similitud no estaba en el índice 0. Corregido en `analysis.service.ts` (`withSortedMatches`), aplicado a `create()` y `getById()`.

**Bugs conocidos (no corregidos, fuera de alcance frontend):**
- `POST /api/catalog` devolvió una vez un 500 con stack trace de .NET en texto plano en vez de JSON. Reportar a backend.

**Deuda técnica:**
- Cobertura de tests mínima (1 smoke test). Sin tests para guards, interceptor, servicios HTTP ni componentes críticos (resultados, semáforo, bbox-overlay).
- Sidebar (`shell.ts`) no oculta los links de "Gestión" (Reportes/Usuarios/Panel) según el rol del usuario; solo el `roleGuard` en la ruta bloquea el acceso real. Hoy es invisible porque solo existe el rol `analyst`, pero se volverá una inconsistencia de UX visible en cuanto el backend emita otros roles.
- Botones decorativos en pantalla de resultados ("Guardar borrador", "Compartir", "Generar reporte PDF", "Validar coincidencia/Solicitar revisión/Descartar", textarea de observaciones) no tienen lógica ni endpoint — quedaron del diseño visual, intencionalmente inertes para no inventar comportamiento no contractual.
- No hay manejo proactivo de expiración de sesión (`expiresAt` del login no se usa); el logout solo ocurre reactivo a un 401 real.
- `roleGuard` existe y funciona (redirige a `/upload`, no a `/login`, si el rol no califica) pero no hay todavía más de un rol real para probarlo end-to-end contra el backend.
- No existe `environment.production.ts` separado; build de producción reutiliza `apiUrl: '/api'`, lo cual asume un proxy/reverse-proxy en el despliegue final (ver §6).

**Supuestos:**
- `bbox` en píxeles de imagen original (confirmado contra datos reales).
- Fechas del backend son UTC aunque a veces lleguen sin sufijo `Z` tras re-lectura desde SQL Server (compensado en `parseApiDate`).
- Roles son strings opacos; no se asume una lista cerrada de valores en el frontend.

---

## 6. Qué falta para el despliegue en Azure

- No existe configuración de Azure Static Web Apps en el repo (sin `staticwebapp.config.json`, sin workflow de CI/CD en `.github/workflows`). Falta crearla.
- No hay `environment.production.ts` ni mecanismo de build-time para apuntar `apiUrl` a la URL real del backend desplegado — hoy todo asume `/api` relativo vía proxy, que solo existe en dev (`proxy.conf.json` no aplica en producción). Definir cómo se resuelve esto en Azure (reverse proxy en el Static Web App, variable de entorno de build, o dominio compartido con el backend).
- CORS: el backend debe agregar el dominio real del frontend desplegado (hoy CORS solo está resuelto en local vía proxy, según CLAUDE.md).
- No se ha probado el build de producción (`npm run build`) desplegado, solo localmente (364 KB de bundle inicial, sin warnings de tamaño).
- Pendiente decidir manejo de secretos/configuración de backend URL en el pipeline de Azure (no hay secretos en este repo, pero el deployment los necesitará).
- Pendiente probar el flujo completo (login → upload → resultados → historial → enrolar) contra el backend ya desplegado en Azure, no solo contra `localhost:5155`.
