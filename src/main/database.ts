import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let db: Database.Database;

export interface Category {
  id?: number;
  name: string;
  color: string;
  description?: string;
  created_at?: string;
}

export interface Clip {
  id?: number;
  video_path: string;
  output_path: string;
  thumbnail_path?: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  categories: string; // JSON array of category IDs
  notes?: string;
  created_at?: string;
}

export interface KeyBindings {
  markInKey: string;
  markOutKey: string;
}

export const setupDatabase = () => {
  try {
    const dbPath = path.join(app.getPath("userData"), "clip-cutter.db");
    console.log("Database path:", dbPath);

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    createTables();
    insertDefaultCategories();
    console.log("Database setup complete");
  } catch (error) {
    console.error("Error setting up database:", error);
  }
};

const setupKeyBindingsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS key_bindings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO key_bindings (key, value) VALUES 
      ('markInKey', 'z'),
      ('markOutKey', 'm');
  `);
};

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
      thumbnail_path TEXT,
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

  setupKeyBindingsTable();
};

const insertDefaultCategories = () => {
  try {
    const existingCategories = db
      .prepare("SELECT COUNT(*) as count FROM categories")
      .get() as { count: number };

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
  } catch (error) {
    console.error("Error inserting default categories:", error);
  }
};

// Category operations
export const getCategories = (): Category[] => {
  try {
    const stmt = db.prepare("SELECT * FROM categories ORDER BY name ASC");
    return stmt.all() as Category[];
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
};

export const createCategory = (
  category: Omit<Category, "id" | "created_at">
): Category => {
  try {
    const stmt = db.prepare(`
      INSERT INTO categories (name, color, description)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      category.name,
      category.color,
      category.description || null
    );

    return {
      id: result.lastInsertRowid as number,
      ...category,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error creating category:", error);
    throw error;
  }
};

export const updateCategory = (
  id: number,
  updates: Partial<Category>
): void => {
  try {
    const fields = Object.keys(updates).filter(
      key => key !== "id" && key !== "created_at"
    );
    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => updates[field as keyof Category]);

    const stmt = db.prepare(`UPDATE categories SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  } catch (error) {
    console.error("Error updating category:", error);
    throw error;
  }
};

export const deleteCategory = (id: number): void => {
  try {
    const stmt = db.prepare("DELETE FROM categories WHERE id = ?");
    stmt.run(id);
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
};

// Clip operations
export const getClips = (videoPath?: string): Clip[] => {
  try {
    let stmt;
    if (videoPath) {
      stmt = db.prepare(
        "SELECT * FROM clips WHERE video_path = ? ORDER BY created_at DESC"
      );
      return stmt.all(videoPath) as Clip[];
    } else {
      stmt = db.prepare("SELECT * FROM clips ORDER BY created_at DESC");
      return stmt.all() as Clip[];
    }
  } catch (error) {
    console.error("Error getting clips:", error);
    return [];
  }
};

export const createClip = (clip: Omit<Clip, "id" | "created_at">): Clip => {
  try {
    const stmt = db.prepare(`
      INSERT INTO clips (video_path, output_path, thumbnail_path, start_time, end_time, duration, title, categories, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      clip.video_path,
      clip.output_path,
      clip.thumbnail_path,
      clip.start_time,
      clip.end_time,
      clip.duration,
      clip.title,
      clip.categories,
      clip.notes || null
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

export const updateClip = (id: number, updates: Partial<Clip>): void => {
  try {
    const fields = Object.keys(updates).filter(
      key => key !== "id" && key !== "created_at"
    );
    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => updates[field as keyof Clip]);

    const stmt = db.prepare(`UPDATE clips SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  } catch (error) {
    console.error("Error updating clip:", error);
    throw error;
  }
};

export const deleteClip = (id: number): void => {
  try {
    const stmt = db.prepare("DELETE FROM clips WHERE id = ?");
    stmt.run(id);
  } catch (error) {
    console.error("Error deleting clip:", error);
    throw error;
  }
};

export const getClipsByCategory = (categoryId: number): Clip[] => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM clips 
      WHERE categories LIKE ? 
      ORDER BY created_at DESC
    `);

    return stmt.all(`%"${categoryId}"%`) as Clip[];
  } catch (error) {
    console.error("Error getting clips by category:", error);
    return [];
  }
};

export const getKeyBindings = (): KeyBindings => {
  const rows = db.prepare("SELECT key, value FROM key_bindings").all() as {
    key: string;
    value: string;
  }[];

  return rows.reduce(
    (acc, row) => ({
      ...acc,
      [row.key]: row.value,
    }),
    { markInKey: "z", markOutKey: "m" } as KeyBindings
  );
};

export const setKeyBinding = (key: keyof KeyBindings, value: string): void => {
  db.prepare("UPDATE key_bindings SET value = ? WHERE key = ?").run(value, key);
};

export const resetDatabase = () => {
  try {
    // Drop existing tables
    db.exec(`
      DROP TABLE IF EXISTS clips;
      DROP TABLE IF EXISTS categories;
    `);

    // Recreate tables and insert default data
    createTables();
    insertDefaultCategories();
    console.log("Database reset complete");
  } catch (error) {
    console.error("Error resetting database:", error);
  }
};

// Category preset operations
export const savePreset = (
  presetName: string,
  categories: Category[]
): void => {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS category_presets (
    name TEXT PRIMARY KEY,
    categories TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
  ).run();

  db.prepare(
    `INSERT OR REPLACE INTO category_presets (name, categories) VALUES (?, ?)`
  ).run(presetName, JSON.stringify(categories));
};

export const loadPreset = (presetName: string): Category[] => {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS category_presets (
    name TEXT PRIMARY KEY,
    categories TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
  ).run();

  const preset = db
    .prepare(`SELECT categories FROM category_presets WHERE name = ?`)
    .get(presetName) as { categories: string } | undefined;

  if (!preset) {
    throw new Error(`Preset ${presetName} not found`);
  }

  return JSON.parse(preset.categories);
};

export const getPresets = (): string[] => {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS category_presets (
    name TEXT PRIMARY KEY,
    categories TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
  ).run();

  const presets = db.prepare(`SELECT name FROM category_presets`).all() as {
    name: string;
  }[];
  return presets.map(p => p.name);
};
