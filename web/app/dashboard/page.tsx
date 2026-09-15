'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

type QueryResult = {
  id?: string;
  sql: string;
  data: Record<string, any>[];
  chart_type: string;
  error?: string;
};

type Report = {
  id: string;
  user_id: string;
  title: string;
  sql: string;
  natural_query: string;
  chart_type: string;
  result: string;
  created_at: number;
};

type DataSource = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  connection: string;
  created_at: number;
};

type ScheduleJob = {
  id: string;
  user_id: string;
  name: string;
  sql: string;
  query: string;
  chart_type: string;
  interval: string;
  enabled: boolean;
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [schedules, setSchedules] = useState<ScheduleJob[]>([]);
  const [queries, setQueries] = useState(0);
  const [remaining, setRemaining] = useState(10);
  const [isPro, setIsPro] = useState(false);
  const [activeTab, setActiveTab] = useState('query');
  const [showAddDS, setShowAddDS] = useState(false);
  const [newDS, setNewDS] = useState({ name: '', type: 'sqlite', connection: '' });
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', sql: '', query: '', interval: '1h', chart_type: 'line' });

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

    fetch('/api/datasources', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setDatasources(data));

    fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setSchedules(data));
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

  const addDatasource = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/datasources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newDS),
    });
    
    if (res.ok) {
      setShowAddDS(false);
      setNewDS({ name: '', type: 'sqlite', connection: '' });
      fetch('/api/datasources', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setDatasources(data));
    }
  };

  const deleteDatasource = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/datasources/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setDatasources(ds => ds.filter(d => d.id !== id));
  };

  const addSchedule = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newSchedule),
    });
    
    if (res.ok) {
      setShowAddSchedule(false);
      setNewSchedule({ name: '', sql: '', query: '', interval: '1h', chart_type: 'line' });
      fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setSchedules(data));
    }
  };

  const deleteSchedule = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/schedules/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setSchedules(ss => ss.filter(s => s.id !== id));
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/schedules/${id}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setSchedules(ss => ss.map(s => s.id === id ? { ...s, enabled } : s));
  };

  const deleteReport = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setReports(reports.filter(r => r.id !== id));
  };

  const downloadExport = async (reportId: string, format: string) => {
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'query', label: 'Query' },
          { id: 'reports', label: 'Reports' },
          { id: 'datasources', label: 'Data Sources' },
          { id: 'schedules', label: 'Schedules' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? 'rgba(83, 58, 253, 0.3)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: activeTab === tab.id ? '#c9b1e0' : '#94a3b8',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Query Tab */}
      {activeTab === 'query' && (
        <>
          {/* Usage Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
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
                      onClick={() => downloadExport(result.id || 'unknown', fmt)}
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
        </>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Query History</h2>
          {reports.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No reports yet. Run your first query!</p>
          ) : (
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
                    <button 
                      onClick={() => deleteReport(report.id)}
                      style={{ background: 'rgba(240, 184, 200, 0.2)', border: 'none', color: '#f0b8c8', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data Sources Tab */}
      {activeTab === 'datasources' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Data Sources</h2>
            <button 
              onClick={() => setShowAddDS(!showAddDS)}
              style={{ background: 'rgba(83, 58, 253, 0.2)', border: '1px solid rgba(83, 58, 253, 0.5)', color: '#c9b1e0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
            >
              + Add Source
            </button>
          </div>

          {showAddDS && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Name (e.g., Production DB)"
                  value={newDS.name}
                  onChange={e => setNewDS({ ...newDS, name: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                />
                <select
                  value={newDS.type}
                  onChange={e => setNewDS({ ...newDS, type: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                >
                  <option value="sqlite">SQLite</option>
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                </select>
                <input
                  type="text"
                  placeholder="Connection string (e.g., data/db.sqlite or postgres://user:pass@host:5432/db)"
                  value={newDS.connection}
                  onChange={e => setNewDS({ ...newDS, connection: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addDatasource} style={{ background: '#533afd', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Add
                  </button>
                  <button onClick={() => setShowAddDS(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {datasources.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No data sources added yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {datasources.map(ds => (
                <div key={ds.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{ds.name}</span>
                      <span style={{ marginLeft: 12, color: '#94a3b8', fontSize: 12 }}>{ds.type.toUpperCase()}</span>
                    </div>
                    <button 
                      onClick={() => deleteDatasource(ds.id)}
                      style={{ background: 'rgba(240, 184, 200, 0.2)', border: 'none', color: '#f0b8c8', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Scheduled Reports</h2>
            <button 
              onClick={() => setShowAddSchedule(!showAddSchedule)}
              style={{ background: 'rgba(83, 58, 253, 0.2)', border: '1px solid rgba(83, 58, 253, 0.5)', color: '#c9b1e0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
            >
              + Add Schedule
            </button>
          </div>

          {showAddSchedule && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Schedule Name"
                  value={newSchedule.name}
                  onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                />
                <textarea
                  placeholder="SQL Query"
                  value={newSchedule.sql}
                  onChange={e => setNewSchedule({ ...newSchedule, sql: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff', minHeight: 80 }}
                />
                <input
                  type="text"
                  placeholder="Natural language query (optional)"
                  value={newSchedule.query}
                  onChange={e => setNewSchedule({ ...newSchedule, query: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                />
                <select
                  value={newSchedule.interval}
                  onChange={e => setNewSchedule({ ...newSchedule, interval: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                >
                  <option value="1h">Every 1 hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="12h">Every 12 hours</option>
                  <option value="24h">Daily</option>
                  <option value="168h">Weekly</option>
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addSchedule} style={{ background: '#533afd', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Create
                  </button>
                  <button onClick={() => setShowAddSchedule(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {schedules.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No scheduled reports yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {schedules.map(schedule => (
                <div key={schedule.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{schedule.name}</span>
                      <span style={{ marginLeft: 12, color: '#94a3b8', fontSize: 12 }}>Every {schedule.interval}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                        style={{ background: schedule.enabled ? 'rgba(83, 58, 253, 0.3)' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        {schedule.enabled ? 'Active' : 'Paused'}
                      </button>
                      <button 
                        onClick={() => deleteSchedule(schedule.id)}
                        style={{ background: 'rgba(240, 184, 200, 0.2)', border: 'none', color: '#f0b8c8', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ color: '#fff', padding: 24 }}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
