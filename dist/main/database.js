"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClipsByCategory = exports.deleteClip = exports.updateClip = exports.createClip = exports.getClips = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.setupDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
let db;
const setupDatabase = () => {
    try {
        const dbPath = path_1.default.join(electron_1.app.getPath("userData"), "clip-cutter.db");
        console.log("Database path:", dbPath);
        db = new better_sqlite3_1.default(dbPath);
        db.pragma("journal_mode = WAL");
        createTables();
        insertDefaultCategories();
        console.log("Database setup complete");
    }
    catch (error) {
        console.error("Error setting up database:", error);
    }
};
exports.setupDatabase = setupDatabase;
const createTables = () => {
    // Categories table
    db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Clips table
    db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_path TEXT NOT NULL,
      output_path TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      duration REAL NOT NULL,
      title TEXT NOT NULL,
      categories TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create indexes
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clips_video_path ON clips(video_path);
    CREATE INDEX IF NOT EXISTS idx_clips_categories ON clips(categories);
    CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
  `);
};
const insertDefaultCategories = () => {
    try {
        const existingCategories = db
            .prepare("SELECT COUNT(*) as count FROM categories")
            .get();
        if (existingCategories.count === 0) {
            const defaultCategories = [
                {
                    name: "Offense",
                    color: "#4CAF50",
                    description: "Offensive plays and actions",
                },
                {
                    name: "Defense",
                    color: "#f44336",
                    description: "Defensive plays and actions",
                },
                {
                    name: "Rebounds",
                    color: "#FF9800",
                    description: "Offensive and defensive rebounds",
                },
                {
                    name: "Screens",
                    color: "#9C27B0",
                    description: "Screen actions and plays",
                },
                {
                    name: "Turnovers",
                    color: "#795548",
                    description: "Turnovers and steals",
                },
                {
                    name: "Player 1",
                    color: "#2196F3",
                    description: "Player 1 specific clips",
                },
                {
                    name: "Player 2",
                    color: "#00BCD4",
                    description: "Player 2 specific clips",
                },
                {
                    name: "Player 3",
                    color: "#8BC34A",
                    description: "Player 3 specific clips",
                },
                {
                    name: "Player 4",
                    color: "#FFC107",
                    description: "Player 4 specific clips",
                },
                {
                    name: "Player 5",
                    color: "#E91E63",
                    description: "Player 5 specific clips",
                },
            ];
            const stmt = db.prepare(`
        INSERT INTO categories (name, color, description)
        VALUES (?, ?, ?)
      `);
            defaultCategories.forEach(category => {
                stmt.run(category.name, category.color, category.description);
            });
            console.log("Default categories inserted");
        }
    }
    catch (error) {
        console.error("Error inserting default categories:", error);
    }
};
// Category operations
const getCategories = () => {
    try {
        const stmt = db.prepare("SELECT * FROM categories ORDER BY name ASC");
        return stmt.all();
    }
    catch (error) {
        console.error("Error getting categories:", error);
        return [];
    }
};
exports.getCategories = getCategories;
const createCategory = (category) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO categories (name, color, description)
      VALUES (?, ?, ?)
    `);
        const result = stmt.run(category.name, category.color, category.description || null);
        return {
            id: result.lastInsertRowid,
            ...category,
            created_at: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error("Error creating category:", error);
        throw error;
    }
};
exports.createCategory = createCategory;
const updateCategory = (id, updates) => {
    try {
        const fields = Object.keys(updates).filter(key => key !== "id" && key !== "created_at");
        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => updates[field]);
        const stmt = db.prepare(`UPDATE categories SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
    }
    catch (error) {
        console.error("Error updating category:", error);
        throw error;
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = (id) => {
    try {
        const stmt = db.prepare("DELETE FROM categories WHERE id = ?");
        stmt.run(id);
    }
    catch (error) {
        console.error("Error deleting category:", error);
        throw error;
    }
};
exports.deleteCategory = deleteCategory;
// Clip operations
const getClips = (videoPath) => {
    try {
        let stmt;
        if (videoPath) {
            stmt = db.prepare("SELECT * FROM clips WHERE video_path = ? ORDER BY created_at DESC");
            return stmt.all(videoPath);
        }
        else {
            stmt = db.prepare("SELECT * FROM clips ORDER BY created_at DESC");
            return stmt.all();
        }
    }
    catch (error) {
        console.error("Error getting clips:", error);
        return [];
    }
};
exports.getClips = getClips;
const createClip = (clip) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO clips (video_path, output_path, start_time, end_time, duration, title, categories, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(clip.video_path, clip.output_path, clip.start_time, clip.end_time, clip.duration, clip.title, clip.categories, clip.notes || null);
        return {
            id: result.lastInsertRowid,
            ...clip,
            created_at: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error("Error creating clip:", error);
        throw error;
    }
};
exports.createClip = createClip;
const updateClip = (id, updates) => {
    try {
        const fields = Object.keys(updates).filter(key => key !== "id" && key !== "created_at");
        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => updates[field]);
        const stmt = db.prepare(`UPDATE clips SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
    }
    catch (error) {
        console.error("Error updating clip:", error);
        throw error;
    }
};
exports.updateClip = updateClip;
const deleteClip = (id) => {
    try {
        const stmt = db.prepare("DELETE FROM clips WHERE id = ?");
        stmt.run(id);
    }
    catch (error) {
        console.error("Error deleting clip:", error);
        throw error;
    }
};
exports.deleteClip = deleteClip;
const getClipsByCategory = (categoryId) => {
    try {
        const stmt = db.prepare(`
      SELECT * FROM clips 
      WHERE categories LIKE ? 
      ORDER BY created_at DESC
    `);
        return stmt.all(`%"${categoryId}"%`);
    }
    catch (error) {
        console.error("Error getting clips by category:", error);
        return [];
    }
};
exports.getClipsByCategory = getClipsByCategory;
//# sourceMappingURL=database.js.map