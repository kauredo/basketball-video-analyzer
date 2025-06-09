import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolderTree,
  faEdit,
  faCheck,
  faTrash,
  faSave,
  faXmark,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/CategoryManager.module.css";

interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface CategoryManagerProps {
  onCategoriesChange: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  onCategoriesChange,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "#4CAF50",
    description: "",
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await window.electronAPI.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) return;

    try {
      await window.electronAPI.createCategory({
        name: newCategory.name.trim(),
        color: newCategory.color,
        description: newCategory.description.trim() || undefined,
      });

      setNewCategory({ name: "", color: "#4CAF50", description: "" });
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error("Error creating category:", error);
      alert("Error creating category. Name might already exist.");
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      await window.electronAPI.updateCategory(editingCategory.id, {
        name: editingCategory.name.trim(),
        color: editingCategory.color,
        description: editingCategory.description?.trim() || undefined,
      });

      setEditingCategory(null);
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Error updating category. Name might already exist.");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? This will not delete existing clips."
      )
    ) {
      return;
    }

    try {
      await window.electronAPI.deleteCategory(id);
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Error deleting category.");
    }
  };

  const colorPresets = [
    "#4CAF50",
    "#2196F3",
    "#FF9800",
    "#f44336",
    "#9C27B0",
    "#00BCD4",
    "#8BC34A",
    "#FFC107",
    "#E91E63",
    "#795548",
    "#607D8B",
    "#FF5722",
    "#3F51B5",
    "#009688",
    "#CDDC39",
  ];

  return (
    <div className={styles.categoryManager}>
      <div className={styles.categoryHeader}>
        <h3>
          <FontAwesomeIcon icon={faFolderTree} /> Categories
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={styles.editToggleBtn}
        >
          {isEditing ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> Done
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faEdit} /> Edit
            </>
          )}
        </button>
      </div>

      {/* Category List */}
      <div className={styles.categoryList}>
        {categories.map(category => (
          <div key={category.id} className={styles.categoryItem}>
            <div
              className={styles.categoryColorIndicator}
              style={{ backgroundColor: category.color }}
            />

            {editingCategory?.id === category.id ? (
              <div className={styles.categoryEditForm}>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={e =>
                    setEditingCategory({
                      ...editingCategory,
                      name: e.target.value,
                    })
                  }
                  className={styles.categoryNameInput}
                  placeholder="Category name"
                />

                <div className={styles.colorPicker}>
                  {colorPresets.map(color => (
                    <button
                      key={color}
                      className={`${styles.colorOption} ${
                        editingCategory.color === color ? styles.selected : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setEditingCategory({
                          ...editingCategory,
                          color,
                        })
                      }
                    />
                  ))}
                </div>

                <input
                  type="text"
                  value={editingCategory.description || ""}
                  onChange={e =>
                    setEditingCategory({
                      ...editingCategory,
                      description: e.target.value,
                    })
                  }
                  className={styles.categoryDescriptionInput}
                  placeholder="Description (optional)"
                />

                <div className={styles.editActions}>
                  <button
                    onClick={handleUpdateCategory}
                    className={styles.saveBtn}
                  >
                    <FontAwesomeIcon icon={faSave} /> Save
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className={styles.cancelBtn}
                  >
                    <FontAwesomeIcon icon={faXmark} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.categoryInfo}>
                <div className={styles.categoryName}>{category.name}</div>
                {category.description && (
                  <div className={styles.categoryDescription}>
                    {category.description}
                  </div>
                )}

                {isEditing && (
                  <div className={styles.categoryActions}>
                    <button
                      onClick={() => setEditingCategory(category)}
                      className={styles.editBtn}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className={styles.deleteBtn}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Category */}
      {isEditing && (
        <div className={styles.addCategoryForm}>
          <h4>
            <FontAwesomeIcon icon={faPlus} /> Add New Category
          </h4>

          <input
            type="text"
            value={newCategory.name}
            onChange={e =>
              setNewCategory({ ...newCategory, name: e.target.value })
            }
            placeholder="Category name"
            className={styles.categoryNameInput}
          />

          <div className={styles.colorPicker}>
            <label>Color:</label>
            {colorPresets.map(color => (
              <button
                key={color}
                className={`${styles.colorOption} ${
                  newCategory.color === color ? styles.selected : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setNewCategory({ ...newCategory, color })}
              />
            ))}
          </div>

          <input
            type="text"
            value={newCategory.description}
            onChange={e =>
              setNewCategory({ ...newCategory, description: e.target.value })
            }
            placeholder="Description (optional)"
            className={styles.categoryDescriptionInput}
          />

          <button
            onClick={handleCreateCategory}
            disabled={!newCategory.name.trim()}
            className={styles.createCategoryBtn}
          >
            <FontAwesomeIcon icon={faPlus} /> Create Category
          </button>
        </div>
      )}
    </div>
  );
};
