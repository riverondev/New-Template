# Ensayo y video P4

## Ensayo local sin P1 ni credenciales

1. `npm ci`, luego `npm run dev:rehearsal`.
2. Abrir http://127.0.0.1:3100. Confirmar el rótulo ENSAYO P4.
3. WP-42 → Cargar propuesta de ensayo. Ver dependencia WP-39, implementación existente y seguimiento QA.
4. Rechazar. Confirmar estado rechazado y ausencia de resultados.
5. Cargar otra propuesta y aprobar. Ver estado de cada acción, providerId de fixtures y Slack succeeded.
6. Actualizar la página: debe conservar plan y resultado.
7. WP-57 → propuesta distinta, solo comentario de handoff.
8. Reiniciar el servidor manteniendo directorio de datos y navegador. Actualizar; debe recuperar la ejecución.
9. Para ejecución automática HTTP: build previo y `npm run test:e2e`.

El ensayo no demuestra razonamiento P1 ni proveedores reales. No reutilizar sus IDs como evidencia de Jira/Slack real.

## Guion final, 2 minutos

- 00:00–00:15: usuario objetivo, problema y ticket visible.
- 00:15–00:35: prompt «Revisá esto y dejalo listo para el equipo» y lectura Jira (requiere P1).
- 00:35–00:55: hechos, hipótesis, faltantes, evidencia y cambios exactos.
- 00:55–01:15: aprobación humana; resultados con IDs Jira leídos de vuelta.
- 01:15–01:30: abrir Jira y mostrar el aviso privado de Slack.
- 01:30–01:45: refresh; misma ejecución sin duplicados.
- 01:45–02:00: «¿qué falta?» y breve comparación WP-57 (requiere P1).

Grabar únicamente después de completar el flujo real. No mostrar .env, tokens, detalles privados ni presentar simulaciones como servicios reales. Los videos en assets/demos provienen del starter; no son una demo de WorkPilot.

## Registro de ensayo

Estado actual: implementación y guion preparados; no se completó un ensayo visual ni una grabación final. Tests automáticos bloqueados por el sandbox; verificar localmente con los comandos del README. Completar aquí fecha, commit probado, modo (real/ensayo), IDs de prueba no sensibles, resultado y enlace al video.

## Recuperación

- SNAPSHOT_CHANGED: actualizar Jira y generar una nueva propuesta.
- Jira rechazó una acción: inspeccionar el error; las posteriores se omiten y Slack no se envía.
- Jira reconciling: inspeccionar el proveedor; no crear un segundo plan para repetir operaciones inciertas.
- Slack failed + retryable: esperar Retry-After y pulsar Reintentar solo Slack.
- Slack uncertain: verificar manualmente el App Home, no reenviar.
- Lock tras cierre abrupto: detener todas las instancias y revisar los registros/estado externo antes de una recuperación administrada. No borrar el directorio live.
