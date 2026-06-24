# RTattooAI — Frontend (Angular)

## Contexto
Herramienta web de APOYO para la PNP. NO es identificación definitiva. La UI debe
mostrar SIEMPRE, de forma visible, que el resultado es preliminar y requiere
validación humana (campo `disclaimer` del backend).

## Diseño
El diseño visual ya existe en Claude Design. Implementa las pantallas para que
coincidan con ese diseño. Si una pantalla no está diseñada, construye una versión
limpia y funcional sin inventar complejidad.

## Versiones (fijas)
- Angular 21 (LTS, estable). Componentes standalone, signals, zoneless por defecto.
- Node 22 LTS para build local y en Static Web Apps.
- TypeScript: la versión que empareje el CLI de Angular 21; no forzar otra.

## Estructura (anticipa el backlog; ver RTattooAI_FRONTEND_PLAN.md)
- core/: auth (auth.service, auth.guard, role.guard, jwt.interceptor), api/, models/ (espejo del contrato, camelCase).
- features Must: auth/login, analysis/upload, analysis/results, history, catalog/enroll.
- features futuras como rutas lazy ya declaradas y gateadas por rol: reports/ (HU-07),
  admin/users (HU-09), admin/dashboard (HU-10). No se implementan ahora, pero la ruta y el guard existen.
- shared/components: disclaimer-banner, confidence-semaforo, bbox-overlay, image-dropzone.
- Role guard desde el día 1 aunque hoy solo exista un rol, para que el RBAC futuro solo se "active".
- La vista de resultados distingue `verdict`: `match` muestra la banda con semáforo;
  `no_match` se muestra como "sin coincidencia concluyente", nunca como certeza.

## Contrato
Consume el backend REAL (ya funcional) según API_CONTRACT.md (secciones B/C), JSON en camelCase.
- `thumbnailUrl` puede venir `null` en el historial → usar placeholder.
- bbox: el contrato define píxeles; verifica que el JSON real venga en píxeles antes de escalar.
- Imágenes JPG/PNG en esta fase (WEBP es posterior).
- Para desarrollo usa `proxy.conf.json` (`/api` → URL local del backend) para evitar CORS;
  el backend agregará CORS para el dominio del frontend en el despliegue.

## Convenciones
- Componentes standalone, tipado estricto.
- Interceptor que agrega el JWT y maneja 401 redirigiendo a login.
- URL del backend por environment (no hardcodear).
- Las cajas (bbox) se dibujan escalando de píxeles de imagen original al tamaño renderizado.

## Reglas de trabajo
- Ramas feature/*, nunca commits directos a main.
- Sin atribución ni co-autoría de Claude en commits.

## Definición de "terminado"
Login → upload → resultados → historial funcionan contra el backend real (o mock
que cumple el contrato), con el disclaimer siempre visible.