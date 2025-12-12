'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { CreditCard, Lock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const planId = searchParams.get('planId');

    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [plan, setPlan] = useState<any>(null);

    useEffect(() => {
        if (planId) {
            setLoading(true);
            // In a real app, we fetch the specific plan details to confirm price
            // Here we just fetch all and find it, or ideally we have a getPlan(id) endpoint
            api.get('/subscriptions/plans')
                .then(res => {
                    const found = res.data.find((p: any) => p.id === planId);
                    if (found) setPlan(found);
                    else alert('Plan not found');
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [planId]);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);

        // Simulate network delay for payment processing
        // Simulate network delay for payment processing
        try {
            const res = await api.post('/payments/initialize', {
                planId,
                amount: plan.price
            });
            const { authorization_url, reference } = res.data;

            // For mock Paystack, we might just open the URL
            // If it's a real redirect:
            // window.location.href = authorization_url;

            // Since we mocked it to return a URL, let's pretend we visited it and it succeeded
            // In a real app, user goes to Paystack, then Paystack redirects back to a /callback page.
            // Here, we'll verify immediately for the demo.

            await api.get(`/payments/verify?reference=${reference}`);
            alert('Payment Successful!');
            router.push('/dashboard');

        } catch (err) {
            console.error(err);
            alert('Payment failed. Please try again.');
            setProcessing(false);
        }
    };

    if (!user) {
        // Redirect to login if not authenticated, keeping the return url
        // For simplicity in this demo, just showing a message
        if (typeof window !== 'undefined') router.push(`/login?redirect=/checkout?planId=${planId}`);
        return null;
    }

    if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
    if (!plan) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Select a plan first</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans py-20 px-4">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">

                {/* Order Summary */}
                <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 h-fit">
                    <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
                        <span className="text-gray-400">{plan.name}</span>
                        <span className="font-bold">${(plan.price / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-8 text-xl font-bold">
                        <span>Total</span>
                        <span>${(plan.price / 100).toFixed(2)}</span>
                    </div>
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-900/50 text-sm text-blue-200">
                        <p className="flex items-center gap-2 mb-2"><CheckCircle size={16} /> High-Speed Access</p>
                        <p className="flex items-center gap-2"><CheckCircle size={16} /> Instant Activation</p>
                    </div>
                </div>

                {/* Payment Form */}
                <div>
                    <h2 className="text-2xl font-bold mb-6">Payment Details</h2>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6 flex items-center gap-3 text-gray-600">
                        <Lock size={18} />
                        <span className="text-sm">Payments are secure and encrypted.</span>
                    </div>

                    <form onSubmit={handlePayment} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-400">Cardholder Name</label>
                            <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="John Doe" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-400">Card Number</label>
                            <div className="relative">
                                <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0000 0000 0000 0000" required />
                                <CreditCard className="absolute left-3 top-3.5 text-gray-500" size={20} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Expiry Date</label>
                                <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="MM/YY" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">CVC</label>
                                <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="123" required />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {processing ? 'Processing...' : `Pay $${(plan.price / 100).toFixed(2)}`}
                        </button>
                    </form>
                    <p className="mt-4 text-center text-gray-500 text-sm">
                        This is a mock payment form for demonstration purposes.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>}>
            <CheckoutContent />
        </Suspense>
    );
}
