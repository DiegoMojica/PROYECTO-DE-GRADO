import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', target: 'section-dashboard' },
  { id: 'tickets', label: 'Tickets', target: 'section-tickets' },
  { id: 'chatbot', label: 'Chatbot', target: 'section-chatbot' }
];

export default function NavBar({ active, onNavigate, onLogout, user }) {
  return (
    <nav className="main-navbar">
      <div className="nav-brand">
        <span className="brand-logo">Soporte+</span>
        <div className="brand-meta">
          <small>Gestión inteligente de tickets</small>
          {user?.name && <span>{user.name}</span>}
        </div>
      </div>
      <ul className="nav-links">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={active === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.target, item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="nav-actions">
        <button type="button" className="ghost-button" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
