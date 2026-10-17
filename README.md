# 🌊 Dayflow — Human Resource Management System

> **Every workday, perfectly aligned.**

A modern, full-stack HRMS built with React, Node.js, Express, and MongoDB. Designed for managing attendance, leave, payroll, and team operations with a clean, minimal UI.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TailwindCSS, React Router v6 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose |
| **Auth** | JWT (Access + Refresh Tokens), bcrypt |
| **Email** | Nodemailer |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
Dayflow_HRMS/
├── client/                    # React frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── assets/           # Images, fonts
│   │   ├── components/
│   │   │   ├── layout/       # Navbar, Sidebar, Layouts
│   │   │   └── ui/           # Button, Input, Card, etc.
│   │   ├── context/          # React Context (Auth)
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service layer
│   │   └── utils/            # Validators, helpers
│   └── index.html
├── server/                    # Express backend
│   ├── config/               # DB connection
│   ├── controllers/          # Route handlers
│   ├── middleware/           # Auth, validation
│   ├── models/               # Mongoose schemas
│   ├── routes/               # API routes
│   └── utils/                # Token gen, email
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/rishabhyadav69387-svg/Dayflow_HRMS.git
cd Dayflow_HRMS
```

### 2. Set up the backend
```bash
cd server
cp .env.example .env   # Edit with your MongoDB URI and email config
npm install
npm run dev
```

### 3. Set up the frontend
```bash
cd client
npm install
npm run dev
```

### 4. Open your browser
Navigate to `http://localhost:5173`

---

## 🧪 Testing

The backend has automated API tests written with **Jest** and **Supertest**. The database layer is mocked, so MongoDB is not needed to run them.

```bash
cd server
npm install
npm test
```

| Area | What is tested |
|------|----------------|
| `POST /api/auth/send-otp` | invalid email, already registered email, 6-digit OTP with 5-minute expiry |
| `POST /api/auth/register` | missing / wrong / reused OTP, weak password, password mismatch, duplicate user, successful signup |
| `POST /api/auth/login` | unknown email, wrong password, deactivated account, valid JWT + HTTP-only refresh cookie, missing JWT config |

Tests live in `server/tests/`.

---

## 🔐 Authentication Flow

1. **Sign Up** → User registers with Employee ID, Name, Email, Password, Role
2. **Email Verification** → Verification link sent to email
3. **Sign In** → JWT access token + HTTP-only refresh token cookie
4. **Role Redirect** → Employees → `/employee-dashboard`, Admins → `/admin-dashboard`
5. **Token Refresh** → Automatic refresh when access token expires

### Password Rules
- Minimum 8 characters
- At least 1 number
- At least 1 special character

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| **Primary Blue** | `#2f5597` |
| **Font** | Inter (sans-serif) |
| **Border Radius** | 12px (cards), 8px (inputs/buttons) |
| **Shadows** | Soft card shadows with hover elevation |

---

## 📋 Development Phases

- [x] **Phase 1** — Foundation & Auth (Sign Up, Sign In, Role-based Access)
- [ ] **Phase 2** — Dashboards & Employee Profile
- [ ] **Phase 3** — Attendance & Leave Management
- [ ] **Phase 4** — Payroll, Analytics & Notifications

---

## 📜 API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login & get tokens |
| GET | `/verify-email?token=x` | Verify email |
| POST | `/refresh-token` | Refresh access token |
| GET | `/me` | Get current user |
| POST | `/logout` | Logout |
| POST | `/resend-verification` | Resend verification email |

---

## 📄 License

MIT © Dayflow Team
