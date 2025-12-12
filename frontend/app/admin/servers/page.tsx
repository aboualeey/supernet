'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import api from '@/lib/api';

export default function AdminServers() {
    const { user, loading } = useAuth();
    const [servers, setServers] = useState<any[]>([]);
    const [newServer, setNewServer] = useState({ name: '', ipAddress: '', region: '', publicKey: '' });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchServers();
        }
    }, [user]);

    const fetchServers = async () => {
        try {
            const res = await api.get('/servers');
            setServers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/servers', newServer);
            setAdding(false);
            setNewServer({ name: '', ipAddress: '', region: '', publicKey: '' });
            fetchServers();
        } catch (err) {
            alert('Failed to add server');
        }
    };

    if (!user || user.role !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gray-100 p-8 text-black">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Server Management</h1>

                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Active VPN Nodes</h2>
                        <button onClick={() => setAdding(!adding)} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
                            {adding ? 'Cancel' : '+ Add Server'}
                        </button>
                    </div>

                    {adding && (
                        <form onSubmit={handleAdd} className="mb-6 bg-gray-50 p-4 rounded border">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <input placeholder="Name (e.g. US-East-1)" value={newServer.name} onChange={e => setNewServer({ ...newServer, name: e.target.value })} className="p-2 border rounded" required />
                                <input placeholder="IP Address" value={newServer.ipAddress} onChange={e => setNewServer({ ...newServer, ipAddress: e.target.value })} className="p-2 border rounded" required />
                                <input placeholder="Region" value={newServer.region} onChange={e => setNewServer({ ...newServer, region: e.target.value })} className="p-2 border rounded" required />
                                <input placeholder="Public Key" value={newServer.publicKey} onChange={e => setNewServer({ ...newServer, publicKey: e.target.value })} className="p-2 border rounded" required />
                            </div>
                            <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save Server</button>
                        </form>
                    )}

                    <table className="w-full text-left">
                        <thead className="border-b bg-gray-50">
                            <tr>
                                <th className="p-3">Name</th>
                                <th className="p-3">Region</th>
                                <th className="p-3">IP Address</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {servers.map(s => (
                                <tr key={s.id} className="border-b">
                                    <td className="p-3">{s.name}</td>
                                    <td className="p-3">{s.region}</td>
                                    <td className="p-3 font-mono">{s.ipAddress}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${s.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
