# 🪦 Subscription Graveyard

> An AI-powered, auto-tracking subscription manager that scans your email receipts, flags active subscriptions, sends renewal alerts, and helps you bury unused expenses forever.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-blueviolet?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Queue_Worker-red?style=for-the-badge&logo=redis)](https://bullmq.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

---

## ✨ Features

- **📧 Multi-Account Gmail Scanning**: Link multiple Gmail accounts securely via OAuth2 to auto-scan for billing receipts.
- **🤖 Intelligent Parsing Engine**: Hybrid Regex & AI matching that categorizes subscriptions, extracts payment amounts, currencies, and isolates marketing promos from actual receipts.
- **📊 Interactive Dashboard**: A sleek, dark-themed user interface featuring glassmorphic cards, receipt progress, and automated analytics.
- **⏰ Smart Alerts**: Calculates next renewal dates automatically and creates notification logs before charges occur.
- **❌ Instant Burial (Unsubscribe)**: Access direct unsubscribe/cancellation links for detected services right from your dashboard.
- **🔍 Diagnostic CLI**: Built-in command-line tools to monitor active users, Gmail connections, and subscriptions in real-time.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React, Next.js 14, CSS Modules | Glassmorphism, animations, responsive layout |
| **Backend** | Node.js, Express | REST APIs, authentication routing, session controllers |
| **Database** | Supabase (PostgreSQL) | Users, subscriptions, receipts, alerts, and OAuth tokens |
| **Queue Broker** | Upstash Redis & BullMQ | Asynchronous and isolated background worker queue |
| **Services** | Gmail API, OpenAI / LLM | Fetching messages, email extraction, and NLP fallback |

---

## 📂 Project Structure

```text
subscription-graveyard/
├── backend/
│   ├── config/            # Supabase & Redis configuration
│   ├── routes/            # Auth, Gmail OAuth, and Subscriptions routes
│   ├── services/          # AI Service, BullMQ Manager, Gmail Client
│   ├── workers/           # Asynchronous email scanning worker task
│   ├── check-db.js        # Command-line database inspector
│   ├── index.js           # Main Express server entrypoint
│   └── package.json
├── frontend/
│   ├── app/               # Next.js App Router (Dashboard, Scanning, Login)
│   ├── components/        # Reusable UI elements (Navbar, Cards, Loaders)
│   ├── lib/               # Common utilities and helper functions
│   └── package.json
└── README.md              # Project documentation
```

---

## 🚀 Getting Started

### 📋 Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account
- A Redis instance (e.g. [Upstash](https://upstash.com/))
- A Google Cloud Developer Project with Gmail API enabled (for OAuth credentials)

---

### 🔧 Setup & Installation

#### 1. Clone the repository
```bash
git clone https://github.com/JenishPatoliya/subscription-graveyard.git
cd subscription-graveyard
```

#### 2. Configure the Backend
Navigate to the `backend` directory and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder and populate it with your environment variables:
```env
PORT=5000
NODE_ENV=development

# Supabase Configurations
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Redis Configuration
REDIS_URL=rediss://default:your_upstash_redis_password@your_upstash_domain.upstash.io:6379

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/gmail/callback

# Session JWT Secret
JWT_SECRET=your_jwt_secret_key
```

#### 3. Configure the Frontend
Navigate to the `frontend` directory and install dependencies:
```bash
cd ../frontend
npm install
```

Create a `.env.local` file in the `frontend/` folder:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

### 💻 Running the Application

You need to run both the frontend and backend servers.

#### Start the Backend Server (from the `backend/` folder)
```bash
npm start
```
*This starts the Express server on port `5000` and initializes the background BullMQ queue worker.*

#### Start the Frontend Server (from the `frontend/` folder)
```bash
npm run dev
```
*This starts the Next.js development server on [http://localhost:3000](http://localhost:3000).*

---

## 📊 Database CLI Tool

To inspect users, active connections, and scanned subscription details directly from your terminal:

```bash
cd backend
node check-db.js
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">Made with ❤️ by <a href="https://github.com/JenishPatoliya">Jenish Patoliya</a></p>
