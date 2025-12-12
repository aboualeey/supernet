'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const { user, loading, logout } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || user.role !== 'admin')) {
            router.push('/dashboard');
        }
        if (user && user.role === 'admin') {
            fetchUsers();
        }
    }, [user, loading]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!user || user.role !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                    <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
                </header>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4 text-black">Users Management</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-black">
                            <thead className="border-b">
                                <tr>
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Active</th>
                                    <th className="p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-mono text-sm">{u.id}</td>
                                        <td className="p-3">{u.email}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-800'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {u.isActive ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <button className="text-blue-600 hover:underline">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
