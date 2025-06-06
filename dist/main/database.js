"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTagsByTimeRange = exports.loadClips = exports.createClip = exports.loadTags = exports.deleteTag = exports.saveTag = exports.setupDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
let db;
const setupDatabase = () => {
    try {
        const dbPath = path_1.default.join(electron_1.app.getPath("userData"), "basketball-analyzer.db");
        console.log("Database path:", dbPath);
        db = new better_sqlite3_1.default(dbPath);
        // Enable WAL mode for better performance
        db.pragma("journal_mode = WAL");
        createTables();
        console.log("Database setup complete");
    }
    catch (error) {
        console.error("Error setting up database:", error);
    }
};
exports.setupDatabase = setupDatabase;
const createTables = () => {
    // Create tags table
    db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_path TEXT NOT NULL,
      timestamp REAL NOT NULL,
      tag_type TEXT NOT NULL,
      description TEXT,
      player TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create clips table
    db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_path TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      title TEXT NOT NULL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create indexes for better performance
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tags_video_path ON tags(video_path);
    CREATE INDEX IF NOT EXISTS idx_tags_timestamp ON tags(timestamp);
    CREATE INDEX IF NOT EXISTS idx_clips_video_path ON clips(video_path);
  `);
};
const saveTag = (tag) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO tags (video_path, timestamp, tag_type, description, player)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(tag.video_path, tag.timestamp, tag.tag_type, tag.description || null, tag.player || null);
        return {
            id: result.lastInsertRowid,
            ...tag,
            created_at: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error("Error saving tag:", error);
        throw error;
    }
};
exports.saveTag = saveTag;
const deleteTag = (tagId) => {
    try {
        const stmt = db.prepare("DELETE FROM tags WHERE id = ?");
        stmt.run(tagId);
    }
    catch (error) {
        console.error("Error deleting tag:", error);
        throw error;
    }
};
exports.deleteTag = deleteTag;
const loadTags = (videoPath) => {
    try {
        const stmt = db.prepare(`
      SELECT * FROM tags 
      WHERE video_path = ? 
      ORDER BY timestamp ASC
    `);
        return stmt.all(videoPath);
    }
    catch (error) {
        console.error("Error loading tags:", error);
        return [];
    }
};
exports.loadTags = loadTags;
const createClip = (clip) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO clips (video_path, start_time, end_time, title, tags)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(clip.video_path, clip.start_time, clip.end_time, clip.title, clip.tags || null);
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
const loadClips = (videoPath) => {
    try {
        const stmt = db.prepare(`
      SELECT * FROM clips 
      WHERE video_path = ? 
      ORDER BY start_time ASC
    `);
        return stmt.all(videoPath);
    }
    catch (error) {
        console.error("Error loading clips:", error);
        return [];
    }
};
exports.loadClips = loadClips;
const getTagsByTimeRange = (videoPath, startTime, endTime) => {
    try {
        const stmt = db.prepare(`
      SELECT * FROM tags 
      WHERE video_path = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `);
        return stmt.all(videoPath, startTime, endTime);
    }
    catch (error) {
        console.error("Error getting tags by time range:", error);
        return [];
    }
};
exports.getTagsByTimeRange = getTagsByTimeRange;
//# sourceMappingURL=database.js.map