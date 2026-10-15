"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 5000);
// Listen on all interfaces so hosted deployments and other devices can reach
// the API. Set HOST=127.0.0.1 to restrict it to this machine.
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = path.join(__dirname, "data.json");
const PROGRAMMES_FILE = path.join(__dirname, "programmes.json");
const STATIC_ROOT = path.resolve(__dirname, "..");
const PROGRAMMES = JSON.parse(fs.readFileSync(PROGRAMMES_FILE, "utf8"));
const JWT_SECRET = process.env.JWT_SECRET || "chimera-lms-local-development-secret-change-me";
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const STATIC_DIRECTORIES = new Set(["Css", "Javascript", "assets"]);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp"
};

function initialData() {
  return {
    users: [
      { id: "staff-lecturer", name: "Dr. Sarah Chen", email: "s.chen@faculty.edu", role: "lecturer", avatar: "SC", status: "Active", demo: true },
      { id: "staff-admin", name: "Marcus Rivera", email: "m.rivera@admin.edu", role: "admin", avatar: "MR", status: "Active", demo: true }
    ],
    courses: PROGRAMMES,
    assignments: [],
    enrollments: [],
    attendance: [],
    submissions: [],
    materials: [],
    program_applications: [],
    audit_log: []
  };
}

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(data.attendance)) data.attendance = [];
    return data;
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
  const { id, name, username, email, role, avatar, profileImage, moduleProgress, moduleNotes, status, lastLogin, selectedCourse } = user;
  return { id, name, ...(username ? { username } : {}), email, role, avatar, ...(profileImage ? { profileImage } : {}), ...(moduleProgress ? { moduleProgress } : {}), ...(moduleNotes ? { moduleNotes } : {}), status, lastLogin, ...(selectedCourse ? { selectedCourse } : {}) };
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

function serveStatic(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return send(response, 405, { error: "Method not allowed" });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(response, 400, { error: "Invalid URL path" });
  }
  if (pathname.includes("\\") || pathname.includes("\0")) {
    return send(response, 400, { error: "Invalid URL path" });
  }

  const relativePath = pathname.replace(/^\/+/, "") || "index.html";
  const segments = relativePath.split("/");
  if (
    segments.some(segment => segment === "." || segment === "..") ||
    (segments[0] !== "index.html" && !STATIC_DIRECTORIES.has(segments[0])) ||
    (segments[0] === "index.html" && segments.length !== 1)
  ) {
    return send(response, 404, { error: "Not found" });
  }

  const filePath = path.resolve(STATIC_ROOT, relativePath);
  const relativeToRoot = path.relative(STATIC_ROOT, filePath);
  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return send(response, 404, { error: "Not found" });
  }

  let fileStats;
  try {
    fileStats = fs.statSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return send(response, 404, { error: "Not found" });
    }
    throw error;
  }
  if (!fileStats.isFile()) return send(response, 404, { error: "Not found" });

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": fileStats.size,
    "X-Content-Type-Options": "nosniff"
  });
  if (request.method === "HEAD") return response.end();

  const stream = fs.createReadStream(filePath);
  stream.on("error", error => {
    console.error(error);
    if (!response.headersSent) send(response, 500, { error: "Unable to serve file" });
    else response.destroy(error);
  });
  stream.pipe(response);
}

function readBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > maxBytes) {
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

function courseNameKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function loginKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function requireRole(user, roles) {
  return Boolean(user && roles.includes(user.role));
}

function canManageCourse(user, course) {
  return user.role === "admin" || (
    user.role === "lecturer" &&
    (course.instructorId === user.id || course.instructor === user.name)
  );
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
  if (!route.startsWith("/api/")) return serveStatic(request, response, url);
  if (route === "/api/health") return send(response, 200, { status: "ok", service: "Chimera LMS JavaScript API" });

  const data = loadData();
  const authorization = request.headers.authorization || "";
  const user = verifyToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");

  if (request.method === "POST" && route === "/api/auth/login") {
    const body = await readBody(request);
    const requestedRole = String(body.role || "");
    if (requestedRole && !["learner", "lecturer", "admin"].includes(requestedRole)) {
      return send(response, 400, { error: "Choose a valid account type" });
    }
    const username = loginKey(body.username || body.email);
    const account = data.users.find(item =>
      loginKey(item.email) === username ||
      (item.username && loginKey(item.username) === username) ||
      (!item.username && loginKey(item.name) === username)
    );
    const isDemoAccount = Boolean(account && account.demo);
    if (!account || (!isDemoAccount && (!account.passwordSalt || !account.passwordHash))) {
      return send(response, 401, { error: "No registered account was found for that username or email" });
    }
    if (requestedRole && account.role !== requestedRole) {
      return send(response, 401, { error: "The selected account type does not match this account" });
    }
    const password = String(body.password || "");
    const validDemoPassword = isDemoAccount && password === "demo";
    const hasRegisteredPassword = Boolean(account.passwordSalt && account.passwordHash);
    const supplied = hasRegisteredPassword ? hashPassword(password, account.passwordSalt).hash : "";
    const suppliedBuffer = Buffer.from(supplied, "hex");
    const storedBuffer = Buffer.from(account.passwordHash || "", "hex");
    const validRegisteredPassword = hasRegisteredPassword && suppliedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, storedBuffer);
    if (!validDemoPassword && !validRegisteredPassword) {
      return send(response, 401, { error: "Incorrect username/email or password" });
    }
    if (account.status === "Inactive") {
      return send(response, 403, { error: "This account is inactive. Contact an administrator." });
    }
    if (isDemoAccount) {
      const { salt, hash } = hashPassword(password);
      account.passwordSalt = salt;
      account.passwordHash = hash;
      delete account.demo;
    }
    if (isDemoAccount && account.role === "learner" && !account.selectedCourse && data.courses.length) {
      account.selectedCourse = data.courses[0].title;
    }
    account.lastLogin = new Date().toISOString();
    saveData(data);
    return send(response, 200, { token: makeToken(account), user: publicUser(account) });
  }

  if (request.method === "POST" && route === "/api/auth/register") {
    const body = await readBody(request);
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) return send(response, 400, { error: "Username must be 3–30 letters, numbers, dots, underscores, or hyphens" });
    if (!email || !String(body.name || "").trim()) return send(response, 400, { error: "Name and email are required" });
    if (String(body.emailConfirm || "").trim().toLowerCase() !== email) return send(response, 400, { error: "Email addresses do not match" });
    if (data.users.some(item => item.email.toLowerCase() === email)) return send(response, 409, { error: "An account with this email already exists" });
    if (data.users.some(item =>
      loginKey(item.username) === loginKey(username) ||
      loginKey(item.email) === loginKey(username) ||
      (!item.username && loginKey(item.name) === loginKey(username))
    )) return send(response, 409, { error: "That username is already in use" });
    if (password !== String(body.passwordConfirm || "")) return send(response, 400, { error: "Passwords do not match" });
    if (password.length < 8) return send(response, 400, { error: "Password must have at least 8 characters" });
    if (!body.identityNumber && !body.passportNumber) return send(response, 400, { error: "An identity or passport number is required" });
    if (!body.agreement) return send(response, 400, { error: "Please accept the registration agreement" });
    const selectedProgramme = data.courses.find(course => courseNameKey(course.title) === courseNameKey(body.course));
    if (!selectedProgramme) return send(response, 400, { error: "Choose one of the available certificate programmes" });

    const { salt, hash } = hashPassword(password);
    const learner = {
      id: crypto.randomUUID(), name: String(body.name).trim(), username, email, role: "learner", avatar: String(body.name).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(),
      status: "Active", passwordSalt: salt, passwordHash: hash,
      identityNumber: body.identityNumber || "", passportNumber: body.passportNumber || "", dateOfBirth: body.dateOfBirth || "", gender: body.gender || "", phone: body.phone || "", lastSchool: body.lastSchool || "", recoveryQuestion: body.recoveryQuestion || "", moduleProgress: {},
      recoveryAnswerHash: crypto.createHash("sha256").update(String(body.recoveryAnswer || "").trim().toLowerCase()).digest("hex"), selectedCourse: selectedProgramme.title
    };
    data.users.push(learner);
    if (selectedProgramme) data.enrollments.push({ userId: learner.id, courseId: selectedProgramme.id });
    data.program_applications.push({ id: crypto.randomUUID(), userId: learner.id, course: learner.selectedCourse, status: "pending", submittedAt: new Date().toISOString() });
    saveData(data);
    return send(response, 201, { token: makeToken(learner), user: profileUser(learner) });
  }

  if (request.method === "POST" && route === "/api/auth/recover") {
    const body = await readBody(request);
    const email = loginKey(body.email);
    const answerHash = crypto.createHash("sha256").update(String(body.recoveryAnswer || "").trim().toLowerCase()).digest("hex");
    const password = String(body.password || "");
    if (password.length < 8) return send(response, 400, { error: "Password must have at least 8 characters" });
    const account = data.users.find(item => loginKey(item.email) === email && item.recoveryAnswerHash && item.recoveryAnswerHash === answerHash);
    if (!account) return send(response, 400, { error: "Email or recovery answer could not be verified" });
    const { salt, hash } = hashPassword(password);
    account.passwordSalt = salt;
    account.passwordHash = hash;
    saveData(data);
    return send(response, 200, { status: "ok" });
  }

  if (!user) return send(response, 401, { error: "Unauthorized" });
  if (request.method === "GET" && route === "/api/me") {
    const account = data.users.find(item => item.id === user.id);
    return send(response, 200, profileUser(account));
  }
  if (request.method === "PATCH" && route === "/api/me") {
    const body = await readBody(request, 4 * 1024 * 1024);
    const account = data.users.find(item => item.id === user.id);
    const editableFields = ["name", "email", "identityNumber", "passportNumber", "dateOfBirth", "gender", "phone", "lastSchool"];
    for (const key of editableFields) {
      if (Object.hasOwn(body, key)) account[key] = String(body[key] || "").trim();
    }
    account.email = account.email.toLowerCase();
    if (!account.name || !account.email) return send(response, 400, { error: "Name and email are required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) return send(response, 400, { error: "Enter a valid email address" });
    if (data.users.some(item => item.id !== account.id && item.email.toLowerCase() === account.email)) return send(response, 409, { error: "That email address is already in use" });
    if (Object.hasOwn(body, "profileImage")) {
      const image = String(body.profileImage || "");
      if (image && (!/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(image) || Buffer.byteLength(image, "utf8") > 2_800_000)) {
        return send(response, 400, { error: "Profile pictures must be PNG, JPG, GIF, or WebP and smaller than 2 MB" });
      }
      account.profileImage = image;
    }
    account.avatar = account.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    saveData(data);
    return send(response, 200, profileUser(account));
  }

  if (request.method === "GET" && route === "/api/courses") {
    let courses = data.courses;
    if (user.role === "learner") {
      const learner = data.users.find(item => item.id === user.id);
      const registeredProgramme = courseNameKey(learner && learner.selectedCourse);
      const registeredCourseIds = new Set(data.enrollments.filter(enrollment => enrollment.userId === user.id).map(enrollment => enrollment.courseId));
      data.courses.forEach(course => {
        if (registeredProgramme && courseNameKey(course.title) === registeredProgramme) registeredCourseIds.add(course.id);
      });
      courses = courses.filter(course => registeredCourseIds.has(course.id));
    } else if (user.role === "lecturer") {
      courses = courses.filter(course => course.instructorId === user.id || course.instructor === user.name);
    }
    return send(response, 200, courses);
  }

  if (request.method === "GET" && route === "/api/assignments") {
    let assignments = data.assignments;
    if (user.role === "learner") {
      const learner = data.users.find(item => item.id === user.id);
      const registeredProgramme = courseNameKey(learner && learner.selectedCourse);
      const registeredCourseIds = new Set(data.courses.filter(course => courseNameKey(course.title) === registeredProgramme).map(course => course.id));
      assignments = assignments.filter(assignment => registeredCourseIds.has(assignment.courseId));
    } else if (user.role === "lecturer") {
      const courseIds = new Set(data.courses.filter(course => course.instructorId === user.id || course.instructor === user.name).map(course => course.id));
      assignments = assignments.filter(assignment => courseIds.has(assignment.courseId));
    }
    const submissions = data.submissions.filter(submission => submission.userId === user.id);
    const visibleAssignments = assignments.map(assignment => {
      const submitted = submissions.some(submission => submission.assignmentId === assignment.id);
      return { ...assignment, status: submitted ? "completed" : assignment.status };
    });
    return send(response, 200, visibleAssignments);
  }

  if (request.method === "PATCH" && route === "/api/modules/progress") {
    if (!requireRole(user, ["learner"])) return send(response, 403, { error: "Only learners can update module progress" });
    const body = await readBody(request);
    const course = data.courses.find(item => item.id === String(body.courseId || ""));
    const account = data.users.find(item => item.id === user.id);
    const enrolled = course && (
      data.enrollments.some(enrollment => enrollment.userId === user.id && enrollment.courseId === course.id) ||
      courseNameKey(account && account.selectedCourse) === courseNameKey(course.title)
    );
    if (!enrolled) return send(response, 403, { error: "You are not enrolled in this course" });
    const group = String(body.group || "");
    const index = Number(body.moduleIndex);
    if (!Array.isArray(course.modules && course.modules[group]) || !Number.isInteger(index) || index < 0 || index >= course.modules[group].length || typeof body.completed !== "boolean") {
      return send(response, 400, { error: "Choose a valid programme module" });
    }
    if (!account.moduleProgress || typeof account.moduleProgress !== "object" || Array.isArray(account.moduleProgress)) account.moduleProgress = {};
    if (!account.moduleProgress[course.id] || typeof account.moduleProgress[course.id] !== "object") account.moduleProgress[course.id] = {};
    if (!account.moduleProgress[course.id][group] || typeof account.moduleProgress[course.id][group] !== "object") account.moduleProgress[course.id][group] = {};
    if (body.completed) account.moduleProgress[course.id][group][index] = true;
    else delete account.moduleProgress[course.id][group][index];
    saveData(data);
    return send(response, 200, { moduleProgress: account.moduleProgress });
  }

  if (request.method === "PATCH" && route === "/api/modules/notes") {
    if (!requireRole(user, ["learner"])) return send(response, 403, { error: "Only learners can save module notes" });
    const body = await readBody(request);
    const course = data.courses.find(item => item.id === String(body.courseId || ""));
    const account = data.users.find(item => item.id === user.id);
    const enrolled = course && (
      data.enrollments.some(enrollment => enrollment.userId === user.id && enrollment.courseId === course.id) ||
      courseNameKey(account && account.selectedCourse) === courseNameKey(course.title)
    );
    const group = String(body.group || "");
    const index = Number(body.moduleIndex);
    const note = String(body.note || "");
    if (!enrolled) return send(response, 403, { error: "You are not enrolled in this course" });
    if (!Array.isArray(course.modules && course.modules[group]) || !Number.isInteger(index) || index < 0 || index >= course.modules[group].length) {
      return send(response, 400, { error: "Choose a valid programme module" });
    }
    if (note.length > 5000) return send(response, 400, { error: "Notes must be 5,000 characters or fewer" });
    if (!account.moduleNotes || typeof account.moduleNotes !== "object" || Array.isArray(account.moduleNotes)) account.moduleNotes = {};
    if (!account.moduleNotes[course.id] || typeof account.moduleNotes[course.id] !== "object") account.moduleNotes[course.id] = {};
    if (!account.moduleNotes[course.id][group] || typeof account.moduleNotes[course.id][group] !== "object") account.moduleNotes[course.id][group] = {};
    if (note.trim()) account.moduleNotes[course.id][group][index] = note;
    else delete account.moduleNotes[course.id][group][index];
    saveData(data);
    return send(response, 200, { moduleNotes: account.moduleNotes });
  }

  if (route === "/api/attendance" && request.method === "GET") {
    if (!requireRole(user, ["lecturer", "admin"])) return send(response, 403, { error: "Forbidden" });
    const courseId = url.searchParams.get("courseId") || "";
    const date = url.searchParams.get("date") || "";
    const course = data.courses.find(item => item.id === courseId);
    if (!course || !canManageCourse(user, course)) return send(response, 403, { error: "You cannot manage attendance for this course" });
    if (!isDateKey(date)) {
      return send(response, 400, { error: "Choose a valid attendance date" });
    }
    const enrolledIds = new Set([
      ...data.enrollments.filter(enrollment => enrollment.courseId === courseId).map(enrollment => enrollment.userId),
      ...data.users.filter(learner => learner.role === "learner" && courseNameKey(learner.selectedCourse) === courseNameKey(course.title)).map(learner => learner.id)
    ]);
    const learners = data.users
      .filter(learner => learner.role === "learner" && learner.status !== "Inactive" && enrolledIds.has(learner.id))
      .map(learner => ({ id: learner.id, name: learner.name, email: learner.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const records = data.attendance.filter(record => record.courseId === courseId && record.date === date);
    return send(response, 200, { courseId, date, learners, records });
  }

  if (route === "/api/attendance" && request.method === "POST") {
    if (!requireRole(user, ["lecturer", "admin"])) return send(response, 403, { error: "Forbidden" });
    const body = await readBody(request);
    const course = data.courses.find(item => item.id === body.courseId);
    if (!course || !canManageCourse(user, course)) return send(response, 403, { error: "You cannot manage attendance for this course" });
    const date = String(body.date || "");
    if (!isDateKey(date)) {
      return send(response, 400, { error: "Choose a valid attendance date" });
    }
    if (!Array.isArray(body.records)) return send(response, 400, { error: "Attendance records are required" });
    const enrolledIds = new Set([
      ...data.enrollments.filter(enrollment => enrollment.courseId === course.id).map(enrollment => enrollment.userId),
      ...data.users.filter(learner => learner.role === "learner" && courseNameKey(learner.selectedCourse) === courseNameKey(course.title)).map(learner => learner.id)
    ]);
    const validRecords = body.records.filter(record => record && enrolledIds.has(record.userId));
    if (validRecords.length !== body.records.length || new Set(validRecords.map(record => record.userId)).size !== validRecords.length) {
      return send(response, 400, { error: "Attendance includes an invalid or duplicate learner" });
    }
    if (validRecords.some(record => !["present", "absent"].includes(record.status))) {
      return send(response, 400, { error: "Mark every learner present or absent before saving" });
    }
    const learners = data.users
      .filter(learner => learner.role === "learner" && learner.status !== "Inactive" && enrolledIds.has(learner.id))
      .map(learner => ({ id: learner.id, name: learner.name, email: learner.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (validRecords.length !== learners.length) return send(response, 400, { error: "Mark every enrolled learner before saving" });

    data.attendance = data.attendance.filter(record => record.courseId !== course.id || record.date !== date);
    const records = validRecords.map(record => ({
      courseId: course.id,
      date,
      userId: record.userId,
      status: record.status,
      markedBy: user.id,
      markedAt: new Date().toISOString()
    }));
    data.attendance.push(...records);
    saveData(data);
    return send(response, 200, { courseId: course.id, date, learners, records });
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
      const learner = data.users.find(item => item.id === user.id);
      const registeredProgramme = courseNameKey(learner && learner.selectedCourse);
      const courseIds = new Set(data.courses.filter(course => courseNameKey(course.title) === registeredProgramme).map(course => course.id));
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
    const body = await readBody(request, 8 * 1024 * 1024);
    const assignment = data.assignments.find(item => item.id === body.assignmentId);
    if (!assignment) return send(response, 404, { error: "Assignment not found" });
    const learner = data.users.find(item => item.id === user.id);
    const registeredProgramme = courseNameKey(learner && learner.selectedCourse);
    const enrolled = data.courses.some(course => course.id === assignment.courseId && courseNameKey(course.title) === registeredProgramme);
    if (!enrolled) return send(response, 403, { error: "You are not enrolled in this course" });
    if (data.submissions.some(item => item.userId === user.id && item.assignmentId === assignment.id)) {
      return send(response, 409, { error: "You have already submitted this assessment" });
    }
    const filename = String(body.filename || "").trim();
    const fileContent = String(body.fileContent || "");
    if (!filename || !/^[A-Za-z0-9+/]*={0,2}$/.test(fileContent) || !fileContent) {
      return send(response, 400, { error: "Choose a file to submit" });
    }
    const fileBuffer = Buffer.from(fileContent, "base64");
    if (fileBuffer.length > 5 * 1024 * 1024 || fileBuffer.toString("base64") !== fileContent) {
      return send(response, 413, { error: "Submission files must be smaller than 5 MB" });
    }
    const submission = {
      id: crypto.randomUUID(),
      userId: user.id,
      assignmentId: assignment.id,
      comments: String(body.comments || ""),
      filename: path.basename(filename).slice(0, 255),
      fileType: String(body.fileType || "application/octet-stream").slice(0, 120),
      fileSize: fileBuffer.length,
      fileContent,
      submittedAt: new Date().toISOString()
    };
    data.submissions.push(submission);
    saveData(data);
    const publicSubmission = { ...submission };
    delete publicSubmission.fileContent;
    return send(response, 201, publicSubmission);
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
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
