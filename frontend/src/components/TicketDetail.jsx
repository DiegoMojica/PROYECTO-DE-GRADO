import React, { useEffect, useMemo, useState } from 'react';

const STATUS_AGENT_OPTIONS = [
  { value: 'open', label: 'Pendiente' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'awaiting_client', label: 'Esperando cliente' },
  { value: 'resolved', label: 'Resuelto' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' }
];

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En proceso',
  awaiting_client: 'Esperando cliente',
  resolved: 'Resuelto',
  closed: 'Cerrado'
};

const PRIORITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Alta'
};

const SURVEY_QUESTIONS = [
  { key: 'q1', label: '1. La atencion recibida fue rapida?' },
  { key: 'q2', label: '2. El chatbot ayudo a entender o resolver el problema?' },
  { key: 'q3', label: '3. Considera facil el uso de la plataforma?' },
  { key: 'q4', label: '4. Recibio seguimiento adecuado del caso?' },
  { key: 'q5', label: '5. Recomendaria este sistema a otros usuarios?' }
];

function defaultSurveyAnswers(base = 5) {
  return { q1: base, q2: base, q3: base, q4: base, q5: base };
}

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
  const [agentId, setAgentId] = useState(ticket.assignedAgent?._id || ticket.assignedAgent?.id || '');
  const [programmerId, setProgrammerId] = useState(
    ticket.assignedProgrammer?._id || ticket.assignedProgrammer?.id || ''
  );
  const [surveyAnswers, setSurveyAnswers] = useState(
    ticket.survey?.responses || defaultSurveyAnswers(ticket.satisfactionRating || 5)
  );
  const [satisfactionComment, setSatisfactionComment] = useState('');

  useEffect(() => {
    setMessage('');
    setInternal(false);
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setAgentId(ticket.assignedAgent?._id || ticket.assignedAgent?.id || '');
    setProgrammerId(ticket.assignedProgrammer?._id || ticket.assignedProgrammer?.id || '');
    setSurveyAnswers(ticket.survey?.responses || defaultSurveyAnswers(ticket.satisfactionRating || 5));
    setSatisfactionComment('');
  }, [
    ticket._id,
    ticket.status,
    ticket.priority,
    ticket.assignedAgent?._id,
    ticket.assignedProgrammer?._id,
    ticket.survey,
    ticket.satisfactionRating
  ]);

  const canSendMessage = ['client', 'agent', 'programmer'].includes(currentUser.role);
  const canUseInternal = currentUser.role === 'agent';
  const canAssign = ['agent', 'admin'].includes(currentUser.role);
  const assignedProgrammerId = ticket.assignedProgrammer?._id || ticket.assignedProgrammer?.id;
  const createdById = ticket.createdBy?._id || ticket.createdBy?.id || ticket.createdBy;
  const canChangeStatus = ['agent', 'admin'].includes(currentUser.role);
  const canChangePriority = ['agent', 'admin'].includes(currentUser.role);
  const canMarkReady =
    currentUser.role === 'programmer' &&
    String(assignedProgrammerId || '') === String(currentUser.id || currentUser._id || '') &&
    !ticket.programmerReady &&
    ticket.status !== 'closed';
  const hasStatusChange = status !== ticket.status || priority !== ticket.priority;
  const canSubmitSatisfaction =
    currentUser.role === 'client' &&
    String(createdById || '') === String(currentUser.id || currentUser._id || '') &&
    ticket.status === 'resolved' &&
    !ticket.survey;
  const hasSatisfaction =
    (typeof ticket.satisfactionRating === 'number' && ticket.satisfactionRating > 0) || Boolean(ticket.survey);
  const agentAssignedId = ticket.assignedAgent?._id || ticket.assignedAgent?.id;
  const canDeleteTicket =
    currentUser.role === 'admin' ||
    (currentUser.role === 'agent' &&
      ['resolved', 'closed'].includes(ticket.status) &&
      agentAssignedId &&
      String(agentAssignedId) === String(currentUser.id));
  const statusOptions = useMemo(() => {
    if (['agent', 'admin'].includes(currentUser.role)) return STATUS_AGENT_OPTIONS;
    return [{ value: ticket.status, label: ticket.status }];
  }, [currentUser.role, ticket.status]);

  const hasAssignmentChange =
    String(agentId || '') !== String(ticket.assignedAgent?._id || ticket.assignedAgent?.id || '') ||
    String(programmerId || '') !== String(ticket.assignedProgrammer?._id || ticket.assignedProgrammer?.id || '');

  const sendMessage = async () => {
    if (!message.trim()) return;
    if (!onSendMessage) return;
    await onSendMessage(ticket._id, { text: message, internal: canUseInternal ? internal : false });
    setMessage('');
    if (canUseInternal) setInternal(false);
  };

  const updateStatus = async () => {
    if (!canChangeStatus || !onChangeStatus) return;
    if (!hasStatusChange) return;
    await onChangeStatus(ticket._id, { status, priority });
  };

  const saveAssignment = async () => {
    if (!canAssign || !onAssign || !hasAssignmentChange) return;
    await onAssign(ticket._id, {
      agentId: agentId || null,
      programmerId: programmerId || null
    });
  };

  const markProgrammerReady = async () => {
    if (!canMarkReady || !onMarkProgrammerReady) return;
    await onMarkProgrammerReady(ticket._id);
  };

  const submitSatisfactionForm = async () => {
    if (!canSubmitSatisfaction || !onSubmitSatisfaction) return;
    await onSubmitSatisfaction(ticket._id, { answers: surveyAnswers, comment: satisfactionComment });
    setSurveyAnswers(defaultSurveyAnswers(5));
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
          <span className="tag">{PRIORITY_LABELS[ticket.priority] || ticket.priority}</span>
          <span className="tag">{STATUS_LABELS[ticket.status] || ticket.status}</span>
          {ticket.assignedAgent?.name && <span className="tag tag-agent">Asesor: {ticket.assignedAgent.name}</span>}
          {ticket.assignedProgrammer?.name && (
            <span className="tag tag-programmer">Prog: {ticket.assignedProgrammer.name}</span>
          )}
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
                Esta accion removera el ticket y su historial.
              </small>
            </div>
          )}

          {canSendMessage ? (
            <div className="action-block">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={
                  currentUser.role === 'programmer'
                    ? 'Comparte avances o preguntas para el asesor...'
                    : 'Escribe tu mensaje...'
                }
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
              {currentUser.role === 'admin' && (
                <label>
                  <span>Asesor asignado</span>
                  <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    <option value="">-- Sin asesor --</option>
                    {(usersByRole.agent || []).map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                <span>Programador asignado</span>
                <select value={programmerId} onChange={(e) => setProgrammerId(e.target.value)}>
                  <option value="">-- Sin programador --</option>
                  {(usersByRole.programmer || []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="ghost-button" onClick={saveAssignment} disabled={loading || !hasAssignmentChange}>
                Guardar asignacion
              </button>
              <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Se permite reasignar ticket segun permisos del rol.
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
              {SURVEY_QUESTIONS.map((question) => (
                <label key={question.key}>
                  <span>{question.label}</span>
                  <select
                    value={surveyAnswers[question.key]}
                    onChange={(e) =>
                      setSurveyAnswers((prev) => ({
                        ...prev,
                        [question.key]: Number(e.target.value)
                      }))
                    }
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
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
                Calificacion promedio: <strong>{ticket.satisfactionRating}/5</strong>
              </p>
              {ticket.survey?.responses && (
                <ul className="status-history">
                  {SURVEY_QUESTIONS.map((question) => (
                    <li key={`survey-${question.key}`}>
                      {question.label} <strong>{ticket.survey.responses[question.key]}/5</strong>
                    </li>
                  ))}
                </ul>
              )}
              {(ticket.survey?.comment || ticket.satisfactionComment) && (
                <p style={{ marginTop: 8 }}>"{ticket.survey?.comment || ticket.satisfactionComment}"</p>
              )}
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
