import React, { useCallback, useEffect, useRef, useState } from 'react';
import { socket, ensureSocketConnection, joinRoom } from '../services/socket';

const QUICK_PROMPTS = [
  { label: 'Cómo crear un ticket', text: '¿Cómo puedo crear un ticket nuevo?' },
  { label: 'Estado de mi ticket', text: '¿Cuál es el estado de mi ticket 000000000000000000000000?' },
  { label: 'Requisitos de visita', text: 'Necesito programar una visita técnica' },
  { label: 'Soporte urgente', text: 'Tengo un problema urgente, no puedo acceder al sistema' }
];

export default function Chatbot({ userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const room = userId || 'anon-room';
  const scrollRef = useRef(null);

  useEffect(() => {
    ensureSocketConnection(userId);
    joinRoom(room);
    const handler = ({ reply }) => {
      setMessages((prev) => [...prev, { author: 'bot', text: reply }]);
    };
    socket.on('chat_reply', handler);
    return () => {
      socket.off('chat_reply', handler);
    };
  }, [room, userId]);

  const send = useCallback(() => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { author: 'user', text }]);
    socket.emit('chat_message', { userId, text, room });
    setText('');
  }, [text, userId, room]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (evt) => {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault();
      send();
    }
    if (evt.key === 'Escape') {
      evt.preventDefault();
      setText('');
    }
  };

  const sendPrompt = useCallback(
    (promptText) => {
      setMessages((prev) => [...prev, { author: 'user', text: promptText }]);
      socket.emit('chat_message', { userId, text: promptText, room });
    },
    [room, userId]
  );

  return (
    <div className="chatbot-card">
      <div className="chatbot-header">
        <h2>Chatbot IA</h2>
        <p>
          Enter para enviar. Escape limpia el borrador. Si la IA no está disponible recibirás una guía paso a paso y podremos crear un ticket por ti.
        </p>
      </div>
      <div className="chatbot-body">
        <div className="chatbot-prompts">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => sendPrompt(prompt.text)}
            >
              {prompt.label}
            </button>
          ))}
        </div>
        <div ref={scrollRef} className="chatbot-messages">
          {messages.length === 0 ? (
            <div className="chatbot-empty">
              Inicia la conversacion para recibir ayuda inmediata.
              <span>Ejemplo: "Necesito crear un ticket de soporte."</span>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.author}-${index}`}
                className={`chatbot-bubble ${msg.author === 'bot' ? 'bot' : 'user'}`}
              >
                {msg.text}
              </div>
            ))
          )}
        </div>
        <div className="chatbot-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
          />
          <button type="button" onClick={send}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
