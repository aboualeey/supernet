'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import api from '@/lib/api';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            const { access_token, refresh_token, user } = res.data;
            if (user?.role !== 'admin') {
                setError('Access denied. This portal is for administrators only.');
                setLoading(false);
                return;
            }
            login(access_token, refresh_token, user);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed. Check your credentials.');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0a0a12 0%, #0e1128 50%, #0a0a12 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            padding: '20px',
        }}>
            {/* Glowing background accents */}
            <div style={{ position: 'fixed', top: '20%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{
                width: '100%',
                maxWidth: 420,
                background: 'rgba(15,17,27,0.85)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 20,
                padding: '44px 40px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 60px rgba(99,102,241,0.1), 0 24px 48px rgba(0,0,0,0.4)',
                position: 'relative' as const,
            }}>
                {/* Shield icon */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 64, height: 64, borderRadius: 16,
                        background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                        fontSize: 28, marginBottom: 16,
                        boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
                    }}>🛡️</div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f3f4f6', margin: 0 }}>Admin Portal</h1>
                    <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6, margin: '6px 0 0' }}>
                        Supernet Control Center
                    </p>
                </div>

                {/* Error message */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 10,
                        padding: '10px 14px',
                        marginBottom: 20,
                        color: '#f87171',
                        fontSize: 13,
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Email field */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                            Admin Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 10,
                                padding: '12px 14px',
                                color: '#f3f4f6',
                                fontSize: 14,
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Password field */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 10,
                                padding: '12px 14px',
                                color: '#f3f4f6',
                                fontSize: 14,
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '13px',
                            background: loading ? '#374151' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                            border: 'none',
                            borderRadius: 10,
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'opacity 0.2s, transform 0.1s',
                            letterSpacing: '0.02em',
                            boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                        }}
                        onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.opacity = '0.9'; }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
                    >
                        {loading ? '🔄  Authenticating…' : '🔐  Access Admin Panel'}
                    </button>
                </form>

                <div style={{ marginTop: 24, textAlign: 'center', color: '#4b5563', fontSize: 12 }}>
                    ← <a href="/login" style={{ color: '#6b7280', textDecoration: 'none' }}>Back to user login</a>
                </div>
            </div>
        </div>
    );
}
