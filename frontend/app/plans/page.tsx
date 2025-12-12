'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CheckCircle, Shield } from 'lucide-react';
import Link from 'next/link';

export default function PlansPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/subscriptions/plans')
            .then(res => setPlans(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans py-20 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6">Choose Your Plan</h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Flexible pricing for every need. All plans include unlimited speed, no logs, and 24/7 support.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center text-blue-500">Loading plans...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {plans.map((plan) => (
                            <div key={plan.id} className="bg-gray-800 rounded-2xl p-8 border border-gray-700 hover:border-blue-500 transition-all flex flex-col relative overflow-hidden group">
                                <div className="absolute top-0 right-0 bg-blue-600 text-xs font-bold px-3 py-1 rounded-bl-lg transform translate-x-full group-hover:translate-x-0 transition-transform">
                                    RECOMMENDED
                                </div>
                                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                                <div className="text-4xl font-bold mb-6 text-blue-400">
                                    ${(plan.price / 100).toFixed(2)} <span className="text-lg text-gray-500 font-normal">/ {plan.durationDays} days</span>
                                </div>

                                <ul className="space-y-4 mb-8 flex-grow">
                                    <li className="flex items-center gap-3 text-gray-300">
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                        <span>{plan.bandwidthLimitGb} GB Data Limit</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-gray-300">
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                        <span>High-Speed Servers</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-gray-300">
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                        <span>Multi-Device Support</span>
                                    </li>
                                </ul>

                                <Link
                                    href={`/checkout?planId=${plan.id}`}
                                    className="w-full bg-white text-black hover:bg-gray-200 py-3 rounded-lg font-bold text-center transition-colors"
                                >
                                    Select Plan
                                </Link>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-20 text-center">
                    <p className="text-gray-500">
                        Accepted payments: Credit Card (Stripe), Crypto. <br />
                        Money-back guarantee within 7 days.
                    </p>
                </div>
            </div>
        </div>
    );
}
