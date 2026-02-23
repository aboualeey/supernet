'use client';

import { useState } from 'react';
import { Shield, Home, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface ModeToggleProps {
    profileId: string;
    currentMode: 'saas' | 'private';
    isUserAllowed: boolean;
    isDeviceApproved: boolean;
    onModeChanged: (newConfig: string, newProfile: any) => void;
}

export default function ModeToggle({
    profileId,
    currentMode,
    isUserAllowed,
    isDeviceApproved,
    onModeChanged
}: ModeToggleProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEnabled = isUserAllowed && isDeviceApproved;

    const handleToggle = async (mode: 'saas' | 'private') => {
        if (mode === currentMode) return;
        if (mode === 'private' && !isEnabled) return;

        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/vpn/toggle-mode', { profileId, mode });
            onModeChanged(res.data.config, res.data.profile);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to switch mode');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                <button
                    onClick={() => handleToggle('saas')}
                    disabled={loading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${currentMode === 'saas'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <Shield size={18} />
                    <span className="text-sm font-semibold">SaaS VPN</span>
                </button>

                <button
                    onClick={() => handleToggle('private')}
                    disabled={loading || !isEnabled}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${currentMode === 'private'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : isEnabled
                                ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                                : 'text-gray-600 cursor-not-allowed opacity-50'
                        }`}
                >
                    <Home size={18} />
                    <span className="text-sm font-semibold">Private GW</span>
                </button>
            </div>

            {!isEnabled && (
                <div className="flex items-start gap-2 text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>
                        {!isUserAllowed
                            ? "Private Gateway access not enabled for your account."
                            : "This device is not yet approved for Private Gateway access."}
                    </span>
                </div>
            )}

            {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
            )}
        </div>
    );
}
