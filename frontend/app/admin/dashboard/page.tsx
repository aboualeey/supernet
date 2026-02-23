'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryStats {
    totalUsers: number;
    activeConnections: number;
    totalPeers: number;
    totalBandwidthBytes: number;
}

interface Peer {
    id: string;
    publicKey: string;
    deviceName: string;
    nodeName: string;
    endpoint: string | null;
    allowedIps: string;
    latestHandshake: number | null;
    rxBytes: number;
    txBytes: number;
    isOnline: boolean;
    privateGatewayApproved: boolean;
    ownerEmail?: string;
}

interface UserUsageRow {
    userId: string;
    email: string;
    plan: string;
    maxDevices: number;
    activeDevices: number;
    dataUsageBytes: number;
    bandwidthLimitGb: number | null;
    isActive: boolean;
    privateGatewayAllowed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function timeSince(ts: number | null): string {
    if (!ts) return 'Never';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function deviceIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('iphone') || n.includes('ios')) return '📱';
    if (n.includes('android')) return '🤖';
    if (n.includes('mac') || n.includes('desktop') || n.includes('pc')) return '💻';
    if (n.includes('unknown') || n.includes('vps')) return '🔲';
    return '📡';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '20px 24px',
            borderTop: `3px solid ${color}`,
        }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ color: '#f9fafb', fontSize: 28, fontWeight: 700 }}>{value}</div>
            {sub && <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function OnlineBadge({ online }: { online: boolean }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: online ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.12)',
            color: online ? '#4ade80' : '#6b7280',
            borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: online ? '#4ade80' : '#4b5563',
                display: 'inline-block',
                boxShadow: online ? '0 0 6px #4ade80' : 'none',
                animation: online ? 'pulse 2s infinite' : 'none',
            }} />
            {online ? 'Online' : 'Offline'}
        </span>
    );
}

function BandwidthChart({ peers }: { peers: Peer[] }) {
    if (peers.length === 0) return <div style={{ color: '#4b5563', fontSize: 13 }}>Waiting for peer telemetry…</div>;

    const sorted = [...peers].sort((a, b) => (b.rxBytes + b.txBytes) - (a.rxBytes + a.txBytes)).slice(0, 8);
    const maxVal = Math.max(...sorted.map(p => p.rxBytes + p.txBytes), 1);
    const BAR_W = 40, GAP = 10, H = 110;

    return (
        <svg width={sorted.length * (BAR_W + GAP)} height={H + 44} style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
            </defs>
            {sorted.map((peer, i) => {
                const total = peer.rxBytes + peer.txBytes;
                const barH = Math.max(4, (total / maxVal) * H);
                const x = i * (BAR_W + GAP);
                return (
                    <g key={peer.id}>
                        <rect x={x} y={H - barH} width={BAR_W} height={barH} rx={4}
                            fill={peer.isOnline ? 'url(#barGrad)' : '#374151'} />
                        <text x={x + BAR_W / 2} y={H + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
                            {(deviceIcon(peer.deviceName))}
                        </text>
                        <text x={x + BAR_W / 2} y={H + 30} textAnchor="middle" fontSize={9} fill="#4b5563">
                            {peer.deviceName.length > 8 ? peer.deviceName.substring(0, 7) + '…' : peer.deviceName}
                        </text>
                        <title>{peer.deviceName}: {fmtBytes(total)}</title>
                    </g>
                );
            })}
        </svg>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState<SummaryStats | null>(null);
    const [peers, setPeers] = useState<Peer[]>([]);
    const [usage, setUsage] = useState<UserUsageRow[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [activeTab, setActiveTab] = useState<'connections' | 'users'>('connections');

    // ─── Verification State ──────────────────────────────────────────────────
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [verifyingStatus, setVerifyingStatus] = useState<string>('idle');
    const [verifyResult, setVerifyResult] = useState<any>(null);

    const fetchAll = useCallback(async () => {
        try {
            const [s, p, u] = await Promise.all([
                api.get('/admin/stats'),
                api.get('/admin/peers'),   // all peers (online + offline)
                api.get('/admin/usage'),
            ]);
            setStats(s.data);
            setPeers(p.data);
            setUsage(u.data);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Admin fetch error:', err);
        }
    }, []);

    useEffect(() => {
        if (!loading && (!user || user.role !== 'admin')) {
            router.push('/admin/login');
            return;
        }
        if (user?.role === 'admin') {
            fetchAll();
            const iv = setInterval(fetchAll, 10_000);
            return () => clearInterval(iv);
        }
    }, [user, loading, fetchAll, router]);

    const handlePeerAction = async (publicKey: string, action: 'disable-peer' | 'enable-peer') => {
        try {
            const res = await api.post(`/admin/${action}`, { publicKey });
            setActionMsg({ text: res.data.message, ok: true });
            setTimeout(() => { setActionMsg(null); fetchAll(); }, 2500);
        } catch (err: any) {
            setActionMsg({ text: `Error: ${err?.response?.data?.message ?? err.message}`, ok: false });
        }
    };

    const handleUserGatewayToggle = async (userId: string, allowed: boolean) => {
        try {
            const res = await api.post('/admin/allow-gateway', { userId, allowed });
            setActionMsg({ text: res.data.message, ok: true });
            setTimeout(() => { setActionMsg(null); fetchAll(); }, 2000);
        } catch (err: any) {
            setActionMsg({ text: `Error: ${err?.response?.data?.message ?? err.message}`, ok: false });
        }
    };

    const handleDeviceApprovalToggle = async (profileId: string, approved: boolean) => {
        try {
            const res = await api.post('/admin/approve-gateway', { profileId, approved });
            setActionMsg({ text: res.data.message, ok: true });
            setTimeout(() => { setActionMsg(null); fetchAll(); }, 2000);
        } catch (err: any) {
            setActionMsg({ text: `Error: ${err?.response?.data?.message ?? err.message}`, ok: false });
        }
    };

    const handleVerifyGateway = async (profileId: string) => {
        setVerifyingId(profileId);
        setVerifyingStatus('contacting_gateway');
        setVerifyResult(null);

        try {
            // In a real scenario, we might prompt for the Device Exit IP
            // For now, we use the current IP the user is connecting from (if available)
            // or ask the admin to provide it. For the one-click UX, we will probe it.
            const deviceExitIp = prompt('Please enter the Public IP reported by the user device (or leave blank to probe):') || '';

            setVerifyingStatus('comparing_routes');
            const data = await api.post('/admin/private-gateway/verify', { profileId, deviceExitIp });

            setVerifyResult(data);
            setVerifyingStatus('done');
        } catch (err: any) {
            setVerifyingStatus('error');
            setVerifyResult({ error: err.message || 'Verification failed' });
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                Loading admin panel…
            </div>
        </div>
    );
    if (!user || user.role !== 'admin') return null;

    const planCounts: Record<string, number> = {};
    for (const u of usage) planCounts[u.plan] = (planCounts[u.plan] ?? 0) + 1;

    const onlinePeers = peers.filter(p => p.isOnline);

    const s = {
        page: { minHeight: '100vh', background: '#0a0a12', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#f3f4f6', paddingBottom: 60 },
        topbar: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', position: 'sticky' as const, top: 0, zIndex: 100 },
        wrap: { maxWidth: 1280, margin: '0 auto', padding: '36px 24px' },
        grid4: { display: 'grid' as const, gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 },
        section: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 },
        sTitle: { fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 14, display: 'flex' as const, alignItems: 'center' as const, gap: 7 },
        th: { padding: '10px 14px', textAlign: 'left' as const, color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        td: { padding: '11px 14px', fontSize: 13, color: '#d1d5db', borderBottom: '1px solid rgba(255,255,255,0.03)' },
        btn: (bg: string) => ({ background: bg, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'opacity 0.15s' }),
        tab: (a: boolean) => ({ background: a ? 'rgba(99,102,241,0.18)' : 'transparent', border: a ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: a ? '#a5b4fc' : '#9ca3af', transition: 'all 0.15s' }),
    };

    return (
        <div style={s.page}>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } * { box-sizing: border-box; }`}</style>

            {/* Top bar */}
            <header style={s.topbar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#a5b4fc', letterSpacing: '-0.5px' }}>⚡ Supernet</span>
                    <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>ADMIN</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {lastRefresh && <span style={{ color: '#4b5563', fontSize: 11 }}>↻ {lastRefresh.toLocaleTimeString()}</span>}
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{user.email}</span>
                    <button onClick={fetchAll} style={s.btn('#1f2937')}>Refresh</button>
                    <button onClick={logout} style={s.btn('#7f1d1d')}>Logout</button>
                </div>
            </header>

            <div style={s.wrap}>
                {/* Action flash */}
                {actionMsg && (
                    <div style={{ background: actionMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${actionMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: actionMsg.ok ? '#4ade80' : '#f87171' }}>
                        {actionMsg.ok ? '✓' : '⚠'} {actionMsg.text}
                    </div>
                )}

                {/* ── Stat cards ───────────────────────────────────────────── */}
                <div style={s.grid4}>
                    <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} color="#6366f1" />
                    <StatCard label="Active Now" value={stats?.activeConnections ?? '—'} color="#22c55e" sub={`of ${stats?.totalPeers ?? 0} total peers`} />
                    <StatCard label="Total Peers (DB)" value={stats?.totalPeers ?? '—'} color="#f59e0b" />
                    <StatCard label="Bandwidth Used" value={stats ? fmtBytes(stats.totalBandwidthBytes) : '—'} color="#06b6d4" />
                </div>

                {/* ── Charts row ───────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, marginBottom: 22 }}>
                    {/* Plan distribution */}
                    <div style={s.section}>
                        <div style={s.sTitle}>📊 Plans</div>
                        {Object.keys(planCounts).length === 0
                            ? <p style={{ color: '#4b5563', fontSize: 12 }}>No subscriptions</p>
                            : Object.entries(planCounts).map(([plan, count]) => (
                                <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, color: '#d1d5db' }}>{plan || 'None'}</span>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: '#a5b4fc' }}>{count}</span>
                                </div>
                            ))
                        }
                    </div>

                    {/* Bandwidth chart */}
                    <div style={s.section}>
                        <div style={s.sTitle}>📈 Bandwidth per Device</div>
                        <BandwidthChart peers={peers} />
                    </div>
                </div>

                {/* ── Tabs ─────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button style={s.tab(activeTab === 'connections')} onClick={() => setActiveTab('connections')}>
                        🔌 Connections
                        {onlinePeers.length > 0 && (
                            <span style={{ marginLeft: 6, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                                {onlinePeers.length} live
                            </span>
                        )}
                        {peers.length > 0 && <span style={{ marginLeft: 4, color: '#6b7280', fontSize: 11 }}>({peers.length})</span>}
                    </button>
                    <button style={s.tab(activeTab === 'users')} onClick={() => setActiveTab('users')}>
                        👥 Users & Usage ({usage.length})
                    </button>
                </div>

                {/* ── Connections table ─────────────────────────────────────── */}
                {activeTab === 'connections' && (
                    <div style={s.section}>
                        <div style={s.sTitle}>🔌 All WireGuard Peers</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Device', 'Owner', 'Node', 'IP / AllowedIPs', 'Endpoint', 'Last Handshake', 'RX ↓', 'TX ↑', 'Status', 'Gateway', 'Tools', ''].map(h => (
                                            <th key={h} style={s.th}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {peers.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ ...s.td, color: '#4b5563', textAlign: 'center', padding: '40px 0' }}>
                                                <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
                                                No peers tracked yet. TelemetryService polls every 10s — connect a device to see it appear here.
                                            </td>
                                        </tr>
                                    ) : peers.map(p => (
                                        <tr key={p.id} style={{ transition: 'background 0.1s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td style={s.td}>
                                                <span style={{ marginRight: 6 }}>{deviceIcon(p.deviceName)}</span>
                                                <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{p.deviceName}</span>
                                            </td>
                                            <td style={{ ...s.td, color: '#9ca3af', fontSize: 12 }}>{p.ownerEmail ?? '—'}</td>
                                            <td style={{ ...s.td, color: '#6b7280', fontSize: 11 }}>{p.nodeName}</td>
                                            <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: '#a5b4fc' }}>{p.allowedIps}</td>
                                            <td style={{ ...s.td, color: '#6b7280', fontSize: 11 }}>{p.endpoint ?? '—'}</td>
                                            <td style={s.td}>{timeSince(p.latestHandshake)}</td>
                                            <td style={{ ...s.td, color: '#34d399', fontFamily: 'monospace' }}>{fmtBytes(p.rxBytes)}</td>
                                            <td style={{ ...s.td, color: '#60a5fa', fontFamily: 'monospace' }}>{fmtBytes(p.txBytes)}</td>
                                            <td style={s.td}><OnlineBadge online={p.isOnline} /></td>
                                            <td style={s.td}>
                                                <button
                                                    onClick={() => handleDeviceApprovalToggle(p.id, !p.privateGatewayApproved)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: `1px solid ${p.privateGatewayApproved ? '#a5b4fc' : '#4b5563'}`,
                                                        color: p.privateGatewayApproved ? '#a5b4fc' : '#6b7280',
                                                        borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer'
                                                    }}
                                                >
                                                    {p.privateGatewayApproved ? '★ Approved' : '☆ Approve'}
                                                </button>
                                            </td>
                                            <td style={s.td}>
                                                <button
                                                    onClick={() => handleVerifyGateway(p.id)}
                                                    style={{
                                                        background: 'rgba(99,102,241,0.1)',
                                                        border: '1px solid #6366f1',
                                                        color: '#a5b4fc',
                                                        borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer'
                                                    }}
                                                >
                                                    🔍 Verify Route
                                                </button>
                                            </td>
                                            <td style={s.td}>
                                                <button
                                                    style={s.btn(p.isOnline ? '#7f1d1d' : '#14532d')}
                                                    onMouseEnter={e => (e.target as HTMLElement).style.opacity = '0.8'}
                                                    onMouseLeave={e => (e.target as HTMLElement).style.opacity = '1'}
                                                    onClick={() => handlePeerAction(p.publicKey, p.isOnline ? 'disable-peer' : 'enable-peer')}
                                                >
                                                    {p.isOnline ? '⛔ Disable' : '✅ Enable'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Users table ───────────────────────────────────────────── */}
                {activeTab === 'users' && (
                    <div style={s.section}>
                        <div style={s.sTitle}>👥 Users & Bandwidth</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Email', 'Plan', 'Devices', 'Data Used', 'Limit', 'Status', 'Gateway'].map(h => (
                                            <th key={h} style={s.th}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.length === 0 ? (
                                        <tr><td colSpan={7} style={{ ...s.td, color: '#4b5563', textAlign: 'center', padding: '40px 0' }}>No user VPN profiles found.</td></tr>
                                    ) : usage.map(u => {
                                        const limitBytes = u.bandwidthLimitGb ? u.bandwidthLimitGb * 1_073_741_824 : null;
                                        const pct = limitBytes ? Math.min(100, (u.dataUsageBytes / limitBytes) * 100) : null;
                                        return (
                                            <tr key={u.userId}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <td style={s.td}>{u.email}</td>
                                                <td style={s.td}>
                                                    <span style={{
                                                        background: u.plan === 'TEAM' ? 'rgba(234,179,8,0.15)' : u.plan === 'PRO' ? 'rgba(99,102,241,0.15)' : 'rgba(107,114,128,0.1)',
                                                        color: u.plan === 'TEAM' ? '#fbbf24' : u.plan === 'PRO' ? '#a5b4fc' : '#9ca3af',
                                                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4
                                                    }}>{u.plan || 'None'}</span>
                                                </td>
                                                <td style={s.td}>{u.activeDevices} / {u.maxDevices}</td>
                                                <td style={{ ...s.td, fontFamily: 'monospace' }}>{fmtBytes(u.dataUsageBytes)}</td>
                                                <td style={s.td}>
                                                    {pct !== null ? (
                                                        <div>
                                                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{pct.toFixed(1)}%</div>
                                                            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', width: 80 }}>
                                                                <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#6366f1', transition: 'width 0.3s' }} />
                                                            </div>
                                                        </div>
                                                    ) : <span style={{ color: '#4b5563', fontSize: 12 }}>Unlimited</span>}
                                                </td>
                                                <td style={s.td}>
                                                    <span style={{ color: u.isActive ? '#4ade80' : '#f87171', fontWeight: 600, fontSize: 12 }}>
                                                        {u.isActive ? '✓ Active' : '✗ Suspended'}
                                                    </span>
                                                </td>
                                                <td style={s.td}>
                                                    <button
                                                        onClick={() => handleUserGatewayToggle(u.userId, !u.privateGatewayAllowed)}
                                                        style={{
                                                            background: u.privateGatewayAllowed ? 'rgba(165,180,252,0.15)' : 'transparent',
                                                            border: `1px solid ${u.privateGatewayAllowed ? '#a5b4fc' : '#374151'}`,
                                                            color: u.privateGatewayAllowed ? '#a5b4fc' : '#6b7280',
                                                            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer'
                                                        }}
                                                    >
                                                        {u.privateGatewayAllowed ? 'Authorized' : 'Authorize'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Verification Modal ─────────────────────────────────────── */}
                {verifyingId && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            background: '#111827', border: '1px solid #374151', borderRadius: 16,
                            padding: 32, maxWidth: 500, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                        }}>
                            <h3 style={{ color: '#f3f4f6', marginTop: 0, marginBottom: 20, fontSize: 20 }}>Starlink Exit Verification</h3>

                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: verifyingStatus === 'contacting_gateway' || verifyingStatus === 'comparing_routes' || verifyingStatus === 'done' ? '#f3f4f6' : '#6b7280' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: verifyingStatus === 'contacting_gateway' ? '#6366f1' : verifyingStatus === 'comparing_routes' || verifyingStatus === 'done' ? '#22c55e' : '#374151' }} />
                                        1. Contacting Private Gateway...
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: verifyingStatus === 'comparing_routes' || verifyingStatus === 'done' ? '#f3f4f6' : '#6b7280' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: verifyingStatus === 'comparing_routes' ? '#6366f1' : verifyingStatus === 'done' ? '#22c55e' : '#374151' }} />
                                        2. Comparing Device Exit IP...
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: verifyingStatus === 'done' ? '#f3f4f6' : '#6b7280' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: verifyingStatus === 'done' ? (verifyResult?.status === 'VERIFIED' ? '#22c55e' : '#ef4444') : '#374151' }} />
                                        3. Finalizing Result
                                    </div>
                                </div>
                            </div>

                            {verifyingStatus === 'done' && verifyResult && (
                                <div style={{
                                    background: verifyResult.status === 'VERIFIED' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${verifyResult.status === 'VERIFIED' ? '#22c55e' : '#ef4444'}`,
                                    padding: 16, borderRadius: 8, marginBottom: 20
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: verifyResult.status === 'VERIFIED' ? '#4ade80' : '#f87171', marginBottom: 8 }}>
                                        {verifyResult.status === 'VERIFIED' ? '🟢 VERIFIED (Using Starlink)' : '🔴 FAILED (Routing Mismatch)'}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
                                        {verifyResult.status === 'VERIFIED'
                                            ? `Device traffic is exiting via Gateway: ${verifyResult.gatewayIp}`
                                            : `Error: ${verifyResult.reason}`}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setVerifyingId(null)}
                                style={{ width: '100%', background: '#374151', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
