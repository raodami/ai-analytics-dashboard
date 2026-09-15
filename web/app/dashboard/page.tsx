'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [queries, setQueries] = useState(0);
  const [remaining, setRemaining] = useState(10);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setIsPro(data.is_pro);
        setQueries(data.query_count);
        setRemaining(data.remaining);
      });

    fetch('/api/reports', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setReports(data));
  }, [router]);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ natural_query: query }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setResult(data);
        setQueries(q => q + 1);
        setRemaining(r => Math.max(0, r - 1));
        
        fetch('/api/reports', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => setReports(data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (!result?.data?.length) return null;

    const labels = Object.keys(result.data[0]);
    const values = result.data.map(row => row[labels[0]] || row[Object.keys(row)[0]]);

    switch (result.chart_type) {
      case 'line':
        return (
          <LineChart width={600} height={300} data={result.data.map((r, i) => ({
            label: labels.map(l => r[l]).join(', '),
            value: values[i]
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#533afd" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart width={600} height={300} data={result.data.map((r, i) => ({
            label: labels.map(l => r[l]).join(', '),
            value: values[i]
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#533afd" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'pie':
        return (
          <PieChart width={600} height={300}>
            <Pie 
              data={result.data.map((r, i) => ({ 
                name: labels[0] in r ? r[labels[0]] : `Item ${i+1}`, 
                value: values[i] 
              }))} 
              dataKey="value" 
              nameKey="name"
              cx="50%" 
              cy="50%" 
              outerRadius={120}
            >
              {[ '#533afd', '#061b31', '#c9b1e0', '#f0b8c8' ].map((color, i) => (
                <Cell key={i} fill={color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );
      default:
        return (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(83, 58, 253, 0.1)' }}>
                  {labels.map(l => (
                    <th key={l} style={{ padding: 12, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} style={{ padding: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                        {typeof v === 'number' ? v.toFixed(2) : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  const downloadExport = async (reportId, format) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/reports/${reportId}/export/${format}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg, #533afd, #c9b1e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Analytics Dashboard
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 4 }}>Natural Language to SQL Analytics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isPro && (
            <span style={{ background: 'linear-gradient(135deg, #533afd, #7c3aed)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              PRO
            </span>
          )}
          <span style={{ color: '#94a3b8' }}>{user?.email}</span>
          <button 
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Usage Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'rgba(83, 58, 253, 0.1)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>Query Count</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#533afd' }}>{queries}</div>
        </div>
        <div style={{ background: 'rgba(201, 177, 224, 0.1)', border: '1px solid rgba(201, 177, 224, 0.3)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>Remaining Today</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#c9b1e0' }}>{remaining}</div>
        </div>
        <div style={{ background: 'rgba(240, 184, 200, 0.1)', border: '1px solid rgba(240, 184, 200, 0.3)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>Plan</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#f0b8c8' }}>{isPro ? 'Pro' : 'Free'}</div>
        </div>
      </div>

      {/* Query Input */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Ask a Question</h2>
        <form onSubmit={handleQuery}>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g., Show me sales by month, Total revenue per category..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '12px 16px', color: '#fff', fontSize: 14 }}
            />
            <button 
              type="submit" 
              disabled={loading || (!isPro && remaining <= 0)}
              style={{ background: loading || (!isPro && remaining <= 0) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #533afd, #7c3aed)', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              {loading ? 'Processing...' : 'Generate'}
            </button>
          </div>
          {!isPro && remaining <= 0 && (
            <p style={{ color: '#f0b8c8', marginTop: 8, fontSize: 14 }}>
              Daily limit reached.{' '}
              <span 
                onClick={() => router.push('/pricing')}
                style={{ color: '#533afd', cursor: 'pointer', textDecoration: 'underline' }}
              >Upgrade to Pro</span> for unlimited queries.
            </p>
          )}
        </form>
      </div>

      {/* Results */}
      {result && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Results</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {['csv', 'json', 'markdown'].map(fmt => (
                <button 
                  key={fmt}
                  onClick={() => downloadExport(result.id, fmt)}
                  style={{ background: 'rgba(83, 58, 253, 0.2)', border: '1px solid rgba(83, 58, 253, 0.5)', color: '#c9b1e0', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                >
                  Export {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          {result.error ? (
            <div style={{ color: '#f0b8c8', padding: 16, background: 'rgba(240, 184, 200, 0.1)', borderRadius: 8 }}>
              <strong>Error:</strong> {result.error}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Generated SQL:</div>
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, fontSize: 12, overflowX: 'auto' }}>
                  {result.sql}
                </pre>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Chart Type: {result.chart_type}</div>
                <div style={{ overflowX: 'auto' }}>
                  {renderChart()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reports History */}
      {reports.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Recent Queries</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map(report => (
              <div key={report.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{report.natural_query}</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(report.created_at * 1000).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => downloadExport(report.id, 'csv')}
                    style={{ background: 'rgba(83, 58, 253, 0.2)', border: 'none', color: '#c9b1e0', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >
                    CSV
                  </button>
                  <button 
                    onClick={() => downloadExport(report.id, 'json')}
                    style={{ background: 'rgba(83, 58, 253, 0.2)', border: 'none', color: '#c9b1e0', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >
                    JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
