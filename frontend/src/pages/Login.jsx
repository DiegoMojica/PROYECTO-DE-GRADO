import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000'}/api/auth/login`, { email, password });
      if (res.data.ok) {
        const user = res.data.user;
        onLogin(user);
        localStorage.setItem('token', res.data.token);
      } else {
        alert('Login failed');
      }
    } catch (err) {
      alert('Error login');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Login</h3>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
      <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><br />
      <button onClick={submit}>Entrar</button>
    </div>
  );
}