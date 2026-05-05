import React, { useEffect, useState } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'awaiting_client', label: 'Esperando cliente' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' }
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' }
];

export default function TicketFilters({ filters, onChange }) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const submit = (event) => {
    event.preventDefault();
    onChange(localFilters);
  };

  const reset = () => {
    const cleared = { status: '', priority: '', search: '' };
    setLocalFilters(cleared);
    onChange(cleared);
  };

  return (
    <form className="ticket-filters" onSubmit={submit}>
      <div className="ticket-filters-header">
        <h3>Buscar Tickets</h3>
        <span>Aplica filtros para encontrar casos rapido</span>
      </div>

      <div className="filter-grid">
        <label className="filter-control filter-control-search">
          <span>Buscar</span>
          <input
            value={localFilters.search}
            onChange={(e) => setLocalFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Titulo, empresa, cliente o descripcion"
          />
        </label>

        <label className="filter-control filter-control-status">
          <span>Estado</span>
          <select
            value={localFilters.status}
            onChange={(e) => setLocalFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-control filter-control-priority">
          <span>Prioridad</span>
          <select
            value={localFilters.priority}
            onChange={(e) => setLocalFilters((prev) => ({ ...prev, priority: e.target.value }))}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-actions">
        <button type="submit" className="ghost-button">
          Aplicar filtros
        </button>
        <button type="button" className="ghost-button" onClick={reset}>
          Limpiar
        </button>
      </div>
    </form>
  );
}
