# Separación de analistas Magali/Victoria — Diseño

Fecha: 2026-08-24

## Contexto

`index.html` es una app single-file (HTML+CSS+JS embebido, sin build, sin
dependencias más allá de Leaflet vía CDN) que gestiona un plan de acción
comercial: comercios con ubicación, estado, observaciones, etc., mostrados en
un mapa Leaflet acotado al microcentro de Paraná. Los datos viven en
`localStorage` bajo la clave `federar_plan_comercial_v1` como un array plano
de objetos `shop`. Hoy existe un campo de texto libre `analyst` por comercio
y un filtro de texto libre sobre ese campo, pero no hay ninguna noción
estructurada de "analista" ni separación de datos.

## Objetivo

Introducir dos analistas fijas y mutuamente excluyentes — **Magali** y
**Victoria** — de forma que toda la información comercial (comercios,
markers, métricas, filtros) quede completamente separada por analista,
sin duplicar lógica ni romper funcionalidad existente, y preservando los
datos ya guardados en `localStorage` vía una migración segura e idempotente.

## Decisiones de diseño

### 1. Modelo de analistas

```js
const ANALYSTS = {
  magali:   { id: "magali",   name: "Magali" },
  victoria: { id: "victoria", name: "Victoria" }
};
```

Estructura centralizada, fácil de extender (Objetivo 24: campos futuros
como `assignedZone` se agregan acá sin tocar el resto del código).

### 2. Storage y migración v1 → v2

Nueva clave `federar_plan_comercial_v2`:

```js
{
  version: 2,
  analysts: {
    magali:   { shops: [...] },
    victoria: { shops: [...] }
  }
}
```

La clave vieja `federar_plan_comercial_v1` **se conserva intacta siempre**
como respaldo; nunca se borra ni se sobreescribe.

Reglas de migración (idempotente y robusta):

- Se ejecuta **solo si** `federar_plan_comercial_v2` no existe todavía en
  `localStorage`. Su sola presencia es la marca de "ya migrado" — no se
  necesita un flag separado.
- Se valida que el contenido parseado de `federar_plan_comercial_v1` sea
  realmente un array (`Array.isArray`) antes de usarlo. Si no lo es, se
  trata como ausente.
- Si `v1` está ausente, corrupto (JSON inválido) o no es un array, se crea
  igual una `v2` válida con `magali.shops = []` y `victoria.shops = []` —
  la app nunca debe romperse por esto.
- Si `v1` es un array válido, su contenido pasa completo a
  `analysts.magali.shops` (analista por defecto para datos históricos sin
  dueño) y `victoria.shops` arranca vacío.
- Tras migrar, se muestra una única vez un aviso descartable en la UI:
  *"Se migraron N comercios existentes a la analista Magali (compatibilidad
  con datos previos)."* — controlado por una clave separada
  `federar_migration_notice_shown` para no repetirse en cargas futuras.

### 3. Analista activa

- Persistida en `localStorage` bajo una clave propia
  (`federar_active_analyst`).
- **Validación al cargar:** si el valor almacenado no es exactamente
  `"magali"` o `"victoria"` (ausente, corrupto, valor arbitrario), se usa
  `"magali"` como fallback seguro. Nunca se confía ciegamente en el valor
  guardado.

### 4. Campo "Analista" existente → eliminado como texto libre

El input "Analista responsable" del formulario y el filtro de texto
"Analista" de la sidebar se eliminan. El dueño de un comercio pasa a ser
implícito: la analista activa en el momento de guardarlo. Los shops
migrados desde v1 conservan su campo `analyst` viejo en el objeto (dato
inerte, no se lee ni se muestra) — no se borra por prolijidad, no se usa
por diseño.

### 5. Campo "Zona" (nuevo, opcional)

Se agrega un input opcional `zone` al formulario (puede quedar vacío). No
es obligatorio ni retroactivo. El filtro de zona busca coincidencia parcial
insensible a mayúsculas/espacios en `zone`, y si `zone` está vacío hace
fallback a buscar en `address`.

### 6. Arquitectura de estado y filtrado (única, sin duplicar por analista)

```js
state = {
  activeAnalyst: 'magali' | 'victoria',          // persistido
  filtersByAnalyst: { magali: {...}, victoria: {...} }  // solo en memoria (sesión)
}

getActiveAnalyst()
getActiveShops()        // shops de la analista activa únicamente
getCurrentFilters()      // filtersByAnalyst[activeAnalyst]
applyFilters(shop, filters)
renderAll()              // renderStats + renderList + refreshMarkers
```

`applyFilters` centraliza la lógica en un objeto de "matchers" combinados
con AND:

```js
const filterMatchers = {
  search:    (shop, value) => ...,
  zone:      (shop, value) => ...,
  status:    (shop, value) => ...,
  dateRange: (shop, { from, to }) => matchesDateRange(shop.visitDate, from, to)
};
function applyFilters(shop, filters) {
  return Object.entries(filterMatchers).every(([key, fn]) => fn(shop, filters[key]));
}
```

Agregar un filtro nuevo a futuro (Objetivo 21) es sumar una entrada al
objeto `filterMatchers`, sin tocar el resto de la app.

Los filtros de cada analista se conservan en memoria (`filtersByAnalyst`)
durante la sesión; no se persisten en `localStorage` (no es requisito).

### 7. Rango Desde/Hasta reutilizable

```js
function inRange(value, min, max) { ... } // numérico genérico, ambos extremos inclusive
function matchesDateRange(dateStr, from, to) { ... } // convierte a epoch y delega en inRange
```

Diseñado para reutilizarse a futuro con filtros numéricos (monto, cantidad,
distancia) sin reescribir la lógica de comparación.

Comportamiento con `visitDate` vacío: si hay un filtro de fecha activo
(`from` y/o `to`), el comercio sin fecha queda **excluido** — no se puede
afirmar que cae dentro del rango. Sin filtro de fecha activo, se incluye
normalmente. Este comportamiento queda documentado en el código.

### 8. Markers

Se reemplaza el `Map` manual + loop `removeLayer` por `L.layerGroup()`
agregado al mapa una vez; `markersLayer.clearLayers()` antes de cada
render evita markers cruzados o duplicados. Se mantiene un índice
`id → marker` en paralelo para poder centrar/abrir popup desde el listado.

### 9. Autoajuste de mapa

- 0 resultados: no se llama `fitBounds`; se muestra el mensaje "No se
  encontraron comercios con estos filtros." y se mantiene la última vista
  válida del mapa (no se rompe ni se resetea a un estado inválido).
- 1 resultado: `setView` centrado en ese comercio, zoom fijo razonable
  (16, dentro del rango 15–17 pedido).
- 2+ resultados: `fitBounds` con padding, igual que el comportamiento
  actual de carga inicial.

### 10. UI

- Selector segmentado "Magali | Victoria" en el header, mismo lenguaje
  visual (paleta, radios, sombras) que los botones existentes.
- Texto visible "Analista activa: Magali" / "Analista activa: Victoria".
- Card de filtros ampliada: búsqueda textual, Zona, Estado (ya existe),
  Desde, Hasta, contador de resultados, badges de filtros activos, botón
  "Limpiar filtros" (no cambia la analista activa).
- En pantallas ≤600px la card de filtros queda colapsada detrás de un
  botón "Mostrar filtros" para no ocupar toda la pantalla.

## Fuera de alcance (explícitamente, por pedido del usuario)

- Clustering de markers (Leaflet.markercluster) — solo dejar la
  arquitectura lista para incorporarlo después.
- Nuevos filtros más allá de los pedidos (localidad, barrio, prioridad,
  etc.) — solo dejar `filterMatchers` preparado para sumarlos.
- Persistencia de filtros en `localStorage` — alcanza con memoria de
  sesión.
- Frameworks, backend, autenticación, librerías nuevas.
- Datos ficticios permanentes en el repo (las pruebas manuales se hacen
  con datos temporales, no se commitean).

## Riesgos / edge cases cubiertos

- `localStorage` con `v1` corrupto o ausente → migración crea `v2` vacía
  sin romper la app.
- `activeAnalyst` corrupto o con valor ajeno → fallback a `magali`.
- Comercios sin coordenadas → no se renderiza su marker pero no bloquean
  el render del resto (comportamiento ya existente, se preserva).
- Comercios sin `visitDate`, `zone`, `address`, `notes` → filtros y
  búsqueda deben tolerarlo sin excepciones.
