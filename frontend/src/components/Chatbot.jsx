import React, { useCallback, useEffect, useRef, useState } from 'react';
import { socket, ensureSocketConnection, joinRoom } from '../services/socket';
import api from '../services/api';

const QUICK_PROMPTS = [
  { label: 'Como crear un ticket', text: 'Como puedo crear un ticket nuevo?' },
  { label: 'Estado de mi ticket', text: 'Quiero consultar el estado de mi ticket' },
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
    setMessages((prev) => [...prev, { author: 'user', text: outgoing }]);
    api
      .post('/chatbot', { message: outgoing })
      .then((res) => {
        const reply = res?.data?.reply || 'No se pudo generar respuesta en este momento.';
        const source = res?.data?.source || 'rules';
        setMessages((prev) => [...prev, { author: 'bot', text: reply, source }]);
      })
      .catch(() => {
        setMessages((prev) => [
          ...prev,
          {
            author: 'bot',
            text: 'Error al consultar el chatbot. Verifica que el backend este activo.',
            source: 'rules'
          }
        ]);
      });
    setText('');
  }, [text]);

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
      api
        .post('/chatbot', { message: promptText })
        .then((res) => {
          const reply = res?.data?.reply || 'No se pudo generar respuesta en este momento.';
          const source = res?.data?.source || 'rules';
          setMessages((prev) => [...prev, { author: 'bot', text: reply, source }]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            {
              author: 'bot',
              text: 'Error al consultar el chatbot. Verifica que el backend este activo.',
              source: 'rules'
            }
          ]);
        });
    },
    []
  );

  const downloadReport = useCallback(async (range) => {
    try {
      const response = await api.get(`/reports/tickets?range=${range}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_${range}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          author: 'bot',
          text: 'No se pudo descargar el reporte PDF. Verifica permisos y backend.',
          source: 'rules'
        }
      ]);
    }
  }, []);

  const renderActionButtons = useCallback(
    (msg) => {
      if (msg.author !== 'bot') return null;
      const text = String(msg.text || '').toLowerCase();
      const actions = [];

      if (text.includes('/api/reports/tickets?range=weekly') || text.includes('resumen semanal generado')) {
        actions.push(
          <button
            key="weekly"
            type="button"
            className="ghost-button"
            style={{ marginTop: 10 }}
            onClick={() => downloadReport('weekly')}
          >
            Descargar PDF semanal
          </button>
        );
      }

      if (text.includes('/api/reports/tickets?range=monthly') || text.includes('resumen mensual generado')) {
        actions.push(
          <button
            key="monthly"
            type="button"
            className="ghost-button"
            style={{ marginTop: 10, marginLeft: 8 }}
            onClick={() => downloadReport('monthly')}
          >
            Descargar PDF mensual
          </button>
        );
      }

      if (!actions.length) return null;
      return <div>{actions}</div>;
    },
    [downloadReport]
  );

  return (
    <div className="chatbot-card">
      <div className="chatbot-header">
        <h2>Chatbot de soporte</h2>
        <p>Recibe orientacion, consulta estados y escala casos a soporte humano cuando sea necesario.</p>
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
                    {msg.source === 'ai' ? 'Asistente' : 'Reglas'}
                  </div>
                )}
                {msg.text}
                {renderActionButtons(msg)}
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
