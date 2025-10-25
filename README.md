```markdown
# Support Ticket System - Proyecto de Grado

Resumen:
Aplicación web para gestión de soporte técnico multiempresa con chatbot IA (OpenAI) y notificaciones en tiempo real (Socket.io).

Estructura:
- backend/: API Node.js + Express + MongoDB + Socket.io + OpenAI proxy
- frontend/: React app (simple) con componente de chatbot

Requisitos:
- Node.js 18+ (compatible con fetch global)
- MongoDB (local o MongoDB Atlas)
- Cuenta y API Key de OpenAI (opcional si quieres activar IA)
- Git y GitHub (para subir el repo)

Variables de entorno:
Crea un archivo .env en backend/ con las variables:
MONGO_URI=...
JWT_SECRET=...
OPENAI_API_KEY=...

Instalación backend:
cd backend
npm install
npm run dev

Instalación frontend:
cd frontend
npm install
npm start

Notas:
- El backend expone APIs REST y Socket.io en el puerto 4000 por defecto.
- El chatbot hace llamadas a la API de OpenAI desde el backend (evita exponer la API Key).
- Ajusta prompts en backend/chatbot/openaiChat.js para personalizar respuestas.

Documentación completa y archivos de la tesis están en /docs (puedes agregar más en el repo).
```