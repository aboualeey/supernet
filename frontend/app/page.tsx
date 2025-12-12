import Link from "next/link";
import { Shield, Globe, Zap, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white font-sans">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Globe className="h-8 w-8 text-blue-500" />
              <span className="text-xl font-bold tracking-tight">Starlink VPN</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
              <a href="#features" className="hover:text-white transition">Features</a>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">
                Log in
              </Link>
              <Link
                href="/plans"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-900/0 to-transparent opacity-50"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-blue-200">
              Secure Global Internet Access
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Experience the internet without borders. High-speed, encrypted connections powered by WireGuard® technology for ultimate privacy and performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plans"
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full text-lg font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2"
              >
                <Zap size={20} fill="currentColor" /> Start Free Trial
              </Link>
              <Link
                href="#features"
                className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-full text-lg font-bold transition-all border border-gray-700"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="py-24 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose Starlink VPN?</h2>
            <p className="text-gray-400">Built for speed, security, and simplicity.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Shield className="h-8 w-8 text-green-400" />}
              title="Military-Grade Encryption"
              description="Your data is protected by ChaCha20 encryption, ensuring your privacy is never compromised."
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-yellow-400" />}
              title="Blazing Fast Speeds"
              description="Powered by the lightweight WireGuard protocol, offering superior performance compared to OpenVPN."
            />
            <FeatureCard
              icon={<Globe className="h-8 w-8 text-purple-400" />}
              title="Global Server Network"
              description="Access content from anywhere in the world with our rapidly expanding network of high-speed nodes."
            />
          </div>
        </div>
      </div>

      {/* Trust Section */}
      <div className="py-24 border-y border-gray-800 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-12 text-gray-500">TRUSTED BY USERS ACROSS THE GLOBE</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Placeholders for logos if we had them */}
            <div className="flex items-center justify-center font-bold text-xl">TRUSTCORP</div>
            <div className="flex items-center justify-center font-bold text-xl">NETGUARD</div>
            <div className="flex items-center justify-center font-bold text-xl">SECURE.IO</div>
            <div className="flex items-center justify-center font-bold text-xl">PRIVACY+</div>
          </div>
        </div>
      </div>

      {/* Pricing Teaser / CTA */}
      <div id="pricing" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/10"></div>
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to secure your connection?</h2>
          <p className="text-xl text-gray-400 mb-10">
            Join thousands of users who trust Starlink VPN for their daily browsing.
            Plans start as low as <span className="text-white font-bold">$1.99/day</span>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            <ul className="text-left space-y-3 mb-8 md:mb-0">
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-green-500" /> Unlimited Bandwidth</li>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-green-500" /> No Logs Policy</li>
            </ul>
            <ul className="text-left space-y-3">
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-green-500" /> Multi-Device Support</li>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-green-500" /> 24/7 Support</li>
            </ul>
          </div>
          <div className="mt-10">
            <Link
              href="/plans"
              className="bg-white text-black hover:bg-gray-200 px-8 py-4 rounded-full text-lg font-bold transition-all inline-flex items-center gap-2"
            >
              View All Plans
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900 py-12 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Starlink VPN. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-4">
          <a href="#" className="hover:text-white">Privacy Policy</a>
          <a href="#" className="hover:text-white">Terms of Service</a>
          <a href="#" className="hover:text-white">Contact</a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700/50 hover:bg-gray-800 transition-colors">
      <div className="mb-6 bg-gray-900/50 w-16 h-16 rounded-xl flex items-center justify-center border border-gray-700">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
