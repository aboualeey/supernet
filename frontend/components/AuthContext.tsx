'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import api from '../lib/api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: any;
    login: (token: string, refreshToken: string, userData: any) => void;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => { },
    logout: () => { },
    isAuthenticated: false,
    loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = Cookies.get('token');
        if (!token) {
            setLoading(false);
            return;
        }

        // Re-fetch fresh profile from server so we always have the correct role
        // (avoids stale localStorage role after role changes in DB)
        api.get('/auth/profile')
            .then((res) => {
                const freshUser = res.data;
                localStorage.setItem('user', JSON.stringify(freshUser));
                setUser(freshUser);
            })
            .catch(() => {
                // Token invalid / expired — treat as logged out
                Cookies.remove('token');
                Cookies.remove('refreshToken');
                localStorage.removeItem('user');
            })
            .finally(() => setLoading(false));
    }, []);

    const login = (token: string, refreshToken: string, userData: any) => {
        Cookies.set('token', token, { expires: 1 });
        Cookies.set('refreshToken', refreshToken, { expires: 7 });
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        // Route admins to admin dashboard, regular users to user dashboard
        if (userData?.role === 'admin') {
            router.push('/admin/dashboard');
        } else {
            router.push('/dashboard');
        }
    };

    const logout = () => {
        Cookies.remove('token');
        Cookies.remove('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
