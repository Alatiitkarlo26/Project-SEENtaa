# Project SEENta: Peer-to-Peer Lost and Found Management System
**Polytechnic University of the Philippines — Biñan Campus**  
*Official Peer-to-Peer Student Property Recovery & Clearinghouse*

---

## 🌟 Overview
**Project SEENta** is a secure, decentralized lost and found web platform designed specifically for the students, faculty, and administration of **PUP Biñan Campus**.

Unlike legacy physical bulletin boards or administrative clearinghouses, SEENta empowers students to recover belongings directly from their peers through a **three-tier recovery protocol**:
1. **Challenge-Response Ownership Verification** (Private identifying details, serial numbers, and Republic Act 10173 Academic Honesty declaration).
2. **Safe-Zone Coordination** (Direct in-app messaging tagged with official Campus Safe-Exchange Zones).
3. **Dual Mutual Turnover Confirmation & Cryptographic Ledger** (Mutual in-person digital acknowledgment generating immutable SHA-256 transaction signatures).

---

## 🏗️ Architecture: Decoupled Monorepo

The system is decoupled into two clean, self-contained sub-projects:

```text
Project-SEENta/
├── frontend/                   # Client Application (Vite 8 + React 19 + TailwindCSS v4)
│   ├── src/
│   │   ├── components/         # Modals, Navbar, Cards, Accessibility
│   │   ├── pages/              # Student Dashboard, Auth, About, Admin
│   │   ├── services/           # authService, itemService, otpService
│   │   ├── context/            # AuthContext, ThemeContext (High Contrast)
│   │   └── utils/              # Image compressor, Role taggers
│   ├── package.json
│   ├── vite.config.js          # With automated /api proxy to backend
│   └── .env.example
│
├── backend/                    # Core REST API (Express 5.2.1 + Node.js 20+)
│   ├── index.js                # API routes, JWT middleware, Email dispatcher
│   ├── db.js                   # Cloud PostgreSQL adapter (Supabase) + Local JSON fallback
│   ├── package.json
│   └── .env.example
│
├── docs/                       # Project specifications & roadmap documentation
├── package.json                # Root orchestrator scripts (concurrently dev & build)
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher

### 1. Installation
Clone the repository and install all dependencies:
```bash
# Install root, backend, and frontend dependencies in one command
npm run install:all
```

### 2. Environment Variables Configuration
Copy the `.env.example` templates in both folders:

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=/api
```

**Backend (`backend/.env`):**
```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 3. Run Development Servers
From the root directory, start both the backend and frontend concurrently:
```bash
npm run dev
```
- **Backend API**: [http://localhost:5000/api/status](http://localhost:5000/api/status)
- **Frontend App**: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Automated Testing
Run the comprehensive integration test suite across all 3 phases:
```bash
node backend/test-phase3-e2e.js
```
*(Tests authentication, Bcrypt password upgrade, challenge-response claims, safe-zone chat, dual turnover confirmation, SHA-256 signatures, community ratings, and dispute handling).*

---

## 📦 Production Build
Compile the optimized client bundle:
```bash
npm run build
```
The compiled static assets are generated in `frontend/dist/`.

---

## 🛡️ Security & Institutional Compliance
- **Data Privacy Act of 2012 (RA 10173)**: Strict domain authentication (`@iskolarngbayan.pup.edu.ph` and `@pup.edu.ph`).
- **Cryptographic Security**: Passwords hashed with `bcryptjs` (salt factor 10). Session authorization verified using signed 7-day `jsonwebtoken` tokens.
- **Physical Safety Protocol**: Meetup scheduling is restricted to designated on-campus Safe-Exchange Zones (Main Lobby, Library Entrance, Guard Post, Activity Gazebo).

---

## 👥 Development Team — Group 12
- **Alatiit, Jian Karlo**
- **Aviles, Armi Jhon**
- **Igloso, Mark**
- **Orfella, Roderick**
- **Ubaldo, Neilven Ryan**

*Polytechnic University of the Philippines — Biñan Campus*
