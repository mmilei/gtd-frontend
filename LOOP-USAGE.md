# LOOP-USAGE.md — editor markdown + navegación por URL (2026-08-24+)

Spec: `brain/resources/gtd-frontend-spec-y-loop-kickoff.md`. Formato:
`- [HH:MM] <ítem> | <modelo> | <tokens>k tokens | <tool_uses> tool_uses | <duration>s`

- [16:03] item 0 (CI workflow) | Sonnet | 63k tokens | 5 tool_uses | 16s
- [16:35] item 1 (useRoute) | Opus | 88k tokens | 17 tool_uses | 204s
- [16:42] item 2 (rutas App.tsx) | Opus | 109k tokens | 44 tool_uses | 401s
- [16:48] item 3 (CardPage.tsx) | Opus | 109k tokens | 36 tool_uses | 295s
- [16:55] item 4 (borrar historial manual) | Opus | 111k tokens | 38 tool_uses | 313s
- [16:59] item 5 (cache tres capas) | Sonnet | 99k tokens | 27 tool_uses | 208s
- [17:01] item 6 (404.html) | Sonnet | 67k tokens | 11 tool_uses | 79s
- [17:03] item 7 (getPeople/getPages) | Sonnet | 78k tokens | 16 tool_uses | 101s
- [17:07] item 8 (person facet) | Sonnet | 110k tokens | 29 tool_uses | 182s
- [17:19] item 9 (CodeMirror 6) | Opus | 130k tokens | 40 tool_uses | 666s
- [17:25] item 10 (decoración wikilinks) | Opus | 80k tokens | 21 tool_uses | 256s
- [17:32] item 11 (autocompletado) | Opus | 108k tokens | 36 tool_uses | 383s
- [17:37] item 12 (checklists clickeables) | Opus | 86k tokens | 22 tool_uses | 254s
- [17:42] item 13 (chips de links) | Opus | 112k tokens | 34 tool_uses | 243s
- [17:46] item 14 (related people read-only) | Sonnet | 101k tokens | 36 tool_uses | 240s
- [17:57] item 16 (depends_on backend+frontend) | Opus | 161k tokens | 68 tool_uses | 564s
- [18:01] item 17 (markdown en ItemCard) | Opus | 73k tokens | 17 tool_uses | 167s
- [19:53] item 18 (crear persona desde @) | Opus | 134k tokens | 58 tool_uses | 643s
- [19:54] fix orquestador: GET /api/people shape (VaultPage, no List<String>) — sin subagente, 204/204 backend tests
- [00:51] fix orquestador: /ponytail-review sobre el diff, unificó RelatedPeople/VaultLinks (-24 líneas) — sin subagente, 72/72 tests
- [01:04] /code-review high (fork) sobre el diff completo | 182k tokens | 22 tool_uses | 459s — 6 findings, 4 arreglados por el orquestador (crash decodeURIComponent, links stale tras save, reference en depends_on, unconfirmed fallthrough), 1 no arreglado (EditModal refetchea buckets propio en vez de recibirlo como prop — eficiencia, no correctness)
- [01:14] fix orquestador a pedido del usuario probando en vivo: modal apilado sobre página (efecto mamushka), baseRoute sticky + test de regresión mutado — sin subagente, 74/74 tests
- [01:2x] fix orquestador (backend, repo test-java/Java, rama feat/depends-on): resolveLinks()/deriveLinks() no resolvían wikilinks con ruta calificada (`[[wiki/references/algo]]`), solo nombres pelados — encontrado por el usuario probando en vivo con una tarjeta real. wikilinkKey() compartido extrae basename antes de buscar en el índice. Sin subagente, 206/206 backend tests, verificado contra la tarjeta real del screenshot ("Retomar investigación Claude CLI")
