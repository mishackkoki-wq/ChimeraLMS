# Chimera LMS – Full-Stack Learning Management System

Modern role-based LMS built for the system design document (Learners, Lecturers, Administrators).

## Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | HTML5 + CSS3 + Vanilla JS (no frameworks)       |
| Backend   | Pure Python 3 (stdlib `http.server` + PyJWT)   |
| Auth      | JWT (HS256)                                     |
| Storage   | JSON file (`backend/data.json`)                 |

## Project Structure

```
chimera-lms/
├── index.html          # Login + app shell
├── styles.css          # Dark/light theme, responsive
├── app.js              # Frontend logic + API client
├── README.md
└── backend/
    ├── server.py       # REST API
    └── data.json       # Auto-created on first run
```

## Quick Start

### 1. Start Backend (Terminal 1)
```bash
cd backend
python3 server.py
```
API runs at **http://localhost:5000**

### 2. Start Frontend (Terminal 2)
```bash
python3 -m http.server 8080
```
Open **http://localhost:8080**

## Demo Accounts

Any password works. You can also just select a role and click Sign In.

| Role     | Email                  |
|----------|------------------------|
| Learner  | alex.j@student.edu     |
| Lecturer | s.chen@faculty.edu     |
| Admin    | m.rivera@admin.edu     |

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

- Passwords are hashed with SHA-256 + salt (demo only)
- Any password is accepted for convenience in demo mode
- Change `SECRET_KEY` in `server.py` before any real deployment
- For production: use PostgreSQL, proper password hashing (bcrypt/argon2), HTTPS, rate limiting

## Requirements

- Python 3.8+
- PyJWT (`pip install PyJWT` if not already present)

No Node.js required for the current backend.
