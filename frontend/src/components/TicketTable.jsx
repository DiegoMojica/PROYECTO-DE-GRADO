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
  const [copiedTicketId, setCopiedTicketId] = React.useState('');

  const copyTicketNumber = async (event, ticketId) => {
    event.stopPropagation();
    const value = String(ticketId || '');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedTicketId(value);
      window.setTimeout(() => {
        setCopiedTicketId((current) => (current === value ? '' : current));
      }, 1400);
    } catch (error) {
      console.error('No se pudo copiar el numero de ticket', error);
    }
  };

  return (
    <div className="ticket-table">
      <header>
        <h2>Tickets</h2>
        <span>{tickets.length} resultados</span>
      </header>
      <div className="table-scroll">
        <table>
          <colgroup>
            <col style={{ width: '260px' }} />
            <col style={{ width: '260px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '170px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '210px' }} />
            <col style={{ width: '170px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Numero ticket</th>
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
                <td className="ticket-col-id">
                  <div className="ticket-id-cell">
                    <span className="ticket-id-value" title={ticket._id}>
                      {ticket._id}
                    </span>
                    <button type="button" className="ticket-id-copy" onClick={(event) => copyTicketNumber(event, ticket._id)}>
                      {copiedTicketId === ticket._id ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </td>
                <td className="ticket-col-title">{ticket.title}</td>
                <td className="ticket-col-company">{ticket.company || 'N/D'}</td>
                <td className="ticket-col-client">{ticket.createdBy?.name || ticket.createdBy?.email || 'N/D'}</td>
                <td className="ticket-col-priority">
                  <span className={PRIORITY_COLORS[ticket.priority] || 'tag'}>{ticket.priority}</span>
                </td>
                <td className="ticket-col-status">{STATUS_LABELS[ticket.status] || ticket.status}</td>
                <td className="ticket-col-satisfaction">
                  {ticket.satisfactionRating ? (
                    <span className="tag tag-success">{ticket.satisfactionRating}/5</span>
                  ) : (
                    <span className="tag">Pendiente</span>
                  )}
                </td>
                <td className="ticket-col-assigned">
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
                <td className="ticket-col-updated">{new Date(ticket.updatedAt).toLocaleString()}</td>
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
