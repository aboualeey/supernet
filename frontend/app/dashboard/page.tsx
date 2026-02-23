'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import api from '@/lib/api';
import QRCode from 'react-qr-code';
import { Download, RefreshCw, Power, Smartphone, Monitor, Wifi, Home, Shield } from 'lucide-react';
import ModeToggle from '@/components/vpn/ModeToggle';

interface WgClient {
    name: string;
    ip: string;
    publicKey: string;
    hasQr: boolean;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
    iphone: <Smartphone size={20} />,
    android: <Smartphone size={20} />,
};

export default function Dashboard() {
    const { user, logout, loading } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [configText, setConfigText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(true);

    // WireGuard auto-clients state
    const [wgClients, setWgClients] = useState<WgClient[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [selectedClient, setSelectedClient] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchConfig();
        }
        fetchWgClients();
        // Poll for new clients every 10 seconds (picks up new peers automatically)
        const interval = setInterval(fetchWgClients, 10000);
        return () => clearInterval(interval);
    }, [user]);

    const fetchConfig = async () => {
        setLoadingConfig(true);
        try {
            const res = await api.get('/vpn/config');
            if (res.data.config) {
                setConfigText(res.data.config);
                setProfile(res.data.profile);
            } else {
                setProfile(null);
                setConfigText('');
            }
        } catch (err) {
            console.error('Failed to fetch config', err);
        } finally {
            setLoadingConfig(false);
        }
    };

    const fetchWgClients = async () => {
        try {
            const res = await api.get('/vpn/clients');
            const list: WgClient[] = res.data.clients || [];
            setWgClients(list);
            if (list.length > 0 && !selectedClient) {
                setSelectedClient(list[0].name);
            }
        } catch (err) {
            console.error('Failed to fetch WireGuard clients', err);
        } finally {
            setLoadingClients(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await api.post('/vpn/generate');
            await fetchConfig();
        } catch (err) {
            console.error(err);
            alert('Failed to generate VPN profile');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([configText], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "wg0.conf";
        document.body.appendChild(element);
        element.click();
    };

    const handleClientConfDownload = (name: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        window.open(`${baseUrl}/vpn/clients/${name}/conf`, '_blank');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
    if (!user) return null;

    const activeClient = wgClients.find(c => c.name === selectedClient);
    const qrImageUrl = activeClient?.hasQr
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/vpn/clients/${activeClient.name}/qr`
        : null;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-5xl mx-auto">
                <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wifi size={26} className="text-blue-400" />
                        Supernet VPN Dashboard
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-400">Welcome, {user.name || user.email}</span>
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
                        >
                            <Power size={18} /> Logout
                        </button>
                    </div>
                </header>

                {/* ── Dashboard Content ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Status Card */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold mb-4 text-blue-400">Subscription Status</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Plan</span>
                                <span className="font-semibold text-green-400">Standard</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Status</span>
                                <span className="badge bg-green-900 text-green-300 px-2 py-1 rounded">Active</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-700 pt-3 mt-2">
                                <span className="text-gray-400">Security Mode</span>
                                <span className={`flex items-center gap-1 font-semibold ${profile?.exitMode === 'private' ? 'text-purple-400' : 'text-blue-400'}`}>
                                    {profile?.exitMode === 'private' ? <Home size={14} /> : <Shield size={14} />}
                                    {profile?.exitMode === 'private' ? 'Private Gateway' : 'SaaS VPN'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* VPN Config Card */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold mb-4 text-purple-400">VPN Configuration</h2>

                        {loadingConfig ? (
                            <div className="text-center py-8 text-gray-500">Just a sec...</div>
                        ) : !profile ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 mb-6">No VPN profile active.</p>
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2 w-full transition disabled:opacity-50"
                                >
                                    <RefreshCw size={20} className={generating ? "animate-spin" : ""} />
                                    {generating ? 'Generating...' : 'Generate New Config'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <ModeToggle
                                    profileId={profile.id}
                                    currentMode={profile.exitMode}
                                    isUserAllowed={user?.privateGatewayAllowed}
                                    isDeviceApproved={profile.privateGatewayApproved}
                                    onModeChanged={(newConfig, newProfile) => {
                                        setConfigText(newConfig);
                                        setProfile(newProfile);
                                    }}
                                />

                                <div className="bg-white p-4 rounded-lg flex justify-center">
                                    <QRCode value={configText} size={150} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-400 mb-2">Scan with WireGuard App</p>
                                    <button
                                        onClick={handleDownload}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center gap-2 w-full"
                                    >
                                        <Download size={18} /> Download .conf
                                    </button>
                                </div>
                                <div className="bg-gray-900 p-4 rounded overflow-x-auto">
                                    <pre className="text-xs text-green-500 font-mono whitespace-pre-wrap">{configText}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── WireGuard Auto-Clients Section ── */}
                <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                            <Monitor size={22} />
                            WireGuard Device Configs
                        </h2>
                        <button
                            onClick={fetchWgClients}
                            title="Refresh client list"
                            className="text-gray-400 hover:text-white transition"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    {loadingClients ? (
                        <div className="text-center py-12 text-gray-500">Loading device configs…</div>
                    ) : wgClients.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>No device configs generated yet.</p>
                            <p className="text-sm mt-2">Add a peer to <code className="text-cyan-400">wg0.conf</code> and configs will appear here automatically.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row">

                            {/* Device list sidebar */}
                            <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-gray-700">
                                {wgClients.map((client) => (
                                    <button
                                        key={client.name}
                                        onClick={() => setSelectedClient(client.name)}
                                        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition hover:bg-gray-750 ${selectedClient === client.name ? 'bg-gray-700 border-l-4 border-cyan-400' : ''}`}
                                    >
                                        <span className="text-cyan-400">
                                            {DEVICE_ICONS[client.name] || <Monitor size={20} />}
                                        </span>
                                        <div>
                                            <p className="font-semibold capitalize">{client.name}</p>
                                            <p className="text-xs text-gray-400">{client.ip}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Client detail panel */}
                            {activeClient && (
                                <div className="flex-1 p-6">
                                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">

                                        {/* QR code */}
                                        <div className="flex flex-col items-center gap-3">
                                            {qrImageUrl ? (
                                                <div className="bg-white p-3 rounded-lg shadow-lg">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={`${qrImageUrl}?t=${Date.now()}`}
                                                        alt={`${activeClient.name} QR code`}
                                                        width={180}
                                                        height={180}
                                                        className="rounded"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="bg-gray-700 p-3 rounded-lg flex items-center justify-center" style={{ width: 186, height: 186 }}>
                                                    <span className="text-gray-500 text-sm text-center">QR not ready</span>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-400">Scan with WireGuard app</p>
                                        </div>

                                        {/* Info + actions */}
                                        <div className="flex-1 space-y-4 w-full">
                                            <div>
                                                <h3 className="text-lg font-bold capitalize text-white mb-1">{activeClient.name}</h3>
                                                <div className="flex gap-2 text-sm">
                                                    <span className="bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded font-mono">{activeClient.ip}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${activeClient.hasQr ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                                                        {activeClient.hasQr ? '✓ QR ready' : '⏳ Generating…'}
                                                    </span>
                                                </div>
                                            </div>

                                            {activeClient.publicKey && (
                                                <div>
                                                    <p className="text-xs text-gray-400 mb-1">Server Public Key (peer)</p>
                                                    <p className="font-mono text-xs text-gray-300 bg-gray-900 p-2 rounded break-all">{activeClient.publicKey}</p>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleClientConfDownload(activeClient.name)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-semibold transition"
                                            >
                                                <Download size={16} />
                                                Download {activeClient.name}.conf
                                            </button>

                                            <p className="text-xs text-gray-500">
                                                Config auto-updated whenever <code className="text-cyan-400">wg0.conf</code> changes.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
