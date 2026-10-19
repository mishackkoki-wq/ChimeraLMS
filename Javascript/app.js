// ==================== CHIMERA LMS (Full-Stack Frontend) ====================
// The Node server hosts both the frontend and API; file:// previews use the local API.

// The API is hosted by Node on port 5000. When the frontend is opened through
// the optional Python preview server (for example, port 8080), use Node's API
// origin instead of sending API calls to the static file server.
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
const API_ORIGIN = location.protocol === "file:" || (isLocalHost && location.port !== "5000")
  ? "http://127.0.0.1:5000"
  : location.origin;
const API = `${API_ORIGIN}/api`;

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
const notificationsButton = document.getElementById("notifications-button");
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
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const emailConfirm = document.getElementById("reg-email-confirm").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;
    const identityNumber = document.getElementById("reg-id-number").value.trim();
    const passportNumber = document.getElementById("reg-passport").value.trim();

    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
      showToast("Username must be 3–30 letters, numbers, dots, underscores, or hyphens");
      document.getElementById("reg-username").focus();
      return;
    }
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
    if (password.length < 8) {
      showToast("Use a password with at least 8 characters");
      return;
    }

    const submitButton = document.getElementById("register-submit");
    submitButton.disabled = true;
    submitButton.classList.add("is-submitting");
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name, firstName, surname, username, email, emailConfirm, password, passwordConfirm: confirm,
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
    { id: "dashboard", label: "Analytics", icon: "◫" },
    { id: "courses", label: "My Courses", icon: "▤" },
    { id: "content", label: "Content Management", icon: "▧" },
    { id: "students", label: "Student Management", icon: "♙" },
    { id: "assessments", label: "Assessments & Grading", icon: "✓" },
    { id: "communication", label: "Communication", icon: "✉" },
    { id: "schedule", label: "Schedule & Calendar", icon: "▦" },
    { id: "settings", label: "Admin & Settings", icon: "⚙" }
  ],
  admin: [
    { id: "dashboard", label: "Overview", icon: "◫" },
    { id: "users", label: "User Management", icon: "♙" },
    { id: "courses", label: "Course & Academic", icon: "▤" },
    { id: "content", label: "Content Approval", icon: "▧" },
    { id: "assessments", label: "Assessments & Grades", icon: "✓" },
    { id: "admissions", label: "Admissions & Enrolment", icon: "⇥" },
    { id: "attendance", label: "Attendance & Discipline", icon: "◷" },
    { id: "communication", label: "Communication Center", icon: "✉" },
    { id: "reports", label: "Reports & Analytics", icon: "⌁" },
    { id: "settings", label: "Settings & Security", icon: "⚙" }
  ],
  guest: [
    { id: "dashboard", label: "Public Info", icon: "ℹ️" },
    { id: "courses", label: "Available Courses", icon: "📚" }
  ]
};

function initTheme() {
  const savedTheme = localStorage.getItem("chimera-theme");
  document.body.classList.toggle("light", savedTheme !== "dark");
}
notificationsButton.addEventListener("click", () => {
  if (currentUser?.role === "learner") {
    if (currentPage !== "dashboard") { currentPage = "dashboard"; renderPage(); }
    document.getElementById("learner-notifications")?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (currentUser?.role === "admin") {
    showToast("You’re all caught up.");
  } else {
    showToast("Notifications are available in the learner dashboard.");
  }
});
document.getElementById("messages-button").addEventListener("click", () => showToast("You have no new messages."));

document.getElementById("global-search").addEventListener("submit", event => {
  event.preventDefault();
  const query = document.getElementById("global-search-input").value.trim().toLowerCase();
  if (!query) return;
  const destination = (navItems[currentUser?.role] || []).find(item => item.label.toLowerCase().includes(query));
  if (!destination) {
    showToast("No matching dashboard section found.");
    return;
  }
  currentPage = destination.id;
  renderNav();
  renderPage();
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

document.getElementById("forgot-password-link").addEventListener("click", event => {
  event.preventDefault();
  const knownEmail = document.getElementById("username").value.trim();
  openModal("Reset your password", `
    <p class="profile-intro">Enter the email and recovery answer you used when registering.</p>
    <form id="password-recovery-form" class="profile-form">
      <label class="profile-field"><span>Email address</span><input class="form-control" type="email" name="email" autocomplete="email" required value="${escapeHTML(knownEmail.includes("@") ? knownEmail : "")}" /></label>
      <label class="profile-field"><span>Recovery answer</span><input class="form-control" type="text" name="recoveryAnswer" autocomplete="off" required /></label>
      <label class="profile-field"><span>New password</span><input class="form-control" type="password" name="password" minlength="8" autocomplete="new-password" required /></label>
    </form>`,
    '<button class="btn btn-ghost" id="recovery-cancel" type="button">Cancel</button><button class="btn btn-primary" id="recovery-submit" type="submit" form="password-recovery-form">Update password</button>'
  );
  document.getElementById("recovery-cancel").onclick = closeModal;
  document.getElementById("password-recovery-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = document.getElementById("recovery-submit");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    button.disabled = true;
    try {
      const result = await api("/auth/recover", { method: "POST", body: JSON.stringify(values) });
      if (!result) throw new Error("Unable to connect to the LMS. Please try again when the server is available.");
      closeModal();
      showToast("Password updated. You can now sign in.");
    } catch (error) {
      showToast(error.message || "Could not reset your password");
      button.disabled = false;
    }
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("login-role").value;
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, role })
    });
    if (!data || !data.token || !data.user) {
      throw new Error("Unable to connect to the LMS. Please try again when the server is available.");
    }
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem("chimera_token", authToken);
    currentPage = "dashboard";
    await showApp();
    showToast("Welcome, " + currentUser.name + "!");
  } catch (err) {
    showToast(err.message || "Login failed");
  } finally {
    submitButton.disabled = false;
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
      <label class="profile-field profile-picture-field"><span>Profile picture</span><input class="form-control" type="file" name="profilePicture" accept="image/png,image/jpeg,image/gif,image/webp" /><small>PNG, JPG, GIF, or WebP. Maximum 2 MB.</small></label>
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
    const picture = formData.get("profilePicture");
    delete updates.profilePicture;
    const saveButton = document.getElementById("profile-save");
    saveButton.disabled = true;
    try {
      if (picture && picture.size) {
        if (!picture.type.match(/^image\/(png|jpeg|gif|webp)$/) || picture.size > 2 * 1024 * 1024) {
          throw new Error("Choose a PNG, JPG, GIF, or WebP image smaller than 2 MB");
        }
        updates.profileImage = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read that image"));
          reader.readAsDataURL(picture);
        });
      }
      const savedProfile = await api("/me", { method: "PATCH", body: JSON.stringify(updates) });
      if (!savedProfile) throw new Error("Unable to connect to the LMS. Please try again when the server is available.");
      currentUser = { ...currentUser, ...updates, ...(savedProfile || {}) };
      currentUser.avatar = currentUser.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      document.getElementById("user-name").textContent = currentUser.name;
      updateAvatar(document.getElementById("user-avatar"), currentUser);
      updateHeaderProfile(displayRoleName(currentUser.role), currentUser);
      closeModal();
      showToast("Profile updated successfully");
      if (currentPage === "dashboard") renderPage();
    } catch (error) {
      showToast(error.message || "Could not update your profile");
      saveButton.disabled = false;
    }
  });
}

function updateAvatar(element, user) {
  if (!element) return;
  element.replaceChildren();
  if (user.profileImage) {
    const image = document.createElement("img");
    image.src = user.profileImage;
    image.alt = "";
    element.appendChild(image);
  } else {
    element.textContent = user.avatar || (user.name || "U").slice(0, 2).toUpperCase();
  }
}

function displayRoleName(role) {
  return role === "lecturer" ? "Facilitator" : role.charAt(0).toUpperCase() + role.slice(1);
}

function updateHeaderProfile(roleName, user) {
  const avatar = document.getElementById("profile-avatar-mini");
  const label = document.getElementById("role-badge");
  if (user.role === "learner" && user.profileImage) {
    avatar.hidden = true;
    label.replaceChildren();
    const image = document.createElement("img");
    image.className = "role-profile-image";
    image.src = user.profileImage;
    image.alt = `${user.name || "Learner"} profile picture`;
    label.appendChild(image);
    label.setAttribute("aria-label", "Learner profile picture");
  } else {
    avatar.hidden = false;
    updateAvatar(avatar, user);
    label.textContent = roleName;
    label.removeAttribute("aria-label");
  }
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
  appScreen.dataset.role = currentUser.role;
  const displayRole = displayRoleName(currentUser.role);
  document.getElementById("user-role").textContent = displayRole;
  updateAvatar(document.getElementById("user-avatar"), currentUser);
  updateHeaderProfile(displayRole, currentUser);
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
    dashboard: "Dashboard", courses: "Courses", assignments: "Assignments", content: "Content Management", students: "Student Management", communication: "Communication",
    grades: "Grades & Feedback", progress: "Progress Analytics", assessments: "Assessments",
    "learning-paths": "Learning Paths", "practice-tests": "Practice Tests", schedule: "Calendar", achievements: "Achievements",
    attendance: "Attendance Register", grading: "Grading Queue", reports: "Reports", users: "User Management",
    security: "Security & Audit Logs", settings: "System Settings"
  };
  pageTitle.textContent = currentUser.role === "admin" ? ({ dashboard: "Overview", users: "User Management", courses: "Course & Academic Management", content: "Content Approval", assessments: "Assessments & Grades", admissions: "Admissions & Enrolment", attendance: "Attendance & Discipline", communication: "Communication Center", reports: "Reports & Analytics", settings: "Settings & Security" }[currentPage] || "Admin Dashboard") : currentPage === "dashboard" && currentUser.role === "lecturer" ? "Analytics Dashboard" : currentPage === "dashboard" && currentUser.role === "learner" ? "Dashboard Home" : (titles[currentPage] || "Dashboard");
  appScreen.dataset.page = currentPage;
  const role = currentUser.role;
  const map = {
    dashboard: () => renderDashboard(role),
    courses: () => renderCourses(role),
    content: () => role === "lecturer" ? renderLecturerSection("content") : "",
    students: () => role === "lecturer" ? renderLecturerSection("students") : "",
    communication: () => role === "lecturer" ? renderLecturerSection("communication") : "",
    assignments: () => renderAssignments(),
    grades: () => renderGrades(),
    progress: () => renderProgress(),
    "learning-paths": () => renderLearningPaths(),
    "practice-tests": () => renderPracticeTests(),
    schedule: () => role === "lecturer" ? renderLecturerSection("schedule") : '<div id="student-calendar"></div>',
    attendance: () => renderAttendancePage(),
    achievements: () => renderAchievements(),
    assessments: () => renderAssessments(),
    grading: () => renderGrading(),
    reports: () => renderReports(role),
    users: () => renderUsers(),
    security: () => renderSecurity(),
    settings: () => renderSettings(role),
    admissions: () => renderAdminSection("admissions")
  };
  contentArea.innerHTML = role === "admin" && currentPage !== "dashboard" ? renderAdminSection(currentPage) : (map[currentPage] || (() => '<div class="empty-state"><p>Page under construction</p></div>'))();
  attachPageListeners();
}

function attachPageListeners() {
  document.querySelectorAll("[data-lecturer-page]").forEach(button => button.addEventListener("click", () => { currentPage = button.dataset.lecturerPage; renderNav(); renderPage(); }));
  document.querySelectorAll("[data-lecturer-toast]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.lecturerToast)));
  const rosterSearch = document.querySelector(".roster-search");
  if (rosterSearch) rosterSearch.addEventListener("input", () => document.querySelectorAll(".roster-list article").forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(rosterSearch.value.toLowerCase()); }));
  document.querySelectorAll("[data-admin-toast]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.adminToast)));
  document.querySelectorAll("[data-admin-page]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    currentPage = button.dataset.adminPage;
    renderNav();
    renderPage();
  }));
  document.querySelectorAll("[data-admin-action]").forEach(button => button.addEventListener("click", () => openAdminAction(button.dataset.adminAction)));
  document.querySelectorAll(".admin-table-search").forEach(input => input.addEventListener("input", () => {
    const table = input.closest(".admin-panel")?.querySelector("tbody");
    if (!table) return;
    const query = input.value.trim().toLowerCase();
    table.querySelectorAll("tr").forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); });
  }));
  const selectAllUsers = document.querySelector(".admin-select-all");
  if (selectAllUsers) selectAllUsers.addEventListener("change", () => document.querySelectorAll(".admin-users-table tbody input[type=checkbox]").forEach(box => { box.checked = selectAllUsers.checked; }));
  const broadcastForm = document.getElementById("admin-broadcast-form");
  if (broadcastForm) broadcastForm.addEventListener("submit", event => {
    event.preventDefault();
    const subject = broadcastForm.querySelector('input[placeholder^="e.g."]')?.value.trim();
    if (subject) openAdminAction(`Send announcement · ${subject}`);
  });
  const editLearnerProfile = document.getElementById("edit-learner-profile");
  if (editLearnerProfile) editLearnerProfile.addEventListener("click", openLearnerProfile);
  document.querySelectorAll("[data-submit-id]").forEach(btn => {
    btn.addEventListener("click", () => openSubmitModal(btn.dataset.submitId));
  });
  document.querySelectorAll("[data-module-toggle]").forEach(button => button.addEventListener("click", async () => {
    const courseId = button.dataset.courseId;
    const group = button.dataset.moduleGroup;
    const moduleIndex = Number(button.dataset.moduleIndex);
    const wasCompleted = currentUser.moduleProgress?.[courseId]?.[group]?.[moduleIndex] === true;
    const completed = !wasCompleted;
    button.disabled = true;
    setModuleCompletion(courseId, group, moduleIndex, completed);
    syncProgrammeModuleUI(courseId);
    try {
      const result = await api("/modules/progress", {
        method: "PATCH",
        body: JSON.stringify({ courseId, group, moduleIndex, completed })
      });
      if (!result) throw new Error("Could not save module progress. Check your server connection.");
      currentUser.moduleProgress = result.moduleProgress;
      syncProgrammeModuleUI(courseId);
    } catch (error) {
      setModuleCompletion(courseId, group, moduleIndex, wasCompleted);
      syncProgrammeModuleUI(courseId);
      showToast(error.message || "Could not save module progress");
    } finally {
      button.disabled = false;
    }
  }));
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

function openAdminAction(action) {
  const isGradeOverride = /override grade/i.test(action);
  const isDestructive = /delete|suspend|ban|reject|lock results|restore/i.test(action);
  const prompt = isGradeOverride
    ? '<p class="admin-modal-copy">Enter the approved grade and a reason. The reason will be attached to the audit record.</p><label class="admin-form-field">New grade (%)<input id="admin-action-grade" type="number" min="0" max="100" required /></label><label class="admin-form-field">Reason<textarea id="admin-action-reason" required rows="3" placeholder="Explain why this grade change is required"></textarea></label>'
    : isDestructive
      ? `<p class="admin-modal-copy">This action affects live institutional records. Confirm to record your request in the administrator audit trail.</p><label class="admin-form-field">Reason<textarea id="admin-action-reason" required rows="3" placeholder="Reason for this action"></textarea></label>`
      : '<p class="admin-modal-copy">Continue with this administrative request? It will be added to the audit trail.</p>';
  openModal(isDestructive || isGradeOverride ? "Confirm sensitive action" : "Confirm admin action", `<div class="admin-action-modal"><span class="admin-modal-icon">${isDestructive || isGradeOverride ? "!" : "✓"}</span><div><strong>${escapeHTML(action)}</strong>${prompt}</div></div>`, '<button type="button" class="btn btn-ghost" id="admin-action-cancel">Cancel</button><button type="button" class="btn btn-primary" id="admin-action-confirm">Confirm request</button>');
  document.getElementById("admin-action-cancel").onclick = closeModal;
  document.getElementById("admin-action-confirm").onclick = async () => {
    const reason = document.getElementById("admin-action-reason")?.value.trim() || "";
    const grade = document.getElementById("admin-action-grade")?.value;
    if ((isDestructive || isGradeOverride) && !reason) { showToast("Add a reason before continuing"); return; }
    if (isGradeOverride && (grade === "" || Number(grade) < 0 || Number(grade) > 100)) { showToast("Enter a grade between 0 and 100"); return; }
    const detail = `${action}${isGradeOverride ? ` · ${grade}%` : ""}${reason ? ` · Reason: ${reason}` : ""}`;
    const button = document.getElementById("admin-action-confirm");
    button.disabled = true;
    button.textContent = "Recording…";
    try {
      const entry = await api("/audit", { method: "POST", body: JSON.stringify({ action: `Admin request: ${detail}` }) });
      if (entry) cachedAudit.unshift(entry);
      else cachedAudit.unshift({ time: new Date().toISOString(), user: currentUser.email, action: `Admin request: ${detail}`, status: "Local" });
      cachedAudit = cachedAudit.slice(0, 5000);
      closeModal();
      showToast("Request recorded in the admin audit trail");
      if (["dashboard", "settings", "reports"].includes(currentPage)) renderPage();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Confirm request";
      showToast(error.message || "Could not record the admin action");
    }
  };
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

function courseModuleStats(course) {
  const groups = Object.entries(course.modules || {});
  let total = 0;
  let completed = 0;
  groups.forEach(([group, modules]) => {
    total += modules.length;
    modules.forEach((_, index) => {
      if (currentUser?.moduleProgress?.[course.id]?.[group]?.[index] === true) completed++;
    });
  });
  return { total, completed, percent: total ? Math.round(completed / total * 100) : Math.max(0, Math.min(100, Number(course.progress) || 0)) };
}

function setModuleCompletion(courseId, group, moduleIndex, completed) {
  if (!currentUser.moduleProgress || typeof currentUser.moduleProgress !== "object") currentUser.moduleProgress = {};
  if (!currentUser.moduleProgress[courseId]) currentUser.moduleProgress[courseId] = {};
  if (!currentUser.moduleProgress[courseId][group]) currentUser.moduleProgress[courseId][group] = {};
  if (completed) currentUser.moduleProgress[courseId][group][moduleIndex] = true;
  else delete currentUser.moduleProgress[courseId][group][moduleIndex];
}

function syncProgrammeModuleUI(courseId) {
  const course = cachedCourses.find(item => item.id === courseId);
  if (!course) return;
  const stats = courseModuleStats(course);
  document.querySelectorAll(".student-course-card, .registered-programme-card").forEach(card => {
    if (card.dataset.courseCardId !== courseId) return;
    const track = card.querySelector(".student-progress-track span");
    const progressLabel = card.querySelector(".student-course-progress small");
    if (track) track.style.width = `${stats.percent}%`;
    if (progressLabel) progressLabel.textContent = stats.total ? `${stats.percent}% complete · ${stats.completed}/${stats.total} modules` : `${stats.percent}% complete`;
    const moduleSummary = card.querySelector(".programme-module-completion");
    if (moduleSummary) moduleSummary.textContent = `${stats.completed}/${stats.total} complete`;
    card.querySelectorAll("[data-module-toggle]").forEach(button => {
      const isCompleted = currentUser.moduleProgress?.[courseId]?.[button.dataset.moduleGroup]?.[button.dataset.moduleIndex] === true;
      button.dataset.completed = String(isCompleted);
      button.setAttribute("aria-pressed", String(isCompleted));
      button.classList.toggle("is-completed", isCompleted);
      button.querySelector(".module-check").textContent = isCompleted ? "✓" : "";
    });
  });
  const activeCourses = learnerActiveCourses();
  if (activeCourses.length) {
    const overall = Math.round(activeCourses.reduce((sum, item) => sum + courseModuleStats(item).percent, 0) / activeCourses.length);
    const ring = document.getElementById("learner-overall-progress");
    const value = document.getElementById("learner-overall-progress-value");
    if (ring) ring.style.setProperty("--progress-value", overall);
    if (value) value.textContent = `${overall}%`;
  }
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
  const progress = courses.length ? Math.round(courses.reduce((sum, course) => sum + courseModuleStats(course).percent, 0) / courses.length) : 0;
  const firstName = escapeHTML((currentUser.name || "Learner").trim().split(/\s+/)[0]);
  const dashboardAvatar = currentUser.profileImage
    ? `<img class="dashboard-profile-picture" src="${escapeHTML(currentUser.profileImage)}" alt="${escapeHTML(currentUser.name || "Learner")} profile picture" />`
    : `<div class="dashboard-profile-picture dashboard-profile-initials" aria-label="${escapeHTML(currentUser.name || "Learner")} profile">${escapeHTML(currentUser.avatar || (currentUser.name || "L").slice(0, 2).toUpperCase())}</div>`;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const courseCards = courses.length ? courses.map(course => {
    const courseStats = courseModuleStats(course);
    return `<article class="student-course-card" data-course-card-id="${escapeHTML(course.id)}"><div class="student-course-top"><span class="student-course-code">${escapeHTML(course.code || "COURSE")}</span><span class="student-course-status">Registered programme</span></div><h3>${escapeHTML(course.title)}</h3><p>${escapeHTML(course.instructor || "Chimera Learning")}</p><div class="student-course-progress"><div class="student-progress-track"><span style="width:${courseStats.percent}%"></span></div><small>${courseStats.percent}% complete${courseStats.total ? ` · ${courseStats.completed}/${courseStats.total} modules` : ""}</small></div>${renderProgrammeModules(course, false, "Programme modules")}</article>`;
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
    <section class="student-welcome"><div><p class="student-panel-eyebrow">${today}</p><h1>Welcome to Chimera LMS, ${firstName}</h1><p>Keep learning, keep building. Here’s your study overview.</p></div><div class="student-welcome-visual">${dashboardAvatar}<img class="welcome-banner-image" src="assets/chimera-welcome-banner.png" alt="Chimera Holdings" /></div></section>
    <section class="student-metrics" aria-label="Learning overview"><article class="student-metric-card overall-progress-card"><div class="progress-ring" id="learner-overall-progress" style="--progress-value:${progress}"><span id="learner-overall-progress-value">${progress}%</span></div><div><p class="student-panel-eyebrow">OVERALL PROGRESS</p><h2>Your learning journey</h2><small>Average progress across current courses</small></div></article><article class="student-metric-card"><span class="metric-icon">▤</span><p class="student-panel-eyebrow">CURRENT COURSES</p><strong>${courses.length}</strong><small>Active courses</small></article><article class="student-metric-card"><span class="metric-icon">◷</span><p class="student-panel-eyebrow">UPCOMING ASSIGNMENTS</p><strong>${upcoming.length}</strong><small>Still to complete</small></article></section>
    <div class="student-dashboard-grid"><div class="student-dashboard-main"><section class="student-panel"><div class="student-panel-title"><div><p class="student-panel-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Current courses</h2></div><button type="button" class="student-text-link" data-dashboard-page="courses">All courses <span aria-hidden="true">→</span></button></div><div class="student-courses-grid">${courseCards}</div></section><section class="student-panel"><div class="student-panel-title"><div><p class="student-panel-eyebrow">WHAT’S NEXT</p><h2>Upcoming assignments</h2></div><button type="button" class="student-text-link" data-dashboard-page="assignments">All assignments <span aria-hidden="true">→</span></button></div><div class="student-assignment-list">${assignmentRows}</div></section></div><aside class="student-dashboard-side"><div id="student-calendar"></div><section id="learner-notifications" class="student-panel notifications-panel"><div class="student-panel-title"><div><p class="student-panel-eyebrow">STAY ON TRACK</p><h2>Notifications</h2></div><span class="notification-count">${notifications.length}</span></div><ul class="notification-list">${notificationMarkup}</ul></section></aside></div>
  </div>`;
}

function renderDashboard(role) {
  if (role === "learner") {
    return renderLearnerDashboard();
  }
  if (role === "lecturer") {
    return renderLecturerDashboard();
  }
  if (role === "admin") {
    return renderAdminDashboard();
  }
  return '<div class="card"><h3>Welcome to Chimera LMS</h3><p style="color:var(--text-muted)">Limited public view. Sign in for full access.</p></div>';
}

function renderLecturerDashboard() {
  const courses = cachedCourses.filter(c => !c.instructor || c.instructor.includes("Chen")).slice(0, 3);
  const course = courses[0] || { code: "DATA210", title: "Data Analytics", students: 40, progress: 68 };
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const bars = [42, 58, 51, 73, 64, 84, 69].map((v, i) => `<i style="height:${v}%" title="Week ${i + 1}: ${v}%"></i>`).join("");
  return `<div class="lecturer-dashboard"><header class="lecturer-heading"><div><p class="lecturer-crumb">OVERVIEW <span>›</span> ANALYTICS</p><h1>Good morning, ${escapeHTML((currentUser.name || "Sarah").split(/\s+/)[0])} <span>✦</span></h1><p>Your teaching overview for ${today}.</p></div><button class="lecturer-period" data-lecturer-toast="Showing this semester">◷ &nbsp; This semester⌄</button></header>
  <section class="lecturer-kpis"><article><span class="lecturer-kpi-icon indigo">▤</span><div><small>Active courses</small><strong>${courses.length || 2}</strong><em>Across this semester</em></div><b>↗</b></article><article><span class="lecturer-kpi-icon teal">♙</span><div><small>Total students</small><strong>124</strong><em>Across all modules</em></div><b>↗</b></article><article><span class="lecturer-kpi-icon amber">◷</span><div><small>Pending grading</small><strong>18</strong><em class="alert-copy">Needs your attention</em></div><b>↗</b></article><article><span class="lecturer-kpi-icon green">✓</span><div><small>Average performance</small><strong>72<span>%</span></strong><em class="positive-copy">↑ 4.2% this month</em></div><b>↗</b></article></section>
  <div class="lecturer-main-grid"><div class="lecturer-column"><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">LEARNING PROGRESS</span><h2>Course completion</h2><p>Progress across your active modules</p></div><button data-lecturer-page="courses">All courses ↗</button></div><div class="completion-content"><div class="progress-ring" role="img" aria-label="68 percent course completion"><div><strong>68%</strong><small>completed</small></div></div><div class="completion-copy"><span class="course-chip">${escapeHTML(course.code || "DATA210")}</span><h3>${escapeHTML(course.title || "Data Analytics")}</h3><p>Module 3 · Data visualisation</p><div class="mini-progress"><span style="width:68%"></span></div><div class="completion-meta"><span>27 of 40 students completed</span><strong>68%</strong></div><button class="lecturer-link" data-lecturer-page="content">View learning content →</button></div></div></section>
  <section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">CLASS INSIGHTS</span><h2>Student performance</h2><p>Average scores across recent assessments</p></div><select aria-label="Select performance period"><option>Last 7 weeks</option><option>This semester</option></select></div><div class="performance-summary"><strong>72%</strong><span class="positive-copy">↑ 4.2%</span><small>class average</small></div><div class="bar-chart" aria-label="Weekly student performance chart">${bars}</div><div class="chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span><span>Week 5</span><span>Week 6</span><span>Week 7</span></div></section>
  <section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">TEACHING LOAD</span><h2>My courses</h2></div><button data-lecturer-page="courses">View all →</button></div><div class="lecturer-course-list">${(courses.length ? courses : [{code:"DATA210",title:"Data Analytics",students:40,progress:68},{code:"UXD202",title:"User Experience Design",students:36,progress:54}]).map(c=>`<article><span class="lecturer-course-icon">▤</span><div><strong>${escapeHTML(c.title)}</strong><small>${escapeHTML(c.code)} · ${Number(c.students)||40} students</small></div><div class="course-progress-line"><span style="width:${Number(c.progress)||68}%"></span></div><b>${Number(c.progress)||68}%</b><button aria-label="Open ${escapeHTML(c.title)}" data-lecturer-page="courses">→</button></article>`).join("")}</div></section></div>
  <aside class="lecturer-column lecturer-aside"><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">ASSESSMENT ACTIVITY</span><h2>Submission rate</h2></div></div><div class="submission-stat"><div class="submission-ring"><span>63%</span></div><div><strong>25 <small>/ 40 submitted</small></strong><p>Assignment 2 · Data Analysis</p><span class="submission-due">Due in 2 days</span></div></div><div class="submission-footer"><span>15 submissions remaining</span><button class="lecturer-link" data-lecturer-page="assessments">Review submissions →</button></div></section>
  <section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">STUDENT ENGAGEMENT</span><h2>Needs attention <span class="attention-count">3</span></h2><p>Haven’t logged in for 7 days</p></div><button data-lecturer-page="students">View all</button></div><ul class="engagement-list"><li><span class="student-initial">TM</span><div><strong>Thabo Mokoena</strong><small>DATA210 · Last seen 9 days ago</small></div><button aria-label="Message Thabo" data-lecturer-page="communication">↗</button></li><li><span class="student-initial coral">LN</span><div><strong>Lerato Ndlovu</strong><small>UXD202 · Last seen 8 days ago</small></div><button aria-label="Message Lerato" data-lecturer-page="communication">↗</button></li><li><span class="student-initial gold">PK</span><div><strong>Peter Khumalo</strong><small>DATA210 · Last seen 7 days ago</small></div><button aria-label="Message Peter" data-lecturer-page="communication">↗</button></li></ul><button class="lecturer-outline-btn" data-lecturer-page="students">Review at-risk students</button></section>
  <section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">ON YOUR CALENDAR</span><h2>Upcoming schedule</h2></div><button data-lecturer-page="schedule">Full calendar ↗</button></div><article class="schedule-item"><time><b>21</b><small>OCT</small></time><span class="schedule-dot"></span><div><strong>Data Analytics · Lecture</strong><small>09:00 – 10:30 · Room B204</small></div></article><article class="schedule-item"><time><b>22</b><small>OCT</small></time><span class="schedule-dot purple"></span><div><strong>Assignment 2 · Deadline</strong><small>23:59 · DATA210</small></div></article><article class="schedule-item"><time><b>24</b><small>OCT</small></time><span class="schedule-dot amber-dot"></span><div><strong>UX Design · Workshop</strong><small>11:00 – 12:30 · Lab 3</small></div></article></section></aside></div></div>`;
}

function renderLecturerSection(section) {
  if (section === "content") return `<div class="lecturer-dashboard"><div class="lecturer-heading"><div><p class="lecturer-crumb">TEACHING <span>›</span> CONTENT</p><h1>Content management</h1><p>Organise and publish materials for your courses.</p></div><button class="lecturer-action" id="upload-materials-btn">＋ Upload material</button></div><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">COURSE MATERIALS</span><h2>Learning resources</h2><p>Files, lecture recordings, and links</p></div><button data-lecturer-toast="Week added">＋ Add week</button></div><div class="lecturer-course-list"><article><span class="lecturer-course-icon">▣</span><div><strong>Week 3 · Data visualisation</strong><small>Slides · PDF · Published 14 Oct</small></div><span class="resource-state">Visible</span><button data-lecturer-toast="Resource options opened">•••</button></article><article><span class="lecturer-course-icon">▶</span><div><strong>Lecture recording · Chart selection</strong><small>Video · 28 min · Published 16 Oct</small></div><span class="resource-state">Visible</span><button data-lecturer-toast="Resource options opened">•••</button></article></div><div class="upload-dropzone"><strong>＋ &nbsp;Upload videos, PDFs, slides, or links</strong><small>Drag files here or choose from your device</small></div></section></div>`;
  if (section === "students") return `<div class="lecturer-dashboard"><div class="lecturer-heading"><div><p class="lecturer-crumb">TEACHING <span>›</span> STUDENTS</p><h1>Student management</h1><p>Track attendance, performance, and student engagement.</p></div><button class="lecturer-action" data-lecturer-toast="Student report exported">↓ Export roster</button></div><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">CLASS ROSTER</span><h2>Students <span class="attention-count">3 at risk</span></h2><p>124 students across 3 modules</p></div><input class="roster-search" type="search" placeholder="Search students…" aria-label="Search students"></div><div class="lecturer-course-list roster-list">${[["AM","Ayesha Mohamed","STU2024012","ayesha.m@learn.edu","88%"],["TM","Thabo Mokoena","STU2024038","thabo.m@learn.edu","42%"],["LN","Lerato Ndlovu","STU2024051","lerato.n@learn.edu","56%"],["PK","Peter Khumalo","STU2024064","peter.k@learn.edu","39%"]].map((s,i)=>`<article><span class="student-initial ${i===1?'coral':''}">${s[0]}</span><div><strong>${s[1]} ${i===1?'<em>At risk</em>':''}</strong><small>${s[2]} · ${s[3]}</small></div><span class="roster-grade">${s[4]}</span><select aria-label="Attendance for ${s[1]}"><option>Present</option><option>Absent</option><option>Late</option></select></article>`).join("")}</div></section></div>`;
  if (section === "communication") return `<div class="lecturer-dashboard"><div class="lecturer-heading"><div><p class="lecturer-crumb">TEACHING <span>›</span> COMMUNICATION</p><h1>Communication</h1><p>Keep your classes informed and respond to student questions.</p></div><button class="lecturer-action" data-lecturer-toast="Announcement composer opened">＋ New announcement</button></div><div class="lecturer-main-grid"><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">STUDENT QUESTIONS</span><h2>Q&amp;A inbox</h2></div><span class="attention-count">3 new</span></div>${[["KM","Kagiso Mthembu","Could you clarify the analysis brief?","DATA210 · 12 min ago"],["SN","Sibongile Nkosi","Is the quiz open book?","UXD202 · 1 hour ago"],["JB","James Botha","Request for assignment extension","DATA210 · Yesterday"]].map(x=>`<article class="question-row"><span class="student-initial">${x[0]}</span><div><strong>${x[1]}</strong><p>${x[2]}</p><small>${x[3]}</small></div><button class="lecturer-link" data-lecturer-toast="Reply composer opened">Reply</button></article>`).join("")}</section><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">RECENT UPDATE</span><h2>Announcements</h2></div></div><div class="announcement-card"><strong>Assignment 2 resources are live</strong><p>Posted to Data Analytics · Yesterday at 14:32</p><button class="lecturer-link" data-lecturer-toast="Announcement details opened">View announcement →</button></div></section></div></div>`;
  if (section === "schedule") return `<div class="lecturer-dashboard"><div class="lecturer-heading"><div><p class="lecturer-crumb">TEACHING <span>›</span> CALENDAR</p><h1>Schedule &amp; calendar</h1><p>Lectures, deadlines, and marking due dates.</p></div><button class="lecturer-action" data-lecturer-toast="Office hours booking is now open">＋ Set office hours</button></div><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">OCTOBER 2026</span><h2>This week</h2></div><button data-lecturer-toast="Calendar reminders are enabled">Reminders on</button></div><div class="calendar-week">${[19,20,21,22,23,24,25].map((d,i)=>`<article class="${i===2?'today':''}"><small>${['MON','TUE','WED','THU','FRI','SAT','SUN'][i]}</small><strong>${d}</strong>${i===2?'<span>Lecture<br>09:00</span>':''}${i===3?'<span class="calendar-deadline">Assignment due</span>':''}</article>`).join("")}</div></section><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">UP NEXT</span><h2>Upcoming events</h2></div></div><article class="schedule-item"><time><b>21</b><small>OCT</small></time><span class="schedule-dot"></span><div><strong>Data Analytics · Lecture</strong><small>09:00 – 10:30 · Room B204</small></div></article><article class="schedule-item"><time><b>22</b><small>OCT</small></time><span class="schedule-dot purple"></span><div><strong>Assignment 2 · Deadline</strong><small>23:59 · DATA210</small></div></article></section></div>`;
  return `<div class="lecturer-dashboard"><div class="lecturer-heading"><div><p class="lecturer-crumb">TEACHING <span>›</span> ASSESSMENTS</p><h1>Assessments &amp; grading</h1><p>Create assessments, review submissions, and release feedback.</p></div><button class="lecturer-action" id="create-assessment-btn">＋ Create assessment</button></div><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">GRADEBOOK</span><h2>Recent assessments</h2><p>25 of 40 submissions received for Assignment 2</p></div><button data-lecturer-toast="Gradebook exported as a CSV file">↓ Export gradebook</button></div><div class="lecturer-course-list"><article><span class="lecturer-course-icon">A</span><div><strong>Assignment 2 · Data Analysis</strong><small>DATA210 · Due 22 Oct · 40 marks · 2 attempts</small></div><span class="resource-state">25 / 40 submitted</span><button data-lecturer-toast="Submissions opened">Review →</button></article><article><span class="lecturer-course-icon">Q</span><div><strong>Quiz 1 · Research methods</strong><small>UXD202 · Released 12 Oct · Auto-marked</small></div><span class="resource-state">Average 62%</span><button data-lecturer-toast="Feedback settings opened">Feedback →</button></article></div></section><section class="lecturer-panel"><div class="lecturer-panel-heading"><div><span class="lecturer-eyebrow">MARKING QUEUE</span><h2>Pending submissions</h2></div></div>${renderGrading()}</section></div>`;
}

function renderAdminDashboard() {
  const today = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  const recent = [...cachedUsers].sort((a, b) => String(b.lastLogin || "").localeCompare(String(a.lastLogin || ""))).slice(0, 4);
  return `<div class="admin-dashboard admin-workspace">
    <header class="admin-dashboard-heading"><div><p class="admin-breadcrumb"><span>Administration</span><span aria-hidden="true">›</span><strong>Overview</strong></p><h1>Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${escapeHTML((currentUser.name || "Administrator").split(/\s+/)[0])}</h1><p>${today} <span>·</span> Here’s your institution at a glance.</p></div><div class="admin-heading-actions"><button type="button" data-admin-toast="You’re all caught up.">♧ &nbsp; Notifications <b>3</b></button><button type="button" data-admin-page="reports">Download report ↓</button></div></header>
    <section class="admin-hero-strip"><div><span class="admin-eyebrow">CHIMERA LMS · ADMINISTRATION</span><h2>Your institution, in focus.</h2><p>Manage learning, people, and operations from one secure workspace.</p></div><span class="admin-hero-symbol" aria-hidden="true">✳</span></section>
    <section class="admin-kpi-grid" aria-label="Institution key performance indicators">
      <article class="admin-kpi-card"><div class="admin-kpi-label"><span class="admin-kpi-icon indigo">♙</span><span>Total users</span><button data-admin-page="users" aria-label="View users">↗</button></div><strong>1,287</strong><div class="admin-user-split"><span><i class="dot-student"></i> 1,240 students</span><span><i class="dot-lecturer"></i> 42 lecturers</span><span><i class="dot-admin"></i> 5 admins</span></div><div class="admin-mini-bars"><i style="height:38%"></i><i style="height:52%"></i><i style="height:46%"></i><i style="height:68%"></i><i style="height:61%"></i><i style="height:85%"></i><i style="height:100%"></i></div><small class="admin-kpi-foot">Active community · <b>+8.4%</b> this term</small></article>
      <article class="admin-kpi-card"><div class="admin-kpi-label"><span class="admin-kpi-icon teal">▤</span><span>Active courses</span><button data-admin-page="courses" aria-label="View courses">↗</button></div><strong>68</strong><p class="admin-kpi-caption">Across 6 faculties and 14 programmes</p><div class="admin-kpi-progress"><span style="width:78%"></span></div><small class="admin-kpi-foot">78% learner engagement this month</small></article>
      <article class="admin-kpi-card health-kpi"><div class="admin-kpi-label"><span class="admin-kpi-icon green">✓</span><span>System health</span><span class="online-pill"><i></i> Online</span></div><strong>All systems go</strong><p class="admin-kpi-caption">API response time <b>84 ms</b> · uptime 99.98%</p><div class="storage-label"><span>Storage used</span><b>72%</b></div><div class="admin-kpi-progress storage-progress"><span style="width:72%"></span></div><small class="admin-kpi-foot">720 GB of 1 TB · <button data-admin-page="settings">Manage storage</button></small></article>
      <article class="admin-kpi-card pending-kpi"><div class="admin-kpi-label"><span class="admin-kpi-icon amber">!</span><span>Pending actions</span><span class="pending-badge">20</span></div><button class="pending-action-row" data-admin-page="users"><span><i class="pending-dot coral-dot"></i> Lecturer applications</span><b>12 <span>→</span></b></button><button class="pending-action-row" data-admin-page="communication"><span><i class="pending-dot amber-dot"></i> Student complaints</span><b>8 <span>→</span></b></button><small class="admin-kpi-foot">Review items needing attention</small></article>
    </section>
    <div class="admin-overview-grid admin-overview-primary"><section class="admin-panel admin-chart-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">INSTITUTIONAL SNAPSHOT</span><h2>Learning activity</h2><p>Engagement across the last 7 months</p></div><button class="admin-select-pill" data-admin-action="Change date range">Last 7 months⌄</button></div><div class="admin-activity-chart" aria-label="Monthly learning activity chart"><div class="chart-y-labels"><span>1,200</span><span>900</span><span>600</span><span>300</span><span>0</span></div><div class="activity-chart-area"><div class="chart-gridlines"><i></i><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 700 190" preserveAspectRatio="none" role="img" aria-label="Engagement trending upward from April to October"><defs><linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5473d8" stop-opacity=".22"/><stop offset="1" stop-color="#5473d8" stop-opacity="0"/></linearGradient></defs><path d="M0 155 C45 145 55 132 100 138 S165 110 200 122 S260 96 300 104 S365 75 400 91 S465 58 500 73 S565 49 600 56 S660 27 700 32 V190 H0Z" fill="url(#activity-fill)"/><path d="M0 155 C45 145 55 132 100 138 S165 110 200 122 S260 96 300 104 S365 75 400 91 S465 58 500 73 S565 49 600 56 S660 27 700 32" fill="none" stroke="#5573d7" stroke-width="3" vector-effect="non-scaling-stroke"/></svg><div class="chart-x-labels"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div></div></div><div class="chart-legend"><span><i></i> Daily active learners</span><b>1,086 <small>today</small></b></div></section>
      <section class="admin-panel admin-actions-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">NEEDS YOUR ATTENTION</span><h2>Priority queue <span class="attention-count">20</span></h2></div><button data-admin-page="users">View queue →</button></div><button class="admin-priority-row" data-admin-page="users"><span class="priority-icon coral-bg">♙</span><span><strong>Lecturer applications</strong><small>12 applications awaiting review</small></span><time>Today</time></button><button class="admin-priority-row" data-admin-page="communication"><span class="priority-icon amber-bg">✉</span><span><strong>Student complaints</strong><small>8 open support tickets</small></span><time>2 urgent</time></button><button class="admin-priority-row" data-admin-page="content"><span class="priority-icon blue-bg">▧</span><span><strong>Content approvals</strong><small>4 new resources to review</small></span><time>New</time></button><div class="admin-queue-footer">Queue refreshed just now <span>●</span></div></section></div>
    <div class="admin-overview-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">LATEST ACTIVITY</span><h2>Recent users</h2><p>Most recent sign-ins and account updates</p></div><button data-admin-page="users">All users →</button></div><div class="admin-table-wrap"><table class="admin-data-table"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last active</th></tr></thead><tbody>${recent.map((user,index)=>`<tr><td><span class="admin-table-person"><i>${escapeHTML(String(user.name||"U").split(/\s+/).map(v=>v[0]).slice(0,2).join("").toUpperCase())}</i><span><b>${escapeHTML(user.name||"User")}</b><small>${escapeHTML(user.email||"")}</small></span></span></td><td>${escapeHTML(user.role||"learner")}</td><td><span class="admin-status ${user.status==="Inactive"?"is-inactive":""}">${escapeHTML(user.status||"Active")}</span></td><td>${escapeHTML(user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-ZA",{day:"numeric",month:"short"}) : "—")}</td></tr>`).join("") || '<tr><td colspan="4" class="admin-empty-row">No recent activity yet.</td></tr>'}</tbody></table></div></section><section class="admin-panel admin-audit-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">SECURITY</span><h2>Latest admin activity</h2><p>Auditable changes across your workspace</p></div><button data-admin-page="settings">View audit →</button></div>${cachedAudit.slice(0,4).map(item=>`<div class="admin-audit-row"><i>✓</i><span><b>${escapeHTML(item.action||"System event")}</b><small>${escapeHTML(item.user||"Administrator")} · ${escapeHTML(item.time||"")}</small></span></div>`).join("") || '<div class="admin-empty-row">No recent admin changes recorded.</div>'}</section></div>
  </div>`;
}

function renderAdminSection(section) {
  const heading = {
    users: ["USER ADMINISTRATION", "People & permissions", "Manage student, lecturer, and administrator accounts."],
    courses: ["ACADEMIC OPERATIONS", "Courses & academic structure", "Organise faculties, programmes, terms, and course assignments."],
    content: ["QUALITY CONTROL", "Content approval", "Review learning resources before students see them."],
    assessments: ["ACADEMIC INTEGRITY", "Assessments & grades", "Review gradebooks and manage institution-wide grading policy."],
    admissions: ["SECTION 6 · LEARNER LIFECYCLE", "Admissions & enrolment", "Track applications, registration, and learner progression."],
    attendance: ["LEARNER SUPPORT", "Attendance & discipline", "Monitor participation and follow up when learners need support."],
    communication: ["INSTITUTIONAL COMMS", "Communication center", "Coordinate announcements, support, and student feedback."],
    reports: ["MANAGEMENT INSIGHTS", "Reports & analytics", "Explore academic, financial, and engagement performance."],
    settings: ["PLATFORM CONTROL", "Settings & security", "Configure integrations, access, backups, and audit visibility."]
  }[section] || ["ADMINISTRATION", "Overview", "Manage your institution."];
  const intro = `<header class="admin-section-heading"><div><p class="admin-section-kicker">${heading[0]}</p><h1>${heading[1]}</h1><p>${heading[2]}</p></div><button class="admin-primary-button" data-admin-action="${escapeHTML(heading[1])}">＋ ${section === "users" ? "Add user" : section === "courses" ? "Add programme" : section === "communication" ? "New announcement" : "Create new"}</button></header>`;
  if (section === "users") {
    const rows = cachedUsers.map(user => `<tr><td><input type="checkbox" aria-label="Select ${escapeHTML(user.name||"user")}" /></td><td><span class="admin-table-person"><i>${escapeHTML(String(user.name||"U").split(/\s+/).map(v=>v[0]).slice(0,2).join("").toUpperCase())}</i><span><b>${escapeHTML(user.name||"User")}</b><small>${escapeHTML(user.email||"")}</small></span></span></td><td><span class="admin-role-pill">${escapeHTML(user.role||"learner")}</span></td><td>${escapeHTML(user.selectedCourse||user.department||"—")}</td><td><span class="admin-status ${user.status==="Inactive"?"is-inactive":""}">${escapeHTML(user.status||"Active")}</span></td><td><button class="admin-more-button" data-admin-action="Manage account · ${escapeHTML(user.name||user.email||"User")}" aria-label="Manage ${escapeHTML(user.name||"user")}">•••</button></td></tr>`).join("");
    return `<div class="admin-workspace">${intro}<section class="admin-panel admin-management-panel"><div class="admin-toolbar"><div class="admin-tab-row"><button class="selected">All users <b>${cachedUsers.length}</b></button><button>Students</button><button>Lecturers <b>12</b></button><button>Admins</button></div><div class="admin-toolbar-controls"><input type="search" class="admin-table-search" placeholder="Search name or email" aria-label="Search users" /><select aria-label="Filter by status"><option>All statuses</option><option>Active</option><option>Inactive</option></select><button class="admin-secondary-button" data-admin-action="Import users from Excel">↑ Import</button><button class="admin-secondary-button" data-admin-action="Export users">↓ Export</button></div></div><div class="admin-bulk-row"><label><input type="checkbox" class="admin-select-all" /> Select all</label><button data-admin-action="Assign selected users to a course">Assign to course</button><button data-admin-action="Suspend selected users" class="danger-link">Suspend</button><span>Student account tools · lecturers require approval before course access</span></div><div class="admin-table-wrap"><table class="admin-data-table admin-users-table"><thead><tr><th></th><th>Name &amp; email</th><th>Role</th><th>Programme / Faculty</th><th>Status</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="admin-empty-row">No users match this filter.</td></tr>'}</tbody></table></div><footer class="admin-pagination"><span>Showing ${cachedUsers.length ? 1 : 0}–${cachedUsers.length} of ${cachedUsers.length} accounts</span><div><button disabled>‹</button><button class="selected">1</button><button disabled>›</button></div></footer></section><div class="admin-split-grid"><section class="admin-panel"><span class="admin-section-kicker">LECTURER WORKFLOW</span><h2>Applications to review <span class="attention-count">12</span></h2><p class="admin-muted">Verify credentials and assign subjects before approval.</p><button class="admin-secondary-button" data-admin-action="Review lecturer applications">Review applications →</button></section><section class="admin-panel"><span class="admin-section-kicker">ACCESS CONTROL</span><h2>Roles &amp; permissions</h2><div class="permission-matrix"><span>Capability</span><b>Admin</b><b>Finance</b><b>Support</b><span>Manage users</span><b>✓</b><b>Limited</b><b>Limited</b><span>View finance</span><b>✓</b><b>✓</b><b>—</b><span>Handle tickets</span><b>✓</b><b>—</b><b>✓</b></div></section></div></div>`;
  }
  if (section === "courses") return `<div class="admin-workspace">${intro}<div class="admin-stat-strip"><article><small>Faculties</small><b>6</b></article><article><small>Programmes</small><b>14</b></article><article><small>Active courses</small><b>68</b></article><article><small>Terms</small><b>2</b></article></div><section class="admin-panel"><div class="admin-toolbar"><div class="admin-tab-row"><button class="selected">Course catalogue</button><button>Faculties</button><button>Departments</button><button>Programmes</button><button>Terms</button></div><input type="search" class="admin-table-search" placeholder="Search courses" aria-label="Search courses" /></div><div class="admin-table-wrap"><table class="admin-data-table"><thead><tr><th>Course</th><th>Programme</th><th>Lead lecturer</th><th>Learners</th><th>Status</th><th></th></tr></thead><tbody>${cachedCourses.map(course=>`<tr><td><b>${escapeHTML(course.code||"COURSE")}</b><small class="admin-cell-sub">${escapeHTML(course.title||"")}</small></td><td>${escapeHTML(course.programme||"Certificate programme")}</td><td>${escapeHTML(course.instructor||"Unassigned")}</td><td>${Number(course.students)||0}</td><td><span class="admin-status">Active</span></td><td><button class="admin-more-button" data-admin-action="Edit course · ${escapeHTML(course.code||course.title||"")}">•••</button></td></tr>`).join("")||'<tr><td colspan="6" class="admin-empty-row">No courses available.</td></tr>'}</tbody></table></div></section><div class="admin-split-grid"><section class="admin-panel"><span class="admin-section-kicker">CURRENT TERM</span><h2>Semester 2 · 2026</h2><p class="admin-muted">13 July – 27 November 2026 · Registration closes 31 July</p><button class="admin-secondary-button" data-admin-action="Manage academic terms">Manage terms</button></section><section class="admin-panel"><span class="admin-section-kicker">CURRICULUM</span><h2>Programme structure</h2><p class="admin-muted">Review modules, prerequisites, and learning outcomes by programme.</p><button class="admin-secondary-button" data-admin-action="Open curriculum structure">View curriculum →</button></section></div></div>`;
  if (section === "content") return `<div class="admin-workspace">${intro}<div class="admin-stat-strip"><article><small>Awaiting review</small><b>4</b></article><article><small>Flagged by system</small><b class="text-coral">2</b></article><article><small>Approved this month</small><b>126</b></article><article><small>Storage used</small><b>720 GB</b></article></div><div class="admin-split-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">REVIEW QUEUE</span><h2>Recently uploaded resources</h2></div><select><option>All types</option><option>Video</option><option>PDF</option></select></div>${[["Video","Introduction to data visualisation","DATA210 · 248 MB · uploaded by S. Chen","Flagged: audio quality"],["PDF","Learner assessment guide","SDEV101 · 4.2 MB · uploaded by N. Dlamini","Ready for review"],["Video","Building accessible web forms","WEB220 · 186 MB · uploaded by P. Naidoo","Ready for review"]].map((r,i)=>`<article class="admin-review-row"><span class="resource-type-icon">${r[0]==="Video"?"▶":"▤"}</span><span><b>${r[1]}</b><small>${r[2]}</small><em>${r[3]}</em></span><button data-admin-action="Approve content · ${r[1]}">Approve</button><button data-admin-action="Reject content · ${r[1]}">Reject</button></article>`).join("")}</section><section class="admin-panel"><span class="admin-section-kicker">STORAGE BY COURSE</span><h2>Largest data usage</h2><p class="admin-muted">Total allocation: 1 TB</p>${[["Software Developer",86],["Data Science Practitioner",68],["Cybersecurity Analyst",51],["Project Management",34]].map(x=>`<div class="storage-course-row"><span>${x[0]}</span><b>${x[1]} GB</b><i><em style="width:${x[1]}%"></em></i></div>`).join("")}<button class="admin-secondary-button" data-admin-action="Open storage report">Storage report →</button></section></div></div>`;
  if (section === "assessments") return `<div class="admin-workspace">${intro}<div class="admin-stat-strip"><article><small>Awaiting approval</small><b>6</b></article><article><small>Results ready to lock</small><b>3</b></article><article><small>Pass mark</small><b>50%</b></article><article><small>Distinction</small><b>75%</b></article></div><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">CROSS-COURSE CONTROL</span><h2>Gradebooks</h2><p>Grade changes require a reason and are recorded in the audit log.</p></div><button class="admin-secondary-button" data-admin-action="Export gradebook report">↓ Export</button></div><div class="admin-table-wrap"><table class="admin-data-table"><thead><tr><th>Assessment</th><th>Course</th><th>Submissions</th><th>Average</th><th>Results</th><th></th></tr></thead><tbody>${cachedAssignments.slice(0,8).map((a,i)=>`<tr><td><b>${escapeHTML(a.title||"Assessment")}</b></td><td>${escapeHTML(a.course||"Course")}</td><td>${18+i*3} / ${34+i*4}</td><td>${62+i*3}%</td><td><span class="admin-status">${i<2?"Ready to lock":"Marking"}</span></td><td><button data-admin-action="Override grade · ${escapeHTML(a.title||"Assessment")}" class="admin-inline-link">Override</button> <button data-admin-action="Lock results · ${escapeHTML(a.title||"Assessment")}" class="admin-inline-link">Lock</button></td></tr>`).join("")||'<tr><td colspan="6" class="admin-empty-row">No gradebooks available.</td></tr>'}</tbody></table></div></section><section class="admin-panel grading-policy"><div><span class="admin-section-kicker">GLOBAL GRADING POLICY</span><h2>Institution thresholds</h2><p class="admin-muted">Applies to new assessments across all programmes.</p></div><label>Pass mark <span><input type="number" value="50" min="0" max="100" /> %</span></label><label>Distinction <span><input type="number" value="75" min="0" max="100" /> %</span></label><button class="admin-primary-button" data-admin-action="Save global grading policy">Save policy</button></section></div>`;
  if (section === "admissions") return `<div class="admin-workspace">${intro}<div class="admin-stat-strip"><article><small>New applications</small><b>12</b></article><article><small>Documents to verify</small><b>7</b></article><article><small>Pending registration</small><b>23</b></article><article><small>Intake</small><b>Jan 2027</b></article></div><section class="admin-panel"><div class="admin-toolbar"><div class="admin-tab-row"><button class="selected">Applications <b>12</b></button><button>Enrolments</button><button>Progression</button></div><input type="search" class="admin-table-search" placeholder="Search applicants" /></div><div class="admin-table-wrap"><table class="admin-data-table"><thead><tr><th>Applicant</th><th>Programme</th><th>Submitted</th><th>Documents</th><th>Status</th><th></th></tr></thead><tbody>${[["Nomsa Dlamini","Software Developer","18 Oct","Complete"],["Kabelo Mokoena","Data Science Practitioner","17 Oct","ID required"],["Ayesha Patel","Cybersecurity Analyst","17 Oct","Complete"],["Lunga Ndlovu","Project Manager","16 Oct","Complete"]].map(row=>`<tr><td><b>${row[0]}</b><small class="admin-cell-sub">${row[0].split(" ")[0].toLowerCase()}@student.edu</small></td><td>${row[1]}</td><td>${row[2]} 2026</td><td>${row[3]}</td><td><span class="admin-status pending-status">Review</span></td><td><button class="admin-inline-link" data-admin-action="Review application · ${row[0]}">Review →</button></td></tr>`).join("")}</tbody></table></div></section></div>`;
  if (section === "attendance") return `<div class="admin-workspace">${intro}<div class="admin-stat-strip"><article><small>Institution attendance</small><b>86%</b></article><article><small>Below 80% threshold</small><b class="text-coral">38</b></article><article><small>Open discipline cases</small><b>5</b></article><article><small>Registers submitted</small><b>94%</b></article></div><div class="admin-split-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">ATTENDANCE WATCH</span><h2>Students needing follow-up</h2></div><button data-admin-action="Export DHET attendance register">↓ DHET / QCTO</button></div>${[["TM","Thabo Mokoena","Software Developer","62%"],["LN","Lerato Ndlovu","Data Science Practitioner","71%"],["PK","Peter Khumalo","Cybersecurity Analyst","76%"]].map((x,i)=>`<article class="admin-review-row"><span class="student-initial ${i===0?"coral":""}">${x[0]}</span><span><b>${x[1]}</b><small>${x[2]} · below 80% attendance</small></span><strong class="text-coral">${x[3]}</strong><button data-admin-action="Contact learner · ${x[1]}">Follow up</button></article>`).join("")}</section><section class="admin-panel"><span class="admin-section-kicker">DISCIPLINE &amp; WELLBEING</span><h2>Case management</h2><p class="admin-muted">Record a warning, assign a case owner, or review suspension history.</p><button class="admin-primary-button" data-admin-action="Create discipline case">＋ New case</button><div class="admin-audit-row"><i class="priority-icon amber-bg">!</i><span><b>Academic integrity review</b><small>Support Admin · opened 16 Oct · Medium priority</small></span></div><div class="admin-audit-row"><i class="priority-icon coral-bg">!</i><span><b>Repeated absence warning</b><small>Finance Admin · opened 15 Oct · High priority</small></span></div></section></div></div>`;
  if (section === "communication") return `<div class="admin-workspace">${intro}<div class="admin-split-grid communication-layout"><section class="admin-panel"><span class="admin-section-kicker">BROADCAST MESSAGE</span><h2>Reach your community</h2><p class="admin-muted">Send an announcement by email, SMS, or in-app notification.</p><form id="admin-broadcast-form" class="admin-broadcast-form"><label>Audience<select><option>All students</option><option>All lecturers</option><option>One faculty</option></select></label><label>Faculty<select><option>All faculties</option><option>Technology</option><option>Business</option><option>Creative Industries</option></select></label><label>Delivery<select><option>Email + in-app</option><option>SMS</option><option>Push notification</option></select></label><label>Subject<input required placeholder="e.g. Semester registration closes Friday" /></label><label>Message<textarea required rows="4" placeholder="Write a clear announcement…"></textarea></label><button class="admin-primary-button" type="submit">Send announcement →</button></form></section><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">SUPPORT INBOX</span><h2>Open complaints <span class="attention-count">8</span></h2></div><select><option>All priorities</option><option>Urgent</option></select></div>${[["AM","Ayesha Mohamed","Unable to access assessment feedback","Urgent · 24 min"],["TM","Thabo Mokoena","Request to update registered programme","Normal · 2 hours"],["SN","Sibongile Nkosi","Certificate name spelling correction","Normal · Yesterday"]].map(x=>`<article class="admin-ticket-row"><span class="student-initial">${x[0]}</span><span><b>${x[1]}</b><small>${x[2]}</small><em>${x[3]}</em></span><button data-admin-action="Open support ticket · ${x[1]}">Open</button></article>`).join("")}<button class="admin-secondary-button" data-admin-action="Open all support tickets">View all tickets →</button></section></div><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">RECENT ANNOUNCEMENTS</span><h2>System notices</h2></div><button data-admin-action="Moderate chat logs">Moderate chat logs</button></div><div class="announcement-card"><strong>Planned maintenance · Saturday 24 October</strong><p>Sent to all learners and lecturers · 18 Oct 2026</p></div></section></div>`;
  if (section === "reports") return `<div class="admin-workspace">${intro}<div class="admin-report-toolbar"><label>Date range<select><option>Last 30 days</option><option>This semester</option><option>Year to date</option></select></label><button class="admin-secondary-button" data-admin-action="Export analytics to Excel">↓ Excel</button><button class="admin-secondary-button" data-admin-action="Export analytics to PDF">↓ PDF</button></div><div class="admin-stat-strip"><article><small>Pass rate</small><b>78.4%</b><em>Academic</em></article><article><small>Dropout rate</small><b>6.2%</b><em>↓ 1.1% this term</em></article><article><small>Daily active users</small><b>1,086</b><em>Engagement</em></article><article><small>Monthly income</small><b>R125,000</b><em>Financial</em></article></div><div class="admin-split-grid"><section class="admin-panel"><span class="admin-section-kicker">ACADEMIC OUTCOMES</span><h2>Pass rate by programme</h2><div class="report-bars">${[["Software Developer",78],["Data Science",84],["Cybersecurity",71],["Project Management",88],["UX Design",74]].map(x=>`<div><span>${x[0]}</span><i><b style="width:${x[1]}%"></b></i><strong>${x[1]}%</strong></div>`).join("")}</div></section><section class="admin-panel"><span class="admin-section-kicker">ENGAGEMENT</span><h2>Most watched this month</h2>${[["Data visualisation fundamentals","2,840 views"],["Python: working with data","2,210 views"],["Accessible interface patterns","1,940 views"]].map(x=>`<div class="admin-audit-row"><i class="blue-bg">▶</i><span><b>${x[0]}</b><small>${x[1]}</small></span></div>`).join("")}</section></div><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">SECURITY AUDIT</span><h2>Recent sign-ins &amp; changes</h2><p>Review who accessed the LMS and who changed marks.</p></div><button data-admin-page="settings">Search audit trail →</button></div>${cachedAudit.slice(0,5).map(x=>`<div class="admin-audit-row"><i>✓</i><span><b>${escapeHTML(x.action||"Sign in")}</b><small>${escapeHTML(x.user||"System")} · ${escapeHTML(x.time||"")}</small></span></div>`).join("")||'<div class="admin-empty-row">No audit events available.</div>'}</section></div>`;
  if (section === "settings") return `<div class="admin-workspace">${intro}<div class="admin-split-grid"><section class="admin-panel"><span class="admin-section-kicker">PLATFORM SECURITY</span><h2>Access &amp; security</h2><label class="admin-setting-toggle"><span><b>Enforce two-factor authentication</b><small>Require 2FA for all administrator accounts</small></span><input type="checkbox" checked /></label><label class="admin-setting-toggle"><span><b>New device sign-in alerts</b><small>Notify admins when an unknown device signs in</small></span><input type="checkbox" checked /></label><label class="admin-setting-toggle"><span><b>IP allowlist</b><small>Restrict admin access to approved networks</small></span><input type="checkbox" /></label><button class="admin-secondary-button" data-admin-action="Manage blocked IP addresses">Manage blocked IPs</button></section><section class="admin-panel"><span class="admin-section-kicker">CONNECTED SERVICES</span><h2>Integrations</h2>${[["Zoom","Connected"],["Google Meet","Connected"],["Paystack","Not connected"],["PayFast","Not connected"]].map(x=>`<div class="integration-row"><span><b>${x[0]}</b><small>API credentials stored securely</small></span><span class="admin-status ${x[1]==="Not connected"?"is-inactive":""}">${x[1]}</span><button class="admin-inline-link" data-admin-action="Configure ${x[0]} integration">${x[1]==="Connected"?"Manage":"Connect"}</button></div>`).join("")}</section></div><div class="admin-split-grid"><section class="admin-panel"><span class="admin-section-kicker">BACKUP &amp; BRANDING</span><h2>Institution settings</h2><label class="admin-form-field">Institution name<input value="Chimera Learning" /></label><label class="admin-form-field">Primary domain<input value="learn.chimera.ac.za" /></label><div class="admin-inline-actions"><button class="admin-secondary-button" data-admin-action="Upload institution logo">Upload logo</button><button class="admin-secondary-button" data-admin-action="Create system backup">Create backup</button><button class="admin-secondary-button" data-admin-action="Restore system backup">Restore</button></div></section><section class="admin-panel"><span class="admin-section-kicker">ROLE-AWARE ACCESS</span><h2>Sub-administrator views</h2><div class="subadmin-preview"><b>Finance Admin</b><span>Overview · Reports · Fees · limited user records</span></div><div class="subadmin-preview"><b>Support Admin</b><span>Overview · Students · Attendance · Communication</span></div><button class="admin-primary-button" data-admin-action="Create sub-administrator">＋ Create sub-admin</button></section></div><section class="admin-panel"><div class="admin-panel-heading"><div><span class="admin-section-kicker">IMMUTABLE ACTIVITY RECORD</span><h2>Audit trail</h2><p>Every administrative action is searchable and attributable.</p></div><input type="search" class="admin-table-search" placeholder="Search audit events" /></div><div class="admin-table-wrap"><table class="admin-data-table"><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Status</th></tr></thead><tbody>${cachedAudit.map(x=>`<tr><td>${escapeHTML(x.time||"—")}</td><td>${escapeHTML(x.user||"System")}</td><td>${escapeHTML(x.action||"—")}</td><td><span class="admin-status">${escapeHTML(x.status||"Success")}</span></td></tr>`).join("")||'<tr><td colspan="4" class="admin-empty-row">No activity recorded yet.</td></tr>'}</tbody></table></div></section></div>`;
  return `<div class="admin-workspace">${intro}<section class="admin-panel"><p class="admin-empty-row">Choose an admin workspace from the navigation.</p></section></div>`;
}

function renderCourses(role) {
  let list = cachedCourses;
  if (role === "lecturer") list = cachedCourses.filter(c => c.instructor && c.instructor.includes("Chen"));
  if (role === "learner") {
    return list.length ? '<div class="registered-programme-list">' + list.map(course =>
      '<article class="registered-programme-card" data-course-card-id="' + escapeHTML(course.id) + '"><div class="registered-programme-heading"><div><span class="course-code">' + escapeHTML(course.code) + '</span><h3>' + escapeHTML(course.title) + '</h3><p>' + escapeHTML(course.instructor || "Chimera Learning") + '</p></div><span class="student-course-status">Registered</span></div>' +
      '<div class="student-course-progress"><div class="student-progress-track"><span style="width:' + courseModuleStats(course).percent + '%"></span></div><small>' + courseModuleStats(course).percent + '% complete' + (courseModuleStats(course).total ? ' · ' + courseModuleStats(course).completed + '/' + courseModuleStats(course).total + ' modules' : '') + '</small></div>' + renderProgrammeModules(course, true, "Programme modules") + '</article>'
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
  const stats = courseModuleStats(course);
  return '<details class="programme-modules" data-course-modules="' + escapeHTML(course.id) + '"' + (expanded ? ' open' : '') + '><summary><span>' + escapeHTML(label) + '</span><span class="programme-module-completion">' + stats.completed + '/' + stats.total + ' complete</span></summary><div class="programme-module-groups">' + groups.map(([group, modules]) => {
    const groupProgress = currentUser.moduleProgress?.[course.id]?.[group] || {};
    const completedCount = modules.reduce((count, _, index) => count + (groupProgress[index] === true ? 1 : 0), 0);
    return '<section class="programme-module-group"><div class="programme-module-heading"><h4>' + escapeHTML(group) + '</h4><span>' + completedCount + '/' + modules.length + '</span></div><ol>' + modules.map((module, index) => {
      const completed = groupProgress[index] === true;
      return '<li><button type="button" class="programme-module-toggle' + (completed ? ' is-completed' : '') + '" data-module-toggle data-course-id="' + escapeHTML(course.id) + '" data-module-group="' + escapeHTML(group) + '" data-module-index="' + index + '" data-completed="' + completed + '" aria-pressed="' + completed + '"><span class="module-check" aria-hidden="true">' + (completed ? '✓' : '') + '</span><span>' + escapeHTML(module) + '</span></button></li>';
    }).join("") + '</ol></section>';
  }
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
    return '<div class="card"><h3>Learning preferences</h3><p style="color:var(--text-muted)">Manage your learner profile and dashboard display preferences.</p><div class="settings-action-row"><div><strong>Personal information</strong><small>Review or update your learner profile and picture.</small></div><button type="button" class="btn btn-primary" id="edit-learner-profile">Edit profile</button></div></div>';
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
