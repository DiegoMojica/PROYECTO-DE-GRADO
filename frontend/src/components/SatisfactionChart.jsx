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

export default function SatisfactionChart({ distribution = [], average = 0, total = 0 }) {
  const chartData = distribution
    .slice()
    .sort((a, b) => (a._id || 0) - (b._id || 0))
    .map((item) => ({
      calificacion: item._id,
      respuestas: item.total || 0
    }));

  if (!chartData.length) {
    return (
      <div className="chart-card">
        <h3>Encuestas de satisfaccion</h3>
        <p>Aun no se han recolectado calificaciones.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3>Satisfaccion del cliente</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
          <XAxis dataKey="calificacion" stroke="#e2e8f0" />
          <YAxis allowDecimals={false} stroke="#e2e8f0" />
          <Tooltip />
          <Legend />
          <Bar dataKey="respuestas" name="Respuestas" fill="#f472b6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-footnote">
        Promedio: {average.toFixed(2)} / 5 &mdash; Total respuestas: {total}
      </p>
    </div>
  );
}
