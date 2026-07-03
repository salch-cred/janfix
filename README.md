# 📍 JanFix Mangaluru
> **"undu dada avassthe mare, yapa sari malpuni??"** — A modern, zero-login civic accountability platform built with citizens, for citizens of Mangaluru & Dakshina Kannada.

---

## 🌟 Overview

JanFix is a high-performance, mobile-first civic utility that lets citizens report issues like potholes, broken streetlights, garbage piles, and sewage overflows in **under 60 seconds** — without needing to create an account. 

By leveraging automated geolocation boundary validation, the platform routes reports to the correct municipal ward and public utility authorities (e.g., MCC, PWD, MESCOM) instantly.

---

## ✨ Features

- **🚀 Zero-Login Submissions**: Citizen participation is friction-free. Just capture a photo, pin the location, select a category, and submit.
- **🗺️ Geofenced Boundaries**: Enforces location sanity checks. Restricts submissions specifically to Mangaluru and Dakshina Kannada boundaries, automatically rejecting invalid or out-of-district pins.
- **📊 Public Leaderboard**: Celebrates civic progress with deterministic authority response scoring, ward resolution metrics, and representative accountability tracking.
- **🎨 Offscreen Poster Generator**: Automatically compiles reports into beautiful, download-ready social share cards to build community support on WhatsApp, Instagram, and Twitter.
- **🛡️ Device-based Trust Badges**: Dynamically awards trust levels (e.g., *Active Citizen*, *Trusted Citizen*, *Civic Champion*) matching report counts directly to local devices.

---

## 🏗️ Technical Architecture

JanFix is built on a cutting-edge web stack optimized for rapid, serverless execution and premium, responsive aesthetics:

- **Frontend Core**: [React 19](https://react.dev/) & [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (SSR & Server Functions).
- **Client Routing & Caching**: [TanStack Router](https://tanstack.com/router) & [TanStack Query v5](https://tanstack.com/query) for instant page loads.
- **Mapping & GIS**: [MapLibre GL](https://maplibre.org/) integrated with [OpenFreeMap](https://openfreemap.org/) for free, unlimited 3D vector map tiles.
- **Backend & Database**: [Supabase](https://supabase.com/) PostgreSQL with Row-Level Security (RLS), custom transaction-safe counter triggers, and optimized indexes.

---

## 🚀 Local Development Setup

To run JanFix locally, follow these steps:

### 1. Clone & Install
```bash
git clone https://github.com/salch-cred/janfix.git
cd janfix
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Spin up the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🛠️ Production Build
Create an optimized production build using:
```bash
npm run build
npm run preview
```

---

## 💙 Built with Love
Designed and crafted by boring builders who love testing, fixing bugs like a pro, and building useful utilities for the community.
