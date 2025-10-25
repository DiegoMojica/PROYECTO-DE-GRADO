import React from 'react';
import Chatbot from '../components/Chatbot';

export default function Dashboard({ user }) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Bienvenido, {user.name}</h2>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <h4>Tickets (panel demo)</h4>
          <p>Aquí irán listas y filtros de tickets.</p>
        </div>
        <div style={{ width: 360 }}>
          <h4>Chatbot</h4>
          <Chatbot userId={user.id || user._id || 'anon-room'} />
        </div>
      </div>
    </div>
  );
}