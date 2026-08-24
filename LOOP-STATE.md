# LOOP-STATE — editor markdown + navegación por URL

Spec completa: `brain/resources/gtd-frontend-spec-y-loop-kickoff.md` en el vault.
Budget: 20 iteraciones (14 originales + ítem 0 de CI + 3 sumados el 24/08). Ejecución **secuencial**, un subagente Sonnet por vez.
Rama base: **`develop`**. PR con `--base develop` explícito.

**Loop protection:** 2 VERIFY fallidos seguidos en el mismo ítem → `BLOCKED`, seguir con el próximo.
Más de la mitad de los ítems `BLOCKED` → cortar la corrida.

**El VERIFY lo corre el orquestador, nunca el agente que acaba de escribir el código.** Se verifica
**actuando** (corriendo el comando), nunca leyendo. STATUS lleva output real, jamás "listo".

## Contrato compartido (todos los ítems lo respetan)

- **Arte, cero valores nuevos.** Solo los 24 tokens de `src/styles/app.css`. Ningún color, fuente ni
  radio inventado.
- **Nada hardcodeado.** Prefijo de rutas: `import.meta.env.BASE_URL`. La ruta del vault la manda el
  backend en `link.obsidianUri` — el frontend nunca la conoce.
- `src/lib/api.mock.ts` tiene `_contract: typeof RealApi`: **el build rompe si diverge de `api.ts`**.
- Repo público: sin nombres reales de personas en tests, sin español en el código, sin firma de
  Claude en commits.
- Commitear en el git de este proyecto. **Nunca tocar el repo de `claude-obsidian` desde acá.**

---

## Ítem 0 — CI de tests (va primero, es la red de todo lo demás)

### 0. Workflow que corre los tests en cada PR
- **TRIGGER:** siempre (antes que nada)
- **DO:** `.github/workflows/test.yml`. `on: pull_request: branches: [master, develop]`. Node 24,
  `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. Hoy este repo **no corre ningún test
  en CI** — solo tiene deploy a Pages y release manual.
- **VERIFY:** el workflow aparece en `gh workflow list` y corre verde en el PR de la corrida
- **STATUS:** pending

---

## B1 — navegación

### 1. `useRoute()` — History API, sin router
- **TRIGGER:** siempre (primer ítem)
- **DO:** `src/state/useRoute.ts`. Parsea `/`, `/<bucket>/<archivo>.md`,
  `/tag|proyecto|area|persona/<valor>`. Expone la ruta actual + `navigate(to, { modal? })`.
  `pushState` / `popstate`. Prefijo desde `import.meta.env.BASE_URL`. Sin `react-router`.
  La tarjeta se resuelve **por nombre de archivo, ignorando el bucket de la URL** — así un link
  viejo sigue abriendo una tarea que cambió de bucket.
- **VERIFY:** `npm test` con tests nuevos de parseo y de `navigate` + `popstate`; `npm run typecheck`
- **STATUS:** pending

### 2. Rutas en `App.tsx` — patrón Jira
- **TRIGGER:** ítem 1 verified
- **DO:** `editingFile` y `facetView` pasan a derivarse de la ruta. Navegando in-app → `pushState`
  con `{ modal: true }` en el state → **modal encima** de la lista. Sin ese flag (entrada directa,
  F5, link pegado) → **página**, sin montar `ItemList`.
- **VERIFY:** `npm test`, `npm run typecheck`, `npm run build`
- **STATUS:** pending

### 3. `CardPage.tsx`
- **TRIGGER:** ítem 2 verified
- **DO:** el contenido de la tarjeta con el chrome de la app (header + rail de buckets). **Comparte
  componente con el modal**: una sola implementación del cuerpo, dos envoltorios (`Overlay` para el
  modal, `CardPage` para la página). No duplicar el formulario.
- **VERIFY:** `npm test`, `npm run build`
- **STATUS:** pending

### 4. Borrar el historial hecho a mano
- **TRIGGER:** ítem 3 verified
- **DO:** eliminar `returnToFacetRef` (`App.tsx:72`) y `returnToUnconfirmedRef` (`:76`) — el
  historial del navegador los reemplaza.
- **VERIFY:** `npm test` con un test de regresión que cubra abrir una tarjeta **desde la cola de
  unconfirmed** y cerrarla → tiene que volver a la cola. **Ítem de mayor riesgo del loop:** hoy
  funciona y no puede romperse.
- **STATUS:** pending

### 5. Cache — tres capas
- **TRIGGER:** ítem 2 verified
- **DO:** (a) `cache: 'no-store'` en `request()` (`src/lib/api.ts:8`) — cubre los 20+ endpoints de
  una; (b) handler de `pageshow`, si `event.persisted` → `refresh()` (bfcache); (c) en cada
  `popstate`, refrescar buckets y re-pedir el item, nunca reusar una copia en memoria.
- **VERIFY:** `npm test`; test de que `request()` manda `no-store`
- **STATUS:** pending

### 6. `404.html` para GitHub Pages
- **TRIGGER:** ítem 2 verified
- **DO:** copiar `index.html` a `404.html` en el build. Sin eso, un deep link a
  `/gtd-frontend/backlog/x.md` da 404 en Pages.
- **VERIFY:** `npm run build` y confirmar que `dist/404.html` existe y es idéntico a `dist/index.html`
- **STATUS:** pending

---

## B2 — editor

### 7. `getPeople()` y `getPages()`
- **TRIGGER:** ítem 1 verified
- **DO:** en `src/lib/api.ts` y `src/lib/api.mock.ts`. Tipo `VaultPage = { name, kind, path, obsidianUri }`.
  `links?: VaultPage[]` en `Item` (`types.ts`).
- **VERIFY:** `npm run typecheck` + `npm run build` — ahí salta `_contract`
- **STATUS:** pending

### 8. `person` como facet
- **TRIGGER:** ítem 7 verified
- **DO:** `'person'` en `Facet` (`types.ts:29`) + un arm en `itemMatches` (`lib/facets.ts:19`) contra
  `related_people`, usando `sameFacetValue`. **No crear componente:** `FacetView` ya renderiza
  cualquier facet cross-bucket. Sumar el prefijo en `FACET_PREFIX`.
- **VERIFY:** `npm test` con casos en `facets.test.ts`
- **STATUS:** pending

### 9. CodeMirror 6 reemplaza el `<textarea>`
- **TRIGGER:** ítem 7 verified
- **DO:** `EditModal.tsx:276`. Mismo contrato `value={body}` / `setBody`; **conservar el
  `Ctrl+Enter` que guarda**. Tema con los tokens de la app. Deps: `codemirror`,
  `@codemirror/lang-markdown`, `@codemirror/autocomplete`, `@codemirror/view`, `@codemirror/state`.
- **VERIFY:** `npm test` (los 2 tests de "creating a new task" siguen verdes), `npm run build`
- **STATUS:** pending

### 10. Decoración de wikilinks
- **TRIGGER:** ítem 9 verified
- **DO:** estilo Obsidian — los `[[ ]]` ocultos mientras el cursor no está en esa línea, el nombre en
  `--color-accent`; reaparecen con el cursor en la línea.
- **VERIFY:** `npm test` con un test de que el texto del documento **no cambia** al decorar (la
  decoración es visual, nunca toca el buffer)
- **STATUS:** pending

### 11. Autocompletado `@` `#` `[[`
- **TRIGGER:** ítem 10 verified
- **DO:** `@` → inserta `[[Nombre]]`, fuente `getPeople()` (1 fetch al montar). `#` → `buckets` en
  memoria (`tagSuggestions`, `App.tsx:158`). `[[` → `getPages()` (1 fetch al montar).
  **Cero requests por tecla:** se filtra en el browser.
- **VERIFY:** `npm test` con un test de que `@` + selección escribe `[[Nombre]]` en el body, y otro
  de que no se dispara ningún fetch al tipear
- **STATUS:** pending

### 12. Checklists clickeables
- **TRIGGER:** ítem 10 verified
- **DO:** `- [ ]` / `- [x]` como widget decoration, click togglea. Markdown estándar.
- **VERIFY:** `npm test` con un test de toggle que compruebe el texto resultante
- **STATUS:** pending

### 13. Chips de links + ruteo por kind
- **TRIGGER:** ítems 8 y 11 verified
- **DO:** debajo del body, los `links` que devuelve `GET /api/items/{f}`. **`<a href>` de verdad**,
  no `<div onClick>` — eso da ctrl+click, click del medio y "abrir en pestaña nueva" gratis; solo se
  intercepta el click normal con `preventDefault`. `TASK` → `/<bucket>/<archivo>.md`; `PERSON` →
  `/persona/<nombre>`; `NOTE` → `link.obsidianUri`.
- **VERIFY:** `npm test` con un test de que cada kind renderiza el `href` correcto
- **STATUS:** pending

### 14. Sale el `PillEditor` de personas
- **TRIGGER:** ítem 13 verified
- **DO:** `EditModal.tsx:422` → display read-only (`related_people` ahora es derivado, editarlo a
  mano no tiene efecto). El `PillEditor` de tags (`:410`) **se queda**.
- **VERIFY:** `npm test`, `npm run build`
- **STATUS:** pending

---

## B4 — lo que se sumó al alcance el 2026-08-24

Sellado con el usuario en la misma vuelta que el resto del arte.

### 16. `depends_on` — el campo y el aviso
- **TRIGGER:** ítem 14 verified
- **DO:** backend (`workspace/test-java/Java`, rama propia): `depends_on` como lista de nombres de
  archivo en la whitelist de `patchMeta` y en `CREATABLE_FIELDS`; validar que cada uno exista.
  `markDone` **nunca bloquea** — devuelve qué dependencias siguen abiertas y cierra igual si el
  caller insiste. Frontend: diálogo de confirmación que **lista las tareas que bloquean** por
  título, con `[Cancelar]` y `[Cerrar igual]`.
- **Regla dura, decidida por el usuario:** avisar, jamás prohibir. Un bloqueo duro asume que la
  metadata está al día, y en este vault no lo está.
- **Sin detección de ciclos ni de referencias muertas** — decisión explícita: si algo queda trabado,
  lo destraba el usuario pidiéndolo por chat. La app es un condimento del vault, no un producto
  standalone.
- **VERIFY:** backend `mvn test` con casos de dependencia abierta/cerrada/inexistente; frontend
  `npm test` con un test de que el diálogo lista los títulos correctos y que "Cerrar igual" cierra
- **STATUS:** pending

### 17. Markdown en `ItemCard` con "ver más"
- **TRIGGER:** ítem 12 verified
- **DO:** la tarjeta muestra **2 líneas** del body renderizado (inline: negrita, código, `[[links]]`
  en `--color-accent`; headings y bullets aplanados a texto) más un **"ver más"** que expande la
  tarjeta en el lugar. Colapsada mantiene el alto fijo que tienen hoy — la lista tiene que seguir
  siendo escaneable. Reemplaza `bodySnippet()` (`ItemCard.tsx:22`).
- **VERIFY:** `npm test` con un test de que colapsada muestra 2 líneas y expandida el body entero;
  `npm run build`
- **STATUS:** pending

### 18. Crear persona desde el `@`
- **TRIGGER:** ítem 11 verified
- **DO:** cuando lo tipeado tras `@` no matchea ninguna persona, el dropdown ofrece **"crear
  persona"**. Crea `brain/entities/<Nombre>.md` con frontmatter mínimo (`type: entity`,
  `entity_type: person`, `title`, `created`, `tags: []`) vía endpoint nuevo en el backend.
- **Alcance cerrado, decidido por el usuario:** **solo personas, y solo por esta vía.** Nada de
  crear páginas en `wiki/` — esa zona tiene convenciones de ingest (address, cross-refs, index) que
  la app no conoce.
- **VERIFY:** backend `mvn test` (crea el archivo, rechaza nombre vacío, rechaza si ya existe);
  frontend `npm test` (la opción aparece solo cuando no hay match)
- **STATUS:** pending

**Fuera de alcance, ratificado:** subtareas con jerarquía (`parent:`, UI de árbol). Es un cambio de
modelo de datos, y hoy tres decisiones de modelo que parecían obvias resultaron estar mal — las tres
se encontraron porque había alguien preguntando. No corre sin supervisión.

---

### 15. Prueba humana — último ítem, siempre
- **TRIGGER:** ítems 0-18 verified o BLOCKED
- **DO:** dejar la app corriendo (`bin/gtd-start.bat`) y **parar**. No seguir puliendo, no tomar
  decisiones estéticas por cuenta propia. Checklist para el usuario:
  1. Abrir tarjeta → la URL cambia → **atrás** cierra → **adelante** reabre
  2. Copiar esa URL en pestaña nueva → se dibuja como **página**, con header y rail
  3. F5 sobre una tarjeta abierta → sigue ahí
  4. `@` → autocompleta personas reales → inserta `[[Nombre]]` → guardar → `related_people` aparece
     con el nombre canónico
  5. Ctrl+click en un chip `TASK` → pestaña nueva. Click en un `NOTE` → abre Obsidian
  6. `- [ ]` clickeable, guardar, verificar el `.md` en Obsidian
  7. Editar, guardar, atrás y adelante → siempre contenido nuevo (cache)
  8. Abrir una tarjeta desde la cola de unconfirmed y cerrarla → vuelve a la cola
- **VERIFY:** ninguno automático — lo juzga el usuario
- **STATUS:** pending

---

## Cierre

Al terminar: resumen acá, apagar el dev server, actualizar `brain/projects/frontend-gtd.md`,
`brain/hot.md` y `brain/log.md` del vault, y compilar la tabla de `LOOP-USAGE.md` (subagentes,
modelo, tokens, tool_uses, duración) más el delta de `/usage`.

Antes del PR: agente `verifier` sobre el diff staged, `/ponytail-review` y `/code-review`.
