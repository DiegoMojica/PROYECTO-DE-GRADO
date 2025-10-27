import React from 'react';

const DEFAULT_ORDER = [
  { key: 'open', label: 'Nuevos' },
  { key: 'in_progress', label: 'En proceso' },
  { key: 'awaiting_client', label: 'Esperando cliente' },
  { key: 'resolved', label: 'Resueltos' },
  { key: 'closed', label: 'Cerrados' }
];

export default function TicketBoard({
  groupedTickets = {},
  onSelect,
  selectedId,
  statusOrder = DEFAULT_ORDER,
  allowDelete,
  onDelete
}) {
  return (
    <div className="ticket-board">
      {statusOrder.map((section) => {
        const tickets = groupedTickets[section.key] || [];
        return (
          <div key={section.key} className="ticket-column">
            <header>
              <h4>{section.label}</h4>
              <span>{tickets.length}</span>
            </header>
            <div className="ticket-column-body">
              {tickets.map((ticket) => {
                const canDelete = allowDelete ? allowDelete(ticket) : false;
                return (
                  <article
                    key={ticket._id}
                    className={`ticket-card ${selectedId === ticket._id ? 'selected' : ''}`}
                    onClick={() => onSelect(ticket)}
                  >
                    <div className="ticket-card-header">
                      <h5>{ticket.title}</h5>
                      <span className={`tag tag-${ticket.priority}`}>{ticket.priority}</span>
                    </div>
                    <p>{ticket.description}</p>
                    <ul className="ticket-card-meta">
                      <li>
                        Cliente:{' '}
                        <strong>{ticket.createdBy?.name || ticket.createdBy?.email || 'N/D'}</strong>
                      </li>
                      {ticket.assignedAgent?.name && (
                        <li>
                          Asesor: <strong>{ticket.assignedAgent.name}</strong>
                        </li>
                      )}
                      {ticket.assignedProgrammer?.name && (
                        <li>
                          Programador: <strong>{ticket.assignedProgrammer.name}</strong>
                        </li>
                      )}
                      <li>
                        Actualizado: <strong>{new Date(ticket.updatedAt).toLocaleString()}</strong>
                      </li>
                    </ul>
                    {canDelete && (
                      <button
                        type="button"
                        className="ghost-button destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete?.(ticket);
                        }}
                      >
                        Eliminar ticket
                      </button>
                    )}
                  </article>
                );
              })}
              {!tickets.length && <div className="ticket-column-empty">Sin tickets en esta categoría.</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
