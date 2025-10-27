import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TicketComposer from '../components/TicketComposer';
import TicketTable from '../components/TicketTable';
import TicketDetail from '../components/TicketDetail';
import NotificationBell from '../components/NotificationBell';
import Chatbot from '../components/Chatbot';
import TicketFilters from '../components/TicketFilters';
import StatusPieChart from '../components/StatusPieChart';
import ResolutionBarChart from '../components/ResolutionBarChart';
import SatisfactionChart from '../components/SatisfactionChart';
import NavBar from '../components/NavBar';
import api from '../services/api';
import { ensureSocketConnection, socket } from '../services/socket';

function groupTicketsByStatus(items) {
  return items.reduce((acc, ticket) => {
    const key = ticket.status || 'open';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ticket);
    return acc;
  }, {});
}

function mapUsersByRole(users) {
  const grouped = { client: [], agent: [], programmer: [], admin: [] };
  users.forEach((user) => {
    grouped[user.role] = grouped[user.role] || [];
    grouped[user.role].push({ id: user._id || user.id, name: user.name, email: user.email, role: user.role });
  });
  return grouped;
}

export default function Dashboard({ user, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [usersByRole, setUsersByRole] = useState({ client: [], agent: [], programmer: [], admin: [] });
  const [summary, setSummary] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProgrammerClientId, setSelectedProgrammerClientId] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'client' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [userFormError, setUserFormError] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const activeSectionRef = useRef('dashboard');

  const refreshTickets = useCallback(async (overrideFilters) => {
    try {
      const activeFilters =
        overrideFilters && typeof overrideFilters === 'object' && !Array.isArray(overrideFilters)
          ? overrideFilters
          : filters;
      const params = {};
      if (activeFilters.status) params.status = activeFilters.status;
      if (activeFilters.priority) params.priority = activeFilters.priority;
      if (activeFilters.search) params.search = activeFilters.search;

      const res = await api.get('/tickets', { params });
      if (res.data.ok) {
        setTickets(res.data.tickets);
        if (res.data.tickets.length) {
          const current = res.data.tickets.find((t) => t._id === selectedTicket?._id);
          setSelectedTicket(current || res.data.tickets[0]);
        } else {
          setSelectedTicket(null);
        }
      }
    } catch (err) {
      console.error('Tickets fetch error', err);
    }
  }, [filters, selectedTicket?._id]);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.ok) setNotifications(res.data.notifications);
    } catch (err) {
      console.error('Notifications fetch error', err);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    if (!['admin', 'agent'].includes(user.role)) return;
    try {
      const res = await api.get('/auth/users');
      if (res.data.ok) {
        setUsersByRole(mapUsersByRole(res.data.users));
      }
    } catch (err) {
      console.error('Users fetch error', err);
    }
  }, [user.role]);

  const refreshDashboard = useCallback(async () => {
    if (!['admin', 'agent'].includes(user.role)) return;
    try {
      const [summaryRes, performanceRes] = await Promise.all([
        api.get('/dashboard/summary'),
        user.role === 'admin' ? api.get('/dashboard/team-performance') : Promise.resolve({ data: { ok: false } })
      ]);
      if (summaryRes.data.ok) setSummary(summaryRes.data.summary);
      if (performanceRes.data.ok) setPerformance(performanceRes.data.performance);
    } catch (err) {
      console.error('Dashboard data error', err);
    }
  }, [user.role]);

  useEffect(() => {
    ensureSocketConnection(user.id);
    refreshNotifications();
    refreshUsers();
    refreshDashboard();
  }, [user.id, refreshNotifications, refreshUsers, refreshDashboard]);

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);

  useEffect(() => {
    const handler = () => {
      refreshNotifications();
      refreshTickets();
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [refreshNotifications, refreshTickets]);

  useEffect(() => {
    const configs = [
      { id: 'dashboard', elementId: 'section-dashboard' },
      { id: 'tickets', elementId: 'section-tickets' },
      { id: 'chatbot', elementId: 'section-chatbot' }
    ];

    const targets = configs
      .map((config) => ({ ...config, element: document.getElementById(config.elementId) }))
      .filter((item) => item.element);

    if (!targets.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const match = targets.find((item) => item.element === visible.target);
          if (match && activeSectionRef.current !== match.id) {
            activeSectionRef.current = match.id;
            setActiveSection(match.id);
          }
        }
      },
      { threshold: 0.35 }
    );

    targets.forEach((item) => observer.observe(item.element));

    return () => {
      targets.forEach((item) => observer.unobserve(item.element));
      observer.disconnect();
    };
  }, [activeSectionRef, tickets.length]);

  const createTicket = useCallback(
    async (data) => {
      try {
        setLoadingAction(true);
        const res = await api.post('/tickets', data);
        if (res.data.ok) {
          setTickets((prev) => [res.data.ticket, ...prev]);
          await refreshTickets();
          setSelectedTicket(res.data.ticket);
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.error || 'No se pudo crear el ticket');
      } finally {
        setLoadingAction(false);
      }
    },
    [refreshTickets]
  );

  const sendMessage = useCallback(async (ticketId, body) => {
    try {
      setLoadingAction(true);
      const res = await api.post(`/tickets/${ticketId}/messages`, body);
      if (res.data.ok) {
        setTickets((prev) => prev.map((ticket) => (ticket._id === ticketId ? res.data.ticket : ticket)));
        setSelectedTicket(res.data.ticket);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo enviar el mensaje');
    } finally {
      setLoadingAction(false);
    }
  }, []);

  const changeStatus = useCallback(async (ticketId, payload) => {
    try {
      const res = await api.patch(`/tickets/${ticketId}/status`, payload);
      if (res.data.ok) {
        setTickets((prev) => prev.map((ticket) => (ticket._id === ticketId ? res.data.ticket : ticket)));
        setSelectedTicket(res.data.ticket);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo actualizar el estado');
    }
  }, []);

  const assignTicket = useCallback(async (ticketId, assignment) => {
    try {
      const res = await api.patch(`/tickets/${ticketId}/assign`, assignment);
      if (res.data.ok) {
        setTickets((prev) => prev.map((ticket) => (ticket._id === ticketId ? res.data.ticket : ticket)));
        setSelectedTicket(res.data.ticket);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo asignar el ticket');
    }
  }, []);

  const markProgrammerReady = useCallback(async (ticketId) => {
    try {
      const res = await api.patch(`/tickets/${ticketId}/programmer-ready`);
      if (res.data.ok) {
        setTickets((prev) => prev.map((ticket) => (ticket._id === ticketId ? res.data.ticket : ticket)));
        setSelectedTicket(res.data.ticket);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo marcar el ticket como listo');
    }
  }, []);

  const handleFiltersChange = useCallback(
    (nextFilters) => {
      setFilters(nextFilters);
      refreshTickets(nextFilters);
    },
    [refreshTickets]
  );

  const handleNavigateSection = useCallback((targetId, navId) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(navId);
      activeSectionRef.current = navId;
    }
  }, [activeSectionRef]);

  const submitSatisfaction = useCallback(
    async (ticketId, payload) => {
      try {
        setLoadingAction(true);
        const res = await api.patch(`/tickets/${ticketId}/satisfaction`, payload);
        if (res.data.ok) {
          setTickets((prev) => prev.map((ticket) => (ticket._id === ticketId ? res.data.ticket : ticket)));
          setSelectedTicket(res.data.ticket);
          refreshDashboard();
          refreshTickets();
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.error || 'No se pudo registrar la satisfaccion');
      } finally {
        setLoadingAction(false);
      }
    },
    [refreshDashboard, refreshTickets]
  );

  const handleDeleteTicket = useCallback(
    async (ticket) => {
      if (!ticket) return;
      if (!window.confirm(`¿Eliminar el ticket "${ticket.title}"? Esta acción es irreversible.`)) return;
      try {
        setLoadingAction(true);
        await api.delete(`/tickets/${ticket._id}`);
        setTickets((prev) => prev.filter((item) => item._id !== ticket._id));
        if (selectedTicket?._id === ticket._id) {
          setSelectedTicket(null);
        }
        await Promise.all([refreshTickets(), refreshDashboard()]);
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.error || 'No se pudo eliminar el ticket');
      } finally {
        setLoadingAction(false);
      }
    },
    [refreshDashboard, refreshTickets, selectedTicket?._id]
  );

  const handleGenerateReport = useCallback(
    async (range) => {
      try {
        setLoadingAction(true);
        const response = await api.get('/reports/tickets', {
          params: { range },
          responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte_${range}_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert('No se pudo generar el reporte');
      } finally {
        setLoadingAction(false);
      }
    },
    []
  );

  const resetUserForm = useCallback(() => {
    setUserForm({ name: '', email: '', password: '', role: 'client' });
    setEditingUserId(null);
    setUserFormError('');
  }, []);

  const submitUserForm = useCallback(async (event) => {
    event.preventDefault();
    try {
      setUserFormError('');
      if (editingUserId) {
        const payload = {
          name: userForm.name,
          role: userForm.role,
          email: userForm.email
        };
        if (userForm.password) payload.password = userForm.password;
        await api.put(`/auth/admin/users/${editingUserId}`, payload);
      } else {
        await api.post('/auth/admin/users', userForm);
      }
      await refreshUsers();
      resetUserForm();
    } catch (err) {
      const message = err.response?.data?.error || 'No se pudo guardar el usuario';
      setUserFormError(message);
    }
  }, [editingUserId, refreshUsers, resetUserForm, userForm]);

  const startEditUser = useCallback((record) => {
    setEditingUserId(record.id);
    setUserForm({ name: record.name, email: record.email, password: '', role: record.role });
    setUserFormError('');
  }, []);

  const cancelEditUser = useCallback(() => {
    resetUserForm();
  }, [resetUserForm]);

  const deleteUser = useCallback(async (userId) => {
    if (!window.confirm('Eliminar este usuario?')) return;
    try {
      await api.delete(`/auth/admin/users/${userId}`);
      await refreshUsers();
      if (editingUserId === userId) resetUserForm();
    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar el usuario');
    }
  }, [editingUserId, refreshUsers, resetUserForm]);

  const markNotificationRead = useCallback(async (notificationId) => {
    try {
      const res = await api.patch(`/notifications/${notificationId}/read`);
      if (res.data.ok) {
        setNotifications((prev) => prev.map((item) => (item._id === notificationId ? res.data.notification : item)));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const agentClientOptions = useMemo(() => {
    if (user.role !== 'agent') return [];
    const store = new Map();
    tickets.forEach((ticket) => {
      const client = ticket.createdBy;
      if (!client) return;
      const id = client._id || client.id || client;
      if (!id) return;
      if (!store.has(String(id))) {
        store.set(String(id), {
          id: String(id),
          name: client.name || client.email || 'Cliente sin nombre',
          email: client.email || ''
        });
      }
    });
    return Array.from(store.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets, user.role]);

  const programmerClientOptions = useMemo(() => {
    if (user.role !== 'programmer') return [];
    const store = new Map();
    tickets.forEach((ticket) => {
      const client = ticket.createdBy;
      if (!client) return;
      const id = client._id || client.id || client;
      if (!id) return;
      if (!store.has(String(id))) {
        store.set(String(id), {
          id: String(id),
          name: client.name || client.email || 'Cliente sin nombre',
          email: client.email || ''
        });
      }
    });
    return Array.from(store.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets, user.role]);

  const agentGroupedTickets = useMemo(() => {
    if (user.role !== 'agent' || !selectedClientId) return null;
    const filtered = tickets.filter((ticket) => {
      const clientId = ticket.createdBy?._id || ticket.createdBy?.id || ticket.createdBy;
      if (!clientId) return false;
      return String(clientId) === String(selectedClientId);
    });
    return groupTicketsByStatus(filtered);
  }, [tickets, user.role, selectedClientId]);

  const programmerGroupedTickets = useMemo(() => {
    if (user.role !== 'programmer' || !selectedProgrammerClientId) return null;
    const filtered = tickets.filter((ticket) => {
      const clientId = ticket.createdBy?._id || ticket.createdBy?.id || ticket.createdBy;
      if (!clientId) return false;
      return String(clientId) === String(selectedProgrammerClientId);
    });
    return groupTicketsByStatus(filtered);
  }, [tickets, user.role, selectedProgrammerClientId]);

  useEffect(() => {
    if (user.role === 'agent' && selectedClientId) {
      if (!agentClientOptions.some((client) => client.id === selectedClientId)) {
        setSelectedClientId('');
      }
    }
  }, [agentClientOptions, selectedClientId, user.role]);

  useEffect(() => {
    if (user.role === 'programmer' && selectedProgrammerClientId) {
      if (!programmerClientOptions.some((client) => client.id === selectedProgrammerClientId)) {
        setSelectedProgrammerClientId('');
      }
    }
  }, [programmerClientOptions, selectedProgrammerClientId, user.role]);

  const activityCounters = useMemo(() => {
    const counters = { client: {}, agent: {}, programmer: {} };
    tickets.forEach((ticket) => {
      const clientId = ticket.createdBy?._id || ticket.createdBy?.id;
      if (clientId) counters.client[clientId] = (counters.client[clientId] || 0) + 1;
      const agentId = ticket.assignedAgent?._id || ticket.assignedAgent?.id;
      if (agentId) counters.agent[agentId] = (counters.agent[agentId] || 0) + 1;
      const programmerId = ticket.assignedProgrammer?._id || ticket.assignedProgrammer?.id;
      if (programmerId) counters.programmer[programmerId] = (counters.programmer[programmerId] || 0) + 1;
    });
    return counters;
  }, [tickets]);

  const flatUsers = useMemo(() => {
    const buffer = [];
    Object.values(usersByRole).forEach((group) => {
      group.forEach((item) => {
        buffer.push(item);
      });
    });
    const unique = new Map();
    buffer.forEach((item) => {
      unique.set(item.id, item);
    });
    return Array.from(unique.values());
  }, [usersByRole]);

  const stats = useMemo(() => {
    if (!tickets.length && !summary) return [];

    if (summary) {
      const statusMap = summary.byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.total }), {});
      const baseCards = [
        { label: 'Tickets totales', value: summary.totalTickets, trend: 'Sistema' },
        { label: 'Abiertos', value: statusMap.open || 0, trend: 'Pendientes' },
        { label: 'En progreso', value: statusMap.in_progress || 0, trend: 'Asignados' },
        { label: 'Resueltos', value: statusMap.resolved || 0, trend: 'Ultimos 30 dias' }
      ];
      if (summary.avgResolutionHours) {
        baseCards.push({
          label: 'Promedio de resolucion',
          value: `${summary.avgResolutionHours.toFixed(1)} h`,
          trend: 'Tickets cerrados'
        });
      }
      if (summary.satisfaction?.totalRatings) {
        baseCards.push({
          label: 'Satisfaccion promedio',
          value: summary.satisfaction.average.toFixed(1),
          trend: `${summary.satisfaction.totalRatings} encuestas`
        });
      }
      return baseCards;
    }

    const statusMap = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});

    return [
      { label: 'Tus tickets', value: tickets.length, trend: 'Totales' },
      { label: 'Abiertos', value: statusMap.open || 0, trend: 'Sin resolver' },
      { label: 'En progreso', value: statusMap.in_progress || 0, trend: 'Atendiendose' },
      { label: 'Resueltos', value: statusMap.resolved || 0, trend: 'Cerrados' }
    ];
  }, [tickets, summary]);

  return (
    <>
      <NavBar active={activeSection} onNavigate={handleNavigateSection} onLogout={onLogout} user={user} />
      <div className="dashboard-wrapper">
        <section id="section-dashboard" className="dashboard-section">
      <header className="dashboard-topbar">
        <div>
          <h1>Hola, {user.name || user.email}</h1>
          <div className="subtitle">Rol: {user.role}. Gestiona tus operaciones de soporte.</div>
        </div>
        <div className="dashboard-actions">
          <NotificationBell notifications={notifications} onMarkRead={markNotificationRead} onRefresh={refreshNotifications} />
          {['admin', 'agent'].includes(user.role) && (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleGenerateReport('weekly')}
                disabled={loadingAction}
              >
                Reporte semanal
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleGenerateReport('monthly')}
                disabled={loadingAction}
              >
                Reporte mensual
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              refreshTickets();
              refreshDashboard();
            }}
          >
            Actualizar
          </button>
        </div>
      </header>

      <section className="stats-grid">
        {stats.map((item) => (
          <div key={item.label} className="stats-card">
            <h3>{item.label}</h3>
            <div className="value">{item.value}</div>
            <div className="trend">{item.trend}</div>
          </div>
        ))}
      </section>

      {summary && (
        <section className="chart-grid">
          <StatusPieChart data={summary.byStatus || []} />
          <ResolutionBarChart
            data={summary.resolutionByPriority || []}
            overall={summary.avgResolutionHours || 0}
          />
          <SatisfactionChart
            distribution={summary.satisfaction?.distribution || []}
            average={summary.satisfaction?.average || 0}
            total={summary.satisfaction?.totalRatings || 0}
          />
        </section>
      )}

      {user.role === 'admin' && performance.length > 0 && (
        <section className="ticket-table">
          <header>
            <h2>Rendimiento del equipo</h2>
            <span>{performance.length} miembros</span>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Tickets asesor</th>
                  <th>Tickets programador</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((member) => (
                  <tr key={member._id}>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td>{member.role}</td>
                    <td>{member.agentTickets}</td>
                    <td>{member.programmerTickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
     </section>
      )}

      {user.role === 'agent' && (
        <section className="ticket-table">
          <header>
            <h2>Clientes activos</h2>
            <span>{usersByRole.client.length} clientes</span>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {usersByRole.client.map((client) => {
                  const count = activityCounters.client[client.id] || 0;
                  return (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{client.email}</td>
                      <td>{count}</td>
                    </tr>
                  );
                })}
                {!usersByRole.client.length && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', opacity: 0.6 }}>Sin clientes registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {user.role === 'admin' && (
        <section className="ticket-table">
          <header>
            <h2>Gestion de usuarios</h2>
            <span>{flatUsers.length} cuentas</span>
          </header>
          <form className="user-form" onSubmit={submitUserForm}>
            <div className="form-grid">
              <label>
                <span>Nombre</span>
                <input
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Rol</span>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                  required
                >
                  <option value="client">Cliente</option>
                  <option value="agent">Asesor</option>
                  <option value="programmer">Programador</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <label>
                <span>{editingUserId ? 'Nueva contrasena (opcional)' : 'Contrasena'}</span>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={editingUserId ? 'Dejar vacio para mantener' : 'Minimo 6 caracteres'}
                  required={!editingUserId}
                />
              </label>
            </div>
            {userFormError && <p className="form-error">{userFormError}</p>}
            <div className="form-actions">
              <button type="submit" className="cta-button">
                {editingUserId ? 'Actualizar usuario' : 'Crear usuario'}
              </button>
              {editingUserId && (
                <button type="button" className="ghost-button" onClick={cancelEditUser}>
                  Cancelar edicion
                </button>
              )}
            </div>
          </form>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Tickets manejados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...flatUsers]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((userRow) => {
                    const handled = (activityCounters.agent[userRow.id] || 0) + (activityCounters.programmer[userRow.id] || 0);
                    return (
                      <tr key={userRow.id}>
                        <td>{userRow.name}</td>
                        <td>{userRow.email}</td>
                        <td>{userRow.role}</td>
                        <td>{handled}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="ghost-button" onClick={() => startEditUser(userRow)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => deleteUser(userRow.id)}
                              disabled={userRow.id === user.id}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}
        </section>

        <section id="section-tickets" className="dashboard-main">
        <div className="tickets-column">
          {user.role === 'client' && <TicketComposer onCreate={createTicket} loading={loadingAction} />}
          <TicketFilters filters={filters} onChange={handleFiltersChange} />
          <TicketTable tickets={tickets} onSelect={setSelectedTicket} selectedId={selectedTicket?._id} />
        </div>

        <div className="details-column">
          {selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              currentUser={user}
              onSendMessage={sendMessage}
              onChangeStatus={changeStatus}
              onAssign={assignTicket}
              onMarkProgrammerReady={markProgrammerReady}
              onSubmitSatisfaction={submitSatisfaction}
              usersByRole={usersByRole}
              loading={loadingAction}
            />
          ) : (
            <div className="ticket-detail" style={{ justifyContent: 'center', alignItems: 'center' }}>
              <p>Selecciona un ticket para ver sus detalles.</p>
            </div>
          )}
          <div id="section-chatbot" className="chatbot-wrapper">
            <Chatbot userId={user.id || user._id || 'anon-room'} />
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
