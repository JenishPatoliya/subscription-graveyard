# 🪦 Subscription Graveyard

> An AI-powered, auto-tracking subscription manager that scans your email receipts, flags active subscriptions, sends renewal alerts, and helps you bury unused expenses forever.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-blueviolet?style=for-the-badge&logo=supabase)](https://supabase.com/)

---

## ✨ Features

- **📧 Multi-Account Gmail Scanning**: Link multiple Gmail accounts securely via Google OAuth 2.0 to scan for billing receipts.
- **🤖 Intelligent Parsing Engine**: Hybrid rule-based & AI matching that categorizes subscriptions, extracts payment amounts/currencies, and isolates marketing promos from actual receipts.
- **📊 Interactive Dashboard**: A sleek, dark-themed user interface featuring glassmorphic cards, receipt progress, and automated analytics.
- **⏰ Smart Alerts**: Calculates next renewal dates automatically and creates notification logs 3 days before charges occur.
- **❌ Instant Cancellation (Burial)**: Access direct cancel/unsubscribe links for detected services right from your dashboard.
- **🧠 5 ML Models**: In-depth analytical reports and predictions about your spending patterns.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React, Next.js 14, CSS Modules | Glassmorphism, animations, responsive layout |
| **Backend** | Python 3.11+, FastAPI, Uvicorn | REST APIs, authentication routing, async email scanner |
| **Database** | Supabase (PostgreSQL) | Users, subscriptions, receipts, alerts, and OAuth tokens |
| **ML Engine** | scikit-learn, XGBoost, Groq LLM | Anomaly detection, clustering, spending predictions, and AI recommendations |
| **Services** | Gmail API, Google OAuth 2.0 | Read-only receipts scanning |

---

## 📂 Project Structure

```text
subscription-graveyard/
├── backend/
│   ├── config/            # Supabase & settings config
│   ├── middleware/        # JWT Authentication middleware
│   ├── ml/                # 5 ML model implementations
│   ├── routes/            # Auth, Gmail, Subscriptions, Insights, Alerts routes
│   ├── services/          # Groq AI, Gmail Client, Scheduler, Email Scanner
│   ├── main.py            # Main FastAPI server entrypoint
│   ├── schema.sql         # Supabase Database schema SQL file
│   └── requirements.txt   # Python dependencies
└── frontend/
    ├── app/               # Next.js App Router (Dashboard, Login, Connect Gmail)
    ├── components/        # Reusable UI elements (Navbar, Cards, StatCard)
    ├── lib/               # Common API utilities
    └── package.json       # Next.js dependencies
```

---

## 🧠 Machine Learning Engine (5 Models)

1.  **Isolation Forest (Anomaly Detection)**: Scans subscription records to flag suspicious price spikes or duplicate charges.
2.  **XGBoost Regressor (Spending Prediction)**: Trains on your historical billing receipt sequences to forecast your subscription expenses for the next 3 months.
3.  **K-Means (Subscription Clustering)**: Clusters subscriptions based on cost and frequency, assigning a usage score to help detect candidate subscriptions to cancel.
4.  **TF-IDF + Random Forest Classifier**: Trains on your billing subject lines to help optimize filters that isolate receipts from promotional spam.
5.  **Llama 3 AI Insights (Groq LLM)**: Synthesizes the output of all other ML models to write personalized, actionable recommendations to reduce your monthly expenses.

---

## 🚀 Getting Started

### 📋 Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.11+)
- A [Supabase](https://supabase.com/) account
- A Google Cloud Developer Project with Gmail API enabled (for OAuth credentials)
- A [Groq API Key](https://wow.groq.com/) for Llama 3 processing

---

### 🔧 Setup & Installation

#### 1. Clone the repository
```bash
git clone https://github.com/JenishPatoliya/subscription-graveyard.git
cd subscription-graveyard
```

#### 2. Configure the Backend
Navigate to the `backend` directory, create a Python virtual environment, install dependencies:
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # On Windows
source venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder and populate it with your environment variables:
```env
PORT=8000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Supabase Configurations
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key   # Secret service_role key

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session JWT Secret
JWT_SECRET=your_jwt_secret_key

# Groq API Key
GROQ_API_KEY=your_groq_api_key

# Demo Account
DEMO_EMAIL=demo@subscriptiongraveyard.com
DEMO_PASSWORD=demo123
```

#### 3. Configure the Frontend
Navigate to the `frontend` directory and install dependencies:
```bash
cd ../frontend
npm install
```

Create a `.env.local` file in the `frontend/` folder:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### 💻 Running the Application

You need to run both the frontend and backend servers.

#### Start the Backend Server (from the `backend/` folder)
```bash
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*This starts the FastAPI server on port `8000`.*

#### Start the Frontend Server (from the `frontend/` folder)
```bash
npm run dev
```
*This starts the Next.js development server on [http://localhost:3000](http://localhost:3000).*

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">Made with ❤️ by <a href="https://github.com/JenishPatoliya">Jenish Patoliya</a></p>
