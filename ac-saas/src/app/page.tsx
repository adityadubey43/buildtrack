"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle,
  ChevronRight,
  Star,
  Menu,
  X,
  BarChart3,
  Camera,
  Calculator,
  LayoutDashboard,
  Package,
  FileText,
  Shield,
  Bell,
  Smartphone,
  ArrowRight,
  Play,
  Check,
  MapPin,
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  Zap,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Testimonials", href: "#testimonials" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Daily Progress Reports",
    description:
      "Engineers submit daily updates with before/after photos, weather logs, and delay tracking. Auto-generate PDF reports.",
    bg: "bg-orange-50",
    iconColor: "text-orange-600",
    points: ["Image upload with geo-tagging", "PDF/Excel export", "Delay reason tracking"],
  },
  {
    icon: Camera,
    title: "Attendance with Photo Proof",
    description:
      "Capture attendance from the site with photo verification. Track workers across multiple sites with role-based categories.",
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
    points: ["Mobile photo capture", "Multi-site tracking", "Attendance correction system"],
  },
  {
    icon: Calculator,
    title: "Auto Payroll Calculation",
    description:
      "Automatically calculate wages based on attendance. Support daily wages, contracts, and overtime tracking.",
    bg: "bg-green-50",
    iconColor: "text-green-600",
    points: ["Daily & contract wages", "Overtime calculation", "Weekly payout reports"],
  },
  {
    icon: LayoutDashboard,
    title: "Multi-Site Dashboard",
    description:
      "Get a bird's eye view of all projects. Compare progress, identify delays, and monitor budgets from one place.",
    bg: "bg-purple-50",
    iconColor: "text-purple-600",
    points: ["Real-time project status", "Delay & overrun alerts", "Central control panel"],
  },
  {
    icon: Package,
    title: "Material & Cost Tracking",
    description:
      "Track inventory, manage vendor orders, and compare estimated vs actual costs with BOQ integration.",
    bg: "bg-rose-50",
    iconColor: "text-rose-600",
    points: ["Inventory management", "Vendor tracking", "Cost vs actual analysis"],
  },
  {
    icon: FileText,
    title: "GST Billing & Invoicing",
    description:
      "Generate GST-ready invoices with milestone-based billing. Track partial payments and outstanding dues.",
    bg: "bg-yellow-50",
    iconColor: "text-yellow-600",
    points: ["Milestone-based billing", "GST invoice generation", "Payment history"],
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create Company Account",
    description:
      "Register your construction company in minutes. Get a dedicated workspace with your own tenant ID — completely isolated from other companies.",
    icon: Building2,
    color: "bg-orange-500",
  },
  {
    step: "02",
    title: "Add Projects & Team",
    description:
      "Set up your construction sites, invite team members, assign roles (Admin, Engineer, Supervisor, Accountant), and define project phases.",
    icon: Users,
    color: "bg-blue-600",
  },
  {
    step: "03",
    title: "Track & Manage Everything",
    description:
      "Your team submits daily reports from the field, attendance is auto-tracked, payroll is calculated, and you see everything in real time.",
    icon: TrendingUp,
    color: "bg-green-600",
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "₹999",
    period: "/month",
    description: "Perfect for small contractors managing 1-2 sites",
    borderColor: "border-slate-200",
    badge: null,
    features: [
      "Up to 3 Projects",
      "Up to 25 Workers",
      "Daily Progress Reports",
      "Basic Attendance Tracking",
      "Basic Payroll",
      "5 GB Storage",
      "Email Support",
    ],
    cta: "Start Free Trial",
    ctaStyle: "border-2 border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white",
    popular: false,
  },
  {
    name: "Pro",
    price: "₹2,499",
    period: "/month",
    description: "For growing companies managing multiple projects",
    borderColor: "border-orange-500",
    badge: "Most Popular",
    features: [
      "Unlimited Projects",
      "Unlimited Workers",
      "Advanced DPR with Photos",
      "Photo Attendance + Geo-tag",
      "Full Payroll Automation",
      "Material & Inventory",
      "GST Billing & Invoices",
      "Role-based Access Control",
      "Analytics & Reports",
      "25 GB Storage",
      "Priority Support",
    ],
    cta: "Start Free Trial",
    ctaStyle: "bg-orange-500 text-white hover:bg-orange-600",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large construction firms with advanced needs",
    borderColor: "border-slate-200",
    badge: null,
    features: [
      "Everything in Pro",
      "Client Portal",
      "AI Delay Predictions",
      "BOQ Integration",
      "Equipment Management",
      "Custom Integrations",
      "Dedicated Account Manager",
      "SLA & Uptime Guarantee",
      "Unlimited Storage",
      "24/7 Phone Support",
    ],
    cta: "Contact Sales",
    ctaStyle: "border-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white",
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    name: "Rajesh Patel",
    role: "MD, Patel Constructions Pvt Ltd",
    company: "Managing 12 sites across Gujarat",
    avatar: "RP",
    rating: 5,
    text: "BuildTrack transformed how we manage our sites. Earlier we used WhatsApp groups and Excel — now everything is in one place. Payroll that took 3 days now happens in minutes.",
    avatarBg: "bg-orange-100 text-orange-700",
  },
  {
    name: "Priya Sharma",
    role: "Project Manager",
    company: "Sharma Infrastructure",
    avatar: "PS",
    rating: 5,
    text: "The daily progress report feature with photo upload is exactly what we needed. Our site engineers love it — they can submit from their phone in 5 minutes. Client trust has gone up significantly.",
    avatarBg: "bg-blue-100 text-blue-700",
  },
  {
    name: "Mohammed Idrish",
    role: "Owner",
    company: "Al-Ameen Builders, Hyderabad",
    avatar: "MI",
    rating: 5,
    text: "Attendance with photo proof solved our ghost worker problem completely. We saved over ₹2 lakh in the first month alone. The ROI on this software is incredible.",
    avatarBg: "bg-green-100 text-green-700",
  },
  {
    name: "Sunita Reddy",
    role: "Accounts Head",
    company: "Reddy Construction Group",
    avatar: "SR",
    rating: 5,
    text: "GST invoicing and payroll automation has been a game changer. I used to spend an entire week on payroll — now it done in an afternoon. The accuracy is also much better.",
    avatarBg: "bg-purple-100 text-purple-700",
  },
];

const STATS = [
  { value: "500+", label: "Construction Companies" },
  { value: "50,000+", label: "Workers Managed" },
  { value: "₹200Cr+", label: "Projects Tracked" },
  { value: "99.9%", label: "Uptime SLA" },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((p) => (p + 1) % FEATURES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-md shadow-lg" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className={`text-xl font-bold ${scrolled ? "text-slate-900" : "text-white"}`}>
                Build<span className="text-orange-500">Track</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-orange-500 ${
                    scrolled ? "text-slate-600" : "text-white/80"
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  scrolled ? "text-slate-700 hover:text-orange-600" : "text-white/90 hover:text-white"
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-sm font-semibold px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-lg shadow-orange-500/30"
              >
                Start Free Trial
              </Link>
            </div>

            <button
              className={`md:hidden p-2 rounded-lg ${scrolled ? "text-slate-700" : "text-white"}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-slate-700 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-3">
              <Link href="/login" className="text-center py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">
                Sign In
              </Link>
              <Link href="/signup" className="text-center py-2.5 bg-orange-500 rounded-lg text-white font-semibold">
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen gradient-hero flex items-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                <span className="text-orange-300 text-sm font-medium">
                  #1 Construction Management Software in India
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                All-in-One{" "}
                <span className="text-gradient">Construction</span>{" "}
                Management Software
              </h1>

              <p className="text-lg text-slate-300 mb-8 leading-relaxed max-w-xl">
                Manage projects, attendance, payroll, and billing across multiple sites — all from one powerful platform built for Indian construction companies.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                {["7-day Free Trial", "No Credit Card", "Setup in 10 min"].map((b) => (
                  <div key={b} className="flex items-center gap-2 text-slate-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {b}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-2xl shadow-orange-500/40"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="inline-flex items-center gap-2 px-7 py-3.5 glass text-white font-semibold rounded-xl hover:bg-white/10 transition-all">
                  <Play className="w-4 h-4 text-orange-400" />
                  Book Demo
                </button>
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="hidden lg:block">
              <div className="glass rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-white font-semibold text-sm">Project Overview</div>
                    <div className="text-slate-400 text-xs">Live dashboard</div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Active Sites", value: "8", icon: MapPin, color: "text-orange-400" },
                    { label: "Workers Today", value: "142", icon: Users, color: "text-blue-400" },
                    { label: "This Week Payroll", value: "₹4.2L", icon: DollarSign, color: "text-green-400" },
                    { label: "Tasks Pending", value: "23", icon: Clock, color: "text-purple-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/5 rounded-xl p-3">
                      <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
                      <div className="text-white font-bold text-lg">{s.value}</div>
                      <div className="text-slate-400 text-xs">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {[
                    { name: "Skyline Heights, Ahmedabad", pct: 72, color: "bg-orange-500" },
                    { name: "Green Valley Villas, Surat", pct: 45, color: "bg-blue-500" },
                    { name: "Metro Plaza, Vadodara", pct: 88, color: "bg-green-500" },
                  ].map((p) => (
                    <div key={p.name} className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                        <span>{p.name}</span>
                        <span className="text-white font-semibold">{p.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16 pt-10 border-t border-white/10">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-slate-400 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" className="w-full" fill="white">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              Everything You Need
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Built for Real{" "}
              <span className="text-gradient">Construction Sites</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Every feature designed for how construction companies actually work — from remote sites to head office.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`card-hover rounded-2xl border-2 p-6 cursor-pointer transition-all ${
                  activeFeature === i ? "border-orange-400 shadow-xl shadow-orange-100" : "border-slate-100"
                }`}
                onClick={() => setActiveFeature(i)}
              >
                <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{f.description}</p>
                <ul className="space-y-1.5">
                  {f.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: "Role-Based Access", desc: "5 role types with granular permissions" },
              { icon: Bell, title: "Smart Alerts", desc: "Instant notifications for delays & dues" },
              { icon: Smartphone, title: "Mobile-First", desc: "Offline mode for remote sites" },
              { icon: BarChart3, title: "Analytics", desc: "Deep insights on projects & costs" },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  <f.icon className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{f.title}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <ChevronRight className="w-4 h-4" />
              Simple Setup
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Up and Running in{" "}
              <span className="text-gradient">3 Simple Steps</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              No training required. Your entire team can start using BuildTrack in under 30 minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="text-center">
                <div className={`w-24 h-24 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <div className="text-5xl font-black text-slate-100 mb-2">{step.step}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
            <h3 className="text-center font-bold text-slate-800 mb-6 text-lg">
              The Core Workflow — Seamless & Automatic
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { label: "Attendance Capture", color: "bg-orange-500" },
                { label: "DPR Submission", color: "bg-blue-500" },
                { label: "Wage Calculation", color: "bg-purple-500" },
                { label: "Payroll Generation", color: "bg-green-500" },
                { label: "Client Billing", color: "bg-rose-500" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`${s.color} text-white px-4 py-2 rounded-lg font-medium`}>{s.label}</div>
                  {i < 4 && <ArrowRight className="w-4 h-4 text-slate-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-600 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <DollarSign className="w-4 h-4" />
              Simple Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Plans That <span className="text-gradient">Grow With You</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Start with a 7-day free trial — no credit card required. Upgrade or downgrade anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 ${plan.borderColor} p-8 flex flex-col ${
                  plan.popular ? "shadow-2xl shadow-orange-100 scale-105" : "shadow-lg"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-500 mb-1">{plan.period}</span>
                  </div>
                  {plan.price !== "Custom" && (
                    <p className="text-xs text-green-600 font-medium mt-1">7-day free trial included</p>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.name === "Enterprise" ? "#" : "/signup"}
                  className={`block text-center py-3 px-6 rounded-xl font-semibold transition-all ${plan.ctaStyle}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              Trusted by 500+ Companies
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Real Stories from <span className="text-gradient">Real Builders</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 card-hover">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-600 leading-relaxed mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full ${t.avatarBg} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                    <div className="text-slate-500 text-xs">{t.role}</div>
                    <div className="text-orange-500 text-xs font-medium">{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="gradient-hero py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your <span className="text-gradient">Construction Business?</span>
          </h2>
          <p className="text-slate-300 mb-8 text-lg">
            Join 500+ construction companies already saving time and money with BuildTrack.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-2xl shadow-orange-500/40"
            >
              Start Your Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="px-8 py-4 glass text-white font-semibold rounded-xl hover:bg-white/10 transition-all">
              Schedule a Demo
            </button>
          </div>
          <p className="text-slate-400 text-sm mt-4">No credit card required. 7-day free trial.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-lg">
                  Build<span className="text-orange-500">Track</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4">
                India's most trusted construction management platform. Built for the field, designed for growth.
              </p>
              <div className="text-xs">Made with ❤️ for Indian builders</div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm">
                {["Features", "Pricing", "Security", "Integrations", "Changelog"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-orange-400 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm">
                {["About Us", "Blog", "Careers", "Press", "Partners"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-orange-400 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2.5 text-sm">
                <li>📧 support@buildtrack.in</li>
                <li>📞 +91 98765 43210</li>
                <li>🏢 Ahmedabad, Gujarat</li>
              </ul>
              <div className="mt-4 space-y-2 text-sm">
                <a href="#" className="block hover:text-orange-400 transition-colors">Privacy Policy</a>
                <a href="#" className="block hover:text-orange-400 transition-colors">Terms of Service</a>
                <a href="#" className="block hover:text-orange-400 transition-colors">Refund Policy</a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm">© 2026 BuildTrack. All rights reserved.</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
