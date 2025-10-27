# Sistema de Tickets de Soporte

Aplicacion full stack para gestionar solicitudes de soporte multiempresa. La plataforma combina una API Node.js/Express con MongoDB, Socket.IO y autenticacion JWT, junto a un panel React en tiempo real y un chatbot basado en reglas con integracion opcional a servicios de IA.

## Contenido
1. [Caracteristicas clave](#caracteristicas-clave)
2. [Arquitectura y carpetas](#arquitectura-y-carpetas)
3. [Requisitos previos](#requisitos-previos)
4. [Variables de entorno](#variables-de-entorno)
5. [Instalacion](#instalacion)
6. [Puesta en marcha](#puesta-en-marcha)
7. [Usuarios y datos de ejemplo](#usuarios-y-datos-de-ejemplo)
8. [Chatbot e integraciones IA](#chatbot-e-integraciones-ia)
9. [Scripts utiles](#scripts-utiles)
10. [Pruebas rapidas desde consola](#pruebas-rapidas-desde-consola)
11. [Resolucion de problemas](#resolucion-de-problemas)

## Caracteristicas clave
- Roles completos (cliente, asesor, programador y administrador) con permisos diferenciados.
- Tickets con historial de estados, mensajes y asignaciones, incluyendo seguimiento de SLA y satisfaccion.
- Notificaciones persistentes y en tiempo real mediante Socket.IO.
- Dashboard con metricas, graficas y generacion de reportes PDF.
- Chatbot guiado por reglas que orienta al usuario y puede crear tickets automaticamente, con opcion de conectarlo a OpenAI o Hugging Face.

## Arquitectura y carpetas
- `backend/`: API REST con Express, MongoDB, autenticacion JWT, Socket.IO, reportes en PDF y chatbot.
- `frontend/`: Aplicacion React (create-react-app) con panel responsive, componentes reutilizables y servicio websocket.
- `backend/scripts/`: utilidades auxiliares (por ejemplo `seedSample.js` para datos demo).
- `frontend/public/`: HTML base y recursos estaticos.

## Requisitos previos
- Node.js 18 o superior (necesario para `fetch` nativo en el backend).
- npm 8 o superior (se instala junto a Node).
- MongoDB en ejecucion (local o remoto). Por defecto se usa `mongodb://localhost:27017/support`.
- API key de OpenAI o Hugging Face si deseas habilitar respuestas IA (opcional).

Comprueba tus versiones:
```bash
node --version
npm --version
```

## Variables de entorno
### Backend (`backend/.env`)
1. Copia el archivo de ejemplo:
   ```bash
   cd backend
   copy .env.ejemplo .env   # en Linux o macOS usa: cp .env.ejemplo .env
   ```
2. Ajusta los valores principales:
   - `MONGO_URI`: cadena de conexion a MongoDB.
   - `JWT_SECRET`: llave para firmar tokens JWT.
   - `PORT`: puerto del servidor (4000 por defecto).
   - `CLIENT_URL`: origen permitido para CORS y Socket.IO (por ejemplo `http://localhost:3000`).
   - `OPENAI_API_KEY`: clave de OpenAI (opcional).
   - `HF_API_KEY` y `HF_MODEL`: credenciales de Hugging Face (opcional).

### Frontend (`frontend/.env`)
Define la URL del backend:
```env
REACT_APP_BACKEND_URL=http://localhost:4000
```
Cambia este valor si modificas el puerto o despliegas en otro dominio.

## Instalacion
Ejecuta una sola vez por entorno.

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

> Consejo: usa dos terminales distintas, una para backend y otra para frontend.

## Puesta en marcha
### Iniciar backend (Express + Socket.IO)
```bash
cd backend
npm run dev
```
El API quedara disponible en `http://localhost:4000`. Para modo produccion utiliza `npm start`.

### Iniciar frontend (React)
```bash
cd frontend
npm start
```
La interfaz se abre en `http://localhost:3000` y consume la API configurada en `REACT_APP_BACKEND_URL`.

## Usuarios y datos de ejemplo
El backend incluye un script para poblar datos de demostracion:
```bash
cd backend
npm run seed
```
Crea las cuentas (contrasena `demo123`):
- `cliente@demo.com`
- `asesor@demo.com`
- `programador@demo.com`
- `admin@demo.com`

Tambien genera tickets y notificaciones para probar el flujo completo.

## Chatbot e integraciones IA
### Modo OpenAI
1. Genera una API key en `https://platform.openai.com/account/api-keys`.
2. Define `OPENAI_API_KEY` en `backend/.env`.
3. Reinicia el backend. El chatbot combinara reglas y respuestas de `gpt-3.5-turbo`.

### Modo Hugging Face
1. Crea un token `Read` en `https://huggingface.co/settings/tokens`.
2. Anade `HF_API_KEY` y `HF_MODEL` (por ejemplo `mistralai/Mistral-7B-Instruct-v0.2`) en `backend/.env`.
3. Si `OPENAI_API_KEY` esta vacio pero Hugging Face esta configurado, el chatbot usara esa ruta.

Sin claves externas el bot permanece en modo de reglas, orientando al usuario con respuestas deterministicas.

## Scripts utiles
### Backend
- `npm run dev`: servidor con recarga en caliente (nodemon).
- `npm start`: servidor en modo produccion.
- `npm run seed`: carga datos de muestra.

### Frontend
- `npm start`: modo desarrollo con hot reload.
- `npm run build`: compila la version optimizada en `frontend/build`.

## Pruebas rapidas desde consola
```powershell
# 1. Iniciar sesion como cliente y obtener el token
$login = Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"cliente@demo.com","password":"demo123"}'
$token = $login.token

# 2. Crear un ticket usando la API
Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/tickets `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body '{"title":"Prueba via consola","description":"Ticket creado desde PowerShell","priority":"high"}'
```

## Resolucion de problemas
- **Fallo al conectar con MongoDB**: verifica que el servicio este activo (`mongod`) y que `MONGO_URI` sea accesible desde tu entorno.
- **Errores CORS o websocket**: asegurate de que `CLIENT_URL` y `REACT_APP_BACKEND_URL` apunten al origen correcto (incluye protocolo y puerto).
- **Notificaciones no llegan**: revisa la consola del backend para confirmar que Socket.IO este inicializado y que no existan bloqueadores de red en el navegador.
- **Chatbot sin respuestas IA**: comprueba las claves, reinicia el backend y revisa la salida por posibles errores de autenticacion o limite de cuota.

