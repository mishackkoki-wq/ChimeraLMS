# Chimera LMS – Full-Stack Learning Management System

Modern role-based LMS built for the system design document (Learners, Lecturers, Administrators).

## Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | HTML5 + CSS3 + Vanilla JS (no frameworks)       |
| Backend   | Node.js built-in HTTP server (no dependencies) |
| Auth      | JWT (HS256)                                     |
| Storage   | JSON file (`backend/data.json`)                 |

## Project Structure

```
chimera-lms/
├── index.html          # Login + app shell
├── Css/styles.css      # Dark/light theme, responsive
├── Javascript/app.js   # Frontend logic + API client
├── README.md
└── backend/
    ├── server.js       # JavaScript REST API
    ├── package.json    # Node run scripts
    └── data.json       # Auto-created on first run
```

## Quick Start

### 1. Start Backend
```bash
cd backend
npm start
```
API runs at **http://127.0.0.1:5000**. When opening this folder in VS Code, the
workspace task starts the backend automatically; approve the task prompt if VS
Code asks for permission. If it does not start, choose **Terminal → Run Task →
Start Chimera LMS API**.

### 2. Start Frontend
```bash
python -m http.server 8080
```
Open **http://localhost:8080**

Sign in using the username (or email) and password for a registered account.
Demo accounts are not accepted for authentication.

## API Endpoints

| Method | Path                    | Description                  | Auth      |
|--------|-------------------------|------------------------------|-----------|
| GET    | /api/health             | Health check                 | Public    |
| POST   | /api/auth/login         | Login → JWT                  | Public    |
| GET    | /api/me                 | Current user                 | Bearer    |
| GET    | /api/courses            | List courses                 | Bearer    |
| GET    | /api/assignments        | List assignments             | Bearer    |
| POST   | /api/assignments        | Create assessment            | Lecturer  |
| POST   | /api/submissions        | Submit assignment            | Learner   |
| POST   | /api/submissions/grade  | Grade submission             | Lecturer  |
| POST   | /api/materials          | Upload materials (simulated) | Lecturer  |
| GET    | /api/users              | User list                    | Admin     |
| GET    | /api/audit              | Audit log                    | Admin     |
| GET    | /api/stats              | Role-based stats             | Bearer    |

## Features

- Role-based dashboards (Learner / Lecturer / Admin / Guest)
- JWT authentication
- Assignment submission with file upload UI
- Create assessments
- Grade submissions
- Upload course materials
- Admin user management + audit log
- Dark / Light theme toggle (persisted)
- Fully offline-capable fallback if backend is down
- Responsive layout

## Security Notes (Demo)

- Registered passwords are hashed with Node.js scrypt; demo accounts cannot authenticate
- Set a private `JWT_SECRET` environment variable before deployment
- For production: use PostgreSQL, proper password hashing (bcrypt/argon2), HTTPS, rate limiting

## Requirements

- Node.js 18 or newer
