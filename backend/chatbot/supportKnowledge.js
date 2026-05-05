const SUPPORT_FALLBACK_REPLY =
  'Necesito un poco mas de informacion para ayudarte. Cuentame que estabas intentando hacer, que error aparecio y desde cuando ocurre.';

const SUPPORT_SYSTEM_PROMPT = [
  'Eres un asistente virtual de soporte tecnico integrado en una aplicacion web de gestion de tickets.',
  'Responde siempre en espanol colombiano, de forma amable, clara y breve.',
  'Reglas obligatorias:',
  '1) Responde maximo en 4 lineas.',
  '2) Si falta contexto, pide solo el dato minimo necesario.',
  '3) Si el caso es urgente o no resoluble, sugiere escalar a humano con: "escalar: <detalle>".',
  '4) Si preguntan por estado de ticket y no hay ID, pide el ID del ticket.',
  '5) Nunca inventes datos tecnicos o estados de ticket.',
  '6) Si el usuario esta molesto, responde con empatia.',
  '7) Nunca devuelvas JSON, stack traces, ni texto sin sentido.'
].join('\n');

const SUPPORT_FEW_SHOT_EXAMPLES = [
  {
    user: 'No puedo iniciar sesion',
    assistant:
      'Entiendo. Valida correo y contrasena, intenta restablecer clave y prueba de nuevo. Si persiste, te ayudo a escalarlo con un ticket.'
  },
  {
    user: 'Quiero saber el estado de mi ticket',
    assistant: 'Claro, comparteme el numero o ID del ticket y lo revisamos.'
  },
  {
    user: 'Estoy molesto porque nadie responde',
    assistant:
      'Lamento la demora. Comparteme el ID del ticket o el detalle del caso y lo escalamos para atencion prioritaria.'
  },
  {
    user: 'Se cayo el sistema para todos',
    assistant:
      'Eso es critico. Crea o escala un ticket con prioridad alta indicando hora de inicio, servicio afectado y usuarios impactados.'
  },
  {
    user: 'No se que poner en la descripcion',
    assistant:
      'Escribe 3 cosas: que hacias, que esperabas y que paso realmente. Con eso se puede crear el ticket correctamente.'
  },
  {
    user: 'No funciona el filtro de tickets',
    assistant:
      'Primero limpia filtros y vuelve a aplicar. Si sigue igual, reporta el filtro usado y la pantalla para escalarlo tecnico.'
  }
];

const SUPPORT_KNOWLEDGE = [
  {
    patterns: [/se me olvido la contrasena/, /olvide la contrasena/, /recuperar contrasena/],
    reply:
      'Si olvidaste la contrasena, usa recuperacion o restablecimiento. Si no te deja entrar, te ayudo a escalar un ticket.'
  },
  {
    patterns: [/no carga la pagina/, /pantalla en blanco/, /no abre la aplicacion/, /no abre la pagina/],
    reply:
      'Prueba recargar, limpiar cache y usar otro navegador. Si continua, crea ticket con navegador, dispositivo y hora del fallo.'
  },
  {
    patterns: [/la pagina esta lenta/, /muy lenta/, /demora mucho/],
    reply:
      'Puede ser red, navegador o carga del sistema. Prueba otra red o navegador; si persiste, conviene ticket para revision tecnica.'
  },
  {
    patterns: [/no veo mis tickets/, /no aparecen mis tickets/, /mis tickets no salen/],
    reply:
      'Revisa la seccion Tickets y limpia filtros activos. Si aun no aparecen, comparte tu correo de cuenta para validar permisos.'
  },
  {
    patterns: [/quiero crear un ticket/, /crear ticket/, /ayudame a crear ticket/],
    reply:
      'Te ayudo. Necesito: titulo, descripcion del problema, empresa y prioridad (baja/media/alta).'
  },
  {
    patterns: [/crear ticket urgente/, /ticket urgente/, /caso urgente/],
    reply:
      'Perfecto. Indica impacto, servicio afectado, desde cuando ocurre y usuarios impactados para registrarlo como prioridad alta.'
  },
  {
    patterns: [/mi sistema se cayo/, /se cayo el sistema/, /no funciona nada/, /servicio caido/],
    reply:
      'Esto parece critico. Recomiendo escalar de inmediato con ticket alta prioridad: "escalar: caida del servicio + impacto + hora".'
  },
  {
    patterns: [/no se el numero del ticket/, /no tengo el id/, /no recuerdo el ticket/],
    reply:
      'Puedes verlo en la tabla de Tickets, columna "Numero ticket". Si quieres, te indico como copiarlo desde el boton "Copiar".'
  },
  {
    patterns: [/mi ticket no ha sido respondido/, /no me responden el ticket/, /sin respuesta/],
    reply:
      'Revisa estado y ultima actualizacion del ticket. Si supera el tiempo esperado, escalalo al asesor con prioridad correspondiente.'
  },
  {
    patterns: [/ticket cerrado pero no resolvieron/, /cerraron y sigue fallando/, /mi problema sigue igual/],
    reply:
      'Lamento eso. Solicita reapertura o crea un nuevo ticket indicando que el caso anterior no quedo resuelto.'
  },
  {
    patterns: [/quiero hablar con una persona/, /asesor humano/, /necesito asesor ya/],
    reply:
      'Claro. Para escalarlo de una vez, escribe: "escalar: <detalle del problema y su impacto>".'
  },
  {
    patterns: [/estoy molesto/, /esto no sirve/, /nadie responde/, /muy mala atencion/],
    reply:
      'Lamento la experiencia. Quiero ayudarte a resolverlo hoy: comparteme el ID del ticket o el detalle del caso para escalarlo.'
  },
  {
    patterns: [/como califico/, /encuesta de satisfaccion/, /calificacion del servicio/],
    reply:
      'Cuando el ticket esta cerrado, veras la encuesta. Califica de 1 a 5 y agrega comentario para seguimiento.'
  },
  {
    patterns: [/prioridad alta/, /que significa prioridad alta/],
    reply:
      'Prioridad alta aplica cuando afecta operacion, varios usuarios o un servicio critico.'
  },
  {
    patterns: [/ticket en proceso/, /estado en proceso/],
    reply:
      'En proceso significa que el equipo tecnico ya tomo el caso y esta trabajando en la solucion.'
  },
  {
    patterns: [/ticket abierto/, /estado abierto/],
    reply:
      'Abierto significa que el ticket fue creado y esta pendiente de atencion o asignacion.'
  },
  {
    patterns: [/ticket cerrado/, /estado cerrado/],
    reply:
      'Cerrado significa finalizado. Si no se soluciono, puedes solicitar reapertura o crear nuevo ticket.'
  },
  {
    patterns: [/quitar ticket/, /eliminar ticket/, /borrar ticket/],
    reply:
      'Eliminar ticket depende de permisos del rol. Si no te aparece la opcion, debe hacerlo un usuario autorizado.'
  },
  {
    patterns: [/cambiar prioridad/, /subir prioridad/, /bajar prioridad/],
    reply:
      'Indica impacto del problema para justificar el cambio y el asesor podra actualizar la prioridad.'
  },
  {
    patterns: [/no me deja enviar mensaje/, /boton enviar no funciona/],
    reply:
      'Verifica conexion y recarga la pagina. Si sigue fallando, crea ticket tecnico indicando la pantalla exacta.'
  },
  {
    patterns: [/no aparecen notificaciones/, /notificaciones no llegan/],
    reply:
      'Pulsa "Actualizar" en notificaciones. Si hay muchas pendientes, usa "Marcar todo leido". Si no llegan nuevas, reportalo.'
  },
  {
    patterns: [/soy administrador.*no veo metricas/, /admin.*dashboard vacio/],
    reply:
      'Valida rol admin y que existan tickets registrados. Si el panel sigue vacio, toca revisar backend o consultas.'
  },
  {
    patterns: [/soy asesor.*no veo tickets/, /asesor.*sin tickets asignados/],
    reply:
      'Puede no haber asignaciones o hay filtros activos. Limpia filtros y revisa nuevamente la bandeja.'
  },
  {
    patterns: [/soy programador.*no veo casos/, /programador.*no tengo tickets/],
    reply:
      'Revisa que tengas rol programador y que el asesor te haya asignado casos.'
  },
  {
    patterns: [/error 500/, /codigo 500/],
    reply:
      'Error 500 indica problema del servidor. Recomendado: ticket prioridad alta con hora, modulo afectado y captura.'
  },
  {
    patterns: [/error 404/, /codigo 404/],
    reply:
      'Error 404 indica recurso o ruta no encontrada. Verifica URL; si pasa dentro de la plataforma, reportalo por ticket.'
  },
  {
    patterns: [/error de conexion/, /no conecta/, /conexion fallida/],
    reply:
      'Verifica internet y VPN si aplica. Si afecta a varios usuarios, escalalo como urgente.'
  },
  {
    patterns: [/mongodb no conecta/, /mongo no conecta/],
    reply:
      'Revisa MONGO_URI, estado del servicio MongoDB y credenciales. Si es ambiente productivo, escalalo de inmediato.'
  },
  {
    patterns: [/jwt falla/, /token invalido/, /token vencido/],
    reply:
      'Valida que el token exista, no este vencido y viaje en Authorization Bearer.'
  },
  {
    patterns: [/no guarda el ticket/, /ticket no se crea/, /fallo al crear ticket/],
    reply:
      'Confirma campos requeridos: titulo, descripcion, empresa y prioridad. Si aun falla, comparte el error para escalarlo.'
  },
  {
    patterns: [/tabla de tickets no actualiza/, /tabla no actualiza/, /no refresca tickets/],
    reply:
      'Usa "Actualizar", limpia filtros y verifica conexion. Si persiste, puede ser fallo frontend/backend y debe escalarse.'
  },
  {
    patterns: [/asesor no recibe mi mensaje/, /mensaje no le llega al asesor/],
    reply:
      'Verifica que el ticket este activo y que el mensaje aparezca en conversacion. Si no, reporta el caso tecnico.'
  },
  {
    patterns: [/no asigno asesor/, /sin asesor asignado/],
    reply:
      'Si esta sin asesor y el caso es urgente, solicita escalamiento para asignacion manual.'
  },
  {
    patterns: [/caida del servicio/, /afecta a todos los usuarios/, /servicio fuera/],
    reply:
      'Eso es prioridad alta. Registra servicio afectado, hora de inicio y alcance del impacto para atencion inmediata.'
  },
  {
    patterns: [/tengo problema pero no se explicarlo/, /no se explicarlo/, /no se que poner/],
    reply:
      'No te preocupes. Dime: que hacias, que esperabas y que ocurrio. Con eso te ayudo a crear un ticket claro.'
  },
  {
    patterns: [/quiero cambiar mi correo/, /cambiar correo/, /actualizar correo/],
    reply:
      'Ese cambio requiere validacion de cuenta. Debe gestionarlo un administrador o ticket de soporte.'
  },
  {
    patterns: [/no puedo adjuntar/, /no deja adjuntar/, /adjuntar evidencia/],
    reply:
      'Revisa formato y tamano del archivo. Si la plataforma lo bloquea, reporta el fallo con tipo de archivo y peso.'
  },
  {
    patterns: [/el sistema se cerro solo/, /me saco de la cuenta/, /se cerro la sesion/],
    reply:
      'Puede ser sesion expirada. Inicia sesion de nuevo; si se repite, reporta hora y frecuencia para revisar autenticacion.'
  },
  {
    patterns: [/como uso la plataforma/, /como funciona la plataforma/],
    reply:
      'Flujo basico: crear ticket, revisar estado, conversar en el detalle y cerrar con encuesta de satisfaccion.'
  },
  {
    patterns: [/como reviso mis tickets/, /donde reviso mis tickets/],
    reply:
      'Entra a Tickets y usa filtros por estado o prioridad. Tambien puedes buscar por titulo, empresa o cliente.'
  },
  {
    patterns: [/problema con mi computador/, /problema con internet/],
    reply:
      'Indica sistema operativo, mensaje de error y desde cuando ocurre. Si afecta trabajo, conviene crear ticket de soporte.'
  },
  {
    patterns: [/dashboard vacio/, /graficas no cargan/, /metricas no cargan/],
    reply:
      'Actualiza la pagina y valida permisos del rol. Si persiste, puede ser carga de datos y debe revisarse backend.'
  },
  {
    patterns: [/no puedo cerrar el ticket/, /no me deja cerrar/],
    reply:
      'Verifica estado actual y permisos del rol. Si el boton no aplica cambio, reporta error con ID del ticket.'
  },
  {
    patterns: [/quiero reabrir ticket/, /reabrir ticket/, /abrir de nuevo ticket/],
    reply:
      'Comparte el ID del ticket y que sigue fallando para solicitar reapertura o crear seguimiento.'
  },
  {
    patterns: [/quiero cancelar solicitud/, /cancelar ticket/],
    reply:
      'Comparte el ID del ticket y motivo de cancelacion para que el asesor o admin actualice el estado.'
  },
  {
    patterns: [/no tengo permisos/, /permisos insuficientes/, /acceso denegado/],
    reply:
      'Tu rol puede no tener acceso a esa accion. Solicita validacion de permisos al administrador.'
  },
  {
    patterns: [/quiero cambiar mi rol/, /cambiar rol/],
    reply:
      'El cambio de rol debe hacerlo un administrador. Indica rol actual y rol requerido en una solicitud.'
  },
  {
    patterns: [/no se que prioridad escoger/, /que prioridad pongo/],
    reply:
      'Usa alta si afecta operacion, media si limita tu trabajo y baja para dudas o impactos menores.'
  },
  {
    patterns: [/error de seguridad/, /alguien entro a mi cuenta/, /acceso no autorizado/],
    reply:
      'Caso de seguridad: cambia contrasena y escalalo ya con prioridad alta. Evita compartir datos sensibles por chat.'
  },
  {
    patterns: [/no recibo correos/, /no llegan correos/, /email no llega/],
    reply:
      'Revisa spam y correo registrado. Si la plataforma debe enviar notificaciones y no llegan, reporta por ticket.'
  },
  {
    patterns: [/quiero filtrar tickets/, /como filtrar tickets/],
    reply:
      'Usa el buscador y filtros justo arriba de la tabla: estado, prioridad y texto libre.'
  },
  {
    patterns: [/no funciona el filtro/, /filtro da error/, /filtro no aplica/],
    reply:
      'Limpia y reaplica filtros. Si sigue fallando, indica el filtro exacto y el resultado esperado para escalarlo.'
  },
  {
    patterns: [/ya intente todo/, /ya probe todo/, /no se pudo con nada/],
    reply:
      'Gracias por intentarlo. Para avanzar rapido, lo mejor es escalar con detalle de pruebas realizadas y resultado.'
  },
  {
    patterns: [/puedes crear el ticket por mi/, /crealo tu/, /crea ticket por mi/],
    reply:
      'Si. Enviame titulo, descripcion, empresa y prioridad. O usa: "escalar: <detalle>" para crearlo directo.'
  },
  {
    patterns: [/chat se duplica/, /responde dos veces/, /mensaje duplicado/],
    reply:
      'Gracias por reportarlo. Eso apunta a un evento duplicado de chat; conviene crear ticket tecnico para revision.'
  }
];

module.exports = {
  SUPPORT_FALLBACK_REPLY,
  SUPPORT_SYSTEM_PROMPT,
  SUPPORT_FEW_SHOT_EXAMPLES,
  SUPPORT_KNOWLEDGE
};

