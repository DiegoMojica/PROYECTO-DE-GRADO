import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f97316', '#a855f7'];
const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En progreso',
  awaiting_client: 'Esperando cliente',
  resolved: 'Resuelto',
  closed: 'Cerrado'
};

export default function StatusPieChart({ data = [] }) {
  const chartData = data.map((item, index) => ({
    name: STATUS_LABELS[item._id] || item._id || `Estado ${index + 1}`,
    value: item.total || 0
  }));

  if (!chartData.length) {
    return (
      <div className="chart-card">
        <h3>Estado de tickets</h3>
        <p>No hay datos suficientes.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3>Estado de tickets</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
            {chartData.map((entry, index) => (
              <Cell key={`slice-${entry.name}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
