// El contenedor de produccion (nginx) hace reverse proxy de /api hacia el backend
// (mismo patron que proxy.conf.json en dev), asi el frontend nunca necesita conocer
// la URL absoluta del backend ni lidiar con CORS cross-origin.
export const environment = {
  apiUrl: '/api'
};
