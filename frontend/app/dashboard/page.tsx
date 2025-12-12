'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import api from '@/lib/api';
import QRCode from 'react-qr-code';
import { Download, RefreshCw, Power } from 'lucide-react';

export default function Dashboard() {
    const { user, logout, loading } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [configText, setConfigText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(true);

    useEffect(() => {
        if (user) {
            fetchConfig();
        }
    }, [user]);

    const fetchConfig = async () => {
        setLoadingConfig(true);
        try {
            const res = await api.get('/vpn/config');
            if (res.data.config) {
                setConfigText(res.data.config);
                setProfile(true); // Just to indicate we have a profile
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
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
    if (!user) return null; // AuthContext handles redirect

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                    <h1 className="text-2xl font-bold">Starlink VPN Dashboard</h1>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <div className="flex justify-between">
                                <span className="text-gray-400">Data Usage</span>
                                <span>Unlimited</span>
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
            </div>
        </div>
    );
}
