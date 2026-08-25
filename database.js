const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(
  "./transcriber.db",
  (err) => {
    if (err) {
      console.error(
        "Database connection error:",
        err.message
      );
    } else {
      console.log(
        "Connected to SQLite database"
      );
    }
  }
);

// Create messages table
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId INTEGER,
    speaker TEXT,
    text TEXT,
    createdAt TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )
`, () => {
  // Try to add the column in case the table already exists
  db.run(`ALTER TABLE sessions ADD COLUMN updatedAt TEXT`, (err) => {
    // Ignore error if column already exists
  });
});

module.exports = db;