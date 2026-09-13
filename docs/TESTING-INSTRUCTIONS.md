# Guía de prueba para WorkPilot

Esta guía está pensada para que otra persona pueda probar la app con el flujo real de Jira/Slack sin romper el entorno ni dejar secretos en el repositorio.

## 1. Requisitos previos

- Node.js 22 o superior
- npm
- Git
- Ollama instalado y ejecutándose localmente
- Un proyecto Jira real con clave `WH`
- Una historia principal `WH-1` y dos subtareas `WH-2` y `WH-3`
- Credenciales válidas de Jira y, si se prueba el flujo de Slack, el token y usuario de destino configurados
- Un archivo `.env` local, nunca versionado

> Importante: nunca subir `.env`, tokens ni credenciales reales al repositorio. Mantener todo solo en el entorno local.

## 2. Preparar el entorno local

1. Copia la plantilla:

   ```powershell
   copy .env.example .env
   ```

2. Edita `.env` con valores reales para tu entorno local.

   Ejemplo mínimo de configuración:

   ```env
   WORKPILOT_DEMO=false
   MODEL_PROVIDER=ollama
   MODEL=qwen3:4b
   OLLAMA_BASE_URL=http://127.0.0.1:11434/v1

   JIRA_BASE_URL=https://tu-org.atlassian.net
   JIRA_EMAIL=tu-email@ejemplo.com
   JIRA_API_TOKEN=tu-token-real
   JIRA_PROJECT_KEY=WH
   JIRA_SUBTASK_ISSUE_TYPE_ID=10006
   JIRA_WRITES_ENABLED=true

   # Si se prueba Slack real:
   # SLACK_BOT_TOKEN=xoxb-tu-token
   # SLACK_RECIPIENT_USER_ID=U1234567890
   ```

3. Asegúrate de que Ollama esté disponible en el PATH o ejecuta directamente la ruta local si hace falta:

   ```powershell
   $env:Path += ';C:\Users\Sergio Ortega\AppData\Local\Programs\Ollama'
   $env:OLLAMA_HOST='127.0.0.1:11434'
   $env:MODEL_PROVIDER='ollama'
   $env:MODEL='qwen3:4b'
   ```

4. Arranca Ollama y, si hace falta, descarga el modelo:

   ```powershell
   ollama serve
   ollama pull qwen3:4b
   ```

## 3. Instalar dependencias

```powershell
npm install
```

## 4. Iniciar la app

```powershell
npm run dev:web
```

La app normalmente queda en:

- http://127.0.0.1:3100/

Si aparece un conflicto de puerto, revisa si había un proceso previo escuchando en 3100 y reinícialo limpio.

## 5. Validación rápida del backend

Antes de probar el flujo completo, comprueba que el entorno está bien conectado:

```powershell
curl http://127.0.0.1:3100/api/workpilot/session
curl "http://127.0.0.1:3100/api/workpilot/context?issueKey=WH-1"
```

Lo esperado es:

- sesión activa
- `mode` en live o real
- `writesEnabled` permitido solo tras aprobación explícita
- contexto de `WH-1` con subtareas `WH-2` y `WH-3`

## 6. Caso recomendado de prueba

1. Abrir la app en http://127.0.0.1:3100/
2. Confirmar que el issue por defecto o el contexto cargado corresponde a `WH-1`
3. Usar el flujo de WorkPilot para proponer una acción para la issue `WH-1`
4. Revisar la propuesta y validar el contenido antes de aprobar
5. Aprobar la acción desde la UI
6. Verificar en Jira que la escritura se haya hecho en la issue correcta y no en otra
7. Si el flujo incluye Slack, comprobar que el mensaje llega solo al usuario configurado en App Home
8. Confirmar que no se dupliquen acciones ni se reenvíen escrituras de Jira en reintentos de Slack

## 7. Reglas de seguridad importantes

- Jira es la fuente de verdad.
- Las escrituras reales solo deben ocurrir después de aprobación explícita.
- Slack es solo notificación saliente; nunca debe elegir el destinatario del modelo.
- El flujo no debe repetir cambios si ya se validó la operación.
- Nunca usar datos reales en commits ni PRs.
- Antes de cerrar la prueba, revisar que `.env` sigue en local y no se ha versionado.

## 8. Datos de prueba recomendados

Usar este caso real durante validación:

- Proyecto: `WH`
- Historia: `WH-1`
- Subtareas: `WH-2`, `WH-3`

Esto permite verificar que el contexto del issue, las subtareas y la validación de destino funcionan correctamente.

## 9. Si algo falla

Revisar en este orden:

1. `npm install`
2. Ollama activo y modelo descargado
3. `.env` correcto y sin valores vacíos
4. `JIRA_PROJECT_KEY=WH`
5. `JIRA_WRITES_ENABLED=true` solo si se quiere escribir en Jira real
6. Puerto 3100 libre
7. `/api/workpilot/session` y `/api/workpilot/context?issueKey=WH-1` respondiendo correctamente

## 10. Limpieza final antes de entregar

Antes de hacer un PR o compartir el repo:

```powershell
git status
```

Y confirmar que:

- no hay `.env` con secretos reales
- no hay tokens ni mensajes privados en el historial
- no hay artefactos de testing o logs sensibles
- solo quedan cambios relevantes para la entrega

## 11. Nota final

El entorno de pruebas real debe mantenerse localizado. El repositorio no debe llevar credenciales ni artefactos de ejecuciones locales. La validación debe hacerse con variables reales en `.env` y con el proyecto `WH` para comprobar el comportamiento real del flujo.
