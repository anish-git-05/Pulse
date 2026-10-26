
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing from server/.env');
  process.exit(1);
}

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

// Columns returned in the format expected by React
const TASK_COLUMNS = `
  id,
  title,
  description,
  assignee,
  due_date AS "dueDate",
  priority,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const demoTasks = [
  {
    title: 'Finalize the event poster',
    description: 'Review the design and get final approval.',
    assignee: 'Anish Kumar',
    dueDate: 'Today',
    priority: 'High',
    status: 'In progress',
  },
  {
    title: 'Prepare the weekly team update',
    description: 'Collect updates from every workstream.',
    assignee: 'Priya Sharma',
    dueDate: 'Tomorrow',
    priority: 'Medium',
    status: 'To do',
  },
  {
    title: 'Confirm venue arrangements',
    description: 'Coordinate seating and equipment requirements.',
    assignee: 'Rahul Verma',
    dueDate: 'Oct 29',
    priority: 'High',
    status: 'Done',
  },
];

const validStatuses = ['To do', 'In progress', 'Done'];
const validPriorities = ['Low', 'Medium', 'High'];

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Health check
app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');

    res.json({
      success: true,
      message: 'Pulse API is running!',
      database: 'connected',
    });
  })
);

// GET /api/tasks
app.get(
  '/api/tasks',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(`
      SELECT ${TASK_COLUMNS}
      FROM tasks
      ORDER BY created_at DESC, id DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  })
);

// POST /api/tasks
app.post(
  '/api/tasks',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const {
      title,
      description = '',
      assignee = 'Unassigned',
      dueDate = '',
      priority = 'Medium',
    } = body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: 'A task title is required and must be at most 200 characters.',
      });
    }

    if (
      typeof description !== 'string' ||
      typeof assignee !== 'string' ||
      typeof dueDate !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Description, assignee, and due date must be text.',
      });
    }

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be Low, Medium, or High.',
      });
    }

    const result = await pool.query(
      `
        INSERT INTO tasks (
          title, description, assignee, due_date, priority
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${TASK_COLUMNS}
      `,
      [
        title.trim(),
        description.trim(),
        assignee.trim() || 'Unassigned',
        dueDate.trim(),
        priority,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      data: result.rows[0],
    });
  })
);

// PATCH /api/tasks/:id
app.patch(
  '/api/tasks/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID.',
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task status.',
      });
    }

    const result = await pool.query(
      `
        UPDATE tasks
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING ${TASK_COLUMNS}
      `,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    res.json({
      success: true,
      message: 'Task status updated.',
      data: result.rows[0],
    });
  })
);

// Reject unknown API endpoints
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});

// Serve React's production build when available
const clientDist = path.resolve(__dirname, '../client/dist');
const clientIndex = path.join(clientDist, 'index.html');

if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(clientIndex);
    }

    next();
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Pulse API is running!');
  });
}

// Unknown routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// Error handler
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);

  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
  });
});

// Create the table and seed the database once
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
      due_date VARCHAR(50) NOT NULL DEFAULT '',
      priority VARCHAR(10) NOT NULL DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High')),
      status VARCHAR(20) NOT NULL DEFAULT 'To do'
        CHECK (status IN ('To do', 'In progress', 'Done')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM tasks'
  );

  if (countResult.rows[0].count === 0) {
    for (const task of demoTasks) {
      await pool.query(
        `
          INSERT INTO tasks (
            title, description, assignee, due_date, priority, status
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          task.title,
          task.description,
          task.assignee,
          task.dueDate,
          task.priority,
          task.status,
        ]
      );
    }

    console.log('Initial demo tasks created.');
  }
}

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL.');

    await initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Pulse server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Pulse:', error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

startServer();
