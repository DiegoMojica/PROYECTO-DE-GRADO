import React, { useState } from 'react';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' }
];

export default function TicketComposer({ onCreate, loading }) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  const submit = async (evt) => {
    evt.preventDefault();
    if (!title.trim() || !description.trim()) return;
    await onCreate({ title, company, priority, description });
    setTitle('');
    setCompany('');
    setPriority('medium');
    setDescription('');
  };

  return (
    <form className="ticket-composer" onSubmit={submit}>
      <header>
        <h2>Crear nuevo ticket</h2>
        <p>Describe el incidente. Un asesor lo revisara y asignara un especialista.</p>
      </header>
      <div className="composer-grid">
        <label>
          <span>Titulo</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Error al generar reporte" required />
        </label>
        <label>
          <span>Empresa</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de tu empresa" />
        </label>
        <label>
          <span>Prioridad</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>Descripcion</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cuentanos que ocurre, incluye pasos para reproducir el problema."
          rows={4}
          required
        />
      </label>
      <button type="submit" className="cta-button" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar ticket'}
      </button>
    </form>
  );
}
