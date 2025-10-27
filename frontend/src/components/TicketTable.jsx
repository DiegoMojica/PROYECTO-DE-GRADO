import React from 'react';

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En progreso',
  awaiting_client: 'Esperando cliente',
  resolved: 'Resuelto',
  closed: 'Cerrado'
};

const PRIORITY_COLORS = {
  low: 'tag tag-low',
  medium: 'tag tag-medium',
  high: 'tag tag-high',
  critical: 'tag tag-critical'
};

export default function TicketTable({ tickets, onSelect, selectedId }) {
  return (
    <div className="ticket-table">
      <header>
        <h2>Tickets</h2>
        <span>{tickets.length} resultados</span>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Titulo</th>
              <th>Empresa</th>
              <th>Cliente</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Satisfaccion</th>
              <th>Asignado</th>
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr
                key={ticket._id}
                onClick={() => onSelect(ticket)}
                className={selectedId === ticket._id ? 'selected' : ''}
              >
                <td>{ticket._id.slice(-6)}</td>
                <td>{ticket.title}</td>
                <td>{ticket.company || 'N/D'}</td>
                <td>{ticket.createdBy?.name || ticket.createdBy?.email || 'N/D'}</td>
                <td>
                  <span className={PRIORITY_COLORS[ticket.priority] || 'tag'}>{ticket.priority}</span>
                </td>
                <td>{STATUS_LABELS[ticket.status] || ticket.status}</td>
                <td>
                  {ticket.satisfactionRating ? (
                    <span className="tag tag-success">{ticket.satisfactionRating}/5</span>
                  ) : (
                    <span className="tag">Pendiente</span>
                  )}
                </td>
                <td>
                  {ticket.assignedAgent?.name && (
                    <div className="avatar-stack">
                      <span className="tag tag-agent">{ticket.assignedAgent.name}</span>
                    </div>
                  )}
                  {ticket.assignedProgrammer?.name && (
                    <div className="avatar-stack">
                      <span className="tag tag-programmer">{ticket.assignedProgrammer.name}</span>
                    </div>
                  )}
                  {!ticket.assignedAgent && !ticket.assignedProgrammer && 'Sin asignar'}
                </td>
                <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {!tickets.length && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', opacity: 0.6 }}>
                  No hay tickets para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
