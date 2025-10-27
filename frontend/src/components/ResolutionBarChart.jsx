import React from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const PRIORITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica'
};

export default function ResolutionBarChart({ data = [], overall = 0 }) {
  const chartData = data.map((item) => ({
    prioridad: PRIORITY_LABELS[item._id] || item._id,
    horas: Number(item.avgHours?.toFixed?.(2) || item.avgHours || 0),
    casos: item.resolved || 0
  }));

  if (!chartData.length) {
    return (
      <div className="chart-card">
        <h3>Tiempo promedio de resolucion</h3>
        <p>No hay tickets resueltos para calcular promedios.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3>Tiempo promedio de resolucion (horas)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
          <XAxis dataKey="prioridad" stroke="#e2e8f0" />
          <YAxis stroke="#e2e8f0" />
          <Tooltip />
          <Legend />
          <Bar dataKey="horas" name="Promedio (h)" fill="#38bdf8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-footnote">
        Promedio general: {overall ? `${overall.toFixed(2)} h` : 'Sin datos'}
      </p>
    </div>
  );
}
