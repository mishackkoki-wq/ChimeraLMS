// ==================== CHIMERA LMS (Full-Stack Frontend) ====================
// Connects to Python backend at http://localhost:5000
// Falls back to offline mock data if backend is unavailable

const API = "http://localhost:5000/api";

let currentUser = null;
let currentPage = "dashboard";
let authToken = localStorage.getItem("chimera_token") || null;
let selectedFile = null;
let cachedCourses = [];
let cachedAssignments = [];
let cachedUsers = [];
let cachedAudit = [];

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const sidebarNav = document.getElementById("sidebar-nav");
const contentArea = document.getElementById("content-area");
const pageTitle = document.getElementById("page-title");
const roleBadge = document.getElementById("role-badge");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalFooter = document.getElementById("modal-footer");
const modalClose = document.getElementById("modal-close");
const toastEl = document.getElementById("toast");
const registerScreen = document.getElementById("register-screen");
const registerForm = document.getElementById("register-form");
const showRegisterLink = document.getElementById("show-register");
const showLoginLink = document.getElementById("show-login");
const homeScreen = document.getElementById("home-screen");

function showScreen(name) {
  [homeScreen, loginScreen, registerScreen, appScreen].forEach(s => s && s.classList.remove("active"));
  if (name === "home" && homeScreen) homeScreen.classList.add("active");
  else if (name === "login") loginScreen.classList.add("active");
  else if (name === "register") registerScreen.classList.add("active");
  else if (name === "app") appScreen.classList.add("active");
}

// Homepage buttons → Login / Register
["nav-login"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", (e) => { e.preventDefault(); showScreen("login"); });
});
["nav-register", "hero-register", "skills-cta"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", (e) => { e.preventDefault(); showScreen("register"); });
});

// FAQ accordion
document.querySelectorAll(".faq-question").forEach(btn => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".faq-item");
    const isOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item").forEach(i => {
      i.classList.remove("open");
      i.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      i.querySelector(".faq-icon").textContent = "+";
    });
    if (!isOpen) {
      item.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      item.querySelector(".faq-icon").textContent = "−";
    }
  });
});

// Smooth scroll for in-page anchors on homepage
document.querySelectorAll('#home-screen a[href^="#"]').forEach(a => {
  a.addEventListener("click", (e) => {
    const targetId = a.getAttribute("href").slice(1);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      // Update active nav pill
      document.querySelectorAll(".home-menu .nav-link").forEach(l => l.classList.remove("active"));
      const navLink = document.querySelector(`.home-menu .nav-link[href="#${targetId}"]`);
      if (navLink) navLink.classList.add("active");
    }
  });
});

// Screen switching (login <-> register)
if (showRegisterLink) {
  showRegisterLink.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("register");
  });
}
if (showLoginLink) {
  showLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("login");
  });
}

// Registration
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;
    const role = document.getElementById("reg-role").value;

    if (password !== confirm) {
      showToast("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters");
      return;
    }

    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role })
      });

      if (data && data.token) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("chimera_token", authToken);
        currentPage = "dashboard";
        if (typeof showScreen === "function") showScreen("app");
        await showApp();
        showToast("Account created! Welcome, " + currentUser.name);
      } else if (data && data.error) {
        showToast(data.error);
      } else {
        // Offline success simulation
        currentUser = {
          id: "new-" + Date.now(),
          name: name,
          email: email,
          role: role,
          avatar: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        };
        currentPage = "dashboard";
        if (typeof showScreen === "function") showScreen("app");
        await showApp();
        showToast("Account created (offline)! Welcome, " + name);
      }
    } catch (err) {
      showToast(err.message || "Registration failed");
    }
  });
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers["Authorization"] = "Bearer " + authToken;
  try {
    const res = await fetch(API + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
    return data;
  } catch (err) {
    if (String(err.message).includes("Failed to fetch") || String(err.message).includes("NetworkError")) {
      console.warn("Backend unreachable — offline mode");
      return null;
    }
    throw err;
  }
}

const navItems = {
  learner: [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "courses", label: "My Courses", icon: "📚" },
    { id: "assignments", label: "Assignments", icon: "📝" },
    { id: "grades", label: "Grades & Feedback", icon: "⭐" },
    { id: "progress", label: "Progress", icon: "📈" }
  ],
  lecturer: [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "courses", label: "My Courses", icon: "📚" },
    { id: "assessments", label: "Assessments", icon: "📋" },
    { id: "grading", label: "Grading", icon: "✅" },
    { id: "reports", label: "Class Reports", icon: "📑" }
  ],
  admin: [
    { id: "dashboard", label: "System Dashboard", icon: "🖥️" },
    { id: "users", label: "User Management", icon: "👥" },
    { id: "courses", label: "All Courses", icon: "📚" },
    { id: "reports", label: "Analytics & Reports", icon: "📊" },
    { id: "security", label: "Security & Logs", icon: "🔒" },
    { id: "settings", label: "System Settings", icon: "⚙️" }
  ],
  guest: [
    { id: "dashboard", label: "Public Info", icon: "ℹ️" },
    { id: "courses", label: "Available Courses", icon: "📚" }
  ]
};

function initTheme() {
  if (localStorage.getItem("chimera-theme") === "light") {
    document.body.classList.add("light");
    themeIcon.textContent = "🌙";
  } else {
    themeIcon.textContent = "☀️";
  }
}
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  themeIcon.textContent = isLight ? "🌙" : "☀️";
  localStorage.setItem("chimera-theme", isLight ? "light" : "dark");
});

function showToast(message) {
  toastEl.textContent = message;
  toastEl.className = "toast show success";
  setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function openModal(title, bodyHtml, footerHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalFooter.innerHTML = footerHtml || "";
  modalOverlay.classList.add("open");
}
function closeModal() {
  modalOverlay.classList.remove("open");
  selectedFile = null;
}
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role })
    });
    if (data && data.token) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem("chimera_token", authToken);
      currentPage = "dashboard";
      await showApp();
      showToast("Welcome, " + currentUser.name + "!");
    } else {
      currentUser = {
        id: "offline",
        name: role === "admin" ? "Marcus Rivera" : role === "lecturer" ? "Dr. Sarah Chen" : role === "guest" ? "Guest User" : "Alex Johnson",
        email: email || "demo@chimera.edu",
        role: role,
        avatar: role === "admin" ? "MR" : role === "lecturer" ? "SC" : role === "guest" ? "GU" : "AJ"
      };
      currentPage = "dashboard";
      await showApp();
      showToast("Running in offline demo mode");
    }
  } catch (err) {
    showToast(err.message || "Login failed");
  }
});

logoutBtn.addEventListener("click", () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("chimera_token");
  loginForm.reset();
  if (typeof showScreen === "function") showScreen("home");
  else {
    loginScreen.classList.add("active");
    appScreen.classList.remove("active");
  }
});

async function showApp() {
  if (typeof showScreen === "function") {
    showScreen("app");
  } else {
    loginScreen.classList.remove("active");
    if (homeScreen) homeScreen.classList.remove("active");
    if (registerScreen) registerScreen.classList.remove("active");
    appScreen.classList.add("active");
  }
  document.getElementById("user-name").textContent = currentUser.name;
  document.getElementById("user-role").textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  document.getElementById("user-avatar").textContent = currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase();
  roleBadge.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  await loadData();
  renderNav();
  renderPage();
}

async function loadData() {
  const [courses, assignments, users, audit] = await Promise.all([
    api("/courses"),
    api("/assignments"),
    currentUser.role === "admin" ? api("/users") : Promise.resolve(null),
    currentUser.role === "admin" ? api("/audit") : Promise.resolve(null)
  ]);
  cachedCourses = courses || getOfflineCourses();
  cachedAssignments = assignments || getOfflineAssignments();
  cachedUsers = users || getOfflineUsers();
  cachedAudit = audit || getOfflineAudit();
}

function getOfflineCourses() {
  return [
    { id: "c1", code: "CS101", title: "Introduction to Programming", instructor: "Dr. Sarah Chen", progress: 78, status: "in-progress", students: 142 },
    { id: "c2", code: "MATH204", title: "Linear Algebra", instructor: "Prof. James Okonkwo", progress: 45, status: "in-progress", students: 98 },
    { id: "c3", code: "DS310", title: "Data Structures & Algorithms", instructor: "Dr. Amina Hassan", progress: 92, status: "completed", students: 76 },
    { id: "c4", code: "WEB220", title: "Web Development Fundamentals", instructor: "Dr. Sarah Chen", progress: 30, status: "in-progress", students: 115 }
  ];
}
function getOfflineAssignments() {
  return [
    { id: "a1", title: "Binary Search Trees Implementation", course: "DS310", due: "2026-10-08", status: "pending", grade: null, type: "Project" },
    { id: "a2", title: "React Component Library", course: "WEB220", due: "2026-10-05", status: "in-progress", grade: null, type: "Assignment" },
    { id: "a3", title: "Matrix Operations Project", course: "MATH204", due: "2026-09-28", status: "completed", grade: 88, type: "Project" },
    { id: "a4", title: "Python Basics Quiz", course: "CS101", due: "2026-09-20", status: "completed", grade: 95, type: "Quiz" }
  ];
}
function getOfflineUsers() {
  return [
    { name: "Alex Johnson", email: "alex.j@student.edu", role: "learner", status: "Active", lastLogin: "2026-10-01" },
    { name: "Dr. Sarah Chen", email: "s.chen@faculty.edu", role: "lecturer", status: "Active", lastLogin: "2026-10-02" },
    { name: "Priya Patel", email: "p.patel@student.edu", role: "learner", status: "Active", lastLogin: "2026-09-30" },
    { name: "Marcus Rivera", email: "m.rivera@admin.edu", role: "admin", status: "Active", lastLogin: "2026-10-02" }
  ];
}
function getOfflineAudit() {
  return [
    { time: "2026-10-02 07:45", user: "m.rivera@admin.edu", action: "Role change", ip: "102.45.12.88", status: "Success" },
    { time: "2026-10-02 06:12", user: "s.chen@faculty.edu", action: "Uploaded materials – WEB220", ip: "196.22.45.11", status: "Success" }
  ];
}

function renderNav() {
  const nav = navItems[currentUser.role] || navItems.guest;
  sidebarNav.innerHTML = nav.map(item =>
    '<div class="nav-item ' + (item.id === currentPage ? "active" : "") + '" data-page="' + item.id + '">' +
    "<span>" + item.icon + "</span><span>" + item.label + "</span></div>"
  ).join("");
  sidebarNav.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", () => {
      currentPage = el.dataset.page;
      renderNav();
      renderPage();
    });
  });
}

function renderPage() {
  const titles = {
    dashboard: "Dashboard", courses: "Courses", assignments: "Assignments",
    grades: "Grades & Feedback", progress: "My Progress", assessments: "Assessments",
    grading: "Grading Queue", reports: "Reports", users: "User Management",
    security: "Security & Audit Logs", settings: "System Settings"
  };
  pageTitle.textContent = titles[currentPage] || "Dashboard";
  const role = currentUser.role;
  const map = {
    dashboard: () => renderDashboard(role),
    courses: () => renderCourses(role),
    assignments: () => renderAssignments(),
    grades: () => renderGrades(),
    progress: () => renderProgress(),
    assessments: () => renderAssessments(),
    grading: () => renderGrading(),
    reports: () => renderReports(role),
    users: () => renderUsers(),
    security: () => renderSecurity(),
    settings: () => renderSettings()
  };
  contentArea.innerHTML = (map[currentPage] || (() => '<div class="empty-state"><p>Page under construction</p></div>'))();
  attachPageListeners();
}

function attachPageListeners() {
  document.querySelectorAll("[data-submit-id]").forEach(btn => {
    btn.addEventListener("click", () => openSubmitModal(btn.dataset.submitId));
  });
  const createBtn = document.getElementById("create-assessment-btn");
  if (createBtn) createBtn.addEventListener("click", openCreateAssessmentModal);
  const uploadBtn = document.getElementById("upload-materials-btn");
  if (uploadBtn) uploadBtn.addEventListener("click", openUploadModal);
  document.querySelectorAll("[data-grade]").forEach(btn => {
    btn.addEventListener("click", () => openGradeModal(btn.dataset.student, btn.dataset.assignment));
  });
}

function renderDashboard(role) {
  if (role === "learner") {
    const due = cachedAssignments.filter(a => a.status !== "completed").length;
    return '<div class="stats-grid">' +
      '<div class="stat-card"><div class="label">Enrolled Courses</div><div class="value">' + cachedCourses.length + '</div></div>' +
      '<div class="stat-card"><div class="label">Assignments Due</div><div class="value">' + due + '</div></div>' +
      '<div class="stat-card"><div class="label">Average Grade</div><div class="value">91%</div></div>' +
      '<div class="stat-card"><div class="label">Completion</div><div class="value">61%</div></div></div>' +
      '<div class="card"><h3>Continue Learning</h3><div class="course-grid">' +
      cachedCourses.filter(c => c.status !== "completed").map(c =>
        '<div class="course-card"><div class="code">' + c.code + '</div><h4>' + c.title + '</h4>' +
        '<div class="meta">' + c.instructor + '</div>' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + (c.progress||0) + '%"></div></div>' +
        '<div class="meta" style="margin-top:0.4rem">' + (c.progress||0) + '% complete</div></div>'
      ).join("") + '</div></div>';
  }
  if (role === "lecturer") {
    const my = cachedCourses.filter(c => c.instructor && c.instructor.includes("Chen"));
    return '<div class="stats-grid">' +
      '<div class="stat-card"><div class="label">Active Courses</div><div class="value">' + (my.length||2) + '</div></div>' +
      '<div class="stat-card"><div class="label">Students</div><div class="value">257</div></div>' +
      '<div class="stat-card"><div class="label">Pending Grades</div><div class="value">18</div></div>' +
      '<div class="stat-card"><div class="label">Avg Class Score</div><div class="value">84%</div></div></div>' +
      '<div class="card"><h3>My Courses <button class="btn btn-sm btn-primary" id="upload-materials-btn">Upload Materials</button></h3>' +
      '<div class="course-grid">' + (my.length ? my : cachedCourses.slice(0,2)).map(c =>
        '<div class="course-card"><div class="code">' + c.code + '</div><h4>' + c.title + '</h4>' +
        '<div class="meta">' + (c.students||0) + ' students</div></div>'
      ).join("") + '</div></div>';
  }
  if (role === "admin") {
    return '<div class="stats-grid">' +
      '<div class="stat-card"><div class="label">Total Users</div><div class="value">' + (cachedUsers.length||5) + '</div></div>' +
      '<div class="stat-card"><div class="label">Active Courses</div><div class="value">' + cachedCourses.length + '</div></div>' +
      '<div class="stat-card"><div class="label">System Health</div><div class="value" style="color:var(--success)">99.8%</div></div>' +
      '<div class="stat-card"><div class="label">API</div><div class="value" style="font-size:1.1rem">JWT + JSON</div></div></div>' +
      '<div class="card"><h3>System Overview</h3><div class="table-wrap"><table>' +
      '<thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead><tbody>' +
      '<tr><td>Backend</td><td>Python HTTP Server</td><td><span class="status completed">Running</span></td></tr>' +
      '<tr><td>Auth</td><td>JWT HS256</td><td><span class="status completed">Active</span></td></tr>' +
      '<tr><td>Storage</td><td>data.json</td><td><span class="status completed">OK</span></td></tr>' +
      '</tbody></table></div></div>';
  }
  return '<div class="card"><h3>Welcome to Chimera LMS</h3><p style="color:var(--text-muted)">Limited public view. Sign in for full access.</p></div>';
}

function renderCourses(role) {
  let list = cachedCourses;
  if (role === "lecturer") list = cachedCourses.filter(c => c.instructor && c.instructor.includes("Chen"));
  return '<div class="course-grid">' + list.map(c =>
    '<div class="course-card"><div class="code">' + c.code + '</div><h4>' + c.title + '</h4>' +
    '<div class="meta">' + c.instructor + '</div>' +
    (role === "learner" ?
      '<div class="progress-bar"><div class="progress-fill" style="width:' + (c.progress||0) + '%"></div></div>' +
      '<div class="meta" style="margin-top:0.4rem">' + (c.progress||0) + '%</div>' :
      '<div class="meta">' + (c.students||0) + ' students</div>') +
    '</div>'
  ).join("") + '</div>';
}

function renderAssignments() {
  return '<div class="card"><h3>My Assignments</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Title</th><th>Course</th><th>Due</th><th>Status</th><th>Grade</th><th></th></tr></thead><tbody>' +
    cachedAssignments.map(a =>
      '<tr><td>' + a.title + '</td><td>' + a.course + '</td><td>' + a.due + '</td>' +
      '<td><span class="status ' + a.status + '">' + a.status + '</span></td>' +
      '<td>' + (a.grade != null ? a.grade + "%" : "—") + '</td><td>' +
      (a.status === "pending" || a.status === "in-progress" ?
        '<button class="btn btn-sm btn-primary" data-submit-id="' + a.id + '">Submit</button>' :
        '<button class="btn btn-sm btn-ghost">View</button>') +
      '</td></tr>'
    ).join("") + '</tbody></table></div></div>';
}

function renderGrades() {
  return '<div class="card"><h3>Grades & Feedback</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Assignment</th><th>Course</th><th>Grade</th><th>Feedback</th></tr></thead><tbody>' +
    '<tr><td>Matrix Operations Project</td><td>MATH204</td><td><strong>88%</strong></td><td>Excellent work.</td></tr>' +
    '<tr><td>Python Basics Quiz</td><td>CS101</td><td><strong>95%</strong></td><td>Outstanding.</td></tr>' +
    '</tbody></table></div></div>';
}

function renderProgress() {
  return '<div class="stats-grid">' +
    '<div class="stat-card"><div class="label">Overall Progress</div><div class="value">61%</div>' +
    '<div class="progress-bar" style="margin-top:0.75rem"><div class="progress-fill" style="width:61%"></div></div></div>' +
    '<div class="stat-card"><div class="label">Courses</div><div class="value">1 / ' + cachedCourses.length + '</div></div>' +
    '<div class="stat-card"><div class="label">Submitted</div><div class="value">' +
    cachedAssignments.filter(a => a.status === "completed").length + ' / ' + cachedAssignments.length + '</div></div></div>' +
    '<div class="card"><h3>Course Progress</h3>' +
    cachedCourses.map(c =>
      '<div style="margin-bottom:1.25rem"><div style="display:flex;justify-content:space-between">' +
      '<span>' + c.code + ' – ' + c.title + '</span><span>' + (c.progress||0) + '%</span></div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + (c.progress||0) + '%"></div></div></div>'
    ).join("") + '</div>';
}

function renderAssessments() {
  return '<div class="card"><h3>Assessments <button class="btn btn-sm btn-primary" id="create-assessment-btn">+ Create New</button></h3>' +
    '<div class="table-wrap"><table><thead><tr><th>Title</th><th>Course</th><th>Type</th><th>Due</th></tr></thead><tbody>' +
    cachedAssignments.map(a =>
      '<tr><td>' + a.title + '</td><td>' + a.course + '</td><td>' + (a.type||"Assignment") + '</td><td>' + a.due + '</td></tr>'
    ).join("") + '</tbody></table></div></div>';
}

function renderGrading() {
  return '<div class="card"><h3>Pending Submissions to Grade</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th></th></tr></thead><tbody>' +
    '<tr><td>Alex Johnson</td><td>React Component Library</td><td>2026-10-01</td>' +
    '<td><button class="btn btn-sm btn-primary" data-grade data-student="Alex Johnson" data-assignment="React Component Library">Grade</button></td></tr>' +
    '<tr><td>Priya Patel</td><td>Binary Search Trees</td><td>2026-09-30</td>' +
    '<td><button class="btn btn-sm btn-primary" data-grade data-student="Priya Patel" data-assignment="Binary Search Trees">Grade</button></td></tr>' +
    '</tbody></table></div></div>';
}

function renderReports(role) {
  if (role === "admin") {
    return '<div class="stats-grid">' +
      '<div class="stat-card"><div class="label">Enrollments</div><div class="value">4,892</div></div>' +
      '<div class="stat-card"><div class="label">Completion</div><div class="value">72%</div></div>' +
      '<div class="stat-card"><div class="label">Satisfaction</div><div class="value">4.6/5</div></div></div>' +
      '<div class="card"><h3>Reports</h3><div style="display:flex;gap:0.75rem;flex-wrap:wrap">' +
      '<button class="btn btn-primary" onclick="showToast(\'Report ready\')">Enrollment Report</button>' +
      '<button class="btn btn-ghost" onclick="showToast(\'Exported\')">Grade Distribution</button></div></div>';
  }
  return '<div class="card"><h3>Class Reports</h3><p style="color:var(--text-muted)">Progress reports for your classes.</p></div>';
}

function renderUsers() {
  return '<div class="card"><h3>User Management</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th></tr></thead><tbody>' +
    cachedUsers.map(u =>
      '<tr><td>' + u.name + '</td><td>' + u.email + '</td><td>' + u.role + '</td>' +
      '<td><span class="status ' + (u.status === "Active" ? "completed" : "pending") + '">' + u.status + '</span></td>' +
      '<td>' + (u.lastLogin || "—") + '</td></tr>'
    ).join("") + '</tbody></table></div></div>';
}

function renderSecurity() {
  return '<div class="card"><h3>Audit Log</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Time</th><th>User</th><th>Action</th><th>Status</th></tr></thead><tbody>' +
    cachedAudit.map(l =>
      '<tr><td>' + l.time + '</td><td>' + l.user + '</td><td>' + l.action + '</td>' +
      '<td><span class="status ' + (l.status === "Success" ? "completed" : "overdue") + '">' + l.status + '</span></td></tr>'
    ).join("") + '</tbody></table></div></div>';
}

function renderSettings() {
  return '<div class="card"><h3>System Settings</h3>' +
    '<div class="form-group"><label>Institution</label><input class="form-control" value="Chimera University" /></div>' +
    '<button class="btn btn-primary" onclick="showToast(\'Settings saved\')">Save</button></div>';
}

function openSubmitModal(assignmentId) {
  const assignment = cachedAssignments.find(a => a.id === assignmentId);
  if (!assignment) return;
  openModal("Submit Assignment",
    '<p style="margin-bottom:1rem;color:var(--text-muted)"><strong>' + assignment.title + '</strong><br>Course: ' + assignment.course + '</p>' +
    '<div class="form-group"><label>Comments</label><textarea class="form-control" id="submit-comments"></textarea></div>' +
    '<div class="form-group"><label>File</label><div class="file-drop" id="file-drop"><div>📄 Click or drag file</div><div class="filename" id="file-name"></div></div>' +
    '<input type="file" id="file-input" style="display:none" /></div>',
    '<button class="btn btn-ghost" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-submit">Submit</button>'
  );
  setupFileDrop();
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-submit").onclick = async () => {
    if (!selectedFile) { showToast("Select a file"); return; }
    try {
      await api("/submissions", { method: "POST", body: JSON.stringify({ assignmentId, comments: document.getElementById("submit-comments").value, filename: selectedFile.name }) });
    } catch (e) {}
    assignment.status = "completed";
    closeModal();
    showToast('"' + assignment.title + '" submitted!');
    renderPage();
  };
}

function openCreateAssessmentModal() {
  openModal("Create Assessment",
    '<div class="form-group"><label>Title</label><input class="form-control" id="assess-title" /></div>' +
    '<div class="form-group"><label>Course</label><select class="form-control" id="assess-course">' +
    cachedCourses.map(c => '<option>' + c.code + '</option>').join("") + '</select></div>' +
    '<div class="form-group"><label>Type</label><select class="form-control" id="assess-type"><option>Assignment</option><option>Quiz</option><option>Project</option></select></div>' +
    '<div class="form-group"><label>Due</label><input type="date" class="form-control" id="assess-due" /></div>',
    '<button class="btn btn-ghost" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-create">Create</button>'
  );
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-create").onclick = async () => {
    const title = document.getElementById("assess-title").value.trim();
    if (!title) { showToast("Enter a title"); return; }
    try {
      await api("/assignments", { method: "POST", body: JSON.stringify({ title, course: document.getElementById("assess-course").value, type: document.getElementById("assess-type").value, due: document.getElementById("assess-due").value }) });
      await loadData();
    } catch (e) {}
    closeModal();
    showToast('Assessment "' + title + '" created!');
    renderPage();
  };
}

function openUploadModal() {
  openModal("Upload Materials",
    '<div class="form-group"><label>Course</label><select class="form-control" id="upload-course">' +
    cachedCourses.map(c => '<option>' + c.code + '</option>').join("") + '</select></div>' +
    '<div class="form-group"><label>Title</label><input class="form-control" id="upload-title" /></div>' +
    '<div class="form-group"><label>File</label><div class="file-drop" id="file-drop"><div>📁 Drop files</div><div class="filename" id="file-name"></div></div>' +
    '<input type="file" id="file-input" style="display:none" /></div>',
    '<button class="btn btn-ghost" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-upload">Upload</button>'
  );
  setupFileDrop();
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-upload").onclick = async () => {
    if (!selectedFile) { showToast("Select a file"); return; }
    try {
      await api("/materials", { method: "POST", body: JSON.stringify({ course: document.getElementById("upload-course").value, title: document.getElementById("upload-title").value, filename: selectedFile.name }) });
    } catch (e) {}
    closeModal();
    showToast("Materials uploaded!");
  };
}

function openGradeModal(student, assignment) {
  openModal("Grade Submission",
    '<p style="margin-bottom:1rem"><strong>' + student + '</strong><br>' + assignment + '</p>' +
    '<div class="form-group"><label>Score (%)</label><input type="number" class="form-control" id="grade-score" min="0" max="100" /></div>' +
    '<div class="form-group"><label>Feedback</label><textarea class="form-control" id="grade-feedback"></textarea></div>',
    '<button class="btn btn-ghost" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-grade">Submit Grade</button>'
  );
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-grade").onclick = async () => {
    const score = document.getElementById("grade-score").value;
    if (!score) { showToast("Enter a score"); return; }
    try {
      await api("/submissions/grade", { method: "POST", body: JSON.stringify({ student, assignment, score: Number(score), feedback: document.getElementById("grade-feedback").value }) });
    } catch (e) {}
    closeModal();
    showToast("Grade " + score + "% submitted for " + student);
  };
}

function setupFileDrop() {
  const drop = document.getElementById("file-drop");
  const input = document.getElementById("file-input");
  const nameEl = document.getElementById("file-name");
  if (!drop || !input) return;
  drop.onclick = () => input.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("dragover"); };
  drop.ondragleave = () => drop.classList.remove("dragover");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      selectedFile = e.dataTransfer.files[0];
      nameEl.textContent = selectedFile.name;
    }
  };
  input.onchange = () => {
    if (input.files.length) {
      selectedFile = input.files[0];
      nameEl.textContent = selectedFile.name;
    }
  };
}

initTheme();
(async () => {
  if (authToken) {
    try {
      const me = await api("/me");
      if (me) {
        currentUser = me;
        currentPage = "dashboard";
        await showApp();
      }
    } catch {
      localStorage.removeItem("chimera_token");
      authToken = null;
    }
  }
})();
