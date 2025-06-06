import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let db: Database.Database;

export interface Tag {
  id?: number;
  video_path: string;
  timestamp: number;
  tag_type: string;
  description?: string;
  player?: string;
  created_at?: string;
}

export interface Clip {
  id?: number;
  video_path: string;
  start_time: number;
  end_time: number;
  title: string;
  tags?: string;
  created_at?: string;
}

export const setupDatabase = () => {
  try {
    const dbPath = path.join(app.getPath("userData"), "basketball-analyzer.db");
    console.log("Database path:", dbPath);

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma("journal_mode = WAL");

    createTables();
    console.log("Database setup complete");
  } catch (error) {
    console.error("Error setting up database:", error);
  }
};

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

export const saveTag = (tag: Omit<Tag, "id" | "created_at">): Tag => {
  try {
    const stmt = db.prepare(`
      INSERT INTO tags (video_path, timestamp, tag_type, description, player)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      tag.video_path,
      tag.timestamp,
      tag.tag_type,
      tag.description || null,
      tag.player || null
    );

    return {
      id: result.lastInsertRowid as number,
      ...tag,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error saving tag:", error);
    throw error;
  }
};

export const deleteTag = (tagId: number): void => {
  try {
    const stmt = db.prepare("DELETE FROM tags WHERE id = ?");
    stmt.run(tagId);
  } catch (error) {
    console.error("Error deleting tag:", error);
    throw error;
  }
};

export const loadTags = (videoPath: string): Tag[] => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM tags 
      WHERE video_path = ? 
      ORDER BY timestamp ASC
    `);

    return stmt.all(videoPath) as Tag[];
  } catch (error) {
    console.error("Error loading tags:", error);
    return [];
  }
};

export const createClip = (clip: Omit<Clip, "id" | "created_at">): Clip => {
  try {
    const stmt = db.prepare(`
      INSERT INTO clips (video_path, start_time, end_time, title, tags)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      clip.video_path,
      clip.start_time,
      clip.end_time,
      clip.title,
      clip.tags || null
    );

    return {
      id: result.lastInsertRowid as number,
      ...clip,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error creating clip:", error);
    throw error;
  }
};

export const loadClips = (videoPath: string): Clip[] => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM clips 
      WHERE video_path = ? 
      ORDER BY start_time ASC
    `);

    return stmt.all(videoPath) as Clip[];
  } catch (error) {
    console.error("Error loading clips:", error);
    return [];
  }
};

export const getTagsByTimeRange = (
  videoPath: string,
  startTime: number,
  endTime: number
): Tag[] => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM tags 
      WHERE video_path = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(videoPath, startTime, endTime) as Tag[];
  } catch (error) {
    console.error("Error getting tags by time range:", error);
    return [];
  }
};
