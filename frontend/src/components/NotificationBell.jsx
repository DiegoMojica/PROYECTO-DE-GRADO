import React, { useState } from 'react';

export default function NotificationBell({ notifications, onMarkRead, onMarkAllRead, onRefresh }) {
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const toggle = () => setOpen((value) => !value);

  return (
    <div className="notification-wrapper">
      <button type="button" className="ghost-button" onClick={toggle}>
        Notificaciones {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-panel">
          <header>
            <h4>Actividad reciente</h4>
            <div className="notification-actions">
              {unreadCount > 0 && (
                <button type="button" onClick={onMarkAllRead}>
                  Marcar todo leido
                </button>
              )}
              <button type="button" onClick={onRefresh}>Actualizar</button>
            </div>
          </header>
          <ul>
            {notifications.map((notification) => (
              <li key={notification._id} className={notification.read ? '' : 'unread'}>
                <div>
                  <strong>{notification.message}</strong>
                  <span>{new Date(notification.createdAt).toLocaleString()}</span>
                </div>
                {!notification.read && (
                  <button type="button" onClick={() => onMarkRead(notification._id)}>
                    Marcar como leida
                  </button>
                )}
              </li>
            ))}
            {!notifications.length && <li>No hay notificaciones.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
