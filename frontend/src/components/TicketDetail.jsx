import React, { useEffect, useMemo, useState } from 'react';

const STATUS_AGENT_OPTIONS = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'awaiting_client', label: 'Esperando revision del cliente' },
  { value: 'resolved', label: 'Resuelto' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' }
];

export default function TicketDetail({
  ticket,
  currentUser,
  onSendMessage,
  onChangeStatus,
  onAssign,
  onMarkProgrammerReady,
  onSubmitSatisfaction,
  onDeleteTicket,
  usersByRole,
  loading
}) {
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [programmerId, setProgrammerId] = useState(ticket.assignedProgrammer?._id || '');
  const [satisfaction, setSatisfaction] = useState(5);
  const [satisfactionComment, setSatisfactionComment] = useState('');

  useEffect(() => {
    setMessage('');
    setInternal(false);
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setProgrammerId(ticket.assignedProgrammer?._id || '');
    setSatisfaction(ticket.satisfactionRating || 5);
    setSatisfactionComment('');
  }, [ticket._id, ticket.status, ticket.priority, ticket.assignedProgrammer?._id, ticket.satisfactionRating]);

  const canSendMessage = ['client', 'agent', 'programmer'].includes(currentUser.role);
  const canUseInternal = currentUser.role === 'agent';
  const canAssign = currentUser.role === 'agent';
  const canChangeStatus = currentUser.role === 'agent' && !ticket.resolvedAt;
  const canChangePriority = currentUser.role === 'agent' && !ticket.resolvedAt;
  const canMarkReady = currentUser.role === 'programmer' && !ticket.programmerReady;
  const hasStatusChange = status !== ticket.status || priority !== ticket.priority;
  const canSubmitSatisfaction =
    currentUser.role === 'client' && ticket.status === 'resolved' && !ticket.satisfactionRating;
  const hasSatisfaction = typeof ticket.satisfactionRating === 'number' && ticket.satisfactionRating > 0;
  const agentAssignedId = ticket.assignedAgent?._id || ticket.assignedAgent?.id;
  const canDeleteTicket =
    currentUser.role === 'admin' ||
    (currentUser.role === 'agent' &&
      ['resolved', 'closed'].includes(ticket.status) &&
      agentAssignedId &&
      String(agentAssignedId) === String(currentUser.id));
  const statusOptions = useMemo(() => {
    if (currentUser.role === 'agent') return STATUS_AGENT_OPTIONS;
    return [{ value: ticket.status, label: ticket.status }];
  }, [currentUser.role, ticket.status]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    if (!onSendMessage) return;
    await onSendMessage(ticket._id, { text: message, internal: canUseInternal ? internal : false });
    setMessage('');
    if (canUseInternal) setInternal(false);
  };

  const updateStatus = async () => {
    if (!canChangeStatus) return;
    if (status === ticket.status && priority === ticket.priority) return;
    if (!onChangeStatus) return;
    await onChangeStatus(ticket._id, { status, priority });
  };

  const assignProgrammer = async () => {
    if (!canAssign || !programmerId || ticket.assignedProgrammer || !onAssign) return;
    await onAssign(ticket._id, { programmerId });
  };

  const markProgrammerReady = async () => {
    if (!canMarkReady || !onMarkProgrammerReady) return;
    await onMarkProgrammerReady(ticket._id);
  };

  const submitSatisfactionForm = async () => {
    if (!canSubmitSatisfaction || !onSubmitSatisfaction) return;
    await onSubmitSatisfaction(ticket._id, { rating: satisfaction, comment: satisfactionComment });
    setSatisfaction(5);
    setSatisfactionComment('');
  };

  return (
    <div className="ticket-detail">
      <header>
        <div>
          <h2>{ticket.title}</h2>
          <p>{ticket.description}</p>
          {ticket.programmerReady && (
            <span className="tag tag-programmer">Programador listo para revision</span>
          )}
          {ticket.watchers && ticket.watchers.length > 0 && (
            <div className="watcher-list">
              {ticket.watchers.map((member) => (
                <span key={member._id || member.id} className="tag">
                  {member.name || member.email} ({member.role})
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="detail-meta">
          <span className="tag">{ticket.company || 'Sin empresa'}</span>
          <span className="tag">{ticket.priority}</span>
          <span className="tag">{ticket.status}</span>
          {ticket.assignedAgent?.name && <span className="tag tag-agent">Asesor: {ticket.assignedAgent.name}</span>}
          {ticket.assignedProgrammer?.name && <span className="tag tag-programmer">Prog: {ticket.assignedProgrammer.name}</span>}
        </div>
      </header>

      <section className="detail-grid">
        <div>
          <h3>Conversacion</h3>
          <div className="message-feed">
            {ticket.messages.map((msg, index) => (
              <div key={`${msg.createdAt}-${index}`} className={`message-row ${msg.authorRole}`}>
                <div className="message-header">
                  <strong>{msg.authorId?.name || msg.authorRole}</strong>
                  <span>{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <p>{msg.text}</p>
                {msg.internal && <span className="tag tag-internal">Nota interna</span>}
              </div>
            ))}
            {!ticket.messages.length && <div className="message-empty">Sin mensajes aun.</div>}
          </div>
        </div>

        <aside>
          <h3>Acciones</h3>

          {canDeleteTicket && (
            <div className="action-block">
              <button
                type="button"
                className="ghost-button destructive"
                onClick={() => onDeleteTicket?.(ticket)}
                disabled={loading}
              >
                {loading ? 'Eliminando...' : 'Eliminar ticket'}
              </button>
              <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Esta acción removerá el ticket y su historial.
              </small>
            </div>
          )}

          {canSendMessage ? (
            <div className="action-block">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={currentUser.role === 'programmer' ? 'Comparte avances o preguntas para el asesor...' : 'Escribe tu mensaje...'}
              />
              {canUseInternal && (
                <label className="checkbox-inline">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Guardar como nota interna
                </label>
              )}
              <button type="button" className="cta-button" onClick={sendMessage} disabled={loading || !message.trim()}>
                {loading ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </div>
          ) : (
            <div className="action-block">
              <p>Los administradores solo visualizan la conversacion.</p>
            </div>
          )}

          {canChangeStatus && (
            <div className="action-block">
              <label>
                <span>Estado</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canChangeStatus}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Prioridad</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canChangePriority}>
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={updateStatus} className="ghost-button" disabled={loading || !hasStatusChange}>
                Guardar cambios
              </button>
            </div>
          )}

          {canAssign && (
            <div className="action-block">
              <label>
                <span>Programador asignado</span>
                <select
                  value={programmerId}
                  onChange={(e) => setProgrammerId(e.target.value)}
                  disabled={Boolean(ticket.assignedProgrammer)}
                >
                  <option value="">-- Selecciona programador --</option>
                  {(usersByRole.programmer || []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ghost-button"
                onClick={assignProgrammer}
                disabled={loading || Boolean(ticket.assignedProgrammer) || !programmerId}
              >
                {ticket.assignedProgrammer ? 'Programador asignado' : 'Asignar programador'}
              </button>
              <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Una vez asignado no se puede cambiar el programador.
              </small>
            </div>
          )}

          {canMarkReady && (
            <div className="action-block">
              <p>Cuando termines tu parte marca el ticket para que el asesor revise.</p>
              <button type="button" className="cta-button" onClick={markProgrammerReady} disabled={loading}>
                Marcar listo para revision
              </button>
            </div>
          )}

          {canSubmitSatisfaction && (
            <div className="action-block">
              <h4>Encuesta de satisfaccion</h4>
              <label>
                <span>Calificacion (1 = muy baja, 5 = excelente)</span>
                <select value={satisfaction} onChange={(e) => setSatisfaction(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Comentario (opcional)</span>
                <textarea
                  value={satisfactionComment}
                  onChange={(e) => setSatisfactionComment(e.target.value)}
                  rows={3}
                  placeholder="Cuenta como fue tu experiencia."
                />
              </label>
              <button type="button" className="cta-button" onClick={submitSatisfactionForm} disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar encuesta'}
              </button>
            </div>
          )}

          {hasSatisfaction && (
            <div className="action-block">
              <h4>Retroalimentacion del cliente</h4>
              <p>
                Calificacion: <strong>{ticket.satisfactionRating}/5</strong>
              </p>
              {ticket.satisfactionComment && <p style={{ marginTop: 8 }}>"{ticket.satisfactionComment}"</p>}
            </div>
          )}

          <div className="action-block">
            <h4>Seguimiento</h4>
            <ul className="status-history">
              {(ticket.statusHistory ? ticket.statusHistory.slice().reverse() : []).map((history, index) => (
                <li key={`${history.changedAt}-${index}`}>
                  <strong>{history.status}</strong> por {history.changedBy?.name || 'sistema'} -{' '}
                  {new Date(history.changedAt).toLocaleString()}
                  {history.note && <div>{history.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
