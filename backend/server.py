#!/usr/bin/env python3
"""
Chimera LMS Backend
Pure Python (stdlib + PyJWT) REST API with JWT auth and JSON file storage.
"""

import json
import os
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import jwt

# ==================== CONFIG ====================
PORT = 5000
SECRET_KEY = "chimera-lms-secret-key-change-in-production-2026"
TOKEN_EXPIRY_HOURS = 24
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")

# ==================== DATA STORE ====================
def default_data():
    return {
        "users": [
            {
                "id": "u1",
                "email": "alex.j@student.edu",
                "password": hash_password("password123"),
                "name": "Alex Johnson",
                "role": "learner",
                "avatar": "AJ",
                "status": "Active",
                "lastLogin": "2026-10-01"
            },
            {
                "id": "u2",
                "email": "s.chen@faculty.edu",
                "password": hash_password("password123"),
                "name": "Dr. Sarah Chen",
                "role": "lecturer",
                "avatar": "SC",
                "status": "Active",
                "lastLogin": "2026-10-02"
            },
            {
                "id": "u3",
                "email": "m.rivera@admin.edu",
                "password": hash_password("password123"),
                "name": "Marcus Rivera",
                "role": "admin",
                "avatar": "MR",
                "status": "Active",
                "lastLogin": "2026-10-02"
            },
            {
                "id": "u4",
                "email": "p.patel@student.edu",
                "password": hash_password("password123"),
                "name": "Priya Patel",
                "role": "learner",
                "avatar": "PP",
                "status": "Active",
                "lastLogin": "2026-09-30"
            },
            {
                "id": "u5",
                "email": "guest@public.edu",
                "password": hash_password("guest"),
                "name": "Guest User",
                "role": "guest",
                "avatar": "GU",
                "status": "Active",
                "lastLogin": None
            }
        ],
        "courses": [
            {"id": "c1", "code": "CS101", "title": "Introduction to Programming", "instructor": "Dr. Sarah Chen", "instructorId": "u2", "progress": 78, "status": "in-progress", "students": 142},
            {"id": "c2", "code": "MATH204", "title": "Linear Algebra", "instructor": "Prof. James Okonkwo", "instructorId": "u6", "progress": 45, "status": "in-progress", "students": 98},
            {"id": "c3", "code": "DS310", "title": "Data Structures & Algorithms", "instructor": "Dr. Amina Hassan", "instructorId": "u7", "progress": 92, "status": "completed", "students": 76},
            {"id": "c4", "code": "WEB220", "title": "Web Development Fundamentals", "instructor": "Dr. Sarah Chen", "instructorId": "u2", "progress": 30, "status": "in-progress", "students": 115}
        ],
        "assignments": [
            {"id": "a1", "title": "Binary Search Trees Implementation", "course": "DS310", "courseId": "c3", "due": "2026-10-08", "status": "pending", "grade": None, "type": "Project", "createdBy": "u7"},
            {"id": "a2", "title": "React Component Library", "course": "WEB220", "courseId": "c4", "due": "2026-10-05", "status": "in-progress", "grade": None, "type": "Assignment", "createdBy": "u2"},
            {"id": "a3", "title": "Matrix Operations Project", "course": "MATH204", "courseId": "c2", "due": "2026-09-28", "status": "completed", "grade": 88, "type": "Project", "createdBy": "u6"},
            {"id": "a4", "title": "Python Basics Quiz", "course": "CS101", "courseId": "c1", "due": "2026-09-20", "status": "completed", "grade": 95, "type": "Quiz", "createdBy": "u2"}
        ],
        "submissions": [],
        "enrollments": [
            {"userId": "u1", "courseId": "c1"},
            {"userId": "u1", "courseId": "c2"},
            {"userId": "u1", "courseId": "c3"},
            {"userId": "u1", "courseId": "c4"},
            {"userId": "u4", "courseId": "c1"},
            {"userId": "u4", "courseId": "c4"}
        ],
        "audit_log": [
            {"id": "l1", "time": "2026-10-02 07:45", "user": "m.rivera@admin.edu", "action": "Role change: Tom Bradley → Inactive", "ip": "102.45.12.88", "status": "Success"},
            {"id": "l2", "time": "2026-10-02 06:12", "user": "s.chen@faculty.edu", "action": "Uploaded materials – WEB220", "ip": "196.22.45.11", "status": "Success"},
            {"id": "l3", "time": "2026-10-01 23:58", "user": "unknown", "action": "Failed login attempt", "ip": "45.33.12.190", "status": "Blocked"},
            {"id": "l4", "time": "2026-10-01 18:30", "user": "system", "action": "Automated database backup", "ip": "—", "status": "Success"}
        ]
    }

def hash_password(password: str) -> str:
    salt = "chimera_salt_2026"
    return hashlib.sha256((password + salt).encode()).hexdigest()

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    data = default_data()
    save_data(data)
    return data

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def add_audit(data, user, action, ip="127.0.0.1", status="Success"):
    data["audit_log"].insert(0, {
        "id": str(uuid.uuid4())[:8],
        "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "user": user,
        "action": action,
        "ip": ip,
        "status": status
    })
    # Keep last 50
    data["audit_log"] = data["audit_log"][:50]

# ==================== AUTH HELPERS ====================
def create_token(user):
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None

def get_user_from_token(handler):
    auth = handler.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    payload = decode_token(token)
    if not payload:
        return None
    data = load_data()
    return next((u for u in data["users"] if u["id"] == payload["sub"]), None)

# ==================== HTTP HANDLER ====================
class LMSHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _json_response(self, data, status=200):
        self._set_headers(status)
        self.wfile.write(json.dumps(data).encode())

    def _error(self, message, status=400):
        self._json_response({"error": message}, status)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode())

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = parse_qs(parsed.query)

        # Public
        if path == "/api/health":
            return self._json_response({"status": "ok", "service": "Chimera LMS API"})

        # Auth required routes
        user = get_user_from_token(self)

        if path == "/api/me":
            if not user:
                return self._error("Unauthorized", 401)
            safe = {k: v for k, v in user.items() if k != "password"}
            return self._json_response(safe)

        if path == "/api/courses":
            data = load_data()
            courses = data["courses"]
            if user and user["role"] == "lecturer":
                courses = [c for c in courses if c.get("instructorId") == user["id"] or c["instructor"] == user["name"]]
            return self._json_response(courses)

        if path == "/api/assignments":
            data = load_data()
            return self._json_response(data["assignments"])

        if path == "/api/users":
            if not user or user["role"] != "admin":
                return self._error("Forbidden", 403)
            data = load_data()
            users = [{k: v for k, v in u.items() if k != "password"} for u in data["users"]]
            return self._json_response(users)

        if path == "/api/audit":
            if not user or user["role"] != "admin":
                return self._error("Forbidden", 403)
            data = load_data()
            return self._json_response(data["audit_log"])

        if path == "/api/submissions":
            if not user:
                return self._error("Unauthorized", 401)
            data = load_data()
            subs = data["submissions"]
            if user["role"] == "learner":
                subs = [s for s in subs if s["userId"] == user["id"]]
            elif user["role"] == "lecturer":
                # submissions for their courses
                my_courses = [c["id"] for c in data["courses"] if c.get("instructorId") == user["id"]]
                my_assign = [a["id"] for a in data["assignments"] if a.get("courseId") in my_courses]
                subs = [s for s in subs if s["assignmentId"] in my_assign]
            return self._json_response(subs)

        if path == "/api/stats":
            if not user:
                return self._error("Unauthorized", 401)
            data = load_data()
            if user["role"] == "admin":
                return self._json_response({
                    "totalUsers": len(data["users"]),
                    "activeCourses": len(data["courses"]),
                    "totalAssignments": len(data["assignments"]),
                    "pendingSubmissions": len([s for s in data["submissions"] if s.get("grade") is None])
                })
            elif user["role"] == "lecturer":
                my_courses = [c for c in data["courses"] if c.get("instructorId") == user["id"]]
                return self._json_response({
                    "activeCourses": len(my_courses),
                    "students": sum(c["students"] for c in my_courses),
                    "pendingGrades": 18  # demo
                })
            else:
                enrolled = [e for e in data["enrollments"] if e["userId"] == user["id"]]
                completed = [a for a in data["assignments"] if a["status"] == "completed"]
                return self._json_response({
                    "enrolledCourses": len(enrolled),
                    "dueAssignments": len([a for a in data["assignments"] if a["status"] != "completed"]),
                    "completedAssignments": len(completed)
                })

        self._error("Not found", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        body = self._read_body()

        # ---- LOGIN ----
        if path == "/api/auth/login":
            email = body.get("email", "").strip().lower()
            password = body.get("password", "")
            role = body.get("role")  # optional override for demo

            data = load_data()
            user = next((u for u in data["users"] if u["email"].lower() == email), None)

            # Demo mode: if role provided and no matching user, create temp or use role user
            if not user and role:
                # Find first user of that role
                user = next((u for u in data["users"] if u["role"] == role), None)

            if not user:
                add_audit(data, email or "unknown", "Failed login attempt", status="Blocked")
                save_data(data)
                return self._error("Invalid credentials", 401)

            # Accept any password in demo, or check hash
            # For real: if user["password"] != hash_password(password): ...
            # Demo: accept anything

            user["lastLogin"] = datetime.now().strftime("%Y-%m-%d")
            add_audit(data, user["email"], "Successful login")
            save_data(data)

            token = create_token(user)
            safe = {k: v for k, v in user.items() if k != "password"}
            return self._json_response({"token": token, "user": safe})

        # ---- REGISTER ----
        if path == "/api/auth/register":
            name = body.get("name", "").strip()
            email = body.get("email", "").strip().lower()
            password = body.get("password", "")
            role = body.get("role", "learner")

            if not name or not email or not password:
                return self._error("Name, email and password are required")
            if role not in ("learner", "lecturer", "admin"):
                return self._error("Role must be learner, lecturer or admin")
            if len(password) < 6:
                return self._error("Password must be at least 6 characters")

            data = load_data()
            if any(u["email"].lower() == email for u in data["users"]):
                return self._error("Email already registered", 409)

            new_user = {
                "id": "u" + str(uuid.uuid4())[:8],
                "email": email,
                "password": hash_password(password),
                "name": name,
                "role": role,
                "avatar": "".join(w[0] for w in name.split()[:2]).upper() or "U",
                "status": "Active",
                "lastLogin": datetime.now().strftime("%Y-%m-%d")
            }
            data["users"].append(new_user)
            add_audit(data, email, "New user registered as " + role)
            save_data(data)

            token = create_token(new_user)
            safe = {k: v for k, v in new_user.items() if k != "password"}
            return self._json_response({"token": token, "user": safe}, 201)

        # Auth required below
        user = get_user_from_token(self)
        if not user:
            return self._error("Unauthorized", 401)

        data = load_data()

        # ---- SUBMIT ASSIGNMENT ----
        if path == "/api/submissions":
            if user["role"] not in ("learner", "admin"):
                return self._error("Forbidden", 403)
            assignment_id = body.get("assignmentId")
            comments = body.get("comments", "")
            filename = body.get("filename", "submission.pdf")

            assignment = next((a for a in data["assignments"] if a["id"] == assignment_id), None)
            if not assignment:
                return self._error("Assignment not found", 404)

            sub = {
                "id": str(uuid.uuid4())[:8],
                "assignmentId": assignment_id,
                "userId": user["id"],
                "userName": user["name"],
                "filename": filename,
                "comments": comments,
                "submittedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "grade": None,
                "feedback": None
            }
            data["submissions"].append(sub)

            # Update assignment status for this learner (simplified)
            assignment["status"] = "completed"

            add_audit(data, user["email"], f"Submitted assignment: {assignment['title']}")
            save_data(data)
            return self._json_response(sub, 201)

        # ---- CREATE ASSIGNMENT (Lecturer) ----
        if path == "/api/assignments":
            if user["role"] not in ("lecturer", "admin"):
                return self._error("Forbidden", 403)
            new_a = {
                "id": str(uuid.uuid4())[:8],
                "title": body.get("title", "Untitled"),
                "course": body.get("course", ""),
                "courseId": body.get("courseId", ""),
                "due": body.get("due", ""),
                "status": "pending",
                "grade": None,
                "type": body.get("type", "Assignment"),
                "createdBy": user["id"]
            }
            data["assignments"].append(new_a)
            add_audit(data, user["email"], f"Created assessment: {new_a['title']}")
            save_data(data)
            return self._json_response(new_a, 201)

        # ---- GRADE SUBMISSION ----
        if path == "/api/submissions/grade":
            if user["role"] not in ("lecturer", "admin"):
                return self._error("Forbidden", 403)
            sub_id = body.get("submissionId")
            score = body.get("score")
            feedback = body.get("feedback", "")

            sub = next((s for s in data["submissions"] if s["id"] == sub_id), None)
            if not sub:
                # Allow grading without real submission for demo
                return self._json_response({
                    "message": "Grade recorded",
                    "score": score,
                    "feedback": feedback,
                    "student": body.get("student"),
                    "assignment": body.get("assignment")
                })

            sub["grade"] = score
            sub["feedback"] = feedback
            add_audit(data, user["email"], f"Graded submission {sub_id}: {score}%")
            save_data(data)
            return self._json_response(sub)

        # ---- UPLOAD MATERIALS (simulated) ----
        if path == "/api/materials":
            if user["role"] not in ("lecturer", "admin"):
                return self._error("Forbidden", 403)
            add_audit(data, user["email"], f"Uploaded materials for {body.get('course', 'course')}: {body.get('title', 'file')}")
            save_data(data)
            return self._json_response({"message": "Materials uploaded successfully", "filename": body.get("filename")})

        self._error("Not found", 404)

    def do_PUT(self):
        user = get_user_from_token(self)
        if not user:
            return self._error("Unauthorized", 401)
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        body = self._read_body()
        data = load_data()

        # Update user status (admin)
        if path.startswith("/api/users/") and user["role"] == "admin":
            user_id = path.split("/")[-1]
            target = next((u for u in data["users"] if u["id"] == user_id), None)
            if not target:
                return self._error("User not found", 404)
            if "status" in body:
                target["status"] = body["status"]
            if "role" in body:
                target["role"] = body["role"]
            add_audit(data, user["email"], f"Updated user {target['email']}")
            save_data(data)
            safe = {k: v for k, v in target.items() if k != "password"}
            return self._json_response(safe)

        self._error("Not found", 404)

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")

# ==================== START ====================
def main():
    # Ensure data file exists
    load_data()
    server = HTTPServer(("0.0.0.0", PORT), LMSHandler)
    print(f"Chimera LMS API running on http://localhost:{PORT}")
    print(f"Health check: http://localhost:{PORT}/api/health")
    print("Demo accounts (any password works):")
    print("  Learner : alex.j@student.edu")
    print("  Lecturer: s.chen@faculty.edu")
    print("  Admin   : m.rivera@admin.edu")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()

if __name__ == "__main__":
    main()
