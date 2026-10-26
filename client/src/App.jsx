
import { useEffect, useMemo, useState } from 'react';
import './App.css';

// Empty locally: Vite's /api proxy handles requests.
// Set VITE_API_URL on the deployed frontend to point at the deployed backend.
import {API_BASE} from '../api.js'

const initialTasks = [
  {
    id: 1,
    title: 'Finalize the event poster',
    description: 'Review the design and get final approval.',
    assignee: 'Anish Kumar',
    dueDate: 'Today',
    priority: 'High',
    status: 'In progress',
  },
  {
    id: 2,
    title: 'Prepare the weekly team update',
    description: 'Collect updates from every workstream.',
    assignee: 'Priya Sharma',
    dueDate: 'Tomorrow',
    priority: 'Medium',
    status: 'To do',
  },
  {
    id: 3,
    title: 'Confirm venue arrangements',
    description: 'Coordinate seating and equipment requirements.',
    assignee: 'Rahul Verma',
    dueDate: 'Oct 29',
    priority: 'High',
    status: 'Done',
  },
  {
    id: 4,
    title: 'Draft social media captions',
    description: 'Prepare captions for the upcoming campaign.',
    assignee: 'Anish Kumar',
    dueDate: 'Oct 30',
    priority: 'Low',
    status: 'To do',
  },
];

const teamMembers = [
  {
    name: 'Anish Kumar',
    role: 'Coordinator',
    initials: 'AK',
    workstream: 'Operations',
  },
  {
    name: 'Priya Sharma',
    role: 'Sub-coordinator',
    initials: 'PS',
    workstream: 'Design & Media',
  },
  {
    name: 'Rahul Verma',
    role: 'Sub-coordinator',
    initials: 'RV',
    workstream: 'Events',
  },
  {
    name: 'Aditi Singh',
    role: 'Team Member',
    initials: 'AS',
    workstream: 'Outreach',
  },
  {
    name: 'Karan Mehta',
    role: 'Team Member',
    initials: 'KM',
    workstream: 'Technical',
  },
];

const weeklyPlan = [
  {
    day: 'MON',
    date: '26',
    title: 'Weekly planning',
    detail: 'Set priorities and assign tasks',
    tag: 'Planning',
  },
  {
    day: 'TUE',
    date: '27',
    title: 'Creative review',
    detail: 'Review poster and campaign content',
    tag: 'Design',
  },
  {
    day: 'WED',
    date: '28',
    title: 'Event preparation',
    detail: 'Confirm requirements and responsibilities',
    tag: 'Events',
  },
  {
    day: 'THU',
    date: '29',
    title: 'Progress check-in',
    detail: 'Resolve blockers and review progress',
    tag: 'Team',
  },
  {
    day: 'FRI',
    date: '30',
    title: 'Weekly retrospective',
    detail: 'Review outcomes and plan improvements',
    tag: 'Review',
  },
];

const navigation = [
  { label: 'Overview', icon: '◫' },
  { label: 'Tasks', icon: '☑' },
  { label: 'Weekly Plan', icon: '▦' },
  { label: 'Team', icon: '♧' },
  { label: 'Activity', icon: '◷' },
];

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function formatDueDate(value) {
  if (!value) return 'No deadline';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }

  return value;
}

function App() {
  const [activePage, setActivePage] = useState('Overview');
  const [search, setSearch] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);

  const [tasks, setTasks] = useState([]);
const [tasksLoading, setTasksLoading] = useState(true);
const [tasksError, setTasksError] = useState('');
const [savingTask, setSavingTask] = useState(false);

  const [activities, setActivities] = useState(() =>
    readStorage('pulse.activities.v1', [
      {
        id: 1,
        text: 'Workspace created',
        detail: 'Your Pulse demo workspace is ready.',
        time: 'Just now',
      },
      {
        id: 2,
        text: 'Weekly plan prepared',
        detail: 'The team schedule has been added.',
        time: 'Earlier',
      },
    ])
  );

  useEffect(() => {
  let cancelled = false;

  async function fetchTasks() {
    setTasksLoading(true);
    setTasksError('');

    try {
      const response = await fetch(`${API_BASE}/api/tasks`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load tasks.');
      }

      if (!cancelled) {
        setTasks(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      if (!cancelled) {
        setTasksError(
          error.message || 'Could not connect to the Pulse API.'
        );
      }
    } finally {
      if (!cancelled) {
        setTasksLoading(false);
      }
    }
  }

  fetchTasks();

  return () => {
    cancelled = true;
  };
}, []);

  useEffect(() => {
    try {
      localStorage.setItem('pulse.activities.v1', JSON.stringify(activities));
    } catch (error) {
      console.error('Could not save activity locally:', error);
    }
  }, [activities]);

  const completedTasks = tasks.filter((task) => task.status === 'Done').length;
  const inProgressTasks = tasks.filter(
    (task) => task.status === 'In progress'
  ).length;
  const pendingTasks = tasks.filter((task) => task.status === 'To do').length;

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return tasks;

    return tasks.filter((task) =>
      [
        task.title,
        task.description,
        task.assignee,
        task.priority,
        task.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [tasks, search]);

  function addActivity(text, detail) {
    setActivities((current) => [
      {
        id: Date.now(),
        text,
        detail,
        time: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      ...current,
    ]);
  }

  async function updateTaskStatus(taskId, newStatus) {
  const task = tasks.find((item) => item.id === taskId);

  setTasksError('');

  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update task.');
    }

    setTasks((current) =>
      current.map((item) =>
        item.id === taskId ? result.data : item
      )
    );

    if (task && task.status !== newStatus) {
      addActivity(
        'Task status updated',
        `"${task.title}" was moved to ${newStatus}.`
      );
    }
  } catch (error) {
    setTasksError(error.message || 'Could not update task.');
  }
}
  async function handleCreateTask(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const title = String(formData.get('title') || '').trim();

  if (!title) return;

  const newTask = {
    title,
    description: String(formData.get('description') || '').trim(),
    assignee: String(formData.get('assignee') || 'Unassigned'),
    dueDate: String(formData.get('dueDate') || ''),
    priority: String(formData.get('priority') || 'Medium'),
  };

  setSavingTask(true);
  setTasksError('');

  try {
    const response = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newTask),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to create task.');
    }

    setTasks((current) => [result.data, ...current]);

    addActivity(
      'New task created',
      `"${result.data.title}" was assigned to ${result.data.assignee}.`
    );

    setShowTaskModal(false);
    setActivePage('Tasks');
    setSearch('');
  } catch (error) {
    setTasksError(error.message || 'Could not create task.');
  } finally {
    setSavingTask(false);
  }
}

  function openTaskModal() {
    setShowTaskModal(true);
  }

  function renderTaskRow(task) {
    return (
      <div className="task-row" key={task.id}>
        <div className="task-info">
          <strong>{task.title}</strong>
          <p>
            {task.assignee} · {formatDueDate(task.dueDate)}
          </p>
          {task.description && <p>{task.description}</p>}
          <span className={`priority ${task.priority.toLowerCase()}`}>
            {task.priority} priority
          </span>
        </div>

        <select
          className="status-select"
          value={task.status}
          onChange={(event) =>
            updateTaskStatus(task.id, event.target.value)
          }
          aria-label={`Status for ${task.title}`}
        >
          <option value="To do">To do</option>
          <option value="In progress">In progress</option>
          <option value="Done">Done</option>
        </select>
      </div>
    );
  }

  function renderOverview() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Good to see you!</h1>
            <p className="subtitle">
              Here's what's happening with your team today.
            </p>
          </div>

          <button className="primary-button" onClick={openTaskModal}>
            + Create task
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <p>Total tasks</p>
            <h2>{tasks.length}</h2>
            <small>Across your workspace</small>
          </div>

          <div className="stat-card">
            <p>In progress</p>
            <h2>{inProgressTasks}</h2>
            <small>Currently being worked on</small>
          </div>

          <div className="stat-card">
            <p>Completed</p>
            <h2>{completedTasks}</h2>
            <small>
              {tasks.length
                ? `${Math.round((completedTasks / tasks.length) * 100)}% of all tasks`
                : 'No tasks yet'}
            </small>
          </div>

          <div className="stat-card">
            <p>To do</p>
            <h2>{pendingTasks}</h2>
            <small>Waiting to get started</small>
          </div>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <h2>Recent tasks</h2>
            <button
              className="text-button"
              onClick={() => setActivePage('Tasks')}
            >
              View all →
            </button>
          </div>

          <div className="task-list">
            {tasks.length ? (
              tasks.slice(0, 4).map(renderTaskRow)
            ) : (
              <div className="empty-state">
                No tasks yet. Create your first task to get started.
              </div>
            )}
          </div>
        </section>

        <section className="simple-content">
          <div className="panel">
            <div className="panel-heading">
              <h2>This week's focus</h2>
            </div>
            <p className="subtitle">
              Plan the work, make responsibilities clear, and keep the team
              moving forward.
            </p>
            <button
              className="text-button"
              onClick={() => setActivePage('Weekly Plan')}
            >
              Open weekly plan →
            </button>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h2>Team overview</h2>
            </div>
            <p className="subtitle">
              {teamMembers.length} demo team members are listed in this
              workspace.
            </p>
            <button
              className="text-button"
              onClick={() => setActivePage('Team')}
            >
              View team →
            </button>
          </div>
        </section>
      </>
    );
  }

  function renderTasksPage() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">GET THINGS DONE</p>
            <h1>Tasks</h1>
            <p className="subtitle">
              Organize responsibilities and track progress.
            </p>
          </div>

          <button className="primary-button" onClick={openTaskModal}>
            + Create task
          </button>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <h2>All tasks ({filteredTasks.length})</h2>
          </div>

          <div className="task-list">
            {filteredTasks.length ? (
              filteredTasks.map(renderTaskRow)
            ) : (
              <div className="empty-state">
                No tasks match your search.
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  function renderWeeklyPlan() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">PLAN TOGETHER</p>
            <h1>Weekly plan</h1>
            <p className="subtitle">
              A shared view of the team's focus for the week.
            </p>
          </div>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <h2>Week at a glance</h2>
            <span className="subtitle">26–30 October</span>
          </div>

          <div className="task-list">
            {weeklyPlan.map((item) => (
              <div className="task-row" key={item.day}>
                <div className="workspace-icon">
                  {item.date}
                </div>
                <div className="task-info">
                  <strong>
                    {item.day} · {item.title}
                  </strong>
                  <p>{item.detail}</p>
                  <span className="priority low">{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Work in progress</h2>
          </div>
          <p className="subtitle">
            {inProgressTasks} task(s) are currently in progress. Use the Tasks
            page to update statuses and keep the plan current.
          </p>
          <button
            className="text-button"
            onClick={() => setActivePage('Tasks')}
          >
            Review tasks →
          </button>
        </section>
      </>
    );
  }

  function renderTeam() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">PEOPLE & RESPONSIBILITIES</p>
            <h1>Your team</h1>
            <p className="subtitle">
              Meet the people keeping the work moving.
            </p>
          </div>
        </div>

        <div className="members-grid">
          {teamMembers.map((member) => (
            <div className="member-card" key={member.name}>
              <div className="avatar">{member.initials}</div>
              <strong>{member.name}</strong>
              <p>{member.role}</p>
              <p>{member.workstream}</p>
            </div>
          ))}
        </div>

        <p className="footer">
          These are sample team profiles for the demo.
        </p>
      </>
    );
  }

  function renderActivity() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">WORKSPACE UPDATES</p>
            <h1>Activity</h1>
            <p className="subtitle">
              A record of recent changes made in this demo.
            </p>
          </div>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
          </div>

          <div className="task-list">
            {activities.map((activity) => (
              <div className="task-row" key={activity.id}>
                <div className="workspace-icon">↗</div>
                <div className="task-info">
                  <strong>{activity.text}</strong>
                  <p>{activity.detail}</p>
                </div>
                <span className="subtitle">{activity.time}</span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderCurrentPage() {
    switch (activePage) {
      case 'Tasks':
        return renderTasksPage();
      case 'Weekly Plan':
        return renderWeeklyPlan();
      case 'Team':
        return renderTeam();
      case 'Activity':
        return renderActivity();
      default:
        return renderOverview();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <span>pulse<span className="brand-dot">.</span></span>
        </div>

        <div className="workspace">
          <div className="workspace-icon">TT</div>
          <div>
            <strong>Student Committee</strong>
            Demo workspace
          </div>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`nav-button ${
                activePage === item.label ? 'active' : ''
              }`}
              onClick={() => setActivePage(item.label)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="progress-card">
            <p>TEAM PROGRESS</p>
            <strong>
              {tasks.length
                ? `${Math.round((completedTasks / tasks.length) * 100)}% complete`
                : 'No tasks yet'}
            </strong>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    tasks.length
                      ? (completedTasks / tasks.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="profile">
            <div className="avatar">AK</div>
            <div>
              <strong>Anish Kumar</strong>
              <small>Coordinator</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace&nbsp; / &nbsp;<strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <input
              className="search"
              type="search"
              placeholder="Search tasks, people..."
              aria-label="Search tasks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </header>

        <div className="page-content">
          {renderCurrentPage()}

          <div className="footer">
            Pulse · Student team workspace · Demo version
          </div>
        </div>
      </main>

      {showTaskModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowTaskModal(false);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">WORKSPACE</p>
                <h2 id="new-task-title">Create a task</h2>
                <p>Add a responsibility to your team's task list.</p>
              </div>

              <button
                className="close-button"
                type="button"
                aria-label="Close dialog"
                onClick={() => setShowTaskModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <label>
                Task title *
                <input
                  name="title"
                  type="text"
                  placeholder="e.g. Finalize event poster"
                  required
                  autoFocus
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  placeholder="What needs to be done?"
                  rows="3"
                />
              </label>

              <label>
                Assignee
                <select name="assignee" defaultValue="Anish Kumar">
                  {teamMembers.map((member) => (
                    <option key={member.name} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                  <option value="Unassigned">Unassigned</option>
                </select>
              </label>

              <div className="form-row">
                <label>
                  Due date
                  <input name="dueDate" type="date" />
                </label>

                <label>
                  Priority
                  <select name="priority" defaultValue="Medium">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                >
                  Cancel
                </button>

                <button
  className="primary-button"
  type="submit"
  disabled={savingTask}
>
  {savingTask ? 'Saving...' : 'Create task'}
</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
