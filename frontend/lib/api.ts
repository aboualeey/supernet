import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
    baseURL: 'http://localhost:3001', // Update if deployed
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = Cookies.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = Cookies.get('refreshToken');

            if (refreshToken) {
                try {
                    const res = await axios.post('http://localhost:3001/auth/refresh', { refresh_token: refreshToken });
                    if (res.status === 201 || res.status === 200) {
                        const { access_token, refresh_token } = res.data;
                        Cookies.set('token', access_token);
                        Cookies.set('refreshToken', refresh_token);

                        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    console.error('Refresh token failed', refreshError);
                    // Logout or redirect to login
                    Cookies.remove('token');
                    Cookies.remove('refreshToken');
                    window.location.href = '/login';
                }
            } else {
                Cookies.remove('token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
