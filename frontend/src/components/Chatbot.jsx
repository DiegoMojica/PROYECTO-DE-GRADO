import React, { useCallback, useEffect, useRef, useState } from 'react';
import { socket, ensureSocketConnection, joinRoom } from '../services/socket';

const QUICK_PROMPTS = [
  { label: 'Como crear un ticket', text: 'Como puedo crear un ticket nuevo?' },
  { label: 'Estado de mi ticket', text: 'Cual es el estado de mi ticket 000000000000000000000000?' },
  { label: 'Requisitos de visita', text: 'Necesito programar una visita tecnica' },
  { label: 'Soporte urgente', text: 'Tengo un problema urgente, no puedo acceder al sistema' }
];

export default function Chatbot({ userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const room = userId || 'anon-room';
  const scrollRef = useRef(null);
  const lastBotReplyRef = useRef({ text: '', at: 0 });
  const processedMessageIdsRef = useRef([]);

  const rememberProcessedMessageId = useCallback((clientMessageId) => {
    if (!clientMessageId) return;
    processedMessageIdsRef.current.push(String(clientMessageId));
    if (processedMessageIdsRef.current.length > 250) {
      processedMessageIdsRef.current.splice(0, processedMessageIdsRef.current.length - 250);
    }
  }, []);

  const hasProcessedMessageId = useCallback((clientMessageId) => {
    if (!clientMessageId) return false;
    return processedMessageIdsRef.current.includes(String(clientMessageId));
  }, []);

  const createClientMessageId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  useEffect(() => {
    ensureSocketConnection(userId);
    joinRoom(room);

    const handler = ({ reply, source, clientMessageId }) => {
      if (clientMessageId && hasProcessedMessageId(clientMessageId)) return;

      const normalizedReply = (reply || '').trim();
      const now = Date.now();
      const isDuplicate =
        normalizedReply &&
        normalizedReply === lastBotReplyRef.current.text &&
        now - lastBotReplyRef.current.at < 1500;
      if (isDuplicate) return;

      lastBotReplyRef.current = { text: normalizedReply, at: now };
      rememberProcessedMessageId(clientMessageId);
      setMessages((prev) => [...prev, { author: 'bot', text: reply, source: source || 'rules' }]);
    };

    socket.on('chat_reply', handler);
    return () => {
      socket.off('chat_reply', handler);
    };
  }, [hasProcessedMessageId, rememberProcessedMessageId, room, userId]);

  const send = useCallback(() => {
    const outgoing = text.trim();
    if (!outgoing) return;
    const clientMessageId = createClientMessageId();
    setMessages((prev) => [...prev, { author: 'user', text: outgoing }]);
    socket.emit('chat_message', { userId, text: outgoing, room, clientMessageId });
    setText('');
  }, [createClientMessageId, text, userId, room]);

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
      const clientMessageId = createClientMessageId();
      setMessages((prev) => [...prev, { author: 'user', text: promptText }]);
      socket.emit('chat_message', { userId, text: promptText, room, clientMessageId });
    },
    [createClientMessageId, room, userId]
  );

  return (
    <div className="chatbot-card">
      <div className="chatbot-header">
        <h2>Chatbot IA</h2>
        <p>
          Enter para enviar. Escape limpia el borrador. Si la IA no esta disponible recibiras una guia paso a paso y podremos crear un ticket por ti.
        </p>
      </div>
      <div className="chatbot-body">
        <div className="chatbot-prompts">
          {QUICK_PROMPTS.map((prompt) => (
            <button key={prompt.label} type="button" onClick={() => sendPrompt(prompt.text)}>
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
                {msg.author === 'bot' && msg.source && (
                  <div className="chatbot-source">
                    {msg.source === 'ai' ? 'IA local' : 'Reglas'}
                  </div>
                )}
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
