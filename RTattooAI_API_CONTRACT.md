# RTattooAI — Contrato de la API (v1, CONGELADO el Día 1)

Este contrato es la fuente de verdad para los tres repos. El frontend trabaja contra mocks que lo cumplen mientras el backend se construye. **Coordenadas de bbox en píxeles, origen arriba-izquierda, formato `{x, y, width, height}` en todos lados.**

---

## A. Servicio de inferencia (FastAPI) — INTERNO

Solo lo consume el backend. No expuesto a internet directamente.

### `GET /health`
```json
{ "status": "ok", "model_version": "yolov8m + dinov2-vits14 + head-v1" }
```

### `POST /identify`
Detección (YOLO) + identificación (DINOv2 + cabeza afinada + galería) en una sola llamada. **La "galería" del modelo es el "catálogo" del backend/UI: mismo concepto, dos nombres.**
**Request:** `multipart/form-data`
- `image`: archivo (jpg/png)
- `top_k`: entero opcional (default 5)

**Response 200:**
```json
{
  "image_width": 1080,
  "image_height": 1920,
  "model_version": "yolov8m + dinov2-vits14 + head-v1",
  "processing_ms": 540,
  "threshold": 0.55,
  "margin": 0.05,
  "detections": [
    {
      "bbox": { "x": 120, "y": 340, "width": 200, "height": 180 },
      "confidence": 0.91,
      "verdict": "match",
      "matches": [
        {
          "catalog_id": "tat_00123",
          "band": "Los Pulpos",
          "similarity": 0.88,
          "reference_image_url": null
        }
      ]
    }
  ]
}
```
- `detections` vacío ⇒ no se detectó tatuaje (el backend lo traduce a estado `no_detection`).
- `verdict` por detección (rechazo open-set): `"match"` si la mejor similitud ≥ `threshold` y el margen sobre la 2.ª banda ≥ `margin`; en caso contrario `"no_match"` ("no pertenece a ninguna banda conocida"). En `no_match` se devuelven igual las coincidencias más cercanas, marcadas como no concluyentes.
- `similarity` y `confidence` en rango 0–1. `threshold` y `margin` provienen de `src/embedding/match_config.json`.

### `POST /enroll`
Agrega un tatuaje al catálogo (crecimiento en tiempo de ejecución).
**Request:** `multipart/form-data`
- `image`: archivo (jpg/png)
- `band`: string (banda asociada)

**Response 200:**
```json
{ "catalog_id": "tat_00890", "band": "Los Pulpos" }
```
El servicio genera vistas degradadas, calcula los embeddings, los agrega a la galería persistente (índice en Blob) y la vuelve a guardar. Búsquedas posteriores ya incluyen el nuevo tatuaje.

---

## B. Backend (ASP.NET Core) — PÚBLICO (consumido por el frontend)

Todas las rutas, salvo login, requieren header `Authorization: Bearer <jwt>`. Algunas además requieren un rol específico (`Authorize(Roles=...)` en el backend, no solo una restricción de UI) — se indica en cada endpoint cuando aplica. Roles existentes: `analyst`, `supervisor`, `admin`.

### `POST /api/auth/login`
**Request:**
```json
{ "email": "analista@pnp.gob.pe", "password": "..." }
```
**Response 200:**
```json
{
  "token": "eyJhbGci...",
  "expiresAt": "2026-06-24T10:00:00Z",
  "user": { "id": "guid", "name": "Analista 1", "role": "analyst" }
}
```
**401** si las credenciales no son válidas.

### `POST /api/analyses`
**Request:** `multipart/form-data` con `image` y, opcionalmente, `personName`, `documentId`, `notes` (datos de la persona/detenido analizado, para ubicar el expediente más adelante; ninguno se valida ni es obligatorio).
**Response 201:** objeto Analysis (ver esquema abajo). El backend ejecuta el flujo completo (Blob → `/identify` del servicio IA → persistencia) y responde con `status: "completed"`, `"no_detection"` o `"failed"`.

### `GET /api/analyses`
Historial del usuario.
**Response 200:**
```json
[
  {
    "id": "guid",
    "thumbnailUrl": "https://.../thumb.jpg",
    "status": "completed",
    "createdAt": "2026-06-23T14:00:00Z",
    "topBand": "Los Pulpos",
    "topSimilarity": 0.87,
    "personName": null,
    "documentId": null
  }
]
```

### `GET /api/analyses/{id}`
**Response 200:** objeto Analysis completo.

### `PATCH /api/analyses/{id}/detections/{detectionId}/validation`
Registra la validación pericial de un perito/analista sobre una detección puntual (no sobre el análisis completo): confirma la coincidencia, pide una segunda revisión, o la descarta. Reemplaza el estado anterior si ya existía (no hay historial de versiones).
**Request:**
```json
{ "status": "validated", "notes": "Coincide con el tatuaje del expediente CON-..." }
```
`status` ∈ `"validated" | "review" | "dismissed"`. `notes` es opcional (texto libre del perito, se incluye en el reporte PDF).
**Response 200:** `Detection` actualizado (ver esquema abajo), con `validationStatus`/`validationNotes` reflejando el cambio.
**404** si el análisis o la detección no existen o no pertenecen al usuario. **400** si `status` no es uno de los valores permitidos.

### `POST /api/analyses/{id}/enroll`
Agrega al catálogo una o más detecciones del análisis, elegidas por el analista (el frontend pre-marca las de `confidence` alta, pero la selección final es manual). El acto de seleccionar y enviar es la validación: no existe un endpoint de "validar" separado.
**Request:**
```json
{ "detectionIds": ["guid-deteccion-1", "guid-deteccion-2"] }
```
Flujo: por cada `detectionId` el backend recorta la imagen original por su `bbox` → `POST /enroll` del servicio IA (sin `band`) → crea una fila en `TatuajeCatalogo` con `BandaId = null` y `ConsultaOrigenId` apuntando a este análisis (para poder volver al caso original cuando se le asigne banda más adelante).
**Response 200:** arreglo de `CatalogItem` (ver abajo), uno por cada detección enrolada.
**404** si el análisis no existe o no pertenece al usuario. **400** si `detectionIds` está vacío o no corresponde a detecciones de este análisis.

### `POST /api/catalog`
Enrola un tatuaje al catálogo (imagen + banda), carga manual fuera del flujo de análisis.
**Request:** `multipart/form-data` con `image` y `band`.
Flujo: Blob → `POST /enroll` del servicio IA → persiste metadatos en SQL.
**Response 201:**
```json
{
  "catalogId": "tat_00890",
  "band": "Los Pulpos",
  "imageUrl": "https://.../cat_00890.jpg",
  "source": "carga_manual",
  "addedBy": "guid-user",
  "addedAt": "2026-06-23T15:00:00Z",
  "validated": false,
  "originAnalysisId": null
}
```
`band` es `null` cuando el tatuaje todavía no tiene banda confirmada (p. ej. cuando proviene de `POST /api/analyses/{id}/enroll`, `source: "deteccion_analisis"`). `originAnalysisId` enlaza al análisis de origen en ese caso; es `null` en cargas manuales.

### `GET /api/catalog`
Lista entradas del catálogo (gestión y visibilidad). **Response 200:** arreglo de los objetos anteriores.

### `PATCH /api/catalog/{catalogId}/band`
Asigna o confirma la banda de un tatuaje del catálogo que todavía no la tiene (`band: null`), típicamente uno enrolado vía `POST /api/analyses/{id}/enroll`. También puede usarse para corregir la banda de un tatuaje ya asignado.
**Request:**
```json
{ "band": "Los Pulpos" }
```
`catalogId` es el `catalogId` del tatuaje (p. ej. `tat_00026`), no un GUID interno. La banda es texto libre, igual que en `POST /api/catalog` (se busca o crea por nombre).
**Response 200:** `CatalogItem` actualizado (ver arriba).
**404** si `catalogId` no existe. **400** si `band` está vacío.

### `GET /api/users`
Lista las cuentas del sistema. **Requiere rol `admin`** (403 para cualquier otro rol).
**Response 200:**
```json
[
  { "id": "guid", "fullName": "Analista 1", "email": "analista@pnp.gob.pe", "role": "admin", "active": true, "createdAt": "2026-06-24T07:31:13Z" }
]
```
`role` ∈ `"analyst" | "supervisor" | "admin"`.

### `POST /api/users`
Crea una cuenta nueva. **Requiere rol `admin`**.
**Request:**
```json
{ "fullName": "Juana Pérez", "email": "juana@pnp.gob.pe", "password": "mínimo 8 caracteres", "role": "analyst" }
```
**Response 201:** objeto `User` (ver arriba). **400** si el correo ya existe, el rol no es válido, o la contraseña tiene menos de 8 caracteres.

### `PATCH /api/users/{id}/status`
Activa o desactiva una cuenta (un usuario inactivo no puede iniciar sesión). **Requiere rol `admin`**.
**Request:**
```json
{ "active": false }
```
**Response 200:** objeto `User` actualizado. **404** si `id` no existe.

---

## C. Esquema Analysis (respuesta del backend)

```json
{
  "id": "guid",
  "status": "completed",
  "imageUrl": "https://.../original.jpg",
  "thumbnailUrl": "https://.../thumb.jpg",
  "imageWidth": 1080,
  "imageHeight": 1920,
  "createdAt": "2026-06-23T14:00:00Z",
  "modelVersion": "yolov8m + dinov2-vits14 + head-v1",
  "processingMs": 540,
  "detections": [
    {
      "id": "guid-deteccion",
      "bbox": { "x": 120, "y": 340, "width": 200, "height": 180 },
      "confidence": 0.91,
      "verdict": "match",
      "matches": [
        { "catalogId": "tat_00123", "band": "Los Pulpos", "similarity": 0.88, "referenceImageUrl": null }
      ],
      "validationStatus": "pending",
      "validationNotes": null
    }
  ],
  "disclaimer": "Resultado preliminar de apoyo. No constituye identificación definitiva y requiere validación de un analista.",
  "personName": null,
  "documentId": null,
  "notes": null
}
```

`status`: `processing` | `completed` | `no_detection` | `failed`.
`detections[].id`: identificador estable de la detección, usado para seleccionar cuáles enrolar vía `POST /api/analyses/{id}/enroll`.
`verdict` por detección: `match` | `no_match` (rechazo open-set). La UI debe mostrar `no_match` como "sin coincidencia concluyente", no como ausencia de tatuaje.
`referenceImageUrl`: el servicio IA lo devuelve `null`. Lo **pobla el backend** mapeando `catalogId → CatalogItem.ImageBlobPath` (URL SAS) cuando la entrada exista en SQL. Sembrar las 25 imágenes base de la galería en Blob + CatalogItem es opcional pero recomendable para resultados visuales.
`personName`, `documentId`, `notes`: opcionales, capturados en `POST /api/analyses` para facilitar ubicar el expediente de un caso antiguo o recurrente; `null` cuando no se proporcionan.
`validationStatus`: `pending` | `validated` | `review` | `dismissed`. Empieza en `pending` y se actualiza vía `PATCH /api/analyses/{id}/detections/{detectionId}/validation`. `validationNotes`: observaciones del perito, `null` hasta que se registre alguna.

---

## D. Modelo de datos (EF Core / SQL Server)

- **User**: Id, Name, Email, PasswordHash, Role (`analyst` | `supervisor` | `admin`), Active
- **Analysis**: Id, UserId (FK), ImageBlobPath, ThumbnailBlobPath, Status, ImageWidth, ImageHeight, ModelVersion, ProcessingMs, CreatedAt, PersonName?, DocumentId?, Notes?
- **Detection**: Id, AnalysisId (FK), BboxX, BboxY, BboxWidth, BboxHeight, Confidence, Verdict, ValidationStatus (default `pending`), ValidationNotes?, ValidatedByUserId? (FK), ValidatedAt?
- **Match**: Id, DetectionId (FK), CatalogId, Band, Similarity, ReferenceImageUrl
- **CatalogItem**: Id, CatalogId (id del lado de inferencia), BandId? (FK nullable — `null` hasta que un analista confirme la banda), ImageBlobPath, Source, AddedByUserId (FK), AddedAt, Validated, OriginAnalysisId? (FK nullable hacia Analysis, cuando el tatuaje se enroló desde una detección en vez de carga manual)

`CatalogItem.BandId` y `Match.Band` usan convenciones distintas a propósito: `Match.Band` (snapshot histórico de una coincidencia, espejo del contrato del servicio IA) sigue siendo `string` no-nulo con `""` como sentinela de "sin banda". `CatalogItem.BandId` es una FK real a `BandaCriminal`; al ser nullable, `CatalogItemDto.Band` se serializa como `null` (no `""`) cuando no hay banda confirmada.

**Persistencia del catálogo (crece en tiempo de ejecución):**
- Embeddings + ids → **galería persistente** (la galería DINOv2 del ML, `gallery_dinov2.npz`; vectores de 128 dim) en el servicio de inferencia, guardada en Azure Blob. Coseno por fuerza bruta es exacto a esta escala. Se carga al arrancar, se agrega al enrolar y se vuelve a guardar. Umbral/margen en `src/embedding/match_config.json`.
- Metadatos (banda, procedencia, autor, fecha, validación) → SQL Server, para trazabilidad y auditoría.
- Concurrencia: enrolamiento es de baja frecuencia; last-write-wins sobre el índice persistido es aceptable para la demo.
- Escala de producción (narrativa de tesis, no se construye ahora): Azure AI Search vectorial o pgvector.

---

## E. Endpoints añadidos en el endurecimiento (setiembre 2026)

Incorporados al preparar la validación del OE4 y el despliegue en infraestructura propia. Detalle y motivación en `docs/RTattooAI_ENDURECIMIENTO.md`.

### `POST /api/analyses/{id}/retry`
Reprocesa un análisis en estado `failed` reutilizando la imagen ya almacenada.
**Response 200:** objeto `Analysis` actualizado.
**400** si el análisis no está en estado `failed` o no se pudo recuperar su imagen. **404** si no existe o no pertenece al usuario (los roles `supervisor` y `admin` pueden reintentar cualquiera).

### `GET /api/analyses?scope=all`
`scope=all` devuelve el historial de todos los analistas. Solo surte efecto con rol `supervisor` o `admin`; para el resto se ignora y se devuelve el historial propio. Los listados devuelven como máximo 200 registros, del más reciente al más antiguo.

### `GET /api/analyses/export?scope=all|mine`
Exporta una fila por detección en CSV (UTF-8 con BOM). **Requiere rol `supervisor` o `admin`.**
Columnas: `analisis_id, codigo, fecha_utc, analista, estado, tiempo_ms, version_modelo, persona, documento, deteccion_id, confianza, veredicto, banda_top1, similitud_top1, estado_validacion, observaciones, fecha_validacion_utc`.

### `GET /api/reviews`
Detecciones en estado `review` pendientes de segunda revisión. **Requiere rol `supervisor` o `admin`.**
**Response 200:**
```json
[
  {
    "analysisId": "guid",
    "detectionId": "guid",
    "thumbnailUrl": "/api/files/consultas/.../thumbnail.png?exp=...&sig=...",
    "confidence": 0.91,
    "verdict": "match",
    "topBand": "Los Pulpos",
    "topSimilarity": 0.88,
    "notes": "Requiere contraste con archivo fotográfico",
    "requestedBy": "Analista 1",
    "requestedAt": "2026-09-03T14:00:00Z",
    "personName": null,
    "documentId": null
  }
]
```

### `PATCH /api/catalog/{catalogId}/validation`
Confirma o revierte la validación de una entrada del catálogo. **Requiere rol `supervisor` o `admin`.**
**Request:** `{ "validated": true }`
**Response 200:** `CatalogItem` actualizado. **400** si se intenta validar una entrada sin banda asignada. **404** si el `catalogId` no existe.

### `GET /api/audit?limit=100`
Registro de auditoría, del más reciente al más antiguo (`limit` entre 1 y 500). **Requiere rol `admin`.**
**Response 200:**
```json
[
  {
    "id": "guid",
    "userId": "guid",
    "userEmail": "analista@pnp.gob.pe",
    "userRole": "analyst",
    "action": "POST /api/analyses",
    "resource": "id=guid",
    "statusCode": 201,
    "ipAddress": "190.0.0.1",
    "occurredAt": "2026-09-03T14:00:00Z"
  }
]
```

### `PATCH /api/users/{id}/password`
Restablece la contraseña de una cuenta. **Requiere rol `admin`.**
**Request:** `{ "password": "..." }` · **Response 200:** objeto `User`. **400** si no cumple la política. **404** si el usuario no existe.

### `POST /api/auth/change-password`
Cambio de contraseña del usuario autenticado. Limitado a 5 intentos por minuto y por IP.
**Request:** `{ "currentPassword": "...", "newPassword": "..." }`
**Response 204.** **400** si la contraseña actual no coincide o la nueva no cumple la política.

### `GET /api/files/{ruta}?exp={unix}&sig={hmac}`
Entrega las imágenes almacenadas. **No requiere token**: la autorización es la firma HMAC-SHA256 con caducidad que genera el backend, porque un `<img src>` no puede enviar cabeceras. Responde `404` de forma indistinta ante firma inválida, caducada, ruta no permitida o archivo inexistente.

### Cambios en endpoints existentes

- **Control de acceso.** `POST /api/catalog` y `PATCH /api/catalog/{catalogId}/band` pasan a requerir rol `supervisor` o `admin`. `GET /api/catalog` sigue disponible para cualquier usuario autenticado, y `POST /api/analyses/{id}/enroll` continúa disponible para el analista (crea entradas sin banda).
- **Alcance por rol.** `GET /api/analyses/{id}` y `PATCH .../validation` permiten a `supervisor` y `admin` operar sobre análisis de cualquier analista; para el rol `analyst` el comportamiento no cambia (404 ante un análisis ajeno).
- **Validación de imágenes.** `POST /api/analyses` y `POST /api/catalog` verifican la firma real del archivo (JPG/PNG) y un máximo de 80 MP, además del tipo declarado y los 10 MB. El tipo detectado sustituye al declarado.
- **Sesiones.** Un token de una cuenta desactivada deja de ser válido de inmediato (401), sin esperar a su caducidad.
- **Política de contraseñas.** Mínimo 8 caracteres combinando letras y números; se rechazan contraseñas comunes o que contengan el correo del usuario.
- **URL de imágenes.** `imageUrl`, `thumbnailUrl` y `referenceImageUrl` son rutas relativas firmadas (`/api/files/...`) cuando el almacenamiento es local. Con `Storage:Provider=azure` se mantiene el comportamiento anterior con SAS.
- **Límite de peticiones.** 240 por minuto y por IP en toda la API; 5 por minuto en inicio de sesión y cambio de contraseña. Al excederlo se responde 429.

---

## F. Análisis con varias imágenes y captura por cámara (setiembre 2026)

Un caso real necesita varias tomas del mismo detenido: distintas zonas del cuerpo o distintos ángulos del mismo tatuaje. El análisis pasa a agrupar todas esas fotografías, cada una con su propio procesamiento.

### Cambios en `POST /api/analyses`

**Request:** `multipart/form-data`
- `images`: el campo se repite una vez por fotografía (entre 1 y 10). Se sigue aceptando `image` como nombre alternativo, por compatibilidad con la versión de una sola imagen.
- `source`: `archivo` (por defecto) o `camara`, según de dónde provengan las tomas.
- `personName`, `documentId`, `notes`: sin cambios.

Formatos admitidos: **JPG, PNG y WEBP** (RF-01), hasta 10 MB y 80 MP por imagen. Si alguna imagen es inválida o se superan las 10, se responde **400** y **no se crea el análisis**: nunca queda un caso a medias.

### Cambios en el esquema `Analysis`

```json
{
  "id": "guid",
  "status": "completed",
  "imageUrl": "/api/files/consultas/.../original.jpg?exp=...&sig=...",
  "thumbnailUrl": "/api/files/...",
  "imageWidth": 1080,
  "imageHeight": 1920,
  "images": [
    {
      "id": "guid-imagen",
      "order": 0,
      "imageUrl": "/api/files/...",
      "thumbnailUrl": "/api/files/...",
      "width": 1080,
      "height": 1920,
      "status": "completed",
      "modelVersion": "yolov8m + dinov2-vits14 + head-v1",
      "processingMs": 980,
      "source": "archivo"
    }
  ],
  "detections": [
    { "id": "guid-deteccion", "imageId": "guid-imagen", "bbox": { "x": 120, "y": 340, "width": 200, "height": 180 }, "...": "..." }
  ]
}
```

- `images[]`: una entrada por fotografía, ordenada por `order`. `status` por imagen: `completed` | `no_detection` | `failed`. `source`: `archivo` | `camara`.
- `detections[].imageId`: **nuevo y obligatorio**. Indica en qué fotografía aparece la detección; sin él no se puede dibujar la caja ni recortar el enrolamiento sobre la imagen correcta.
- `imageUrl`, `thumbnailUrl`, `imageWidth` y `imageHeight` del nivel raíz son la **portada**: una copia de la primera imagen. Se conservan por compatibilidad; el detalle está en `images`.
- `status` del análisis agrega el de sus imágenes: `completed` si alguna tiene detecciones, `no_detection` si ninguna las tiene pero alguna se procesó, `failed` solo si todas fallaron.

### Cambios en `GET /api/analyses` (historial)

Cada elemento incorpora `imageCount` (entero ≥ 1), el número de fotografías del análisis.

### Cambios en `POST /api/analyses/{id}/retry`

Reprocesa **solo las imágenes en estado `failed`**, reutilizando las ya almacenadas. **400** si ninguna imagen del análisis falló.

### `POST /api/analyses/preview`

Modo asistido en vivo. Analiza un fotograma y responde **sin persistir absolutamente nada**: ni consulta, ni imagen almacenada, ni registro de auditoría. Es una ayuda de encuadre, no una consulta con valor probatorio.

**Request:** `multipart/form-data` con `image` (un fotograma; el cliente lo envía reducido).
**Response 200:**
```json
{
  "imageWidth": 640,
  "imageHeight": 480,
  "modelVersion": "yolov8m + dinov2-vits14 + head-v1",
  "processingMs": 984,
  "detections": [
    {
      "bbox": { "x": 120, "y": 340, "width": 200, "height": 180 },
      "confidence": 0.91,
      "verdict": "match",
      "matches": [ { "catalogId": "tat_00123", "band": "Los Pulpos", "similarity": 0.88, "referenceImageUrl": null } ]
    }
  ],
  "disclaimer": "Vista asistida en vivo: resultado provisional que NO queda registrado. …"
}
```
Las detecciones **no tienen identificador** porque no existen en la base de datos: no pueden validarse ni enrolarse. **503** si el servicio de inferencia no responde, para que el cliente omita ese fotograma y siga.

**Límite de peticiones:** política propia de 90 por minuto y por IP, más alta que la de una acción normal porque el cliente la invoca en bucle. Con una latencia de inferencia cercana a un segundo, el ritmo real ronda un fotograma por segundo.

### Cabeceras

`Permissions-Policy` pasa de `camera=()` a **`camera=(self)`** en la API y en nginx: con `camera=()` el navegador bloquea `getUserMedia` aunque el usuario conceda el permiso. El micrófono y la ubicación siguen bloqueados. La CSP del frontend añade `media-src 'self' blob:` para el visor de la cámara.

---

## G. Bandas, catálogo descriptivo, paginación y versionado de modelos (setiembre 2026)

Cierra los requisitos funcionales que quedaban abiertos en TP1: RF-02, RF-09, RF-10, RF-12, RF-13, RF-16 y RF-17.

### `GET /info` (servicio de inferencia, INTERNO)

Composición exacta del modelo cargado. La consume el backend para versionar (RF-16).

```json
{
  "model_version": "yolov8m + dinov2-vits14 + head-v1",
  "detector": "yolov8m_best.onnx",
  "embedder": "dinov2-vits14",
  "head": "embed_head.pt",
  "embedding_dim": 256,
  "threshold": 0.55,
  "margin": 0.05,
  "det_conf": 0.25,
  "det_iou": 0.45,
  "gallery_size": 425,
  "gallery_identities": 85,
  "gallery_bands": 5
}
```

### `GET /api/bands` · `POST` · `PUT /{id}` · `PATCH /{id}/status` · `DELETE /{id}`

Mantenimiento de bandas criminales (RF-10). **Lectura** para cualquier usuario autenticado: el analista necesita conocer las bandas para trabajar. **Escritura** para `supervisor` y `admin`.

```json
{
  "id": "0f8a…",
  "name": "Los Pulpos",
  "alias": "Pulpos",
  "region": "La Libertad",
  "dangerLevel": "alto",
  "description": "…",
  "active": true,
  "tattooCount": 7,
  "createdAt": "2026-09-09T12:00:00Z"
}
```

- `dangerLevel` admite únicamente `bajo`, `medio` o `alto`, o `null`. Otro valor devuelve **400**. Se limita a tres para que el dato siga siendo agregable en el panel.
- `name` es único; un duplicado devuelve **400**.
- `DELETE` responde **409** si la banda tiene tatuajes en el catálogo: borrarla dejaría huérfanas entradas que sustentan resultados ya emitidos. Se desactiva con `PATCH /{id}/status`.

### `GET /api/catalog` — filtros (RF-09)

Parámetros opcionales: `band`, `category`, `bodyLocation`, `tag`, `validated` (`true`/`false`) y `q` (código, nombre, descripción o banda). Sin parámetros devuelve el catálogo completo, como antes.

El filtro `tag` compara **etiquetas completas**, no subcadenas: con `LIKE`, `león` devolvería también `leones`.

### `GET /api/catalog/facets`

Valores que existen realmente en el catálogo, para que el cliente no ofrezca filtros que no devuelven nada.

```json
{ "bands": ["Los Pulpos"], "categories": ["Símbolo"], "bodyLocations": ["Antebrazo"], "tags": ["corona", "puntas"] }
```

### `PATCH /api/catalog/{catalogId}` (supervisor/admin)

Campos descriptivos de una entrada. **No incluye la imagen**: el vector de la galería se calculó a partir de ella, así que sustituirla dejaría el registro describiendo algo distinto de lo que el sistema compara.

```json
{ "name": "Corona de tres puntas", "description": "…", "category": "Símbolo", "bodyLocation": "Antebrazo derecho", "tags": "corona, puntas" }
```

`tags` viaja como texto separado por comas y se devuelve normalizado como arreglo, en minúsculas y sin repetidos (máximo 12 etiquetas de 30 caracteres).

### Cambios en `POST /api/catalog`

El formulario acepta además `name`, `description`, `category`, `bodyLocation` y `tags`. Un campo ausente se guarda vacío; el resto del contrato no cambia.

### Cambios en el esquema `CatalogItem`

Se añaden `bandId`, `name`, `description`, `category`, `bodyLocation` y `tags` (arreglo de cadenas). Los campos anteriores se mantienen.

### `GET /api/analyses` — paginación y filtros (RF-13)

Parámetros: `scope`, `from`, `to` (fechas `yyyy-MM-dd`), `status`, `q`, `page` y `pageSize`.

**La respuesta deja de ser un arreglo** y pasa a ser una página:

```json
{ "items": [ /* AnalysisListItem */ ], "total": 137, "page": 2, "pageSize": 25, "totalPages": 6 }
```

- El rango se interpreta por días completos: `to=2026-09-03` incluye todo el día 3.
- `pageSize` se acota a 25 por defecto y a 100 como máximo: una sola petición no puede arrastrar la tabla entera.
- Un `status` desconocido se ignora en vez de fallar; un filtro mal escrito no debe impedir ver el historial.
- Desaparece el tope fijo de 200 registros.

`GET /api/analyses/export` acepta los mismos filtros, de modo que lo exportado coincide con lo que se está viendo.

### `GET /api/audit` — paginación y filtros (RF-15)

Parámetros: `from`, `to`, `action`, `userEmail`, `page`, `pageSize` (50 por defecto, 200 máximo). Devuelve la misma forma de página que el historial. Sustituye al anterior `?limit=`.

### `GET /api/audit/export` (admin) y `GET /api/dashboard/metrics/export` (supervisor/admin)

CSV con BOM UTF-8. RF-17.

- El de auditoría acepta los mismos filtros que `GET /api/audit` y está acotado a 50 000 filas: el registro crece sin límite por diseño (RNF-08 pide un año de retención).
- El de métricas usa formato largo — `seccion,metrica,valor` — para que la serie diaria y las bandas más frecuentes quepan en el mismo archivo que los totales.

En todas las exportaciones, un texto libre que empiece por `=`, `+`, `-` o `@` se antepone con un apóstrofo, para que Excel no lo interprete como fórmula.

### `GET /api/models` (supervisor/admin) · `PUT /api/models` (admin)

Inventario de versiones del modelo (RF-16).

```json
{
  "runtime": { /* misma forma que GET /info del servicio de inferencia */ },
  "versions": [
    {
      "id": "…", "identifier": "yolov8m + dinov2-vits14 + head-v1",
      "detector": "yolov8m_best.onnx", "embedder": "dinov2-vits14", "head": "embed_head.pt",
      "map50": 0.915, "top1": 0.982, "top5": 0.994,
      "threshold": 0.55, "margin": 0.05,
      "source": "OE3 — reports/metrics.md", "notes": "…",
      "active": true, "analysesCount": 31, "registeredAt": "2026-09-09T12:00:00Z"
    }
  ]
}
```

- `runtime` es `null` si el servicio de inferencia no responde; el histórico se devuelve igualmente.
- Una versión que el servicio reporte y no esté registrada **se registra sola**: de otro modo habría consultas atribuidas a una versión de la que no consta nada.
- `PUT` da de alta o corrige las métricas de una versión, identificada por su `identifier`. Un campo omitido conserva su valor anterior.

### `POST /api/users` y `PUT /api/users/{id}` — dependencia policial (RF-12)

`POST` acepta además `dependency`. `PUT` edita `fullName`, `role` y `dependency`; no toca la contraseña ni el estado, que tienen su propio endpoint. `UserListItem` incorpora `dependency` y `lastAccessAt`.

### Almacenamiento cifrado (RNF-06)

Transparente para el contrato: `GET /api/files/{ruta}` devuelve siempre la imagen en claro. En disco, los archivos escritos con `Storage:EncryptionKey` configurada empiezan por la cabecera `RTAI1` y están cifrados con AES-256-GCM. Los archivos anteriores a la activación se siguen leyendo.

### Ajuste de imagen (RF-02)

No añade ningún endpoint: el recorte, el giro y la corrección de brillo y contraste ocurren en el navegador y lo que llega a `POST /api/analyses` es ya la imagen ajustada. Es deliberado — lo que se archiva en el expediente debe ser exactamente lo que se analizó, sin reinterpretación del servidor.

---

## H. Tres clases de coincidencia y calibración del modelo (setiembre 2026)

Cambios derivados de la calibración con datos reales. El detalle de las mediciones está en `docs/RTattooAI_CALIBRACION_MODELO.md`.

### `verdict` admite un valor más

```
match | review | no_match
```

`review` es la franja intermedia: hay un candidato razonable pero por debajo del umbral con el que el sistema sostiene una coincidencia. Es el caso del tatuaje gastado, frecuente en la práctica. Presentarlo como `no_match` pierde información útil; presentarlo como `match` afirma algo que el sistema no puede sostener.

El backend lo persiste como texto, de modo que el valor nuevo no requiere migración. **Un veredicto que el backend no reconozca se trata como `no_match`**: ante algo que no entiende, el sistema debe callar antes que afirmar.

### `DetectionDto` incorpora `matchType`

Ortogonal al veredicto: dice *qué clase de cosa* coincidió, no *si* coincidió.

| Valor | Significado |
|---|---|
| `band` | Coincide con una entrada del catálogo atribuida a una banda |
| `unclassified` | Coincide con una entrada **sin banda asignada**. El sistema ya había visto ese tatuaje en otro caso, pero nadie ha determinado a qué corresponde. **No es una atribución de pertenencia** y no debe presentarse como tal |
| `review` | Candidato por debajo del umbral firme |
| `none` | Nada por encima del umbral |

`unclassified` existe porque el enrolamiento desde un análisis crea entradas sin banda: al reencontrarlas, el campo `band` de la coincidencia viaja vacío. Antes eso se veía en el historial igual que "sin coincidencia" y en resultados como una coincidencia con banda en blanco.

En `AnalysisSummaryDto`, `topBand` devuelve **"Sin clasificar"** en ese caso, en lugar de una cadena vacía.

### `POST /identify` (servicio de inferencia) devuelve además `review_threshold`

```json
{ "threshold": 0.70, "margin": 0.0, "review_threshold": 0.55, "...": "..." }
```

Los umbrales viajan con la respuesta para que el cliente no tenga que suponerlos. Están **calibrados para el tamaño actual de la galería** (25 identidades) y hay que recalibrarlos cuando crezca: está medido que al 5 % de falsos positivos hacen falta 0.665 con 50 identidades y 0.89 con 400.

### `GET /info` (servicio de inferencia) añade tres campos

```json
{
  "review_threshold": 0.55,
  "calibrated_for_identities": 25,
  "gallery_warning": null,
  "calibration_warning": null
}
```

- `gallery_warning`: la galería no corresponde a la cabeza cargada. Los vectores solo significan algo en el espacio que produce una cabeza concreta; con otra, el sistema **sigue respondiendo** con un candidato y un porcentaje calculados sobre ruido. El servicio se niega a dar esos resultados por buenos y avisa también en el arranque.
- `calibration_warning`: la galería creció muy por encima del tamaño con el que se calibraron los umbrales, de modo que el sistema está aceptando más impostores de los previstos.

### `GET /api/catalog` añade el filtro `pendingBand`

`pendingBand=true` devuelve solo las entradas sin banda asignada: es la bandeja de trabajo de supervisión, el destino de lo que se enrola desde un análisis.

### Cambio de umbrales operativos

| Parámetro | Antes | Ahora | Motivo |
|---|---:|---:|---|
| `match_threshold` (ρ) | 0.55 | 0.70 | El valor anterior producía **43 % de falsos positivos** medido sobre datos reales |
| `match_margin` (δ) | 0.05 | 0.0 | Con el umbral recalibrado no aporta separación adicional |
| `review_threshold` | — | 0.55 | Franja intermedia, nueva |
| `det_conf` | 0.15 | 0.60 | Con 0.15 el detector marcaba algo en el **52 %** de las fotografías de personas sin tatuajes, sobre todo uñas decoradas |

La escala de similitud del frontend (`SIMILARITY_STRONG` / `SIMILARITY_THRESHOLD`) se mueve con estos valores: son los mismos cortes, no una escala aparte. Si se separan, la pantalla dice una cosa y el sistema hace otra.
