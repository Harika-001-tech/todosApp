const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const cors = require('cors');
const app = express();
app.use(bodyParser.json());
app.use(cors());

const SECRET_KEY = ''; //

app.get('/users', (req, res) => {
  db.serialize(() => {
    db.all('SELECT * FROM users', [], (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    });
  });
});

app.get('/todos', (req, res) => {
  db.serialize(() => {
    db.all('SELECT * FROM todos', [], (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    });
  });
});

// Define a route to insert a new todo
app.post('/todos', (req, res) => {
  const { userId, task, status } = req.body;

  if (!userId || !task || !status) {
    return res.status(400).json({ error: 'userId, task, and status are required fields.' });
  }

  const sql = 'INSERT INTO todos (userId, task, status) VALUES (?, ?, ?)';
  db.run(sql, [userId, task, status], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      message: 'Todo created successfully',
      todoId: this.lastID
    });
  });
});

app.put('/todos/:id', (req, res) => {
  const { id } = req.params;
  const { task, status } = req.body;

  if (!task || !status) {
    return res.status(400).json({ error: 'Task and status are required fields.' });
  }

  const sql = 'UPDATE todos SET task = ?, status = ? WHERE id = ?';
  db.run(sql, [task, status, id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Todo not found.' });
    }
    res.json({
      message: 'Todo updated successfully',
      changes: this.changes
    });
  });
});

app.delete('/todos/:id', (req, res) => {
  const { id } = req.params;

  const sql = 'DELETE FROM todos WHERE id = ?';
  db.run(sql, id, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Todo not found.' });
    }
    res.json({
      message: 'Todo deleted successfully',
      changes: this.changes
    });
  });
});

// Registration endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, hashedPassword],
    function (err) {
      if (err) {
        return res.status(500).json({ message: 'User registration failed.' });
      }
      res.status(201).json({ message: 'User registered successfully.' });
    }
  );
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

    res.json({ message: 'Login successful.', token });
  });
});

// Middleware to authenticate using JWT
function authenticateToken(req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token.' });
    }
    req.user = user;
    next();
  });
}

// Example protected route
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route.', userId: req.user.userId });
});

// Start the server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
