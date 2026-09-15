'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['#533afd', '#7c5cfc', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([
      fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/reports', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([u, r]) => {
      setUser(u);
      setReports(r || []);
    }).catch(() => router.push('/login'));
  }, [router]);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ natural_query: query }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setResult({ ...data, error: data.error });
      }
    } finally {
      setLoading(false);
    }
  }

  function renderChart(data: any[], chartType: string) {
    if (!data || data.length === 0) return null;
    const keys = Object.keys(data[0]).filter(k => k !== 'id');

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={keys[0]} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            <Legend />
            {keys.slice(1).map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />)}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={keys[0]} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            <Legend />
            {keys.slice(1).map((k, i) => <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === 'pie') {
      const pieKey = keys.find(k => k !== keys[0]) || keys[1];
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" labelLine={false} label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey={pieKey}>
              {data.map((_entry: any, index: number) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
              {keys.map(k => <th key={k} style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 20).map((row: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {keys.map(k => <td key={k} style={{ padding: '12px 16px', color: '#e2e8f0' }}>{String(row[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!user) return <div style={{ minHeight: '100vh', background: '#0f172a' }}></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, background: 'rgba(15,23,42,0.9)', zIndex: 100 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#533afd' }}>📊 AI Analytics</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>{user.email}</span>
          {user.is_pro && <span style={{ background: 'linear-gradient(135deg, #533afd, #7c5cfc)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>PRO</span>}
          <button onClick={() => { localStorage.removeItem('token'); router.push('/login'); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: 18, color: '#f8fafc' }}>Ask a question about your data</h2>
          <form onSubmit={handleQuery} style={{ display: 'flex', gap: 12 }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g., Show me sales by month, Top 10 customers..." style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 14 }} />
            <button type="submit" disabled={loading || !query.trim()} style={{ padding: '12px 24px', background: loading ? 'rgba(83,58,253,0.5)' : 'linear-gradient(135deg, #533afd, #7c5cfc)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: loading || !query.trim() ? 'not-allowed' : 'pointer' }}>
              {loading ? '⏳' : '🔍 Query'}
            </button>
          </form>
        </div>

        {result && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#f8fafc', fontSize: 16 }}>Results</h3>
              <code style={{ color: '#94a3b8', fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}>{result.sql}</code>
            </div>
            {result.error ? (
              <div style={{ color: '#f87171', padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{result.error}</div>
            ) : (
              result.data && result.data.length > 0 ? renderChart(JSON.parse(result.data), result.chart_type) : <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No data returned</div>
            )}
          </div>
        )}

        {reports.length > 0 && (
          <div>
            <h2 style={{ marginBottom: 16, fontSize: 18, color: '#f8fafc' }}>Recent Queries</h2>
            {reports.slice(0, 5).map((r: any) => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#f8fafc', fontSize: 14 }}>{r.natural_query}</span>
                  <span style={{ color: '#533afd', fontSize: 12, padding: '4px 12px', background: 'rgba(83,58,253,0.2)', borderRadius: 12 }}>{r.chart_type}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
