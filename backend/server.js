"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "localhost";
const DATA_FILE = path.join(__dirname, "data.json");
const JWT_SECRET = process.env.JWT_SECRET || "chimera-lms-local-development-secret-change-me";
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

const dayOffset = offset => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

function initialData() {
  return {
    users: [
      { id: "u1", name: "Alex Johnson", email: "alex.j@student.edu", role: "learner", avatar: "AJ", status: "Active", demo: true },
      { id: "u2", name: "Dr. Sarah Chen", email: "s.chen@faculty.edu", role: "lecturer", avatar: "SC", status: "Active", demo: true },
      { id: "u3", name: "Marcus Rivera", email: "m.rivera@admin.edu", role: "admin", avatar: "MR", status: "Active", demo: true },
      { id: "u4", name: "Priya Patel", email: "p.patel@student.edu", role: "learner", avatar: "PP", status: "Active", demo: true }
    ],
    courses: [
      { id: "c1", code: "CS101", title: "Introduction to Programming", instructor: "Dr. Sarah Chen", instructorId: "u2", progress: 78, status: "in-progress", students: 142 },
      { id: "c2", code: "MATH204", title: "Linear Algebra", instructor: "Prof. James Okonkwo", instructorId: "u6", progress: 45, status: "in-progress", students: 98 },
      { id: "c3", code: "DS310", title: "Data Structures & Algorithms", instructor: "Dr. Amina Hassan", instructorId: "u7", progress: 92, status: "completed", students: 76 },
      { id: "c4", code: "WEB220", title: "Web Development Fundamentals", instructor: "Dr. Sarah Chen", instructorId: "u2", progress: 30, status: "in-progress", students: 115 }
    ],
    assignments: [
      { id: "a1", title: "Programming Fundamentals Quiz", course: "CS101", courseId: "c1", due: dayOffset(3), status: "pending", grade: null, type: "Quiz", createdBy: "u2" },
      { id: "a2", title: "Matrix Operations Project", course: "MATH204", courseId: "c2", due: dayOffset(7), status: "in-progress", grade: null, type: "Project", createdBy: "u6" },
      { id: "a3", title: "Responsive Learning Page", course: "WEB220", courseId: "c4", due: dayOffset(10), status: "pending", grade: null, type: "Assignment", createdBy: "u2" },
      { id: "a4", title: "Python Basics Quiz", course: "CS101", courseId: "c1", due: dayOffset(-2), status: "completed", grade: 95, type: "Quiz", createdBy: "u2" }
    ],
    enrollments: [
      { userId: "u1", courseId: "c1" }, { userId: "u1", courseId: "c2" }, { userId: "u1", courseId: "c4" },
      { userId: "u4", courseId: "c1" }, { userId: "u4", courseId: "c4" }
    ],
    submissions: [],
    materials: [],
    program_applications: [],
    audit_log: []
  };
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const data = initialData();
    saveData(data);
    return data;
  }
}

function saveData(data) {
  fs.mkdirSync(__dirname, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, DATA_FILE);
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ sub: user.id, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  let actual;
  let payload;
  try {
    actual = Buffer.from(parts[2], "base64url");
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected) || payload.exp < Date.now() / 1000) return null;
  const data = loadData();
  return data.users.find(user => user.id === payload.sub && user.status !== "Inactive") || null;
}

function publicUser(user) {
  const { id, name, email, role, avatar, status, lastLogin, selectedCourse } = user;
  return { id, name, email, role, avatar, status, lastLogin, ...(selectedCourse ? { selectedCourse } : {}) };
}

function profileUser(user) {
  return {
    ...publicUser(user),
    identityNumber: user.identityNumber || "",
    passportNumber: user.passportNumber || "",
    dateOfBirth: user.dateOfBirth || "",
    gender: user.gender || "",
    phone: user.phone || "",
    lastSchool: user.lastSchool || ""
  };
}

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error("Request body is too large"), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error("Request body must be valid JSON"), { status: 400 })); }
    });
    request.on("error", reject);
  });
}

function normalizeRole(role) {
  const key = String(role || "learner").toLowerCase();
  if (["admin", "administrator"].includes(key)) return "admin";
  if (["lecturer", "facilitator", "instructor"].includes(key)) return "lecturer";
  if (key === "guest") return "guest";
  return "learner";
}

function requireRole(user, roles) {
  return Boolean(user && roles.includes(user.role));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}

async function handle(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    return response.end();
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const route = url.pathname.replace(/\/$/, "") || "/";
  if (!route.startsWith("/api/")) return send(response, 404, { error: "Not found" });
  if (route === "/api/health") return send(response, 200, { status: "ok", service: "Chimera LMS JavaScript API" });

  const data = loadData();
  const authorization = request.headers.authorization || "";
  const user = verifyToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");

  if (request.method === "POST" && route === "/api/auth/login") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const role = normalizeRole(body.role);
    const account = data.users.find(item => item.email.toLowerCase() === email && item.role === role);
    if (!account) return send(response, 401, { error: "No account was found for that email and role" });
    if (!account.demo) {
      const supplied = hashPassword(String(body.password || ""), account.passwordSalt).hash;
      const suppliedBuffer = Buffer.from(supplied, "hex");
      const storedBuffer = Buffer.from(account.passwordHash || "", "hex");
      if (suppliedBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, storedBuffer)) {
        return send(response, 401, { error: "Incorrect email or password" });
      }
    }
    account.lastLogin = new Date().toISOString();
    saveData(data);
    return send(response, 200, { token: makeToken(account), user: publicUser(account) });
  }

  if (request.method === "POST" && route === "/api/auth/register") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !String(body.name || "").trim()) return send(response, 400, { error: "Name and email are required" });
    if (String(body.emailConfirm || "").trim().toLowerCase() !== email) return send(response, 400, { error: "Email addresses do not match" });
    if (data.users.some(item => item.email.toLowerCase() === email)) return send(response, 409, { error: "An account with this email already exists" });
    if (password !== String(body.passwordConfirm || "")) return send(response, 400, { error: "Passwords do not match" });
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return send(response, 400, { error: "Password must have at least 8 characters, one capital letter, and one number" });
    if (!body.identityNumber && !body.passportNumber) return send(response, 400, { error: "An identity or passport number is required" });
    if (!body.agreement) return send(response, 400, { error: "Please accept the registration agreement" });

    const { salt, hash } = hashPassword(password);
    const learner = {
      id: crypto.randomUUID(), name: String(body.name).trim(), email, role: "learner", avatar: String(body.name).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(),
      status: "Active", passwordSalt: salt, passwordHash: hash,
      identityNumber: body.identityNumber || "", passportNumber: body.passportNumber || "", dateOfBirth: body.dateOfBirth || "", gender: body.gender || "", phone: body.phone || "", lastSchool: body.lastSchool || "", recoveryQuestion: body.recoveryQuestion || "",
      recoveryAnswerHash: crypto.createHash("sha256").update(String(body.recoveryAnswer || "").trim().toLowerCase()).digest("hex"), selectedCourse: String(body.course || "")
    };
    data.users.push(learner);
    data.program_applications.push({ id: crypto.randomUUID(), userId: learner.id, course: learner.selectedCourse, status: "pending", submittedAt: new Date().toISOString() });
    saveData(data);
    return send(response, 201, { token: makeToken(learner), user: publicUser(learner) });
  }

  if (!user) return send(response, 401, { error: "Unauthorized" });
  if (request.method === "GET" && route === "/api/me") {
    const account = data.users.find(item => item.id === user.id);
    return send(response, 200, profileUser(account));
  }
  if (request.method === "PATCH" && route === "/api/me") {
    const body = await readBody(request);
    const account = data.users.find(item => item.id === user.id);
    const editableFields = ["name", "email", "identityNumber", "passportNumber", "dateOfBirth", "gender", "phone", "lastSchool"];
    for (const key of editableFields) {
      if (Object.hasOwn(body, key)) account[key] = String(body[key] || "").trim();
    }
    account.email = account.email.toLowerCase();
    if (!account.name || !account.email) return send(response, 400, { error: "Name and email are required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) return send(response, 400, { error: "Enter a valid email address" });
    if (data.users.some(item => item.id !== account.id && item.email.toLowerCase() === account.email)) return send(response, 409, { error: "That email address is already in use" });
    account.avatar = account.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    saveData(data);
    return send(response, 200, profileUser(account));
  }

  if (request.method === "GET" && route === "/api/courses") {
    let courses = data.courses;
    if (user.role === "learner") {
      const enrolled = new Set(data.enrollments.filter(item => item.userId === user.id).map(item => item.courseId));
      courses = courses.filter(course => enrolled.has(course.id));
    } else if (user.role === "lecturer") {
      courses = courses.filter(course => course.instructorId === user.id || course.instructor === user.name);
    }
    return send(response, 200, courses);
  }

  if (request.method === "GET" && route === "/api/assignments") {
    let assignments = data.assignments;
    if (user.role === "learner") {
      const enrolled = new Set(data.enrollments.filter(item => item.userId === user.id).map(item => item.courseId));
      assignments = assignments.filter(assignment => enrolled.has(assignment.courseId));
    } else if (user.role === "lecturer") {
      const courseIds = new Set(data.courses.filter(course => course.instructorId === user.id || course.instructor === user.name).map(course => course.id));
      assignments = assignments.filter(assignment => courseIds.has(assignment.courseId));
    }
    return send(response, 200, assignments);
  }

  if (request.method === "GET" && route === "/api/users") {
    if (!requireRole(user, ["admin"])) return send(response, 403, { error: "Forbidden" });
    return send(response, 200, data.users.map(publicUser));
  }
  if (request.method === "GET" && route === "/api/audit") {
    if (!requireRole(user, ["admin"])) return send(response, 403, { error: "Forbidden" });
    return send(response, 200, data.audit_log);
  }
  if (request.method === "GET" && route === "/api/stats") {
    if (user.role === "learner") {
      const enrolled = new Set(data.enrollments.filter(item => item.userId === user.id).map(item => item.courseId));
      const courseIds = new Set(data.courses.filter(course => enrolled.has(course.id)).map(course => course.id));
      return send(response, 200, {
        courses: courseIds.size,
        assignments: data.assignments.filter(item => courseIds.has(item.courseId)).length,
        submissions: data.submissions.filter(item => item.userId === user.id).length
      });
    }
    return send(response, 200, {
      users: data.users.length,
      courses: data.courses.length,
      assignments: data.assignments.length,
      submissions: data.submissions.length
    });
  }

  if (request.method === "POST" && route === "/api/submissions") {
    if (!requireRole(user, ["learner"])) return send(response, 403, { error: "Forbidden" });
    const body = await readBody(request);
    const assignment = data.assignments.find(item => item.id === body.assignmentId);
    if (!assignment) return send(response, 404, { error: "Assignment not found" });
    const enrolled = data.enrollments.some(item => item.userId === user.id && item.courseId === assignment.courseId);
    if (!enrolled) return send(response, 403, { error: "You are not enrolled in this course" });
    const submission = { id: crypto.randomUUID(), userId: user.id, assignmentId: assignment.id, comments: String(body.comments || ""), filename: String(body.filename || ""), submittedAt: new Date().toISOString() };
    data.submissions.push(submission);
    assignment.status = "completed";
    saveData(data);
    return send(response, 201, submission);
  }

  if (request.method === "POST" && route === "/api/assignments") {
    if (!requireRole(user, ["lecturer", "admin"])) return send(response, 403, { error: "Forbidden" });
    const body = await readBody(request);
    const course = data.courses.find(item => item.code === body.course || item.id === body.course);
    if (!course) return send(response, 400, { error: "Choose a valid course" });
    const assignment = { id: crypto.randomUUID(), title: String(body.title || "").trim(), course: course.code, courseId: course.id, due: body.due || "", status: "pending", grade: null, type: body.type || "Assignment", createdBy: user.id };
    if (!assignment.title) return send(response, 400, { error: "Assignment title is required" });
    data.assignments.push(assignment);
    saveData(data);
    return send(response, 201, assignment);
  }

  if (request.method === "POST" && route === "/api/materials") {
    if (!requireRole(user, ["lecturer", "admin"])) return send(response, 403, { error: "Forbidden" });
    const body = await readBody(request);
    const material = { id: crypto.randomUUID(), course: body.course || "", title: body.title || "", filename: body.filename || "", uploadedBy: user.id, uploadedAt: new Date().toISOString() };
    data.materials.push(material);
    saveData(data);
    return send(response, 201, material);
  }

  if (request.method === "POST" && route === "/api/submissions/grade") {
    if (!requireRole(user, ["lecturer", "admin"])) return send(response, 403, { error: "Forbidden" });
    const body = await readBody(request);
    const submission = data.submissions.find(item => item.assignmentId === body.assignment && item.userId === body.student) || null;
    if (submission) {
      submission.score = Number(body.score);
      submission.feedback = String(body.feedback || "");
      submission.gradedAt = new Date().toISOString();
      saveData(data);
    }
    return send(response, 200, { status: "recorded" });
  }

  return send(response, 404, { error: "Not found" });
}

const server = http.createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error(error);
    if (!response.headersSent) send(response, error.status || 500, { error: error.status ? error.message : "Internal server error" });
    else response.end();
  });
});

server.listen(PORT, HOST, () => {
  loadData();
  console.log(`Chimera LMS JavaScript API listening on http://${HOST}:${PORT}`);
  console.log("Demo learner: alex.j@student.edu (any password)");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
