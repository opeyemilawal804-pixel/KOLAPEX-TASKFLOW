
/* =========================================
   KOLAPEX TASKFLOW
   Productivity Management System
========================================= */

const $ = (selector) => document.querySelector(selector);

const today = new Date();
const dateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const uid = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);

let tasks = JSON.parse(localStorage.getItem("kolapex_tasks")) || [];
let projects = JSON.parse(localStorage.getItem("kolapex_projects")) || [
  { id: "general", name: "General", color: "green" }
];

let currentFilter = "all";
let searchQuery = "";
let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const saveData = () => {
  localStorage.setItem("kolapex_tasks", JSON.stringify(tasks));
  localStorage.setItem("kolapex_projects", JSON.stringify(projects));
};

const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function showToast(message) {
  $("#toastMessage").textContent = message;
  $("#toast").classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    $("#toast").classList.remove("show");
  }, 2500);
}

function formatDate(date) {
  if (!date) return "No deadline";

  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function isOverdue(task) {
  return !task.completed && task.dueDate && task.dueDate < dateString(today);
}

function getTaskStats() {
  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(isOverdue).length;
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  return { completed, pending, overdue, percent };
}

/* =========================================
   NAVIGATION
========================================= */

function openView(view) {
  document.querySelectorAll(".view-section").forEach(section => {
    section.classList.remove("active");
  });

  const target = document.getElementById(view);
  if (!target) return;

  target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.view === view);
  });

  const titles = {
    dashboard: "Dashboard",
    tasks: "My Tasks",
    projects: "Projects",
    calendar: "Calendar",
    analytics: "Analytics",
    settings: "Settings"
  };

  $("#breadcrumbTitle").textContent = titles[view] || "Dashboard";
  $("#sidebar").classList.remove("open");

  if (view === "calendar") renderCalendar();
  if (view === "analytics") renderAnalytics();
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => openView(link.dataset.view));
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => openView(button.dataset.goto));
});

$("#menuBtn").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

/* =========================================
   TASK MODAL
========================================= */

function openTaskModal(task = null) {
  $("#taskForm").reset();
  $("#editTaskId").value = task?.id || "";
  $("#modalTitle").textContent = task ? "Edit task" : "Create new task";
  $("#taskName").value = task?.name || "";
  $("#taskDescription").value = task?.description || "";
  $("#taskPriority").value = task?.priority || "Medium";
  $("#taskDueDate").value = task?.dueDate || dateString(today);
  $("#taskProject").value = task?.project || "General";

  updateProjectSelect();
  $("#taskProject").value = task?.project || "General";

  $("#taskModal").classList.add("show");
  $("#taskName").focus();
}

function closeTaskModal() {
  $("#taskModal").classList.remove("show");
}

$("#addTaskBtn").addEventListener("click", () => openTaskModal());
$("#addTaskBtn2").addEventListener("click", () => openTaskModal());
$("#calendarAddBtn").addEventListener("click", () => openTaskModal());

document.querySelectorAll(".close-modal").forEach(button => {
  button.addEventListener("click", closeTaskModal);
});

$("#taskModal").addEventListener("click", event => {
  if (event.target === $("#taskModal")) closeTaskModal();
});

$("#taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("#editTaskId").value;

  const taskData = {
    name: $("#taskName").value.trim(),
    description: $("#taskDescription").value.trim(),
    priority: $("#taskPriority").value,
    dueDate: $("#taskDueDate").value,
    project: $("#taskProject").value
  };

  if (!taskData.name || !taskData.dueDate) return;

  if (id) {
    const index = tasks.findIndex(task => task.id === id);

    if (index !== -1) {
      tasks[index] = {
        ...tasks[index],
        ...taskData
      };
    }

    showToast("Task updated successfully!");
  } else {
    tasks.unshift({
      id: uid(),
      ...taskData,
      completed: false,
      createdAt: new Date().toISOString()
    });

    showToast("New task created!");
  }

  saveData();
  closeTaskModal();
  renderAll();
});

/* =========================================
   TASK OPERATIONS
========================================= */

function toggleTask(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });

  saveData();
  renderAll();
  showToast("Task status updated!");
}

function deleteTask(id) {
  const confirmed = confirm("Are you sure you want to delete this task?");
  if (!confirmed) return;

  tasks = tasks.filter(task => task.id !== id);

  saveData();
  renderAll();
  showToast("Task deleted!");
}

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (task) openTaskModal(task);
}

function taskHTML(task) {
  const overdue = isOverdue(task);

  return `
    <div class="task-item">
      <button class="task-check ${task.completed ? "done" : ""}"
        data-action="toggle" data-id="${escapeHTML(task.id)}"
        aria-label="Toggle task completion">
        ${task.completed ? '<i class="fa-solid fa-check"></i>' : ""}
      </button>

      <div class="task-info ${task.completed ? "completed" : ""}">
        <strong>${escapeHTML(task.name)}</strong>
        <p>${escapeHTML(task.project || "General")} ·
          ${escapeHTML(task.description || "No description")}
        </p>
      </div>

      <div class="task-meta">
        <span class="priority ${escapeHTML(task.priority)}">
          ${escapeHTML(task.priority)}
        </span>
        <span class="task-date" style="${overdue ? "color:#e35e65" : ""}">
          ${overdue ? "Overdue" : formatDate(task.dueDate)}
        </span>
      </div>

      <div class="task-actions">
        <button data-action="edit" data-id="${escapeHTML(task.id)}" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button data-action="delete" data-id="${escapeHTML(task.id)}" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function emptyState(title, description, icon = "fa-clipboard-list") {
  return `
    <div class="empty-state">
      <i class="fa-solid ${icon}"></i>
      <strong>${title}</strong>
      <p>${description}</p>
    </div>
  `;
}

function getFilteredTasks() {
  return tasks.filter(task => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchQuery) ||
      (task.description || "").toLowerCase().includes(searchQuery) ||
      (task.project || "").toLowerCase().includes(searchQuery);

    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "active" && !task.completed) ||
      (currentFilter === "completed" && task.completed);

    const priority = $("#priorityFilter").value;
    const matchesPriority =
      priority === "all" || task.priority === priority;

    return matchesSearch && matchesFilter && matchesPriority;
  });
}

function renderTaskLists() {
  const recent = [...tasks]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  $("#recentTasks").innerHTML = recent.length
    ? recent.map(taskHTML).join("")
    : emptyState("No tasks yet", "Create your first task to get started.");

  const filtered = getFilteredTasks();

  $("#allTasksList").innerHTML = filtered.length
    ? filtered.map(taskHTML).join("")
    : emptyState("No matching tasks", "Try another filter or create a new task.");
}

/* Handle task action buttons */

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "toggle") toggleTask(id);
  if (action === "edit") editTask(id);
  if (action === "delete") deleteTask(id);
});

/* =========================================
   FILTERS AND SEARCH
========================================= */

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderTaskLists();
  });
});

$("#priorityFilter").addEventListener("change", renderTaskLists);

$("#searchInput").addEventListener("input", event => {
  searchQuery = event.target.value.trim().toLowerCase();
  renderTaskLists();
});

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#searchInput").focus();
  }

  if (event.key === "Escape") {
    closeTaskModal();
    $("#projectModal").classList.remove("show");
  }
});

/* =========================================
   PROJECT MANAGEMENT
========================================= */

function updateProjectSelect() {
  const select = $("#taskProject");
  const current = select.value || "General";

  select.innerHTML = projects.map(project => `
    <option value="${escapeHTML(project.name)}">
      ${escapeHTML(project.name)}
    </option>
  `).join("");

  select.value = projects.some(p => p.name === current)
    ? current
    : "General";
}

function renderProjects() {
  $("#projectGrid").innerHTML = projects.map(project => {
    const related = tasks.filter(task => task.project === project.name);
    const completed = related.filter(task => task.completed).length;
    const percent = related.length
      ? Math.round(completed / related.length * 100)
      : 0;

    return `
      <div class="project-card">
        <div class="project-icon ${escapeHTML(project.color)}">
          <i class="fa-solid fa-folder"></i>
        </div>
        <h3>${escapeHTML(project.name)}</h3>
        <p>${related.length} tasks in this project</p>

        <div class="project-progress">
          <div><strong>Progress</strong><span>${percent}%</span></div>
          <div class="progress-track">
            <div style="width:${percent}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

$("#addProjectBtn").addEventListener("click", () => {
  $("#projectForm").reset();
  $("#projectModal").classList.add("show");
});

document.querySelectorAll(".close-project-modal").forEach(button => {
  button.addEventListener("click", () => {
    $("#projectModal").classList.remove("show");
  });
});

$("#projectModal").addEventListener("click", event => {
  if (event.target === $("#projectModal")) {
    $("#projectModal").classList.remove("show");
  }
});

$("#projectForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#projectName").value.trim();

  if (!name) return;

  if (projects.some(project => project.name.toLowerCase() === name.toLowerCase())) {
    showToast("This project already exists!");
    return;
  }

  projects.push({
    id: uid(),
    name,
    color: $("#projectColor").value
  });

  saveData();
  renderAll();

  $("#projectModal").classList.remove("show");
  showToast("Project created successfully!");
});

/* =========================================
   CALENDAR
========================================= */

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  $("#monthLabel").textContent = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let html = days.map(day => `<div class="weekday">${day}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    let day;
    let cellDate;
    let other = false;

    if (i < firstDay) {
      day = previousMonthDays - firstDay + i + 1;
      cellDate = dateString(new Date(year, month - 1, day));
      other = true;
    } else if (i >= firstDay + daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      cellDate = dateString(new Date(year, month + 1, day));
      other = true;
    } else {
      day = i - firstDay + 1;
      cellDate = dateString(new Date(year, month, day));
    }

    const dayTasks = tasks.filter(task => task.dueDate === cellDate);

    html += `
      <div class="calendar-day ${other ? "other-month" : ""} ${cellDate === dateString(today) ? "today" : ""}">
        <div class="day-number">${day}</div>
        ${dayTasks.slice(0, 3).map(task => `
          <div class="calendar-event" title="${escapeHTML(task.name)}">
            ${escapeHTML(task.name)}
          </div>
        `).join("")}
        ${dayTasks.length > 3 ? `<small>+${dayTasks.length - 3} more</small>` : ""}
      </div>
    `;
  }

  $("#calendarGrid").innerHTML = html;
}

$("#prevMonth").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

/* =========================================
   ANALYTICS
========================================= */

function renderAnalytics() {
  const stats = getTaskStats();

  $("#analyticsTotal").textContent = tasks.length;
  $("#analyticsRate").textContent = stats.percent + "%";
  $("#analyticsHigh").textContent =
    tasks.filter(task => task.priority === "High" && !task.completed).length;
  $("#analyticsProjects").textContent = projects.length;

  const total = Math.max(tasks.length, 1);
  const completedHeight = stats.completed / total * 100;
  const remainingHeight = stats.pending / total * 100;

  $("#barChart").innerHTML = `
    <div class="bar-column">
      <div class="bar-stack">
        <div class="bar-remaining" style="height:${remainingHeight}%"></div>
        <div class="bar-completed" style="height:${completedHeight}%"></div>
      </div>
      <span>Tasks</span>
    </div>
  `;
}

/* =========================================
   DASHBOARD STATISTICS
========================================= */

function renderStats() {
  const stats = getTaskStats();

  $("#totalTasks").textContent = tasks.length;
  $("#completedTasks").textContent = stats.completed;
  $("#pendingTasks").textContent = stats.pending;
  $("#overdueTasks").textContent = stats.overdue;

  $("#progressPercent").textContent = stats.percent + "%";
  $("#legendCompleted").textContent = stats.completed;
  $("#legendRemaining").textContent = stats.pending;

  $("#progressCircle").style.background =
    `conic-gradient(var(--primary) ${stats.percent * 3.6}deg, var(--border) 0deg)`;

  $("#taskNavCount").textContent = stats.pending;
}

function renderAll() {
  saveData();
  renderStats();
  renderTaskLists();
  renderProjects();
  renderCalendar();
  renderAnalytics();
  updateProjectSelect();
}

/* =========================================
   DARK MODE
========================================= */

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("#darkModeToggle").checked = dark;

  $("#themeBtn").innerHTML = dark
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-regular fa-moon"></i>';

  localStorage.setItem("kolapex_theme", dark ? "dark" : "light");
}

const savedTheme = localStorage.getItem("kolapex_theme") === "dark";
setTheme(savedTheme);

$("#themeBtn").addEventListener("click", () => {
  setTheme(!document.body.classList.contains("dark"));
});

$("#darkModeToggle").addEventListener("change", event => {
  setTheme(event.target.checked);
});

/* =========================================
   SETTINGS AND EXTRA ACTIONS
========================================= */

$("#clearDataBtn").addEventListener("click", () => {
  const confirmed = confirm(
    "This will permanently clear all locally saved tasks and projects. Continue?"
  );

  if (!confirmed) return;

  tasks = [];
  projects = [{ id: "general", name: "General", color: "green" }];

  saveData();
  renderAll();
  showToast("Your workspace data has been cleared.");
});

$("#focusBtn").addEventListener("click", () => {
  let seconds = 25 * 60;

  const focusWindow = window.open("", "_blank", "width=360,height=280");

  if (!focusWindow) {
    showToast("Allow pop-ups to open the focus timer.");
    return;
  }

  focusWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>KOLAPEX Focus Timer</title>
      <style>
        body {
          background:#f2faf6;
          font-family:Arial,sans-serif;
          text-align:center;
          padding:30px;
          color:#173d30;
        }
        h2 {color:#079669}
        #clock {font-size:54px;font-weight:bold;margin:25px 0}
        button {
          background:#079669;color:white;border:0;
          padding:12px 22px;border-radius:8px;cursor:pointer;
        }
      </style>
    </head>
    <body>
      <h2>KOLAPEX FOCUS</h2>
      <p>25-minute focus session</p>
      <div id="clock">25:00</div>
      <button id="start">Start timer</button>
      <script>
        let time = 1500;
        let interval = null;
        const clock = document.getElementById("clock");
        const button = document.getElementById("start");

        button.addEventListener("click", () => {
          if (interval) {
            clearInterval(interval);
            interval = null;
            button.textContent = "Resume timer";
            return;
          }

          button.textContent = "Pause timer";

          interval = setInterval(() => {
            time--;

            const min = Math.floor(time / 60);
            const sec = time % 60;

            clock.textContent =
              String(min).padStart(2, "0") + ":" +
              String(sec).padStart(2, "0");

            if (time <= 0) {
              clearInterval(interval);
              interval = null;
              button.textContent = "Completed!";
              clock.textContent = "Done!";
              alert("Your focus session is complete!");
            }
          }, 1000);
        });
      <\/script>
    </body>
    </html>
  `);

  focusWindow.document.close();
});

/* =========================================
   DATE AND INITIALIZATION
========================================= */

$("#todayDate").textContent = today.toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

$("#notificationBtn").addEventListener("click", () => {
  const overdue = tasks.filter(isOverdue).length;
  const pending = tasks.filter(task => !task.completed).length;

  showToast(`${pending} active tasks · ${overdue} overdue`);
});

renderAll();
openView("dashboard");

console.log("KOLAPEX TASKFLOW initialized successfully.");
