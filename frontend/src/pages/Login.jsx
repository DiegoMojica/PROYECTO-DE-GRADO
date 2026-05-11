import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('cliente@demo.com');
  const [password, setPassword] = useState('demo123');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('');
  }, [isRegister]);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (isRegister && !name.trim()) return false;
    return true;
  }, [email, password, isRegister, name]);

  const submit = useCallback(async () => {
    if (loading || !canSubmit) return;
    try {
      setLoading(true);
      if (isRegister) {
        await axios.post(`${API_BASE}/api/auth/register`, { name, email, password });
        setMessage('Cuenta creada. Iniciando sesion...');
      }

      const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
      if (res.data.ok) {
        const user = res.data.user;
        onLogin(user);
        localStorage.setItem('token', res.data.token);
      } else {
        setMessage('Credenciales invalidas');
      }
    } catch (err) {
      const errMessage = err.response?.data?.error || 'Error al procesar la solicitud';
      setMessage(errMessage);
    } finally {
      setLoading(false);
    }
  }, [loading, canSubmit, isRegister, name, email, password, onLogin]);

  const toggleMode = useCallback(() => {
    setIsRegister((value) => !value);
  }, []);

  useEffect(() => {
    const handleKeys = (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        submit();
      }
      if (evt.key === 'Escape') {
        evt.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [submit, toggleMode]);

  return (
    <div className="auth-container">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <span className="auth-hero-highlight">
            <span>Soporte tecnico</span>
            <span>v1.0.0</span>
          </span>
          <h1>Plataforma web de soporte tecnico</h1>
          <p>
            Centraliza tickets, roles, chatbot, seguimiento, encuestas y reportes para equipos de soporte.
          </p>
        </div>
        <div className="auth-hero-content">
          <div className="auth-hero-highlight" style={{ background: 'rgba(15,23,42,0.72)' }}>
            Admin, cliente, asesor y programador
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card-inner">
          <h3>{isRegister ? 'Crear cuenta' : 'Iniciar sesion'}</h3>
          <p>{isRegister ? 'Completa tus datos para registrarte en la plataforma.' : 'Ingresa con tu cuenta corporativa.'}</p>

          {isRegister && (
            <div className="input-wrapper">
              <span aria-hidden="true">@</span>
              <input
                placeholder="Nombre completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="input-wrapper">
            <span aria-hidden="true">@</span>
            <input
              placeholder="Correo electronico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {isRegister && (
            <div className="auth-hint">
              El registro crea cuentas con rol <strong>cliente</strong>. Los demas roles los administra un usuario administrador.
            </div>
          )}

          <div className="input-wrapper">
            <span aria-hidden="true">*</span>
            <input
              placeholder="Contrasena"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && <div className="auth-hint" style={{ color: 'var(--accent)' }}>{message}</div>}

          <button className="cta-button" onClick={submit} disabled={loading || !canSubmit}>
            {loading ? 'Procesando...' : isRegister ? 'Crear cuenta y entrar' : 'Entrar'}
          </button>

          <button className="ghost-button" type="button" onClick={toggleMode}>
            {isRegister ? 'Ya tengo una cuenta. Ingresar' : 'Crear una cuenta nueva'}
          </button>

          <div className="auth-hint">Usa las cuentas demo o registra una cuenta de cliente.</div>
        </div>
      </section>
    </div>
  );
}
