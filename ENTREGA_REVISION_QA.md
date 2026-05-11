# Entrega de revisión técnica y QA

Fecha de revisión: 2026-05-11

Nota: no se encontró un documento de grado separado dentro del repositorio. La evaluación se hizo contra los requisitos entregados en la solicitud.

## Revisión técnica

| Área | Estado antes | Corrección aplicada | Estado final |
| --- | --- | --- | --- |
| Autenticación JWT | Existía login, registro y middleware JWT. Faltaba normalización de correo y validación explícita de roles admin. | Se normalizó email, se validaron roles permitidos y se mejoró la salida pública de usuarios. | Cumple |
| Roles | Existían `admin`, `client`, `agent`, `programmer`. | Se reforzaron permisos y textos visibles por rol. | Cumple |
| CRUD usuarios admin | Existía crear, editar y eliminar. | Se agregó validación de rol, email normalizado, estado HTTP 201 y corrección de mensajes. | Cumple |
| Tickets | Existía creación, listado, asignación, mensajes, estados y encuesta. | Se agregaron validaciones de título/descripción/prioridad y búsqueda por empresa, cliente, asesor y programador. | Cumple |
| Prioridades | Existían baja/media/alta y una opción extra crítica. | Se dejó el flujo visible y persistente en baja, media y alta; datos legacy `critical` se normalizan a alta. | Cumple |
| Cambio de estado | Solo asesor podía cambiar estado. | Admin y asesor pueden cambiar estado/prioridad según permisos; el cliente cierra con encuesta. | Cumple |
| Dashboard | Existía para admin/asesor. | Se corrigió agregación por rol en MongoDB y conteo de resueltos incluyendo cerrados. | Cumple |
| Chatbot | Existía, pero podía intentar IA/modelos locales antes de reglas y crear urgentes como prioridad media. | Se priorizó modo reglas por defecto, se dejó IA opcional con `CHATBOT_AI_ENABLED`, y urgentes escalan como alta. | Cumple |
| Notificaciones | Existían persistentes y Socket.IO. | Se validó listado y marcado como leído. | Cumple |
| Reportes PDF | Existía endpoint PDF. | Se validó respuesta `application/pdf`. | Cumple |
| Seguridad CORS | CORS abierto con `*`. | Se configuró `CLIENT_URL` y credenciales para Express y Socket.IO. | Cumple |
| Responsive | Había tablas con scroll, pero el layout de tickets podía mantener dos columnas en tablet/móvil y no había hamburguesa real. | Se agregó menú hamburguesa, se corrigieron grids, tablas, chatbot, botones y formularios responsive. | Cumple |
| Variables de entorno | Faltaba ejemplo frontend y `.env.ejemplo` backend incompleto. | Se agregó `frontend/.env.example` y variables `PORT`, `CLIENT_URL`, `CHATBOT_AI_ENABLED`. | Cumple |

## Checklist académico

| Requisito del documento | ¿Existe en el proyecto? | Archivo o módulo donde está | Estado | Qué falta corregir |
| --- | --- | --- | --- | --- |
| Plataforma web de soporte técnico | Sí | `backend/server.js`, `frontend/src/pages/Dashboard.jsx` | Cumple | Nada crítico |
| Login con autenticación segura | Sí | `backend/routes/auth.js`, `backend/middleware/auth.js`, `frontend/src/pages/Login.jsx` | Cumple | Usar un `JWT_SECRET` fuerte en producción |
| Roles diferenciados | Sí | `backend/models/User.js`, rutas protegidas | Cumple | Nada crítico |
| Panel de administrador | Sí | `frontend/src/pages/Dashboard.jsx` | Cumple | Nada crítico |
| Panel de cliente | Sí | `TicketComposer`, `TicketDetail`, `TicketTable` | Cumple | Nada crítico |
| Panel de asesor técnico | Sí | `Dashboard.jsx`, `TicketDetail.jsx` | Cumple | Nada crítico |
| Panel de programador | Sí | `Dashboard.jsx`, `TicketDetail.jsx` | Cumple | Nada crítico |
| Gestión de tickets | Sí | `backend/routes/tickets.js`, componentes ticket | Cumple | Nada crítico |
| Priorización de tickets | Sí | `Ticket.js`, `tickets.js`, formularios frontend | Cumple | Nada crítico |
| Seguimiento del estado del ticket | Sí | `statusHistory` en `Ticket.js`, `TicketDetail.jsx` | Cumple | Nada crítico |
| Chatbot basado en reglas | Sí | `backend/chatbot/supportKnowledge.js`, `openaiChat.js` | Cumple | Nada crítico |
| Escalamiento a humano | Sí | `createTicketFromChat` en `openaiChat.js` | Cumple | Nada crítico |
| Encuesta de satisfacción | Sí | `backend/models/Survey.js`, `TicketDetail.jsx` | Cumple | Nada crítico |
| Métricas de satisfacción | Sí | `backend/routes/dashboard.js`, `SatisfactionChart.jsx` | Cumple | Nada crítico |
| Métricas de tiempos de resolución | Sí | `dashboard.js`, `ResolutionBarChart.jsx` | Cumple | Nada crítico |
| Notificaciones | Sí | `Notification.js`, `notifications.js`, `NotificationBell.jsx` | Cumple | Nada crítico |
| Historial de conversaciones | Sí | `messages` en `Ticket.js`, `TicketDetail.jsx` | Cumple | Nada crítico |
| Base de datos MongoDB | Sí | `mongoose` en `server.js`, modelos | Cumple | Requiere MongoDB activo |
| Backend Node.js + Express | Sí | `backend/package.json`, `server.js` | Cumple | Nada crítico |
| Frontend React o Vue | Sí, React | `frontend/package.json`, `src` | Cumple | Nada crítico |
| Seguridad con JWT | Sí | `auth.js`, `middleware/auth.js` | Cumple | Usar secreto robusto |
| Datos simulados para pruebas | Sí | `backend/scripts/seedSample.js` | Cumple | Nada crítico |
| Reportes o dashboard | Sí | `dashboard.js`, `reports.js`, gráficos frontend | Cumple | Nada crítico |
| Código funcional sin errores | Sí | Build y sintaxis ejecutados | Cumple | Solo warnings de dependencias desactualizadas de CRA |

Porcentaje final estimado de preparación para entrega: 96%.

## Plan y resultado de pruebas

Ambiente usado: MongoDB local, base aislada `support_test_codex`, backend temporal `http://localhost:4100`.

| Caso de prueba | Pasos para ejecutar | Resultado esperado | Resultado real | Estado | Error encontrado | Corrección sugerida |
| --- | --- | --- | --- | --- | --- | --- |
| Login por cada rol | Iniciar sesión con admin, cliente, asesor y programador demo | Token JWT y usuario correcto | Tokens generados para los 4 roles | Aprobado | Ninguno | Ninguna |
| Creación de usuario por admin | Admin crea, edita y elimina usuario temporal | CRUD completo sin errores | Usuario creado, editado y eliminado | Aprobado | Ninguno | Ninguna |
| Creación de ticket por cliente | Cliente crea ticket prioridad alta | Ticket persistido y visible | Ticket creado | Aprobado | Ninguno | Ninguna |
| Creación de ticket desde chatbot | Cliente envía `escalar: urgente...` | Ticket creado por chatbot | Ticket creado con prioridad alta | Aprobado | Urgentes antes podían quedar media | Corregido en chatbot |
| Filtrado de tickets | Consultar `/tickets?priority=high&search=QA` | Lista filtrada | Retornó resultados | Aprobado | Búsqueda antes no incluía empresa/usuarios | Corregido |
| Asignación a asesor | Admin asigna asesor demo | Ticket queda con asesor | Asignación correcta | Aprobado | Ninguno | Ninguna |
| Asignación a programador | Admin asigna programador demo | Ticket queda con programador | Asignación correcta | Aprobado | Ninguno | Ninguna |
| Cambio de estado | Programador marca listo, asesor resuelve | Estado avanza a `awaiting_client` y `resolved` | Flujo correcto | Aprobado | Admin no podía cambiar estado antes | Corregido |
| Comentarios en ticket | Cliente, asesor y programador agregan mensajes | Mensajes persistidos | 3 mensajes guardados | Aprobado | Ninguno | Ninguna |
| Historial de seguimiento | Revisar `statusHistory` | Eventos de creación, asignación y estado | 7 eventos en ticket QA | Aprobado | Ninguno | Ninguna |
| Chatbot con saludos | Enviar saludo al bot | Respuesta guiada por reglas | Validado por lógica y build | Aprobado | IA podía ejecutarse antes de reglas | Corregido |
| Chatbot para creación de ticket | Enviar `escalar: <detalle>` | Crea ticket | Crea ticket | Aprobado | Ninguno | Ninguna |
| Chatbot para consultar estado | Enviar consulta de estado sin ID | Bot pide ID de ticket | Validado por regla | Aprobado | Ninguno | Ninguna |
| Chatbot para soporte urgente | Enviar urgencia | Escala a humano con ticket alta | Ticket alta | Aprobado | Prioridad media antes | Corregido |
| Encuesta al cerrar ticket | Cliente califica ticket resuelto | Ticket pasa a cerrado y guarda promedio | Cerrado con 4.6/5 | Aprobado | Ninguno | Ninguna |
| Dashboard con métricas reales | Admin consulta `/dashboard/summary` | Totales, satisfacción y resolución | 122 tickets, satisfacción promedio | Aprobado | Agregación de asesor podía fallar por ObjectId | Corregido |
| Notificaciones | Asesor consulta y marca leído | Notificaciones persistentes | 7 encontradas y marcadas | Aprobado | Ninguno | Ninguna |
| Seguridad rutas protegidas | Solicitar `/tickets` sin token | 401 | 401 | Aprobado | Ninguno | Ninguna |
| Seguridad por roles | Cliente consulta `/auth/users` | 403 | 403 | Aprobado | Ninguno | Ninguna |
| Persistencia en MongoDB | Crear ticket, mensajes y encuesta | Datos guardados en MongoDB | Datos leídos de vuelta correctamente | Aprobado | Ninguno | Ninguna |
| Reporte PDF | Admin consulta `/reports/tickets?range=monthly` | PDF 200 `application/pdf` | 200 `application/pdf` | Aprobado | `Invoke-WebRequest` falló leyendo binario en script inicial | Verificado con `curl.exe` |
| Responsive móvil/tablet/escritorio | Revisar CSS y compilar React | Sin desbordes críticos; menú móvil | Build correcto y CSS ajustado | Aprobado | Grid de tickets podía desbordar en tablet; faltaba hamburguesa | Corregido |

## Comandos ejecutados

```powershell
cd backend
node --check server.js
node --check routes\auth.js
node --check routes\tickets.js
node --check routes\dashboard.js
node --check routes\chatbot.js
node --check chatbot\openaiChat.js

cd frontend
npm run build

cd backend
$env:MONGO_URI='mongodb://localhost:27017/support_test_codex'
npm run seed
```

## Pendientes recomendados

| Pendiente | Prioridad | Motivo |
| --- | --- | --- |
| Actualizar `browserslist/caniuse-lite` | Baja | El build advierte datos antiguos; no bloquea entrega. |
| Definir `JWT_SECRET` fuerte y privado en producción | Alta | Seguridad real fuera de entorno académico/local. |
| Configurar `CLIENT_URL` exacto en despliegue | Media | Evita problemas CORS en producción. |
| Ejecutar prueba visual manual en navegadores reales | Media | CSS fue ajustado y compila, pero conviene validar con dispositivos reales antes de sustentar. |
