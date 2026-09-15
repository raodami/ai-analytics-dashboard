'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush
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
  shared_with?: string[];
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

type Team = {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: number;
  members?: TeamMember[];
};

type TeamMember = {
  user_id: string;
  team_id: string;
  role: string;
  invited_at: number;
  joined_at: number;
};

export default function Dashboard() {
  const router = useRouter();
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });

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

    fetch('/api/teams', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setTeams(data));
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
        body: JSON.stringify({ 
          natural_query: query,
          team_id: selectedTeam || undefined
        }),
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

  const createTeam = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newTeam),
    });
    
    if (res.ok) {
      const team = await res.json();
      setTeams([...teams, team]);
      setSelectedTeam(team.id);
      setShowCreateTeam(false);
      setNewTeam({ name: '', description: '' });
    }
  };

  const inviteMember = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/teams/:id/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    
    if (res.ok) {
      setShowInvite(false);
      setInviteEmail('');
      // Refresh teams to show new invite
      fetch('/api/teams', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setTeams(data));
    }
  };

  const renderChart = () => {
    if (!result?.data?.length) return null;

    const labels = Object.keys(result.data[0]);
    const values = result.data.map(row => row[labels[0]] || row[Object.keys(row)[0]]);

    switch (result.chart_type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={result.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={labels[0]} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }}
                labelStyle={{ color: '#c9b1e0' }}
              />
              <Legend />
              <Line type="monotone" dataKey={values[0] ? Object.keys(result.data[0])[1] || Object.keys(result.data[0])[0] : ''} stroke="#533afd" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Brush dataKey={labels[0]} height={30} stroke="#533afd" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={result.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={labels[0]} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }}
                labelStyle={{ color: '#c9b1e0' }}
              />
              <Legend />
              <Bar dataKey={values[0] ? Object.keys(result.data[0])[1] || Object.keys(result.data[0])[0] : ''} fill="#533afd" radius={[4, 4, 0, 0]} />
              <Brush dataKey={labels[0]} height={30} stroke="#533afd" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
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
                {[ '#533afd', '#061b31', '#c9b1e0', '#f0b8c8', '#7c3aed', '#1e40af' ].map((color, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={labels[0]} type="number" stroke="#94a3b8" />
              <YAxis dataKey={labels[1] || labels[0]} type="number" stroke="#94a3b8" />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }}
              />
              <Scatter name="Data" data={result.data.map(r => ({ x: r[labels[0]], y: r[labels[1] || labels[0]] }))} fill="#533afd" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={result.data.slice(0, 6)}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey={labels[0]} stroke="#94a3b8" />
              <PolarRadiusAxis stroke="#94a3b8" />
              <Radar name="Value" dataKey={labels[1] || labels[0]} stroke="#533afd" fill="#533afd" fillOpacity={0.3} />
              <Tooltip 
                contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
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

      {/* Team Selector */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(83, 58, 253, 0.1)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#94a3b8' }}>Working in:</span>
            <select 
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '8px 12px', color: '#fff' }}
            >
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button 
              onClick={() => setShowInvite(!showInvite)}
              style={{ background: 'rgba(83, 58, 253, 0.2)', border: '1px solid rgba(83, 58, 253, 0.5)', color: '#c9b1e0', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              Invite Member
            </button>
          </div>
          
          {showInvite && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <input 
                type="email" 
                placeholder="Email" 
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '8px 12px', color: '#fff', flex: 1 }}
              />
              <select 
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '8px 12px', color: '#fff' }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={inviteMember} style={{ background: '#533afd', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'query', label: 'Query' },
          { id: 'reports', label: 'Reports' },
          { id: 'datasources', label: 'Data Sources' },
          { id: 'schedules', label: 'Schedules' },
          { id: 'team', label: 'Team' },
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
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
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

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Teams</h2>
            <button 
              onClick={() => setShowCreateTeam(!showCreateTeam)}
              style={{ background: 'rgba(83, 58, 253, 0.2)', border: '1px solid rgba(83, 58, 253, 0.5)', color: '#c9b1e0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
            >
              + Create Team
            </button>
          </div>

          {showCreateTeam && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Team Name"
                  value={newTeam.name}
                  onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newTeam.description}
                  onChange={e => setNewTeam({ ...newTeam, description: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '10px 12px', color: '#fff' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createTeam} style={{ background: '#533afd', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Create
                  </button>
                  <button onClick={() => setShowCreateTeam(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {teams.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No teams yet. Create one to collaborate!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {teams.map(team => (
                <div key={team.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{team.name}</span>
                      {team.description && (
                        <span style={{ marginLeft: 12, color: '#94a3b8', fontSize: 12 }}>{team.description}</span>
                      )}
                    </div>
                    <button 
                      style={{ background: 'rgba(83, 58, 253, 0.2)', border: 'none', color: '#c9b1e0', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Manage
                    </button>
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
