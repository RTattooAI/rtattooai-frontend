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

Todas las rutas, salvo login, requieren header `Authorization: Bearer <jwt>`.

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
**Request:** `multipart/form-data` con `image`.
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
    "topSimilarity": 0.87
  }
]
```

### `GET /api/analyses/{id}`
**Response 200:** objeto Analysis completo.

### `POST /api/catalog`
Enrola un tatuaje al catálogo (imagen + banda).
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
  "validated": false
}
```

### `GET /api/catalog`
Lista entradas del catálogo (gestión y visibilidad). **Response 200:** arreglo de los objetos anteriores.

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
      "bbox": { "x": 120, "y": 340, "width": 200, "height": 180 },
      "confidence": 0.91,
      "verdict": "match",
      "matches": [
        { "catalogId": "tat_00123", "band": "Los Pulpos", "similarity": 0.88, "referenceImageUrl": null }
      ]
    }
  ],
  "disclaimer": "Resultado preliminar de apoyo. No constituye identificación definitiva y requiere validación de un analista."
}
```

`status`: `processing` | `completed` | `no_detection` | `failed`.
`verdict` por detección: `match` | `no_match` (rechazo open-set). La UI debe mostrar `no_match` como "sin coincidencia concluyente", no como ausencia de tatuaje.
`referenceImageUrl`: el servicio IA lo devuelve `null`. Lo **pobla el backend** mapeando `catalogId → CatalogItem.ImageBlobPath` (URL SAS) cuando la entrada exista en SQL. Sembrar las 25 imágenes base de la galería en Blob + CatalogItem es opcional pero recomendable para resultados visuales.

---

## D. Modelo de datos (EF Core / SQL Server)

- **User**: Id, Name, Email, PasswordHash, Role
- **Analysis**: Id, UserId (FK), ImageBlobPath, ThumbnailBlobPath, Status, ImageWidth, ImageHeight, ModelVersion, ProcessingMs, CreatedAt
- **Detection**: Id, AnalysisId (FK), BboxX, BboxY, BboxWidth, BboxHeight, Confidence, Verdict
- **Match**: Id, DetectionId (FK), CatalogId, Band, Similarity, ReferenceImageUrl
- **CatalogItem**: Id, CatalogId (id del lado de inferencia), Band, ImageBlobPath, Source, AddedByUserId (FK), AddedAt, Validated

**Persistencia del catálogo (crece en tiempo de ejecución):**
- Embeddings + ids → **galería persistente** (la galería DINOv2 del ML, `gallery_dinov2.npz`; vectores de 128 dim) en el servicio de inferencia, guardada en Azure Blob. Coseno por fuerza bruta es exacto a esta escala. Se carga al arrancar, se agrega al enrolar y se vuelve a guardar. Umbral/margen en `src/embedding/match_config.json`.
- Metadatos (banda, procedencia, autor, fecha, validación) → SQL Server, para trazabilidad y auditoría.
- Concurrencia: enrolamiento es de baja frecuencia; last-write-wins sobre el índice persistido es aceptable para la demo.
- Escala de producción (narrativa de tesis, no se construye ahora): Azure AI Search vectorial o pgvector.
