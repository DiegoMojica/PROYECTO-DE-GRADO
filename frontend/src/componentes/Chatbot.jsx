import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
const socket = io(BACKEND);

export default function Chatbot({ userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const room = userId || 'anon-room';
  const scrollRef = useRef();

  useEffect(() => {
    socket.emit('join', { room });
    socket.on('chat_reply', ({ reply }) => {
      setMessages((m) => [...m, { author: 'bot', text: reply }]);
    });
    return () => socket.off('chat_reply');
  }, [room]);

  const send = () => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { author: 'user', text }]);
    socket.emit('chat_message', { userId, text, room });
    setText('');
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
      <div ref={scrollRef} style={{ maxHeight: 300, overflowY: 'auto', padding: 6 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.author === 'bot' ? 'left' : 'right', margin: 6 }}>
            <div style={{ display: 'inline-block', padding: 8, borderRadius: 6, background: m.author === 'bot' ? '#f1f1f1' : '#007bff', color: m.author === 'bot' ? '#000' : '#fff' }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, padding: 8 }} placeholder="Escribe tu pregunta..." />
        <button onClick={send} style={{ marginLeft: 8 }}>Enviar</button>
      </div>
    </div>
  );
}