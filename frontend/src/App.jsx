import React, { useCallback, useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import api from './services/api';
import { socket } from './services/socket';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((res) => {
        if (res.data.ok) {
          setUser({ id: res.data.user._id || res.data.user.id, ...res.data.user });
        } else {
          localStorage.removeItem('token');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = useCallback(
    (sessionUser) => {
      setUser(sessionUser);
    },
    []
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    if (socket.connected) {
      socket.disconnect();
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">Cargando plataforma...</div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return <Dashboard user={user} onLogout={handleLogout} />;
}
