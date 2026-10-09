// ==================== CHIMERA LMS (Full-Stack Frontend) ====================
// Connects to the JavaScript backend at http://localhost:5000
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
let attendanceRegister = { courseId: "", date: "", learners: [], records: [] };
let attendanceCourseId = "";
let attendanceDate = "";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const sidebarNav = document.getElementById("sidebar-nav");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const contentArea = document.getElementById("content-area");
const pageTitle = document.getElementById("page-title");
const roleBadge = document.getElementById("role-badge");
const roleProfileButton = document.getElementById("role-profile-button");
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

function showScreen(name, historyMode = "push") {
  [homeScreen, loginScreen, registerScreen, appScreen].forEach(s => s && s.classList.remove("active"));
  if (name === "home" && homeScreen) homeScreen.classList.add("active");
  else if (name === "login") loginScreen.classList.add("active");
  else if (name === "register") registerScreen.classList.add("active");
  else if (name === "app") appScreen.classList.add("active");
  if (historyMode !== "none") {
    const state = { screen: name };
    if (historyMode === "replace" || history.state?.screen === name) {
      history.replaceState(state, "", window.location.href);
    } else {
      history.pushState(state, "", window.location.href);
    }
  }
  window.scrollTo(0, 0);
}

history.replaceState({ screen: "home" }, "", window.location.href);
window.addEventListener("popstate", event => {
  const screen = event.state?.screen;
  if (["home", "login", "register", "app"].includes(screen)) {
    showScreen(screen, "none");
  }
});

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

["login-home", "app-home-btn"].forEach(id => {
  const link = document.getElementById(id);
  if (link) link.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("home", "replace");
  });
});

["registration-home", "registration-back"].forEach(id => {
  const link = document.getElementById(id);
  if (link) link.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("home", "replace");
  });
});

// Registration
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstName = document.getElementById("reg-first-name").value.trim();
    const surname = document.getElementById("reg-surname").value.trim();
    const name = `${firstName} ${surname}`.trim();
    const email = document.getElementById("reg-email").value.trim();
    const emailConfirm = document.getElementById("reg-email-confirm").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;
    const identityNumber = document.getElementById("reg-id-number").value.trim();
    const passportNumber = document.getElementById("reg-passport").value.trim();

    if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
      showToast("Email addresses do not match");
      document.getElementById("reg-email-confirm").focus();
      return;
    }
    if (!identityNumber && !passportNumber) {
      showToast("Enter an identity number or passport number");
      document.getElementById("reg-id-number").focus();
      return;
    }

    if (password !== confirm) {
      showToast("Passwords do not match");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      showToast("Use at least 8 characters, including a capital letter and a number");
      return;
    }

    const submitButton = document.getElementById("register-submit");
    submitButton.disabled = true;
    submitButton.classList.add("is-submitting");
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name, firstName, surname, email, emailConfirm, password, passwordConfirm: confirm,
          course: document.getElementById("reg-course").value,
          identityNumber, passportNumber,
          dateOfBirth: document.getElementById("reg-dob").value,
          gender: document.querySelector('input[name="gender"]:checked')?.value || "",
          phone: document.getElementById("reg-phone").value.trim(),
          lastSchool: document.getElementById("reg-school").value.trim(),
          recoveryQuestion: document.getElementById("reg-recovery-question").value,
          recoveryAnswer: document.getElementById("reg-recovery-answer").value.trim(),
          agreement: document.getElementById("reg-agreement").checked
        })
      });

      if (data && data.token) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("chimera_token", authToken);
        currentPage = "dashboard";
        await showApp();
        showToast("Application submitted for " + data.user.selectedCourse + ". Welcome, " + currentUser.name);
      } else {
        showToast("Registration service is unavailable. Please try again shortly.");
      }
    } catch (err) {
      showToast(err.message || "Registration failed");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-submitting");
      }
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
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "courses", label: "My Courses", icon: "▣" },
    { id: "assignments", label: "Assignments", icon: "▤" },
    { id: "learning-paths", label: "Learning Paths", icon: "⌘" },
    { id: "practice-tests", label: "Practice Tests", icon: "◎" },
    { id: "schedule", label: "Calendar", icon: "▦" },
    { id: "progress", label: "Progress Analytics", icon: "↗" },
    { id: "achievements", label: "Achievements", icon: "☆" },
    { id: "settings", label: "Settings", icon: "⚙" }
  ],
  lecturer: [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "courses", label: "My Courses", icon: "📚" },
    { id: "assessments", label: "Assessments", icon: "📋" },
    { id: "attendance", label: "Attendance Register", icon: "🗓️" },
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
  const savedTheme = localStorage.getItem("chimera-theme");
  if (savedTheme !== "dark") {
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

function closeMobileSidebar() {
  appScreen.classList.remove("sidebar-open");
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const isCollapsed = appScreen.classList.contains("sidebar-collapsed");
  const label = isMobile ? "Open navigation" : isCollapsed ? "Expand sidebar" : "Collapse sidebar";
  sidebarToggle.setAttribute("aria-expanded", String(isMobile ? false : !isCollapsed));
  sidebarToggle.setAttribute("aria-label", label);
  sidebarToggle.title = label;
}

sidebarToggle.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 768px)").matches) {
    appScreen.classList.remove("sidebar-collapsed");
    const isOpen = appScreen.classList.toggle("sidebar-open");
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    sidebarToggle.title = isOpen ? "Close navigation" : "Open navigation";
    return;
  }
  const isCollapsed = appScreen.classList.toggle("sidebar-collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
  sidebarToggle.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar");
  sidebarToggle.title = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
});

sidebarBackdrop.addEventListener("click", closeMobileSidebar);
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 768px)").matches) closeMobileSidebar();
});
closeMobileSidebar();

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
  modalOverlay.classList.remove("profile-modal-open");
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
      const normalizedRole = ({ learner: "learner", facilitator: "lecturer", administrator: "admin" })[role.toLowerCase()] || role.toLowerCase();
      currentUser = {
        id: "offline",
        name: normalizedRole === "admin" ? "Marcus Rivera" : normalizedRole === "lecturer" ? "Dr. Sarah Chen" : "Alex Johnson",
        email: email || "demo@chimera.edu",
        role: normalizedRole,
        avatar: normalizedRole === "admin" ? "MR" : normalizedRole === "lecturer" ? "SC" : "AJ",
        ...(normalizedRole === "learner" ? { selectedCourse: "Software Developer" } : {})
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
  if (typeof showScreen === "function") showScreen("home", "replace");
  else {
    loginScreen.classList.add("active");
    appScreen.classList.remove("active");
  }
});

if (roleProfileButton) roleProfileButton.addEventListener("click", openLearnerProfile);

async function openLearnerProfile() {
  let profile = currentUser || {};
  try {
    profile = await api("/me") || profile;
  } catch (error) {
    showToast(error.message || "Could not load your profile");
    return;
  }

  const field = (label, name, value = "", type = "text", autocomplete = "off") =>
    `<label class="profile-field"><span>${label}</span><input class="form-control" type="${type}" name="${name}" value="${escapeHTML(value)}" autocomplete="${autocomplete}" /></label>`;
  modalOverlay.classList.add("profile-modal-open");
  openModal("Student Profile", `
    <p class="profile-intro">View and update the personal information linked to your Chimera LMS account.</p>
    <form id="student-profile-form" class="profile-form">
      <div class="profile-form-grid">
        ${field("Full name", "name", profile.name, "text", "name")}
        ${field("Email address", "email", profile.email, "email", "email")}
        ${field("Identity number", "identityNumber", profile.identityNumber)}
        ${field("Passport number", "passportNumber", profile.passportNumber)}
        ${field("Date of birth", "dateOfBirth", profile.dateOfBirth, "date", "bday")}
        <label class="profile-field"><span>Gender</span><select class="form-control" name="gender"><option value="">Select gender</option><option value="female" ${profile.gender === "female" ? "selected" : ""}>Female</option><option value="male" ${profile.gender === "male" ? "selected" : ""}>Male</option><option value="prefer-not-to-say" ${profile.gender === "prefer-not-to-say" ? "selected" : ""}>Prefer not to say</option></select></label>
        ${field("Contact phone number", "phone", profile.phone, "tel", "tel")}
        ${field("Last school attended", "lastSchool", profile.lastSchool)}
      </div>
    </form>`,
    '<button class="btn btn-ghost" id="profile-cancel">Cancel</button><button class="btn btn-primary" id="profile-save" form="student-profile-form">Save changes</button>'
  );
  document.getElementById("profile-cancel").onclick = closeModal;
  document.getElementById("student-profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const updates = Object.fromEntries(formData.entries());
    const saveButton = document.getElementById("profile-save");
    saveButton.disabled = true;
    try {
      const savedProfile = await api("/me", { method: "PATCH", body: JSON.stringify(updates) });
      currentUser = { ...currentUser, ...updates, ...(savedProfile || {}) };
      currentUser.avatar = currentUser.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      document.getElementById("user-name").textContent = currentUser.name;
      document.getElementById("user-avatar").textContent = currentUser.avatar;
      document.getElementById("profile-avatar-mini").textContent = currentUser.avatar;
      closeModal();
      showToast("Profile updated successfully");
      if (currentPage === "dashboard") renderPage();
    } catch (error) {
      showToast(error.message || "Could not update your profile");
      saveButton.disabled = false;
    }
  });
}

async function showApp(historyMode = "replace") {
  if (typeof showScreen === "function") {
    showScreen("app", historyMode);
  } else {
    loginScreen.classList.remove("active");
    if (homeScreen) homeScreen.classList.remove("active");
    if (registerScreen) registerScreen.classList.remove("active");
    appScreen.classList.add("active");
  }
  document.getElementById("user-name").textContent = currentUser.name;
  const displayRole = currentUser.role === "lecturer" ? "Facilitator" : currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  document.getElementById("user-role").textContent = displayRole;
  document.getElementById("user-avatar").textContent = currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase();
  roleBadge.textContent = displayRole;
  document.getElementById("profile-avatar-mini").textContent = currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase();
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
  // Learner access is based on the authenticated programme returned by the API.
  // Do not fall back to a global demo catalogue when the API is unavailable.
  const offlineCourses = getOfflineCourses();
  cachedCourses = courses || (currentUser.role === "learner"
    ? offlineCourses.filter(course => course.title === currentUser.selectedCourse)
    : offlineCourses);
  cachedAssignments = assignments || getOfflineAssignments().filter(assignment =>
    currentUser.role !== "learner" || cachedCourses.some(course => course.id === assignment.courseId)
  );
  cachedUsers = users || getOfflineUsers();
  cachedAudit = audit || getOfflineAudit();
}

function getOfflineCourses() {
  return [
    { id: "cert-data-science", code: "DSP", title: "Data Science Practitioner", instructor: "Chimera Learning", instructorId: "u2", progress: 0, status: "in-progress", students: 0 },
    { id: "cert-ai-software-developer", code: "AI-SDEV", title: "AI Software Developer", instructor: "Chimera Learning", instructorId: "u2", progress: 0, status: "in-progress", students: 0 },
    { id: "cert-software-developer", code: "SDEV", title: "Software Developer", instructor: "Chimera Learning", instructorId: "u2", progress: 0, status: "in-progress", students: 0 },
    { id: "cert-cyber-security-analyst", code: "CSA", title: "Cybersecurity Analyst", instructor: "Chimera Learning", instructorId: "u2", progress: 0, status: "in-progress", students: 0 },
    { id: "cert-project-manager", code: "PM", title: "Project Manager", instructor: "Chimera Learning", instructorId: "u2", progress: 0, status: "in-progress", students: 0 }
  ];
}
function getOfflineAssignments() {
  const dueDate = days => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateKey(date);
  };
  const defaults = cachedCourses.flatMap(course => [
    { id: `offline-${course.id}-assignment`, courseId: course.id, title: `${course.title} Assignment`, course: course.code, due: dueDate(5), status: "pending", grade: null, type: "Assignment" },
    { id: `offline-${course.id}-practical`, courseId: course.id, title: `${course.title} Practical`, course: course.code, due: dueDate(12), status: "pending", grade: null, type: "Practical" }
  ]);
  try {
    const saved = JSON.parse(localStorage.getItem("chimera_offline_assignments") || "[]");
    if (!Array.isArray(saved)) return defaults;
    const savedById = new Map(saved.map(assignment => [assignment.id, assignment]));
    const merged = defaults.map(assignment => ({ ...assignment, ...(savedById.get(assignment.id) || {}) }));
    return [...merged, ...saved.filter(assignment => !defaults.some(item => item.id === assignment.id))];
  } catch (error) {
    console.error("Could not read offline assignments", error);
    return defaults;
  }
}
function getOfflineUsers() {
  return [
    { id: "u1", name: "Alex Johnson", email: "alex.j@student.edu", role: "learner", status: "Active", selectedCourse: "Software Developer", lastLogin: "2026-10-01" },
    { name: "Dr. Sarah Chen", email: "s.chen@faculty.edu", role: "lecturer", status: "Active", lastLogin: "2026-10-02" },
    { id: "u4", name: "Priya Patel", email: "p.patel@student.edu", role: "learner", status: "Active", selectedCourse: "Software Developer", lastLogin: "2026-09-30" },
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
  const navMarkup = nav.map(item =>
    '<button type="button" class="nav-item ' + (item.id === currentPage ? "active" : "") + '" data-page="' + item.id + '" title="' + item.label + '" aria-current="' + (item.id === currentPage ? "page" : "false") + '">' +
    '<span aria-hidden="true">' + item.icon + "</span><span>" + item.label + "</span></button>"
  ).join("");
  const courseMarkup = currentUser.role === "learner" ? '<div class="sidebar-course-group"><p class="sidebar-section-label">MY COURSES</p>' +
    learnerActiveCourses().slice(0, 5).map(course => {
      const progress = Math.max(0, Math.min(100, Number(course.progress) || 0));
      const code = escapeHTML(course.code || "Course");
      const title = escapeHTML(course.title || "Course");
      const nextAssignment = learnerUpcomingAssignments().find(assignment => assignment.course === course.code || assignment.course === course.title);
      const days = nextAssignment ? Math.max(0, Math.ceil((parseDateKey(assignmentDueKey(nextAssignment)) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000)) : null;
      const dueLabel = days === null ? "No upcoming due date" : days === 0 ? "Due today" : days + (days === 1 ? " day to due date" : " days to due date");
      return '<button type="button" class="sidebar-course-item" data-course-page="courses" title="' + title + ' — ' + progress + '% complete"><span class="sidebar-course-icon" aria-hidden="true">◇</span><span class="sidebar-course-copy"><span class="sidebar-course-title">' + code + ' · ' + title + '</span><span class="sidebar-course-due">' + dueLabel + '</span></span><span class="sidebar-course-percent">' + progress + '%<i><b style="width:' + progress + '%"></b></i></span></button>';
    }).join("") + '</div>' : "";
  sidebarNav.innerHTML = (currentUser.role === "learner" ? '<p class="sidebar-section-label sidebar-main-label">MAIN MENU</p>' : "") + navMarkup + courseMarkup;
  sidebarNav.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", () => {
      currentPage = el.dataset.page;
      closeMobileSidebar();
      renderNav();
      renderPage();
    });
  });
  sidebarNav.querySelectorAll("[data-course-page]").forEach(el => el.addEventListener("click", () => {
    currentPage = el.dataset.coursePage;
    closeMobileSidebar();
    renderNav();
    renderPage();
  }));
}

function renderPage() {
  const titles = {
    dashboard: "Dashboard", courses: "Courses", assignments: "Assignments",
    grades: "Grades & Feedback", progress: "Progress Analytics", assessments: "Assessments",
    "learning-paths": "Learning Paths", "practice-tests": "Practice Tests", schedule: "Calendar", achievements: "Achievements",
    attendance: "Attendance Register", grading: "Grading Queue", reports: "Reports", users: "User Management",
    security: "Security & Audit Logs", settings: "System Settings"
  };
  pageTitle.textContent = currentPage === "dashboard" && currentUser.role === "learner" ? "Dashboard Home" : (titles[currentPage] || "Dashboard");
  const role = currentUser.role;
  const map = {
    dashboard: () => renderDashboard(role),
    courses: () => renderCourses(role),
    assignments: () => renderAssignments(),
    grades: () => renderGrades(),
    progress: () => renderProgress(),
    "learning-paths": () => renderLearningPaths(),
    "practice-tests": () => renderPracticeTests(),
    schedule: () => '<div id="student-calendar"></div>',
    attendance: () => renderAttendancePage(),
    achievements: () => renderAchievements(),
    assessments: () => renderAssessments(),
    grading: () => renderGrading(),
    reports: () => renderReports(role),
    users: () => renderUsers(),
    security: () => renderSecurity(),
    settings: () => renderSettings(role)
  };
  contentArea.innerHTML = (map[currentPage] || (() => '<div class="empty-state"><p>Page under construction</p></div>'))();
  attachPageListeners();
}

function attachPageListeners() {
  const editLearnerProfile = document.getElementById("edit-learner-profile");
  if (editLearnerProfile) editLearnerProfile.addEventListener("click", openLearnerProfile);
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
  document.querySelectorAll("[data-dashboard-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPage = btn.dataset.dashboardPage;
      renderNav();
      renderPage();
    });
  });
  bindStudentCalendar();
  if (currentPage === "attendance") bindAttendanceRegister();
}

function renderAttendancePage() {
  if (!cachedCourses.length) {
    return '<section class="card"><h3>Attendance register</h3><p class="student-empty-state">No courses are assigned to this facilitator yet.</p></section>';
  }
  if (!attendanceCourseId || !cachedCourses.some(course => course.id === attendanceCourseId)) {
    const courseWithLearners = cachedCourses.find(course =>
      cachedUsers.some(learner => learner.role === "learner" && learner.selectedCourse === course.title)
    );
    attendanceCourseId = (courseWithLearners || cachedCourses[0]).id;
  }
  if (!attendanceDate) attendanceDate = localDateKey(new Date());
  const courseOptions = cachedCourses.map(course =>
    `<option value="${escapeHTML(course.id)}"${course.id === attendanceCourseId ? " selected" : ""}>${escapeHTML(course.code)} · ${escapeHTML(course.title)}</option>`
  ).join("");
  return `<section class="card attendance-card">
    <div class="attendance-heading"><div><h3>Attendance register</h3><p>Mark learners present or absent for a course session.</p></div><div class="attendance-filters">
      <label>Course<select id="attendance-course">${courseOptions}</select></label>
      <label>Session date<input id="attendance-date" type="date" value="${escapeHTML(attendanceDate)}" required /></label>
    </div></div>
    <div id="attendance-register-body" aria-live="polite"><p class="student-empty-state">Loading enrolled learners…</p></div>
    <div class="attendance-submit-row"><span class="attendance-legend"><i class="attendance-present-dot"></i>Present <i class="attendance-absent-dot"></i>Absent</span><button type="submit" class="btn btn-primary" form="attendance-register-form" disabled>Save attendance</button></div>
    <form id="attendance-register-form" class="attendance-hidden-form"></form>
  </section>`;
}

function attendanceStorageKey(courseId, date) {
  return `chimera_attendance_${currentUser.id}_${courseId}_${date}`;
}

function getOfflineAttendanceRegister(courseId, date) {
  const key = attendanceStorageKey(courseId, date);
  let records = [];
  try {
    records = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(records)) records = [];
  } catch (error) {
    console.error("Could not read saved offline attendance", error);
    showToast("Could not load locally saved attendance");
  }
  const learners = getOfflineUsers()
    .filter(user => user.role === "learner" && user.status !== "Inactive" && (!user.selectedCourse || cachedCourses.some(course => course.id === courseId && course.title === user.selectedCourse)))
    .map(user => ({ id: user.id, name: user.name, email: user.email }));
  return { courseId, date, learners, records };
}

async function loadAttendanceRegister() {
  const root = document.getElementById("attendance-register-body");
  if (!root) return;
  const courseId = attendanceCourseId;
  const date = attendanceDate;
  attendanceRegister = { courseId, date, learners: [], records: [] };
  const saveButton = document.querySelector('.attendance-submit-row button[type="submit"]');
  if (saveButton) saveButton.disabled = true;
  if (!date) {
    root.innerHTML = '<p class="student-empty-state" role="alert">Choose a session date to load attendance.</p>';
    return;
  }
  root.innerHTML = '<p class="student-empty-state">Loading enrolled learners…</p>';
  try {
    const result = await api(`/attendance?courseId=${encodeURIComponent(courseId)}&date=${encodeURIComponent(date)}`);
    if (courseId !== attendanceCourseId || date !== attendanceDate) return;
    attendanceRegister = result || getOfflineAttendanceRegister(courseId, date);
    renderAttendanceRows();
  } catch (error) {
    if (courseId !== attendanceCourseId || date !== attendanceDate) return;
    root.innerHTML = `<p class="student-empty-state" role="alert">${escapeHTML(error.message || "Could not load the attendance register.")}</p>`;
  }
}

function renderAttendanceRows() {
  const root = document.getElementById("attendance-register-body");
  if (!root) return;
  if (!attendanceRegister.learners.length) {
    root.innerHTML = '<p class="student-empty-state">No learners are enrolled in this course yet.</p>';
    return;
  }
  const statuses = new Map(attendanceRegister.records.map(record => [record.userId, record.status]));
  root.innerHTML = `<div class="attendance-toolbar"><span>${attendanceRegister.learners.length} enrolled learner${attendanceRegister.learners.length === 1 ? "" : "s"}</span><div><button type="button" class="attendance-bulk-button" data-attendance-bulk="present">Mark all present</button><button type="button" class="attendance-bulk-button" data-attendance-bulk="absent">Mark all absent</button></div></div>
    <div class="table-wrap"><table class="attendance-table"><thead><tr><th>Learner</th><th>Email</th><th>Attendance</th></tr></thead><tbody>${attendanceRegister.learners.map(learner => {
      const status = statuses.get(learner.id);
      return `<tr><td>${escapeHTML(learner.name)}</td><td>${escapeHTML(learner.email)}</td><td><div class="attendance-choice" role="group" aria-label="Attendance for ${escapeHTML(learner.name)}">
        <button type="button" class="attendance-status-button is-present${status === "present" ? " is-selected" : ""}" data-attendance-learner="${escapeHTML(learner.id)}" data-attendance-status="present" aria-pressed="${status === "present"}">Present</button>
        <button type="button" class="attendance-status-button is-absent${status === "absent" ? " is-selected" : ""}" data-attendance-learner="${escapeHTML(learner.id)}" data-attendance-status="absent" aria-pressed="${status === "absent"}">Absent</button>
      </div></td></tr>`;
    }).join("")}</tbody></table></div>`;
  const saveButton = document.querySelector('.attendance-submit-row button[type="submit"]');
  if (saveButton) {
    const canSave = Boolean(attendanceRegister.learners.length) && attendanceRegister.learners.every(learner =>
      statuses.has(learner.id) && ["present", "absent"].includes(statuses.get(learner.id))
    );
    saveButton.disabled = !canSave;
  }
  bindAttendanceRowButtons();
}

function setAttendanceStatus(userId, status) {
  const records = attendanceRegister.records.filter(record => record.userId !== userId);
  records.push({ userId, status });
  attendanceRegister.records = records;
  renderAttendanceRows();
}

function bindAttendanceRowButtons() {
  document.querySelectorAll("[data-attendance-learner]").forEach(button => {
    button.addEventListener("click", () => setAttendanceStatus(button.dataset.attendanceLearner, button.dataset.attendanceStatus));
  });
  document.querySelectorAll("[data-attendance-bulk]").forEach(button => {
    button.addEventListener("click", () => {
      attendanceRegister.records = attendanceRegister.learners.map(learner => ({
        userId: learner.id,
        status: button.dataset.attendanceBulk
      }));
      renderAttendanceRows();
    });
  });
}

function bindAttendanceRegister() {
  const courseSelect = document.getElementById("attendance-course");
  const dateInput = document.getElementById("attendance-date");
  const form = document.getElementById("attendance-register-form");
  if (!courseSelect || !dateInput || !form) return;
  courseSelect.addEventListener("change", () => {
    attendanceCourseId = courseSelect.value;
    loadAttendanceRegister();
  });
  dateInput.addEventListener("change", () => {
    attendanceDate = dateInput.value;
    loadAttendanceRegister();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (attendanceRegister.learners.some(learner => !attendanceRegister.records.some(record => record.userId === learner.id && ["present", "absent"].includes(record.status)))) {
      showToast("Mark every learner present or absent before saving");
      return;
    }
    try {
      const result = await api("/attendance", {
        method: "POST",
        body: JSON.stringify({
          courseId: attendanceCourseId,
          date: attendanceDate,
          records: attendanceRegister.records.map(({ userId, status }) => ({ userId, status }))
        })
      });
      if (result) {
        attendanceRegister = result;
        showToast("Attendance register saved");
      } else {
        localStorage.setItem(attendanceStorageKey(attendanceCourseId, attendanceDate), JSON.stringify(attendanceRegister.records));
        showToast("Attendance saved on this device (offline)");
      }
      renderAttendanceRows();
    } catch (error) {
      showToast(error.message || "Could not save attendance");
    }
  });
  loadAttendanceRegister();
}

let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = localDateKey(new Date());

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function assignmentDueKey(assignment) {
  return /^\d{4}-\d{2}-\d{2}/.test(assignment.due || "") ? assignment.due.slice(0, 10) : "";
}

function formattedDate(value, options = { weekday: "short", month: "short", day: "numeric" }) {
  const date = parseDateKey(value);
  return date ? date.toLocaleDateString(undefined, options) : "Date to be confirmed";
}

function learnerActiveCourses() {
  return cachedCourses.filter(course => course.status !== "completed");
}

function learnerUpcomingAssignments() {
  const todayKey = localDateKey(new Date());
  return cachedAssignments
    .filter(assignment => assignment.status !== "completed" && assignmentDueKey(assignment) >= todayKey && assignmentDueKey(assignment))
    .sort((a, b) => assignmentDueKey(a).localeCompare(assignmentDueKey(b)));
}

function renderStudentCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const todayKey = localDateKey(new Date());
  const monthStart = new Date(year, month, 1);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const monthLength = new Date(year, month + 1, 0).getDate();
  const assignmentsByDate = cachedAssignments.reduce((grouped, assignment) => {
    const key = assignmentDueKey(assignment);
    if (key && assignment.status !== "completed") (grouped[key] ||= []).push(assignment);
    return grouped;
  }, {});
  const cells = [];
  for (let index = 0; index < 42; index++) {
    const day = index - leadingDays + 1;
    if (day < 1 || day > monthLength) {
      cells.push('<span class="calendar-empty" aria-hidden="true"></span>');
      continue;
    }
    const dateKey = localDateKey(new Date(year, month, day));
    const hasAssignments = Boolean(assignmentsByDate[dateKey]);
    const classes = ["calendar-day", dateKey === todayKey ? "is-today" : "", dateKey === selectedCalendarDate ? "is-selected" : "", hasAssignments ? "has-assignments" : ""].filter(Boolean).join(" ");
    cells.push(`<button type="button" class="${classes}" data-calendar-date="${dateKey}" aria-label="${formattedDate(dateKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${hasAssignments ? ", assignment due" : ""}">${day}${hasAssignments ? '<i aria-hidden="true"></i>' : ""}</button>`);
  }
  const selectedAssignments = assignmentsByDate[selectedCalendarDate] || [];
  return `<section class="student-calendar-card" aria-label="Student calendar">
    <div class="student-calendar-header"><div><p class="student-panel-eyebrow">YOUR SCHEDULE</p><h2>${calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div><div class="calendar-controls"><button type="button" data-calendar-shift="-1" aria-label="Previous month">‹</button><button type="button" data-calendar-shift="1" aria-label="Next month">›</button></div></div>
    <div class="calendar-weekdays" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
    <div class="calendar-days">${cells.join("")}</div>
    <div class="calendar-selected"><h3>${selectedCalendarDate === todayKey ? "Today" : formattedDate(selectedCalendarDate, { weekday: "long", month: "long", day: "numeric" })}</h3>${selectedAssignments.length ? selectedAssignments.map(assignment => `<p><span class="calendar-event-dot"></span><span><strong>${escapeHTML(assignment.title)}</strong><small>${escapeHTML(assignment.course)} · due ${formattedDate(assignmentDueKey(assignment), { month: "short", day: "numeric" })}</small></span></p>`).join("") : '<p class="calendar-no-events">No assignments due on this date.</p>'}</div>
  </section>`;
}

function bindStudentCalendar() {
  const calendarRoot = document.getElementById("student-calendar");
  if (!calendarRoot) return;
  const draw = () => {
    calendarRoot.innerHTML = renderStudentCalendar();
    calendarRoot.querySelectorAll("[data-calendar-shift]").forEach(button => {
      button.addEventListener("click", () => {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(button.dataset.calendarShift), 1);
        const selected = parseDateKey(selectedCalendarDate);
        if (!selected || selected.getFullYear() !== calendarMonth.getFullYear() || selected.getMonth() !== calendarMonth.getMonth()) {
          selectedCalendarDate = localDateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
        }
        draw();
      });
    });
    calendarRoot.querySelectorAll("[data-calendar-date]").forEach(button => {
      button.addEventListener("click", () => {
        selectedCalendarDate = button.dataset.calendarDate;
        draw();
      });
    });
  };
  draw();
}

function renderLearnerDashboard() {
  const courses = learnerActiveCourses();
  const upcoming = learnerUpcomingAssignments();
  const todayKey = localDateKey(new Date());
  const overdue = cachedAssignments.filter(assignment => assignment.status !== "completed" && assignmentDueKey(assignment) && assignmentDueKey(assignment) < todayKey);
  const progress = courses.length ? Math.round(courses.reduce((sum, course) => sum + Math.max(0, Math.min(100, Number(course.progress) || 0)), 0) / courses.length) : 0;
  const firstName = escapeHTML((currentUser.name || "Learner").trim().split(/\s+/)[0]);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const courseCards = courses.length ? courses.slice(0, 4).map(course => {
    const courseProgress = Math.max(0, Math.min(100, Number(course.progress) || 0));
    const moduleCount = Object.values(course.modules || {}).reduce((total, modules) => total + modules.length, 0);
    return `<article class="student-course-card"><div class="student-course-top"><span class="student-course-code">${escapeHTML(course.code || "COURSE")}</span><span class="student-course-status">Registered programme</span></div><h3>${escapeHTML(course.title)}</h3><p>${escapeHTML(course.instructor || "Chimera Learning")}</p><div class="student-course-progress"><div class="student-progress-track"><span style="width:${courseProgress}%"></span></div><small>${courseProgress}% complete</small></div>${renderProgrammeModules(course, false, `View programme modules · ${moduleCount}`)}</article>`;
  }).join("") : '<div class="student-empty-state">No registered programme is linked to this learner account yet. Once a programme is registered, its course and modules will appear here.</div>';
  const assignmentRows = upcoming.length ? upcoming.slice(0, 4).map(assignment => {
    const dueKey = assignmentDueKey(assignment);
    const daysUntil = Math.round((parseDateKey(dueKey) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000);
    const dueLabel = daysUntil === 0 ? "Due today" : daysUntil === 1 ? "Due tomorrow" : `Due ${formattedDate(dueKey)}`;
    return `<article class="student-assignment-row"><div class="assignment-date-chip"><strong>${parseDateKey(dueKey).getDate()}</strong><span>${parseDateKey(dueKey).toLocaleDateString(undefined, { month: "short" })}</span></div><div class="student-assignment-info"><h3>${escapeHTML(assignment.title)}</h3><p>${escapeHTML(assignment.course)} · ${escapeHTML(assignment.type || "Assignment")}</p><span class="assignment-due-label">${dueLabel}</span></div>${assignment.status === "pending" || assignment.status === "in-progress" ? `<button type="button" class="btn btn-sm btn-primary" data-submit-id="${escapeHTML(assignment.id)}">Submit ${/practical/i.test(assignment.type || "") ? "practical" : "assignment"}</button>` : ""}</article>`;
  }).join("") : '<div class="student-empty-state">You’re all caught up. No upcoming assignments.</div>';
  const notifications = [];
  if (currentUser.selectedCourse) notifications.push(`<li class="notification-item"><span class="notification-mark application-mark">✓</span><span><strong>Programme application received</strong><small>${escapeHTML(currentUser.selectedCourse)} is awaiting review.</small></span></li>`);
  overdue.slice(0, 2).forEach(assignment => notifications.push(`<li class="notification-item"><span class="notification-mark overdue-mark">!</span><span><strong>Assignment overdue</strong><small>${escapeHTML(assignment.title)} · ${formattedDate(assignmentDueKey(assignment), { month: "short", day: "numeric" })}</small></span></li>`));
  upcoming.slice(0, 2).forEach(assignment => notifications.push(`<li class="notification-item"><span class="notification-mark due-mark">•</span><span><strong>Upcoming deadline</strong><small>${escapeHTML(assignment.title)} · ${formattedDate(assignmentDueKey(assignment))}</small></span></li>`));
  const notificationMarkup = notifications.length ? notifications.slice(0, 4).join("") : '<li class="student-empty-state">No new notifications. You’re up to date.</li>';

  return `<div class="student-dashboard">
    <section class="student-welcome"><div><p class="student-panel-eyebrow">${today}</p><h1>Welcome to Chimera LMS, ${firstName}</h1><p>Keep learning, keep building. Here’s your study overview.</p></div><img class="welcome-banner-image" src="assets/chimera-welcome-banner.png" alt="Chimera Holdings" /></section>
    <section class="student-metrics" aria-label="Learning overview"><article class="student-metric-card overall-progress-card"><div class="progress-ring" style="--progress-value:${progress}"><span>${progress}%</span></div><div><p class="student-panel-eyebrow">OVERALL PROGRESS</p><h2>Your learning journey</h2><small>Average progress across current courses</small></div></article><article class="student-metric-card"><span class="metric-icon">▤</span><p class="student-panel-eyebrow">CURRENT COURSES</p><strong>${courses.length}</strong><small>Active courses</small></article><article class="student-metric-card"><span class="metric-icon">◷</span><p class="student-panel-eyebrow">UPCOMING ASSIGNMENTS</p><strong>${upcoming.length}</strong><small>Still to complete</small></article></section>
    <div class="student-dashboard-grid"><div class="student-dashboard-main"><section class="student-panel"><div class="student-panel-title"><div><p class="student-panel-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Current courses</h2></div><button type="button" class="student-text-link" data-dashboard-page="courses">All courses <span aria-hidden="true">→</span></button></div><div class="student-courses-grid">${courseCards}</div></section><section class="student-panel"><div class="student-panel-title"><div><p class="student-panel-eyebrow">WHAT’S NEXT</p><h2>Upcoming assignments</h2></div><button type="button" class="student-text-link" data-dashboard-page="assignments">All assignments <span aria-hidden="true">→</span></button></div><div class="student-assignment-list">${assignmentRows}</div></section></div><aside class="student-dashboard-side"><div id="student-calendar"></div><section class="student-panel notifications-panel"><div class="student-panel-title"><div><p class="student-panel-eyebrow">STAY ON TRACK</p><h2>Notifications</h2></div><span class="notification-count">${notifications.length}</span></div><ul class="notification-list">${notificationMarkup}</ul></section></aside></div>
  </div>`;
}

function renderDashboard(role) {
  if (role === "learner") {
    return renderLearnerDashboard();
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
      '<tr><td>Backend</td><td>Node.js HTTP Server</td><td><span class="status completed">Running</span></td></tr>' +
      '<tr><td>Auth</td><td>JWT HS256</td><td><span class="status completed">Active</span></td></tr>' +
      '<tr><td>Storage</td><td>data.json</td><td><span class="status completed">OK</span></td></tr>' +
      '</tbody></table></div></div>';
  }
  return '<div class="card"><h3>Welcome to Chimera LMS</h3><p style="color:var(--text-muted)">Limited public view. Sign in for full access.</p></div>';
}

function renderCourses(role) {
  let list = cachedCourses;
  if (role === "lecturer") list = cachedCourses.filter(c => c.instructor && c.instructor.includes("Chen"));
  if (role === "learner") {
    return list.length ? '<div class="registered-programme-list">' + list.map(course =>
      '<article class="registered-programme-card"><div class="registered-programme-heading"><div><span class="course-code">' + escapeHTML(course.code) + '</span><h3>' + escapeHTML(course.title) + '</h3><p>' + escapeHTML(course.instructor || "Chimera Learning") + '</p></div><span class="student-course-status">Registered</span></div>' +
      '<div class="student-course-progress"><div class="student-progress-track"><span style="width:' + Math.max(0, Math.min(100, Number(course.progress) || 0)) + '%"></span></div><small>' + Math.max(0, Math.min(100, Number(course.progress) || 0)) + '% complete</small></div>' + renderProgrammeModules(course, true, "Programme modules") + '</article>'
    ).join("") + '</div>' : '<div class="student-empty-state">No registered programme is linked to this learner account. When you register, only that programme and its modules will appear here.</div>';
  }
  return '<div class="course-grid">' + list.map(c =>
    '<div class="course-card"><div class="code">' + escapeHTML(c.code) + '</div><h4>' + escapeHTML(c.title) + '</h4>' +
    '<div class="meta">' + escapeHTML(c.instructor || "") + '</div><div class="meta">' + (c.students||0) + ' students</div></div>'
  ).join("") + '</div>';
}

function renderProgrammeModules(course, expanded = false, label = "View modules") {
  const groups = Object.entries(course.modules || {});
  if (!groups.length) return '<p class="student-empty-state">Module information will be added to this programme.</p>';
  return '<details class="programme-modules"' + (expanded ? ' open' : '') + '><summary>' + escapeHTML(label) + '</summary><div class="programme-module-groups">' + groups.map(([group, modules]) =>
    '<section class="programme-module-group"><h4>' + escapeHTML(group) + '</h4><ol>' + modules.map(module => '<li>' + escapeHTML(module) + '</li>').join("") + '</ol></section>'
  ).join("") + '</div></details>';
}

function renderLearningPaths() {
  const courses = learnerActiveCourses();
  return '<div class="card"><h3>Your learning paths</h3><p style="color:var(--text-muted)">Continue building skills through the courses in your Chimera LMS programme.</p>' +
    (courses.length ? '<div class="learning-path-list">' + courses.map(course => {
      const progress = Math.max(0, Math.min(100, Number(course.progress) || 0));
      return '<article class="learning-path-row"><div><span class="course-code">' + escapeHTML(course.code) + '</span><h4>' + escapeHTML(course.title) + '</h4><p>' + escapeHTML(course.instructor || "Chimera LMS course") + '</p></div><div class="learning-path-progress"><strong>' + progress + '%</strong><div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%"></div></div><small>Course progress</small></div></article>';
    }).join("") + '</div>' : '<div class="student-empty-state">No active courses are available in your learning path yet.</div>') + '</div>';
}

function renderPracticeTests() {
  const tests = cachedAssignments.filter(assignment => /quiz|test|exam|assessment/i.test((assignment.type || "") + " " + (assignment.title || "")));
  return '<div class="card"><h3>Practice tests</h3><p style="color:var(--text-muted)">Review quizzes, tests, and exam practice linked to your courses.</p>' +
    (tests.length ? '<div class="table-wrap"><table><thead><tr><th>Practice</th><th>Course</th><th>Due</th><th>Status</th></tr></thead><tbody>' + tests.map(test => '<tr><td>' + escapeHTML(test.title) + '</td><td>' + escapeHTML(test.course) + '</td><td>' + escapeHTML(test.due || "Date to be confirmed") + '</td><td><span class="status ' + escapeHTML(test.status) + '">' + escapeHTML(test.status) + '</span></td></tr>').join("") + '</tbody></table></div>' : '<div class="student-empty-state">There are no practice tests in your current assignments yet. Check back when your courses publish new activities.</div>') + '</div>';
}

function renderAchievements() {
  const completedAssignments = cachedAssignments.filter(assignment => assignment.status === "completed").length;
  const completedCourses = cachedCourses.filter(course => course.status === "completed").length;
  const highProgressCourses = cachedCourses.filter(course => Number(course.progress) >= 90).length;
  const milestones = [
    { title: "First steps", detail: "Submit your first course assignment", earned: completedAssignments > 0, icon: "✓" },
    { title: "Course finisher", detail: "Complete a course", earned: completedCourses > 0, icon: "◆" },
    { title: "Almost there", detail: "Reach 90% progress in a course", earned: highProgressCourses > 0, icon: "↗" }
  ];
  return '<div class="card"><h3>Achievements</h3><p style="color:var(--text-muted)">Milestones from your learning activity.</p><div class="achievement-grid">' + milestones.map(milestone => '<article class="achievement-card ' + (milestone.earned ? "is-earned" : "") + '"><span aria-hidden="true">' + milestone.icon + '</span><div><strong>' + milestone.title + '</strong><small>' + milestone.detail + '</small></div><em>' + (milestone.earned ? "Earned" : "In progress") + '</em></article>').join("") + '</div></div>';
}

function renderAssignments() {
  const rows = cachedAssignments.map(assignment => {
    const submissionType = /practical/i.test(assignment.type || "") ? "practical" : "assignment";
    const canSubmit = assignment.status === "pending" || assignment.status === "in-progress";
    return `<tr><td>${escapeHTML(assignment.title)}</td><td>${escapeHTML(assignment.course)}</td><td>${escapeHTML(assignment.due || "Date to be confirmed")}</td><td>${escapeHTML(assignment.type || "Assignment")}</td><td><span class="status ${escapeHTML(assignment.status)}">${escapeHTML(assignment.status)}</span></td><td>${assignment.grade != null ? `${escapeHTML(assignment.grade)}%` : "—"}</td><td>${canSubmit ? `<button type="button" class="btn btn-sm btn-primary" data-submit-id="${escapeHTML(assignment.id)}">Submit ${submissionType}</button>` : '<span class="student-course-status">Submitted</span>'}</td></tr>`;
  }).join("");
  return `<div class="card"><h3>My Assignments &amp; Practicals</h3><div class="table-wrap"><table><thead><tr><th>Title</th><th>Course</th><th>Due</th><th>Type</th><th>Status</th><th>Grade</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7">No assignments or practicals are available yet.</td></tr>'}</tbody></table></div></div>`;
}

function renderGrades() {
  return '<div class="card"><h3>Grades & Feedback</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Assignment</th><th>Course</th><th>Grade</th><th>Feedback</th></tr></thead><tbody>' +
    '<tr><td>Matrix Operations Project</td><td>MATH204</td><td><strong>88%</strong></td><td>Excellent work.</td></tr>' +
    '<tr><td>Python Basics Quiz</td><td>CS101</td><td><strong>95%</strong></td><td>Outstanding.</td></tr>' +
    '</tbody></table></div></div>';
}

function renderProgress() {
  const overall = cachedCourses.length ? Math.round(cachedCourses.reduce((sum, course) => sum + Math.max(0, Math.min(100, Number(course.progress) || 0)), 0) / cachedCourses.length) : 0;
  return '<div class="stats-grid">' +
    '<div class="stat-card"><div class="label">Overall Progress</div><div class="value">' + overall + '%</div>' +
    '<div class="progress-bar" style="margin-top:0.75rem"><div class="progress-fill" style="width:' + overall + '%"></div></div></div>' +
    '<div class="stat-card"><div class="label">Registered Programme</div><div class="value">' + cachedCourses.length + '</div></div>' +
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
      '<tr><td>' + escapeHTML(a.title) + '</td><td>' + escapeHTML(a.course) + '</td><td>' + escapeHTML(a.type || "Assignment") + '</td><td>' + escapeHTML(a.due || "Date to be confirmed") + '</td></tr>'
    ).join("") + (cachedAssignments.length ? "" : '<tr><td colspan="4">No assessments have been created yet.</td></tr>') + '</tbody></table></div></div>';
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

function renderSettings(role) {
  if (role === "learner") {
    return '<div class="card"><h3>Learning preferences</h3><p style="color:var(--text-muted)">Manage your learner profile and dashboard display preferences.</p><div class="settings-action-row"><div><strong>Personal information</strong><small>Review or update your learner profile details.</small></div><button type="button" class="btn btn-primary" id="edit-learner-profile">Edit profile</button></div><div class="settings-action-row"><div><strong>Dashboard theme</strong><small>Switch between light and dark appearance from the top bar.</small></div><span class="status completed">' + (document.body.classList.contains("light") ? "Light" : "Dark") + ' theme</span></div></div>';
  }
  return '<div class="card"><h3>System Settings</h3>' +
    '<div class="form-group"><label>Institution</label><input class="form-control" value="Chimera University" /></div>' +
    '<button class="btn btn-primary" onclick="showToast(\'Settings saved\')">Save</button></div>';
}

function openSubmitModal(assignmentId) {
  const assignment = cachedAssignments.find(a => a.id === assignmentId);
  if (!assignment) return;
  const isPractical = /practical/i.test(assignment.type || "");
  const submissionType = isPractical ? "practical" : "assignment";
  openModal(isPractical ? "Submit Practical" : "Submit Assignment",
    `<p style="margin-bottom:1rem;color:var(--text-muted)"><strong>${escapeHTML(assignment.title)}</strong><br>Course: ${escapeHTML(assignment.course)} · ${escapeHTML(assignment.type || "Assignment")}</p>` +
    '<div class="form-group"><label>Comments</label><textarea class="form-control" id="submit-comments"></textarea></div>' +
    '<div class="form-group"><label>File</label><div class="file-drop" id="file-drop"><div>📄 Click or drag file</div><div class="filename" id="file-name"></div></div>' +
    '<input type="file" id="file-input" style="display:none" /></div>',
    `<button class="btn btn-ghost" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-submit">Submit ${submissionType}</button>`
  );
  setupFileDrop();
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-submit").onclick = async () => {
    if (!selectedFile) { showToast("Select a file"); return; }
    const submitButton = document.getElementById("modal-submit");
    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast("Files must be smaller than 5 MB");
      return;
    }
    submitButton.disabled = true;
    try {
      const fileDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the selected file"));
        reader.readAsDataURL(selectedFile);
      });
      const fileContent = String(fileDataUrl).split(",")[1];
      const result = await api("/submissions", {
        method: "POST",
        body: JSON.stringify({
          assignmentId,
          comments: document.getElementById("submit-comments").value,
          filename: selectedFile.name,
          fileType: selectedFile.type || "application/octet-stream",
          fileContent
        })
      });
      if (result === null) {
        let offlineSubmissions;
        try {
          offlineSubmissions = JSON.parse(localStorage.getItem("chimera_offline_submissions") || "[]");
        } catch (error) {
          throw new Error("Could not read offline submissions stored on this device");
        }
        if (!Array.isArray(offlineSubmissions)) {
          throw new Error("Offline submissions stored on this device are invalid");
        }
        offlineSubmissions = offlineSubmissions.filter(submission =>
          submission.assignmentId !== assignmentId || submission.userId !== currentUser.id
        );
        offlineSubmissions.push({
          userId: currentUser.id,
          assignmentId,
          comments: document.getElementById("submit-comments").value,
          filename: selectedFile.name,
          fileType: selectedFile.type || "application/octet-stream",
          fileContent,
          submittedAt: new Date().toISOString()
        });
        localStorage.setItem("chimera_offline_submissions", JSON.stringify(offlineSubmissions));
        const savedAssignments = cachedAssignments.map(item =>
          item.id === assignmentId ? { ...item, status: "completed" } : item
        );
        localStorage.setItem("chimera_offline_assignments", JSON.stringify(savedAssignments));
        assignment.status = "completed";
        showToast(`${isPractical ? "Practical" : "Assignment"} recorded in offline mode on this device`);
      } else {
        assignment.status = "completed";
        showToast(`${isPractical ? "Practical" : "Assignment"} submitted successfully`);
      }
      closeModal();
      renderPage();
    } catch (error) {
      submitButton.disabled = false;
      showToast(error.message || `Could not submit the ${submissionType}`);
    }
  };
}

function openCreateAssessmentModal() {
  openModal("Create Assessment",
    '<div class="form-group"><label>Title</label><input class="form-control" id="assess-title" required /></div>' +
    '<div class="form-group"><label>Course</label><select class="form-control" id="assess-course">' +
    cachedCourses.map(c => '<option value="' + escapeHTML(c.code) + '">' + escapeHTML(c.code) + ' · ' + escapeHTML(c.title) + '</option>').join("") + '</select></div>' +
    '<div class="form-group"><label>Type</label><select class="form-control" id="assess-type"><option>Assignment</option><option>Practical</option><option>Quiz</option><option>Project</option></select></div>' +
    '<div class="form-group"><label>Due</label><input type="date" class="form-control" id="assess-due" /></div>',
    '<button class="btn btn-ghost" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-create">Create</button>'
  );
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-create").onclick = async () => {
    const title = document.getElementById("assess-title").value.trim();
    if (!title) { showToast("Enter a title"); return; }
    const assignmentDetails = {
      title,
      course: document.getElementById("assess-course").value,
      type: document.getElementById("assess-type").value,
      due: document.getElementById("assess-due").value
    };
    try {
      const result = await api("/assignments", { method: "POST", body: JSON.stringify(assignmentDetails) });
      if (result) {
        await loadData();
      } else {
        const course = cachedCourses.find(item => item.code === assignmentDetails.course);
        if (!course) { showToast("Choose a valid course"); return; }
        cachedAssignments.push({
          ...assignmentDetails,
          id: `offline-${Date.now()}`,
          courseId: course.id,
          status: "pending",
          grade: null
        });
        localStorage.setItem("chimera_offline_assignments", JSON.stringify(cachedAssignments));
      }
      closeModal();
      showToast(`Assessment "${title}" created`);
      renderPage();
    } catch (error) {
      showToast(error.message || "Could not create the assessment");
    }
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
        await showApp("push");
      }
    } catch {
      localStorage.removeItem("chimera_token");
      authToken = null;
    }
  }
})();
