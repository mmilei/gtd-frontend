# LOOP-STATE — editor markdown + navegación por URL

Spec completa: `brain/resources/gtd-frontend-spec-y-loop-kickoff.md` en el vault.
Budget: 20 iteraciones (14 originales + ítem 0 de CI + 3 sumados el 24/08).
Ejecución **secuencial**, un subagente por vez. **Modelo por ítem, no por default** (tabla abajo).
Rama base: **`develop`**. PR con `--base develop` explícito.

**Loop protection:** 2 VERIFY fallidos seguidos en el mismo ítem → `BLOCKED`, seguir con el próximo.
Más de la mitad de los ítems `BLOCKED` → cortar la corrida.

**El VERIFY lo corre el orquestador, nunca el agente que acaba de escribir el código.** Se verifica
**actuando** (corriendo el comando), nunca leyendo. STATUS lleva output real, jamás "listo".

## Modelo por ítem

La tabla del skill asigna por tipo de tarea, no por corrida. Este loop tiene de las dos clases:

| Ítems | Modelo | Por qué |
|---|---|---|
| 0, 5, 6, 7, 8, 14 | **Sonnet** | cambios ya especificados: un workflow, una opción de `fetch`, copiar un archivo en el build, dos funciones de API, un arm en un switch, sacar un componente |
| 1, 2, 3, 4 | **Opus** | el patrón modal/página es arquitectura; el ítem 4 es refactor de comportamiento que hoy funciona |
| 9, 10, 11, 12, 13 | **Opus** | CodeMirror 6 con React es donde un modelo más chico produce algo que pasa los tests y está mal: decoraciones que mutan el documento, listeners sin limpiar, `StateField` mal usado |
| 16, 17, 18 | **Opus** | `depends_on` cruza dos repos; los otros dos llevan criterio visual |

Corregido el 2026-08-24 tras la pregunta del usuario: la primera asignación era Sonnet para todo, que
es aplicar mal la tabla. El post-mortem del 2026-08-05 (1,26M tokens, 6 agentes Opus) fue por usar
Opus en tandas **mecánicas** — no es el caso acá.

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
- **STATUS:** verified (parcial) — `.github/workflows/test.yml` creado y commiteado (`4083adb`), YAML válido,
  mismo patrón que `deploy.yml` (Node 24, `npm ci/test/typecheck/build`). El check "corre verde en el PR"
  no se puede correr todavía porque no hay PR abierto — se confirma al abrir el PR al cierre del loop.

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
- **STATUS:** verified — `src/state/useRoute.ts` + `useRoute.test.ts` (`b9682c8`). VERIFY corrido por el
  orquestador: `npm run typecheck` exit 0, `npm test` → 5 archivos, 34/34 tests verdes.

### 2. Rutas en `App.tsx` — patrón Jira
- **TRIGGER:** ítem 1 verified
- **DO:** `editingFile` y `facetView` pasan a derivarse de la ruta. Navegando in-app → `pushState`
  con `{ modal: true }` en el state → **modal encima** de la lista. Sin ese flag (entrada directa,
  F5, link pegado) → **página**, sin montar `ItemList`.
- **VERIFY:** `npm test`, `npm run typecheck`, `npm run build`
- **STATUS:** verified — `App.tsx` deriva `editingFile`/`facetView` de `route` (`71b6f8c`). Placeholder
  temporal (`ponytail:`) para la página completa, marcado para que el ítem 3 lo reemplace. VERIFY del
  orquestador: 37/37 tests, typecheck limpio, build OK (750kB warning pre-existente de three.js).

### 3. `CardPage.tsx`
- **TRIGGER:** ítem 2 verified
- **DO:** el contenido de la tarjeta con el chrome de la app (header + rail de buckets). **Comparte
  componente con el modal**: una sola implementación del cuerpo, dos envoltorios (`Overlay` para el
  modal, `CardPage` para la página). No duplicar el formulario.
- **VERIFY:** `npm test`, `npm run build`
- **STATUS:** verified — `CardPage.tsx` + `pageFrame` en `Overlay.tsx`, `EditModal`/`FacetView` toman
  `frame` inyectable (`d95415d`). Un solo formulario, wrapper distinto. VERIFY del orquestador: 39/39
  tests, typecheck limpio, build OK.

### 4. Borrar el historial hecho a mano
- **TRIGGER:** ítem 3 verified
- **DO:** eliminar `returnToFacetRef` (`App.tsx:72`) y `returnToUnconfirmedRef` (`:76`) — el
  historial del navegador los reemplaza.
- **VERIFY:** `npm test` con un test de regresión que cubra abrir una tarjeta **desde la cola de
  unconfirmed** y cerrarla → tiene que volver a la cola. **Ítem de mayor riesgo del loop:** hoy
  funciona y no puede romperse.
- **STATUS:** verified — `returnToUnconfirmedRef` eliminado, la cola pasa a ser una ruta
  (`/unconfirmed`, `UNCONFIRMED_PATH`) (`be8df64`). Detalle no trivial: cerrar la cola necesitaba
  distinguir "hay historial" vs "entrada directa" (`modal ? back : exitPage`), mismo split que ítem 3.
  El subagente mutó el fix (volvió `navigate('/')` en vez de `back()`) para confirmar que el test de
  regresión realmente lo detecta — no es un green bar falso. VERIFY del orquestador: test de regresión
  presente en `App.test.tsx:71-104`, 41/41 tests, typecheck limpio, build OK, grep confirma 0
  referencias a `returnToUnconfirmedRef`.

### 5. Cache — tres capas
- **TRIGGER:** ítem 2 verified
- **DO:** (a) `cache: 'no-store'` en `request()` (`src/lib/api.ts:8`) — cubre los 20+ endpoints de
  una; (b) handler de `pageshow`, si `event.persisted` → `refresh()` (bfcache); (c) en cada
  `popstate`, refrescar buckets y re-pedir el item, nunca reusar una copia en memoria.
- **VERIFY:** `npm test`; test de que `request()` manda `no-store`
- **STATUS:** verified — `no-store` en `request()`, `navVersion` + listeners de `popstate`/`pageshow`
  fuerzan remount de `CardPage`/`EditModal` (`3a5fc83`). VERIFY del orquestador: 42/42 tests, typecheck
  limpio, build OK.

### 6. `404.html` para GitHub Pages
- **TRIGGER:** ítem 2 verified
- **DO:** copiar `index.html` a `404.html` en el build. Sin eso, un deep link a
  `/gtd-frontend/backlog/x.md` da 404 en Pages.
- **VERIFY:** `npm run build` y confirmar que `dist/404.html` existe y es idéntico a `dist/index.html`
- **STATUS:** verified — `build` encadena `node -e "fs.copyFileSync(...)"`, sin dependencia nueva
  (`48b8eb9`). VERIFY del orquestador: `diff dist/index.html dist/404.html` vacío (idénticos), 42/42
  tests, typecheck limpio.

---

## B2 — editor

### 7. `getPeople()` y `getPages()`
- **TRIGGER:** ítem 1 verified
- **DO:** en `src/lib/api.ts` y `src/lib/api.mock.ts`. Tipo `VaultPage = { name, kind, path, obsidianUri }`.
  `links?: VaultPage[]` en `Item` (`types.ts`).
- **VERIFY:** `npm run typecheck` + `npm run build` — ahí salta `_contract`
- **STATUS:** verified — `VaultPage`, `links?` en `Item`, `getPeople()`/`getPages()` en `api.ts` +
  mock consistente con `_contract` (`39d56f3`). Solo capa de datos, sin UI. VERIFY del orquestador:
  typecheck limpio, build OK, 42/42 tests.

### 8. `person` como facet
- **TRIGGER:** ítem 7 verified
- **DO:** `'person'` en `Facet` (`types.ts:29`) + un arm en `itemMatches` (`lib/facets.ts:19`) contra
  `related_people`, usando `sameFacetValue`. **No crear componente:** `FacetView` ya renderiza
  cualquier facet cross-bucket. Sumar el prefijo en `FACET_PREFIX`.
- **VERIFY:** `npm test` con casos en `facets.test.ts`
- **STATUS:** verified — `person` en `Facet`, arm en `itemMatches` contra `related_people`, prefijo `@`
  en `FACET_PREFIX` (`9c24cee`). De paso unificó `RouteFacet`↔`Facet` en `useRoute.ts` (simplificación
  real: la separación existía solo porque `person` no era un facet todavía). VERIFY del orquestador:
  casos de `person` en `facets.test.ts` presentes y verdes, typecheck limpio, build OK.

### 9. CodeMirror 6 reemplaza el `<textarea>`
- **TRIGGER:** ítem 7 verified
- **DO:** `EditModal.tsx:276`. Mismo contrato `value={body}` / `setBody`; **conservar el
  `Ctrl+Enter` que guarda**. Tema con los tokens de la app. Deps: `codemirror`,
  `@codemirror/lang-markdown`, `@codemirror/autocomplete`, `@codemirror/view`, `@codemirror/state`.
- **VERIFY:** `npm test` (los 2 tests de "creating a new task" siguen verdes), `npm run build`
- **STATUS:** verified — `MarkdownEditor.tsx` nuevo, CM6 con `minimalSetup`, tema solo con tokens de
  `app.css`, Ctrl+Enter con `Prec.highest` (`b39d454`). Nota para ítem 10: estilar decoraciones como
  `.cm-content span.cm-foo` (especificidad 0,2,2) o pierden contra el fallback de `defaultHighlightStyle`.
  `@codemirror/commands`/`@codemirror/language` NO están instalados — si el ítem 10 necesita
  `syntaxTree`, hace falta agregar `@codemirror/language`. Bundle subió de 750kB a 1.26MB (inherente a
  `lang-markdown` arrastrando `lang-html`/`lang-css`/`lang-js`) — no bloquea, fuera del VERIFY
  declarado. VERIFY del orquestador: 44/44 tests (2 obstáculos reales de jsdom+CM6 resueltos: falta de
  `getClientRects` y typing multi-char no determinístico, ambos documentados en el commit), typecheck
  limpio, build OK.

### 10. Decoración de wikilinks
- **TRIGGER:** ítem 9 verified
- **DO:** estilo Obsidian — los `[[ ]]` ocultos mientras el cursor no está en esa línea, el nombre en
  `--color-accent`; reaparecen con el cursor en la línea.
- **VERIFY:** `npm test` con un test de que el texto del documento **no cambia** al decorar (la
  decoración es visual, nunca toca el buffer)
- **STATUS:** verified — regex por línea en un `StateField` (más simple y confiable que `syntaxTree`,
  no hizo falta instalar `@codemirror/language`), sin `destroy()` porque `StateField` no tiene nada que
  desuscribir (`d531146`). El subagente mutó el fix (comentar el field) para confirmar que el test
  detecta la regresión. VERIFY del orquestador: 46/46 tests, typecheck limpio, build OK.

### 11. Autocompletado `@` `#` `[[`
- **TRIGGER:** ítem 10 verified
- **DO:** `@` → inserta `[[Nombre]]`, fuente `getPeople()` (1 fetch al montar). `#` → `buckets` en
  memoria (`tagSuggestions`, `App.tsx:158`). `[[` → `getPages()` (1 fetch al montar).
  **Cero requests por tecla:** se filtra en el browser.
- **VERIFY:** `npm test` con un test de que `@` + selección escribe `[[Nombre]]` en el body, y otro
  de que no se dispara ningún fetch al tipear
- **STATUS:** verified — `MarkdownEditor` fetchea `getPeople()`/`getPages()` una vez al montar
  (`Promise.all` en `useEffect`, guardado en refs), tags vienen ya cacheados de `App.tsx` vía prop;
  `CompletionSource` con `validFor` refiltra en memoria sin volver a llamar la fuente (`5652695`).
  VERIFY del orquestador: 49/49 tests (incluye el test de conteo de fetch: exactamente 1 llamada cada
  una tras tipear varios caracteres), typecheck limpio, build OK.

### 12. Checklists clickeables
- **TRIGGER:** ítem 10 verified
- **DO:** `- [ ]` / `- [x]` como widget decoration, click togglea. Markdown estándar.
- **VERIFY:** `npm test` con un test de toggle que compruebe el texto resultante
- **STATUS:** verified — `StateField` con `Decoration.replace` + `WidgetType` custom, click resuelve
  posición con `posAtDOM` y dispatcha el cambio de 1 carácter; checkbox nativo con `accent-color:
  var(--color-done)` (mismo verde que el botón "mark as done" de `ItemCard`, sin patrón reusable
  directo porque ese es React y esto es DOM plano de CodeMirror) (`af45275`). El subagente detectó y
  corrigió solo un `git add -A` que arrastraba la basura del loop, recommiteó limpio. VERIFY del
  orquestador: working tree limpio, 51/51 tests, typecheck limpio, build OK.

### 13. Chips de links + ruteo por kind
- **TRIGGER:** ítems 8 y 11 verified
- **DO:** debajo del body, los `links` que devuelve `GET /api/items/{f}`. **`<a href>` de verdad**,
  no `<div onClick>` — eso da ctrl+click, click del medio y "abrir en pestaña nueva" gratis; solo se
  intercepta el click normal con `preventDefault`. `TASK` → `/<bucket>/<archivo>.md`; `PERSON` →
  `/persona/<nombre>`; `NOTE` → `link.obsidianUri`.
- **VERIFY:** `npm test` con un test de que cada kind renderiza el `href` correcto
- **STATUS:** verified — `<a href>` real por kind (TASK→`itemPath`, PERSON→`facetPath('person', ...)`,
  NOTE→`obsidianUri` sin interceptar), click normal sin modificador intercepta solo TASK/PERSON,
  `onNavigate` prop en vez de `useRoute()` propio en el modal (evita doble estado sin `popstate`)
  (`153603f`). VERIFY del orquestador: 58/58 tests (2 líneas "navigation to another Document" en el
  log son la prueba de que NOTE NO se intercepta), typecheck limpio, build OK.

### 14. Sale el `PillEditor` de personas
- **TRIGGER:** ítem 13 verified
- **DO:** `EditModal.tsx:422` → display read-only (`related_people` ahora es derivado, editarlo a
  mano no tiene efecto). El `PillEditor` de tags (`:410`) **se queda**.
- **VERIFY:** `npm test`, `npm run build`
- **STATUS:** verified — `PillEditor` de personas reemplazado por `RelatedPeople` (chips de solo
  lectura, mismo patrón que `VaultLinks` del ítem 13, navegan a `/persona/<Nombre>`), eliminado el path
  de escritura entero (`people`/`setPeople`, `related_people` ya no va en `patchMeta`/`createItem`).
  Tags intacto (`4562c4f`). VERIFY del orquestador: 62/62 tests, typecheck limpio, build OK.

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
- **STATUS:** verified — backend: `depends_on` en whitelist de `patchMeta`/`CREATABLE_FIELDS`,
  validación de existencia en `VaultService` antes de escribir, `markDone` devuelve
  `open_dependencies` sin bloquear (repo `test-java/Java`, rama `feat/depends-on`, `9803d2c`).
  Frontend: picker + diálogo "Cerrar igual" siempre disponible, deriva dependencias abiertas de
  `getBuckets()` en vez de un endpoint nuevo (repo `test-node/gtd-frontend`, `3790181`). VERIFY del
  orquestador: backend 198/198 tests (`BUILD SUCCESS`), frontend 66/66 tests, typecheck limpio,
  build OK.

### 17. Markdown en `ItemCard` con "ver más"
- **TRIGGER:** ítem 12 verified
- **DO:** la tarjeta muestra **2 líneas** del body renderizado (inline: negrita, código, `[[links]]`
  en `--color-accent`; headings y bullets aplanados a texto) más un **"ver más"** que expande la
  tarjeta en el lugar. Colapsada mantiene el alto fijo que tienen hoy — la lista tiene que seguir
  siendo escaneable. Reemplaza `bodySnippet()` (`ItemCard.tsx:22`).
- **VERIFY:** `npm test` con un test de que colapsada muestra 2 líneas y expandida el body entero;
  `npm run build`
- **STATUS:** verified — `flattenBody()` + `renderInline()` (regex propio, sin dependencia nueva:
  las únicas libs de markdown instaladas son parsers Lezer atados a CodeMirror, no sirven para nodos
  React estáticos), colapsada con corte de 140 chars + `line-clamp-2` (`3be08dd`). VERIFY del
  orquestador: 70/70 tests, typecheck limpio, build OK.

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
- **STATUS:** verified — `VaultService.createPerson()` + `POST /api/people` (repo `test-java/Java`,
  rama `feat/depends-on`, `cfc6747`); frontend arma la opción "crear persona" desde el `@` sin fetch
  extra (repo `test-node/gtd-frontend`, `ce608df`). **Bug real encontrado y corregido en el mismo
  ítem:** `GET /api/people` devolvía `List<String>` pero el frontend espera `VaultPage[]` — pasaba
  inadvertido porque los tests mockean la API; contra el server real el autocompletado de personas
  mostraría labels `undefined`. Fix aplicado por el orquestador: `people()` ahora reusa `vaultPages()`
  filtrado a `PERSON`, mismo contrato que `/pages` (`4688217`). VERIFY del orquestador: backend
  204/204 tests (`BUILD SUCCESS`, incluye el fix), frontend 72/72 tests, typecheck limpio, build OK.

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
- **STATUS:** en curso — usuario probando en vivo contra `localhost:5173`/`:8080`. Feedback recibido
  hasta ahora, ambos cubiertos por hallazgos del `/code-review` (ver abajo):
  1. Save no refrescaba los hipervínculos nuevos → mismo bug que el finding de `links` stale, arreglado.
  2. Modal de tarjeta hija abre sobre la lista, no sobre la tarjeta padre — **arreglado en vivo**, a
     pedido explícito del usuario ("efecto mamushka"): la página de fondo (`baseRoute`) ahora es
     sticky, separada de la ruta que maneja el modal (`route` mientras `modal:true`). Todo open sigue
     empujando `{modal:true}`, así que abrir un link desde dentro de un modal apila otro modal encima
     (no reemplaza al padre), y `back()` desapila un nivel por vez — el padre "vuelve" cuando el hijo
     se cierra. Test de regresión mutado para confirmar que no es un falso positivo (`0f4d3f2`).

---

## Pre-PR: `/ponytail-review` + `/code-review` (corridos por el orquestador, 2026-08-25)

Sobre el diff completo `origin/develop...HEAD` (20 commits en ese momento, +2425/-112).

**`/ponytail-review`:** 1 finding — `RelatedPeople`/`VaultLinks` en `EditModal.tsx` eran casi
duplicados (mismo wrapper, mismo click-intercept, solo cambiaba el shape de dato). Unificados:
`RelatedPeople` ahora arma `VaultPage[]` sintéticos y delega en `VaultLinks` (`049eacb`, -24 líneas).

**`/code-review high` (fork, 182k tokens, 459s):** 6 findings.

| # | Hallazgo | Severidad | Resultado |
|---|---|---|---|
| 1 | `decodeURIComponent` sin try/catch en `parseRoute` — un `%` suelto en la URL tira `URIError` sin catch, cuelga toda la app | alta (crash) | **arreglado** — `safeDecode()`, test de regresión (`b2628d3`) |
| 2 | Chips de `links` quedan stale tras guardar (el comentario solo excusaba `related_people`) | media | **arreglado** — refetch en background que solo parchea `links`/`related_people`, sin pisar el resto (`279780d`). Confirmado en vivo por el usuario probando el ítem 15, de forma independiente al review |
| 3 | `createPersonOption().apply()` traga el error de `createPerson()` en silencio — sin feedback si falla | media | **arreglado** — mensaje visible unos segundos junto al editor (`0064edc`) |
| 4 | El picker de `depends_on` ofrece tareas de `reference`, que por convención del vault nunca pasan a done — quedarían "still open" para siempre | media | **arreglado** — excluidas del picker y del chequeo de bloqueo (`279780d`) |
| 5 | `EditModal` refetchea `getBuckets()` propio en cada apertura en vez de recibir `buckets` como prop desde `App` (que ya lo tiene) | baja (eficiencia, no correctness) | **no arreglado** — requiere prop-drilling a través de `CardPage`, dejado para otra pasada |
| 6 | `/unconfirmed` en modo página no matcheaba ningún branch de `pageMode`, así que montaba la lista completa debajo del overlay de la cola | media | **arreglado** — branch explícito que no monta `<main>` en ese caso (`400b93a`) |

Todo verificado por el orquestador tras cada fix: 73/73 tests, typecheck limpio, build OK.

---

## Cierre (2026-08-25, cerrado con prueba humana PENDIENTE — a pedido explícito del usuario)

**No se abre PR todavía.** El ítem 15 (prueba humana, 8 pasos) no se corrió completo: el usuario probó
parcial contra el server real y encontró 2 bugs reales (cubiertos abajo), pero no confirmó el checklist
entero. Retomar desde ahí antes de tocar `gh pr create` — `verifier`/`/ponytail-review`/`/code-review`
ya corrieron sobre el diff (ver tabla más abajo), pero eso no reemplaza la confirmación humana.

**Dev servers: quedan corriendo**, a propósito — no se apagan porque la prueba sigue abierta. Backend
`:8080` en `workspace/test-java/Java` rama `feat/depends-on`, frontend `:5173` en
`workspace/test-node/gtd-frontend` rama `feat/markdown-editor-and-routing`.

### Resultado

19/19 ítems automáticos verified (0-14, 16-18) + 4 fixes propios del orquestador tras `/code-review` +
2 fixes más pedidos por el usuario probando en vivo (mamushka + wikilinks con ruta calificada).
**25 commits** en `feat/markdown-editor-and-routing` (frontend), **4 commits** en `feat/depends-on`
(backend `test-java/Java`). Frontend: 74/74 tests, typecheck limpio, build OK (1.30MB, suba esperada
por CodeMirror). Backend: 206/206 tests, `BUILD SUCCESS`.

### Tabla de uso (compilada de `LOOP-USAGE.md`)

| Modelo | Dispatches | Tokens | tool_uses | Duración |
|---|---|---|---|---|
| Sonnet (ítems 0,5,6,7,8,14) | 6 | ~518k | 124 | ~826s |
| Opus (ítems 1,2,3,4,9,10,11,12,13,16,17,18) | 12 | ~1301k | 431 | ~4389s |
| `/code-review high` (fork, modelo de sesión) | 1 | ~182k | 22 | ~459s |
| **Total subagentes** | **19** | **~2.0M** | **577** | **~94.6 min** |

Más 4 fixes corridos por el orquestador directamente (sin subagente, sin bloque `<usage>` propio):
shape de `/api/people`, unificación `RelatedPeople`/`VaultLinks`, modal apilado (mamushka), wikilinks
con ruta calificada. No hay forma de sumarlos al total de arriba sin inventar un número.

**Costo real en USD:** no disponible — `/usage` es un comando de la CLI de la sesión del usuario, no
una tool que este orquestador pueda invocar. El usuario puede correr `/usage` él mismo si quiere el
desglose input/output/cache con pricing real.

### Findings de `/code-review high` no arreglados

Ítem 5 de la tabla del pre-PR (`EditModal` refetchea `getBuckets()` propio en cada apertura en vez de
recibirlo como prop desde `App`, que ya lo tiene cargado) — eficiencia, no correctness, requiere
prop-drilling a través de `CardPage`. Dejado para otra pasada.

### Al retomar

1. Correr el checklist de prueba humana completo (`LOOP-STATE.md` ítem 15, 8 pasos).
2. Si algo más aparece, arreglarlo con el mismo patrón: fix + test de regresión + mutar el fix para
   confirmar que el test lo detecta.
3. Recién ahí: `gh pr create` en ambos repos (`--base develop` explícito, frontend y backend), apagar
   los dev servers, `PushNotification` avisando.
