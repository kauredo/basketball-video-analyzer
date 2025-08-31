import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let db: Database.Database;

export interface Category {
  id?: number;
  name: string;
  color: string;
  description?: string;
  parent_id?: number | null; // For subcategories
  project_id: number; // Required for project-specific categories
  created_at?: string;
}

export interface CategoryPreset {
  id?: number;
  preset_name: string;
  category_name: string;
  color: string;
  description?: string;
  parent_name?: string | null; // For subcategories within preset
  sort_order?: number;
  created_at?: string;
}

export interface Project {
  id?: number;
  name: string;
  video_path: string;
  video_name: string;
  description?: string;
  created_at?: string;
  last_opened?: string;
}

export interface Clip {
  id?: number;
  project_id: number;
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

    migrateDatabase();
    createTables();
    insertDefaultCategories();
    console.log("Database setup complete");
  } catch (error) {
    console.error("Error setting up database:", error);
  }
};

const migrateDatabase = () => {
  try {
    // Check if we need to migrate existing clips table
    const tableInfo = db.prepare("PRAGMA table_info(clips)").all() as Array<{
      name: string;
    }>;
    const hasProjectId = tableInfo.some(col => col.name === "project_id");

    if (!hasProjectId) {
      console.log("Migrating database schema...");

      // First, create the projects table
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          video_path TEXT NOT NULL UNIQUE,
          video_name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create a temporary clips table with the new schema
      db.exec(`
        CREATE TABLE clips_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          video_path TEXT NOT NULL,
          output_path TEXT NOT NULL,
          thumbnail_path TEXT,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          duration REAL NOT NULL,
          title TEXT NOT NULL,
          categories TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
      `);

      // Get existing clips
      const existingClips = db.prepare("SELECT * FROM clips").all() as Array<{
        id: number;
        video_path: string;
        output_path: string;
        thumbnail_path?: string;
        start_time: number;
        end_time: number;
        duration: number;
        title: string;
        categories: string;
        notes?: string;
        created_at: string;
      }>;

      if (existingClips.length > 0) {
        console.log(`Migrating ${existingClips.length} existing clips...`);

        // Create projects for unique video paths and migrate clips
        const videoPathToProjectId = new Map<string, number>();

        for (const clip of existingClips) {
          let projectId = videoPathToProjectId.get(clip.video_path);

          if (!projectId) {
            // Create a new project for this video
            const videoName =
              clip.video_path.split(/[/\\]/).pop() || "Untitled Video";
            const projectName = videoName.replace(/\.[^/.]+$/, ""); // Remove extension

            const stmt = db.prepare(`
              INSERT INTO projects (name, video_path, video_name, description)
              VALUES (?, ?, ?, ?)
            `);

            const result = stmt.run(
              projectName,
              clip.video_path,
              videoName,
              `Migrated project for ${videoName}`
            );

            projectId = result.lastInsertRowid as number;
            videoPathToProjectId.set(clip.video_path, projectId);
          }

          // Insert clip with project_id
          const insertStmt = db.prepare(`
            INSERT INTO clips_new (project_id, video_path, output_path, thumbnail_path, start_time, end_time, duration, title, categories, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          insertStmt.run(
            projectId,
            clip.video_path,
            clip.output_path,
            clip.thumbnail_path,
            clip.start_time,
            clip.end_time,
            clip.duration,
            clip.title,
            clip.categories,
            clip.notes,
            clip.created_at
          );
        }
      }

      // Drop old table and rename new one
      db.exec("DROP TABLE clips");
      db.exec("ALTER TABLE clips_new RENAME TO clips");

      console.log("Database migration completed successfully");
    }

    // Check if we need to add parent_id to categories table for subcategories
    const categoriesTableInfo = db
      .prepare("PRAGMA table_info(categories)")
      .all() as Array<{
      name: string;
    }>;
    const hasParentId = categoriesTableInfo.some(
      col => col.name === "parent_id"
    );
    const hasProjectIdInCategories = categoriesTableInfo.some(
      col => col.name === "project_id"
    );

    if (!hasParentId) {
      console.log("Adding subcategories support...");

      // Add parent_id column to categories table
      db.exec(`
        ALTER TABLE categories 
        ADD COLUMN parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE
      `);

      console.log("Subcategories support added successfully");
    }

    if (!hasProjectIdInCategories) {
      console.log("Adding project-specific categories support...");

      // Add project_id column to categories table
      db.exec(`
        ALTER TABLE categories 
        ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE
      `);

      console.log("Project-specific categories support added successfully");
    }

    // Always check and fix categories table constraints if needed
    // Get the current table schema
    const constraintCheckResult = db
      .prepare(
        `
      SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'
    `
      )
      .get() as { sql: string } | undefined;

    console.log("Current categories table schema:", constraintCheckResult?.sql);

    // If the table exists but doesn't have the correct composite constraint, fix it
    if (
      constraintCheckResult &&
      constraintCheckResult.sql &&
      !constraintCheckResult.sql.includes("UNIQUE(name, parent_id, project_id)")
    ) {
      console.log("Categories table has incorrect constraints. Fixing...");

      // Backup existing categories
      const existingCategories = db
        .prepare("SELECT * FROM categories")
        .all() as Category[];
      console.log(
        `Backing up ${existingCategories.length} existing categories`
      );

      // Drop and recreate the table with proper constraints
      db.exec("DROP TABLE IF EXISTS categories");
      db.exec(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          description TEXT,
          parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, parent_id, project_id)
        )
      `);

      // Restore data with default project_id if missing
      if (existingCategories.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO categories (name, color, description, parent_id, project_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        let restoredCount = 0;
        for (const category of existingCategories) {
          try {
            insertStmt.run(
              category.name,
              category.color,
              category.description,
              category.parent_id,
              category.project_id || 1, // Default to project 1 if no project_id
              category.created_at || new Date().toISOString()
            );
            restoredCount++;
          } catch (error) {
            console.log(
              `Skipping duplicate category: ${category.name} - ${error}`
            );
          }
        }
        console.log(`Restored ${restoredCount} categories`);
      }

      console.log("Categories table constraints fixed successfully");
    } else {
      console.log("Categories table constraints are correct");
    }

    // Check if we need to create or migrate the category_presets table
    const tablesResult = db
      .prepare(
        `
      SELECT name FROM sqlite_master WHERE type='table' AND name='category_presets'
    `
      )
      .all();

    if (tablesResult.length === 0) {
      console.log("Creating category presets table...");

      // Create the new category_presets table
      db.exec(`
        CREATE TABLE category_presets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          preset_name TEXT NOT NULL,
          category_name TEXT NOT NULL,
          color TEXT NOT NULL,
          description TEXT,
          parent_name TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(preset_name, category_name, parent_name)
        )
      `);

      console.log("Category presets table created successfully");
    } else {
      // Check if the existing table has the old structure
      const presetTableInfo = db
        .prepare("PRAGMA table_info(category_presets)")
        .all() as Array<{
        name: string;
      }>;

      const hasOldStructure =
        presetTableInfo.some(col => col.name === "name") &&
        presetTableInfo.some(col => col.name === "categories") &&
        !presetTableInfo.some(col => col.name === "preset_name");

      if (hasOldStructure) {
        console.log("Migrating old preset table structure...");

        // Get existing presets from old structure
        const oldPresets = db
          .prepare("SELECT * FROM category_presets")
          .all() as Array<{
          name: string;
          categories: string;
        }>;

        // Rename old table
        db.exec("ALTER TABLE category_presets RENAME TO category_presets_old");

        // Create new table
        db.exec(`
          CREATE TABLE category_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            preset_name TEXT NOT NULL,
            category_name TEXT NOT NULL,
            color TEXT NOT NULL,
            description TEXT,
            parent_name TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(preset_name, category_name, parent_name)
          )
        `);

        // Migrate old presets to new structure
        for (const oldPreset of oldPresets) {
          try {
            const categories = JSON.parse(oldPreset.categories) as Category[];
            for (let i = 0; i < categories.length; i++) {
              const category = categories[i];
              let parentName = null;

              // Try to find parent by parent_id
              if (category.parent_id) {
                const parent = categories.find(
                  c => c.id === category.parent_id
                );
                parentName = parent?.name || null;
              }

              db.prepare(
                `
                INSERT INTO category_presets (preset_name, category_name, color, description, parent_name, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
              `
              ).run(
                oldPreset.name,
                category.name,
                category.color,
                category.description || null,
                parentName,
                i
              );
            }
          } catch (error) {
            console.log(`Error migrating preset ${oldPreset.name}:`, error);
          }
        }

        // Drop old table
        db.exec("DROP TABLE category_presets_old");

        console.log("Old preset table structure migrated successfully");
      }
    }

    // Migrate any existing global categories (project_id = NULL) to presets
    const globalCategories = db
      .prepare(
        `
      SELECT * FROM categories WHERE project_id IS NULL
    `
      )
      .all() as Category[];

    if (globalCategories.length > 0) {
      console.log(
        `Migrating ${globalCategories.length} global categories to presets...`
      );

      // Create a "Default" preset from existing global categories
      for (const category of globalCategories) {
        try {
          db.prepare(
            `
            INSERT INTO category_presets (preset_name, category_name, color, description, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `
          ).run(
            "Default",
            category.name,
            category.color,
            category.description || null,
            0
          );
        } catch (error) {
          console.log(`Skipping duplicate category: ${category.name}`);
        }
      }

      // Remove global categories from categories table
      db.exec("DELETE FROM categories WHERE project_id IS NULL");

      console.log("Global categories migrated to presets successfully");
    }
  } catch (error) {
    console.error("Error during database migration:", error);
    throw error;
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
  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      video_path TEXT NOT NULL UNIQUE,
      video_name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories table - for project-specific categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, parent_id, project_id)
    )
  `);

  // Category presets table - for global preset templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_name TEXT NOT NULL,
      category_name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      parent_name TEXT, -- Reference to parent by name within same preset
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(preset_name, category_name, parent_name)
    )
  `);

  // Clips table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      video_path TEXT NOT NULL,
      output_path TEXT NOT NULL,
      thumbnail_path TEXT,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      duration REAL NOT NULL,
      title TEXT NOT NULL,
      categories TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_video_path ON projects(video_path);
    CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips(project_id);
    CREATE INDEX IF NOT EXISTS idx_clips_video_path ON clips(video_path);
    CREATE INDEX IF NOT EXISTS idx_clips_categories ON clips(categories);
    CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
  `);

  setupKeyBindingsTable();
};

const insertDefaultCategories = () => {
  try {
    // Default categories are no longer inserted automatically since categories
    // are now project-specific. They will be created when users create projects
    // or load presets instead.
    console.log(
      "Skipping default categories insertion - using project-specific categories now"
    );
  } catch (error) {
    console.error("Error in insertDefaultCategories:", error);
  }
};

// Project operations
export const createProject = (
  project: Omit<Project, "id" | "created_at" | "last_opened">
): Project => {
  try {
    const stmt = db.prepare(`
      INSERT INTO projects (name, video_path, video_name, description)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      project.name,
      project.video_path,
      project.video_name,
      project.description || null
    );

    return {
      id: result.lastInsertRowid as number,
      ...project,
      created_at: new Date().toISOString(),
      last_opened: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

export const getProject = (videoPath: string): Project | null => {
  try {
    const stmt = db.prepare("SELECT * FROM projects WHERE video_path = ?");
    return (stmt.get(videoPath) as Project) || null;
  } catch (error) {
    console.error("Error getting project:", error);
    return null;
  }
};

export const getProjects = (): Project[] => {
  try {
    const stmt = db.prepare("SELECT * FROM projects ORDER BY last_opened DESC");
    return stmt.all() as Project[];
  } catch (error) {
    console.error("Error getting projects:", error);
    return [];
  }
};

export const updateProjectLastOpened = (projectId: number): void => {
  try {
    const stmt = db.prepare(
      "UPDATE projects SET last_opened = CURRENT_TIMESTAMP WHERE id = ?"
    );
    stmt.run(projectId);
  } catch (error) {
    console.error("Error updating project last opened:", error);
  }
};

export const deleteProject = (id: number): void => {
  try {
    // This will also delete all associated clips due to CASCADE
    const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
    stmt.run(id);
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};

// Category operations
export const getCategories = (projectId: number): Category[] => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM categories 
      WHERE project_id = ?
      ORDER BY parent_id ASC, name ASC
    `);
    return stmt.all(projectId) as Category[];
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
};

export const getCategoriesHierarchical = (
  projectId: number
): (Category & {
  children?: Category[];
})[] => {
  try {
    const allCategories = getCategories(projectId);
    const parentCategories = allCategories.filter(cat => !cat.parent_id);

    return parentCategories.map(parent => ({
      ...parent,
      children: allCategories.filter(cat => cat.parent_id === parent.id),
    }));
  } catch (error) {
    console.error("Error getting hierarchical categories:", error);
    return [];
  }
};

export const createCategory = (
  category: Omit<Category, "id" | "created_at">
): Category => {
  try {
    const stmt = db.prepare(`
      INSERT INTO categories (name, color, description, parent_id, project_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      category.name,
      category.color,
      category.description || null,
      category.parent_id || null,
      category.project_id
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

// Category preset operations
export const savePreset = (
  presetName: string,
  categories: Category[]
): void => {
  try {
    // First, delete any existing preset with this name
    db.prepare("DELETE FROM category_presets WHERE preset_name = ?").run(
      presetName
    );

    // Insert categories as preset
    const stmt = db.prepare(`
      INSERT INTO category_presets (preset_name, category_name, color, description, parent_name, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    categories.forEach((category, index) => {
      // Find parent name if exists
      let parentName = null;
      if (category.parent_id) {
        const parent = categories.find(c => c.id === category.parent_id);
        parentName = parent?.name || null;
      }

      stmt.run(
        presetName,
        category.name,
        category.color,
        category.description || null,
        parentName,
        index
      );
    });
  } catch (error) {
    console.error("Error saving preset:", error);
    throw error;
  }
};

export const loadPreset = (presetName: string): CategoryPreset[] => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM category_presets 
      WHERE preset_name = ? 
      ORDER BY sort_order, category_name
    `);
    return stmt.all(presetName) as CategoryPreset[];
  } catch (error) {
    console.error("Error loading preset:", error);
    return [];
  }
};

export const getPresets = (): string[] => {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT preset_name FROM category_presets 
      ORDER BY preset_name
    `);
    return stmt.all().map((row: any) => row.preset_name);
  } catch (error) {
    console.error("Error getting presets:", error);
    return [];
  }
};

export const deletePreset = (presetName: string): void => {
  try {
    db.prepare("DELETE FROM category_presets WHERE preset_name = ?").run(
      presetName
    );
  } catch (error) {
    console.error("Error deleting preset:", error);
    throw error;
  }
};

export const importPresetToProject = async (
  presetName: string,
  projectId: number
): Promise<void> => {
  try {
    // Clear existing categories for the project
    clearProjectCategories(projectId);

    // Load preset data
    const presetCategories = loadPreset(presetName);

    // Create categories from preset, handling parent-child relationships
    const categoryMap = new Map<string, number>(); // preset name -> new category ID

    // First pass: Create parent categories
    for (const presetCat of presetCategories.filter(c => !c.parent_name)) {
      const newCategory = createCategory({
        name: presetCat.category_name,
        color: presetCat.color,
        description: presetCat.description,
        project_id: projectId,
      });
      categoryMap.set(presetCat.category_name, newCategory.id!);
    }

    // Second pass: Create child categories
    for (const presetCat of presetCategories.filter(c => c.parent_name)) {
      const parentId = categoryMap.get(presetCat.parent_name!);
      if (parentId) {
        const newCategory = createCategory({
          name: presetCat.category_name,
          color: presetCat.color,
          description: presetCat.description,
          parent_id: parentId,
          project_id: projectId,
        });
        categoryMap.set(presetCat.category_name, newCategory.id!);
      }
    }
  } catch (error) {
    console.error("Error importing preset to project:", error);
    throw error;
  }
};

export const clearProjectCategories = (projectId: number): void => {
  try {
    const stmt = db.prepare("DELETE FROM categories WHERE project_id = ?");
    stmt.run(projectId);
  } catch (error) {
    console.error("Error clearing project categories:", error);
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
export const getClips = (projectId?: number): Clip[] => {
  try {
    let stmt;
    if (projectId) {
      stmt = db.prepare(
        "SELECT * FROM clips WHERE project_id = ? ORDER BY created_at DESC"
      );
      return stmt.all(projectId) as Clip[];
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
      INSERT INTO clips (project_id, video_path, output_path, thumbnail_path, start_time, end_time, duration, title, categories, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      clip.project_id,
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
