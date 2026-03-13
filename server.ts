import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("turtle.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'volunteer',
    station TEXT,
    is_active BOOLEAN DEFAULT 0,
    profile_picture BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS beaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS nests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nest_code TEXT UNIQUE NOT NULL,
    beach_id INTEGER,
    gps_lat REAL,
    gps_long REAL,
    date_laid TEXT,
    status TEXT,
    total_num_eggs INTEGER,
    current_num_eggs INTEGER,
    depth_top_egg_h REAL,
    distance_to_sea_s REAL,
    tri_tl_desc TEXT,
    tri_tl_lat REAL,
    tri_tl_long REAL,
    tri_tl_distance REAL,
    tri_tl_img BLOB,
    tri_tr_desc TEXT,
    tri_tr_lat REAL,
    tri_tr_long REAL,
    tri_tr_distance REAL,
    tri_tr_img BLOB,
    notes TEXT,
    is_archived BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(beach_id) REFERENCES beaches(id)
  );

  CREATE TABLE IF NOT EXISTS nest_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nest_code TEXT NOT NULL,
    event_type TEXT NOT NULL,
    notes TEXT,
    observer TEXT,
    hatched_count INTEGER,
    tracks_to_sea INTEGER,
    tracks_lost INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(nest_code) REFERENCES nests(nest_code)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/users/register", async (req, res) => {
    const { first_name, last_name, email, password, role, station, profile_picture } = req.body;
    try {
      const password_hash = await bcrypt.hash(password, 10);
      let picBuffer = null;
      if (profile_picture) {
        const base64Data = profile_picture.includes('data:') ? profile_picture.split(',')[1] : profile_picture;
        picBuffer = Buffer.from(base64Data, "base64");
      }

      const stmt = db.prepare(`
        INSERT INTO users (first_name, last_name, email, password_hash, role, station, profile_picture)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(first_name, last_name, email, password_hash, role || 'volunteer', station, picBuffer);
      
      res.status(201).json({ id: result.lastInsertRowid, message: "User registered successfully" });
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email already in use" });
      }
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/users/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const { password_hash, profile_picture, ...userWithoutSensitive } = user;
      res.json({
        user: {
          ...userWithoutSensitive,
          profile_picture: profile_picture ? profile_picture.toString('base64') : null
        }
      });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/users", (req, res) => {
    try {
      const users = db.prepare("SELECT id, first_name, last_name, email, role, station, is_active, CASE WHEN profile_picture IS NOT NULL THEN profile_picture ELSE NULL END as profile_picture FROM users").all() as any[];
      const formattedUsers = users.map(u => ({
        ...u,
        profile_picture: u.profile_picture ? u.profile_picture.toString('base64') : null
      }));
      res.json(formattedUsers);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // THE ENDPOINT REQUESTED BY THE USER
  app.patch("/api/users/:id", async (req, res) => {
    const userId = req.params.id;
    const updates = { ...req.body };

    const forbiddenFields = ["id", "created_at"];

    // If a plain-text password was sent, hash it and swap it out before building keys
    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    // If a profile picture was sent, strip data URL prefix if present and convert to buffer
    if (updates.profile_picture) {
      console.log("First 100 chars:", updates.profile_picture.substring(0, 100));
      console.log("Includes data prefix:", updates.profile_picture.includes('data:'));
      const base64Data = updates.profile_picture.includes('data:')
        ? updates.profile_picture.split(',')[1]
        : updates.profile_picture;
      updates.profile_picture = Buffer.from(base64Data, "base64");
    }

    const keys = Object.keys(updates).filter(key => !forbiddenFields.includes(key));

    if (keys.length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update." });
    }

    try {
      const setClause = keys
        .map((key, index) => `${key} = ?`)
        .join(", ");

      const sql = `
        UPDATE users 
        SET ${setClause} 
        WHERE id = ?
      `;

      const values = keys.map(key => updates[key]);
      values.push(userId);

      const stmt = db.prepare(sql);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      const updatedUser = db.prepare(`
        SELECT id, first_name, last_name, email, role, station, is_active,
          CASE WHEN profile_picture IS NOT NULL THEN profile_picture ELSE NULL END AS profile_picture
        FROM users WHERE id = ?
      `).get(userId) as any;

      res.json({
        message: "User updated successfully",
        user: {
          ...updatedUser,
          profile_picture: updatedUser.profile_picture ? updatedUser.profile_picture.toString('base64') : null
        }
      });
    } catch (err: any) {
      console.error("Update error:", err);
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email already in use by another account." });
      }
      res.status(500).json({ error: "Server error." });
    }
  });

  // Nests
  app.get("/api/nests", (req, res) => {
    try {
      const nests = db.prepare("SELECT * FROM nests WHERE is_archived = 0").all();
      res.json({ nests });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/nests/:id", (req, res) => {
    try {
      const nest = db.prepare("SELECT * FROM nests WHERE id = ? OR nest_code = ?").get(req.params.id, req.params.id);
      if (!nest) return res.status(404).json({ error: "Nest not found" });
      res.json(nest);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/nests/create", (req, res) => {
    try {
      const payload = { ...req.body };
      // Handle images if they are base64
      ['tri_tl_img', 'tri_tr_img', 'sketch'].forEach(key => {
        if (payload[key] && typeof payload[key] === 'string') {
          const base64Data = payload[key].includes('data:') ? payload[key].split(',')[1] : payload[key];
          payload[key] = Buffer.from(base64Data, "base64");
        }
      });

      const keys = Object.keys(payload);
      const placeholders = keys.map(() => "?").join(", ");
      const sql = `INSERT INTO nests (${keys.join(", ")}) VALUES (${placeholders})`;
      const result = db.prepare(sql).run(...Object.values(payload));
      res.status(201).json({ id: result.lastInsertRowid, message: "Nest created successfully" });
    } catch (err) {
      console.error("Create nest error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/nests/:id/update", (req, res) => {
    try {
      const id = req.params.id;
      const payload = { ...req.body };
      ['tri_tl_img', 'tri_tr_img', 'sketch'].forEach(key => {
        if (payload[key] && typeof payload[key] === 'string') {
          const base64Data = payload[key].includes('data:') ? payload[key].split(',')[1] : payload[key];
          payload[key] = Buffer.from(base64Data, "base64");
        }
      });

      const keys = Object.keys(payload).filter(k => k !== 'id');
      const setClause = keys.map(k => `${k} = ?`).join(", ");
      const sql = `UPDATE nests SET ${setClause} WHERE id = ? OR nest_code = ?`;
      db.prepare(sql).run(...Object.values(payload), id, id);
      res.json({ message: "Nest updated successfully" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Nest Events
  app.get("/api/nests/:id/events", (req, res) => {
    try {
      const events = db.prepare("SELECT * FROM nest_events WHERE nest_code = ?").all(req.params.id);
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/nest-events/create", (req, res) => {
    try {
      const keys = Object.keys(req.body);
      const placeholders = keys.map(() => "?").join(", ");
      const sql = `INSERT INTO nest_events (${keys.join(", ")}) VALUES (${placeholders})`;
      const result = db.prepare(sql).run(...Object.values(req.body));
      res.status(201).json({ id: result.lastInsertRowid, message: "Event created successfully" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/nest-events/:id", (req, res) => {
    try {
      const id = req.params.id;
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at');
      const setClause = keys.map(k => `${k} = ?`).join(", ");
      const sql = `UPDATE nest_events SET ${setClause} WHERE id = ?`;
      db.prepare(sql).run(...Object.values(req.body), id);
      res.json({ message: "Event updated successfully" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/nest-events/event/:id", (req, res) => {
    try {
      const event = db.prepare("SELECT * FROM nest_events WHERE id = ?").get(req.params.id);
      res.json(event);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/users/:id", (req, res) => {
    try {
      const user = db.prepare("SELECT id, first_name, last_name, email, role, station, is_active, CASE WHEN profile_picture IS NOT NULL THEN profile_picture ELSE NULL END as profile_picture FROM users WHERE id = ?").get(req.params.id) as any;
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({
        user: {
          ...user,
          profile_picture: user.profile_picture ? user.profile_picture.toString('base64') : null
        }
      });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/users/change-password", async (req, res) => {
    const { email, current_password, new_password } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user) return res.status(404).json({ error: "User not found" });

      const match = await bcrypt.compare(current_password, user.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid current password" });

      const new_hash = await bcrypt.hash(new_password, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(new_hash, email);
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Morning Surveys
  app.get("/api/morning-surveys", (req, res) => {
    try {
      res.json(db.prepare("SELECT * FROM morning_surveys").all());
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/morning-surveys", (req, res) => {
    try {
      const keys = Object.keys(req.body);
      const placeholders = keys.map(() => "?").join(", ");
      const sql = `INSERT INTO morning_surveys (${keys.join(", ")}) VALUES (${placeholders})`;
      const result = db.prepare(sql).run(...Object.values(req.body));
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Beaches
  app.get("/api/beaches", (req, res) => {
    try {
      res.json(db.prepare("SELECT * FROM beaches").all());
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Initial data seed
  const beachCount = db.prepare("SELECT COUNT(*) as count FROM beaches").get() as any;
  if (beachCount.count === 0) {
    db.prepare("INSERT INTO beaches (name, location) VALUES (?, ?)").run("Rethymno", "Crete");
    db.prepare("INSERT INTO beaches (name, location) VALUES (?, ?)").run("Chania", "Crete");
    db.prepare("INSERT INTO beaches (name, location) VALUES (?, ?)").run("Kyparissia", "Peloponnese");
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
