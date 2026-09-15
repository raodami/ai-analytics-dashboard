'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, Radar, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  Brush, Tooltip, Legend, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  ChartBarIcon, ClockIcon, TrashIcon, ArrowPathIcon,
  ShareIcon, PlusIcon, DatabaseIcon,
  CalendarIcon, UsersIcon, SparklesIcon, Cog6ToothIcon,
  PaperAirplaneIcon, ChevronDownIcon, XMarkIcon,
  MagnifyingGlassIcon, ArrowDownTrayIcon, EyeIcon
} from '@heroicons/react/24/outline';

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

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [schedules, setSchedules] = useState<ScheduleJob[]>([]);
  const [queries, setQueries] = useState(0);
  const [remaining, setRemaining] = useState(10);
  const [activeTab, setActiveTab] = useState('query');
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const ws = new WebSocket(`wss://${window.location.host}/api/ws`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'query_progress') {
        setProgress(msg.progress);
      } else if (msg.type === 'query_complete') {
        console.log('Query complete:', msg);
      }
    };
    
    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
    
    return () => ws.close();
  }, []);

  useEffect(() => {
    fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setQueries(data.query_count || 0);
        setRemaining(data.remaining || 10);
      })
      .catch(() => router.push('/login'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setProgress(10);
    setResult(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ natural_query: query })
      });

      const data = await res.json();
      setProgress(100);
      
      if (data.error) {
        alert(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      alert('Failed to process query');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  const downloadChart = () => {
    if (!result?.id) return;
    const url = `/api/charts/${result.id}/png`;
    window.open(url, '_blank');
  };

  const shareReport = async (reportId: string) => {
    const res = await fetch(`/api/reports/${reportId}/share`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    setShareUrl(data.share_url);
    setShowShare(true);
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    setReports(reports.filter(r => r.id !== id));
  };

  const renderChart = (result: QueryResult) => {
    const labels = Object.keys(result.data[0] || {});
    const values = labels.slice(1);

    switch (result.chart_type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={result.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={labels[0]} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }} />
              <Legend />
              {values.map((v, i) => (
                <Line key={i} type="monotone" dataKey={v} stroke="#533afd" strokeWidth={2} />
              ))}
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
              <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }} />
              <Legend />
              {values.map((v, i) => (
                <Bar key={i} dataKey={v} fill="#533afd" radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie 
                data={result.data} 
                dataKey={values[0]} 
                nameKey={labels[0]}
                cx="50%" cy="50%" outerRadius={120}
              >
                {['#533afd', '#061b31', '#c9b1e0', '#f0b8c8', '#7c3aed', '#1e40af'].map((color, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(83, 58, 253, 0.3)', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {labels.map(l => <th key={l} className="p-2 text-left text-gray-400">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    {labels.map(l => <td key={l} className="p-2">{row[l]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  if (!user) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><LoaderIcon className="animate-spin h-8 w-8 text-purple-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Analytics</h1>
              <p className="text-xs text-gray-400">Natural Language to SQL</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-gray-400">
                {user.is_pro ? 'PRO' : `${remaining} queries left`}
              </p>
            </div>
            <button onClick={() => router.push('/logout')} className="text-sm text-gray-400 hover:text-white">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {[
            { id: 'query', label: 'Query', icon: SparklesIcon },
            { id: 'reports', label: 'Reports', icon: ClockIcon },
            { id: 'datasources', label: 'Data Sources', icon: DatabaseIcon },
            { id: 'schedules', label: 'Schedules', icon: CalendarIcon },
            { id: 'team', label: 'Team', icon: UsersIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="space-y-6">
            {/* Query Input */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-purple-400" />
                Ask a Question
              </h2>
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="e.g., Show monthly sales trends..."
                  className="flex-1 bg-slate-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={loading || remaining <= 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {loading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                  Query
                </button>
              </form>

              {/* Progress Bar */}
              {loading && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            {result && (
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Results</h3>
                  <div className="flex gap-2">
                    <button onClick={() => shareReport(result.id!)} className="p-2 hover:bg-slate-700 rounded-lg" title="Share">
                      <ShareIcon className="h-5 w-5" />
                    </button>
                    <button onClick={downloadChart} className="p-2 hover:bg-slate-700 rounded-lg" title="Download">
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400 font-mono bg-slate-900 p-3 rounded-lg">
                  {result.sql}
                </div>
                {renderChart(result)}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Reports</h2>
            {reports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClockIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No reports yet. Run your first query!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reports.map(report => (
                  <div key={report.id} className="bg-slate-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{report.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">{report.natural_query}</p>
                        <p className="text-xs text-gray-500 mt-2 font-mono">{report.sql}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => shareReport(report.id)} className="p-2 hover:bg-slate-700 rounded-lg">
                          <ShareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteReport(report.id)} className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data Sources Tab */}
        {activeTab === 'datasources' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Data Sources</h2>
              <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium">
                <PlusIcon className="h-4 w-4" />
                Add Source
              </button>
            </div>
            {datasources.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DatabaseIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No data sources connected. Add one to get started.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {datasources.map(ds => (
                  <div key={ds.id} className="bg-slate-800/50 rounded-xl p-4 border border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                        <DatabaseIcon className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-medium">{ds.name}</p>
                        <p className="text-sm text-gray-400">{ds.type}</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">Connected</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedules Tab */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Scheduled Reports</h2>
              <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium">
                <PlusIcon className="h-4 w-4" />
                New Schedule
              </button>
            </div>
            {schedules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scheduled reports. Set up automatic report generation.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {schedules.map(schedule => (
                  <div key={schedule.id} className="bg-slate-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{schedule.name}</p>
                        <p className="text-sm text-gray-400">{schedule.query}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${schedule.enabled ? 'bg-green-400/10 text-green-400' : 'bg-gray-600/10 text-gray-400'}`}>
                          {schedule.interval}
                        </span>
                        <button className="p-2 hover:bg-slate-700 rounded-lg">
                          <Cog6ToothIcon className="h-4 w-4" />
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Team</h2>
              <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium">
                <PlusIcon className="h-4 w-4" />
                Invite Member
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No team members yet. Invite others to collaborate.</p>
            </div>
          </div>
        )}
      </main>

      {/* Share Modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share Report</h3>
              <button onClick={() => setShowShare(false)} className="p-1 hover:bg-slate-700 rounded-lg">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={shareUrl}
                readOnly
                className="flex-1 bg-slate-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
              />
              <button onClick={() => navigator.clipboard.writeText(shareUrl)} className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
