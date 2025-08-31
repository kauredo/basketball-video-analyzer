import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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

import { Category } from "../../types/global";

interface CategoryManagerProps {
  onCategoriesChange: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  onCategoriesChange,
}) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set()
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "#4CAF50",
    description: "",
  });
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<number | null>(
    null
  );
  const [newSubcategory, setNewSubcategory] = useState({
    name: "",
    color: "#4CAF50",
    description: "",
  });

  useEffect(() => {
    loadCategories();
    loadPresets();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await window.electronAPI.getCategoriesHierarchical();
      setCategories(cats);

      // Auto-expand categories that have children
      const expandedIds = new Set<number>();
      cats.forEach(category => {
        if (category.children && category.children.length > 0) {
          expandedIds.add(category.id!);
        }
      });
      setExpandedCategories(expandedIds);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadPresets = async () => {
    try {
      const presetList = await window.electronAPI.getPresets();
      setPresets(presetList);
    } catch (error) {
      console.error("Failed to load presets:", error);
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
      alert(t("app.categories.errorCreating"));
    }
  };

  const handleCreateSubcategory = async (
    parentId: number,
    parentColor: string
  ) => {
    if (!newSubcategory.name.trim()) return;

    try {
      await window.electronAPI.createCategory({
        name: newSubcategory.name.trim(),
        color: parentColor, // Inherit parent color
        description: newSubcategory.description.trim() || undefined,
        parent_id: parentId,
      });

      setNewSubcategory({ name: "", color: "#4CAF50", description: "" });
      setAddingSubcategoryTo(null);
      // Expand the parent category to show the new subcategory
      setExpandedCategories(prev => new Set([...prev, parentId]));
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error("Error creating subcategory:", error);
      alert(t("app.categories.errorCreating"));
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || editingCategory.id === undefined) return;

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
      alert(t("app.categories.errorUpdating"));
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm(t("app.categories.confirmDelete"))) {
      return;
    }

    try {
      await window.electronAPI.deleteCategory(id);
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error("Error deleting category:", error);
      alert(t("app.categories.errorDeleting"));
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      alert("Please enter a preset name");
      return;
    }

    try {
      await window.electronAPI.savePreset(newPresetName, categories);
      setNewPresetName("");
      loadPresets();
      alert(t("app.categories.presets.saveSuccess"));
    } catch (error) {
      console.error("Failed to save preset:", error);
      alert(t("app.categories.presets.saveFailed"));
    }
  };

  const handleLoadPreset = async (presetName: string) => {
    if (!confirm(t("app.categories.presets.confirmLoad", { presetName }))) {
      return;
    }

    try {
      const loadedCategories = await window.electronAPI.loadPreset(presetName);
      // Delete all existing categories first
      for (const category of categories) {
        if (category.id) {
          await window.electronAPI.deleteCategory(category.id);
        }
      }
      // Create new categories from preset
      for (const category of loadedCategories) {
        await window.electronAPI.createCategory({
          name: category.name,
          color: category.color,
          description: category.description,
        });
      }
      await loadCategories();
      onCategoriesChange();
      alert(t("app.categories.presets.loadSuccess"));
    } catch (error) {
      console.error("Failed to load preset:", error);
      alert(t("app.categories.presets.loadFailed"));
    }
  };

  const toggleExpanded = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id!);

    return (
      <div
        key={category.id}
        className={styles.categoryItem}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <div className={styles.categoryHeader}>
          <div
            className={styles.categoryColorIndicator}
            style={{ backgroundColor: category.color }}
          />

          {/* Show expand button for parent categories or if has children */}
          {(hasChildren || level === 0) && (
            <button
              onClick={() => hasChildren && toggleExpanded(category.id!)}
              className={`${styles.expandButton} ${
                hasChildren ? styles.hasChildren : styles.noChildren
              }`}
              disabled={!hasChildren}
            >
              {hasChildren ? (isExpanded ? "▼" : "▶") : "○"}
            </button>
          )}

          {editingCategory?.id === category.id && editingCategory ? (
            <div className={styles.categoryEditForm}>
              <div className={styles.editFormHeader}>
                <h4>Edit Category</h4>
              </div>

              <div className={styles.editFormContent}>
                <div className={styles.formGroup}>
                  <label>Category Name</label>
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={e => {
                      const updatedCategory: Category = {
                        ...editingCategory,
                        name: e.target.value,
                      };
                      setEditingCategory(updatedCategory);
                    }}
                    className={styles.editInput}
                    placeholder="Enter category name..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Color</label>
                  <div className={styles.colorPicker}>
                    {colorPresets.map(color => (
                      <button
                        key={color}
                        className={`${styles.colorOption} ${
                          editingCategory.color === color ? styles.selected : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          const updatedCategory: Category = {
                            ...editingCategory,
                            color,
                          };
                          setEditingCategory(updatedCategory);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Description (optional)</label>
                  <input
                    type="text"
                    value={editingCategory.description || ""}
                    onChange={e => {
                      const updatedCategory: Category = {
                        ...editingCategory,
                        description: e.target.value,
                      };
                      setEditingCategory(updatedCategory);
                    }}
                    placeholder="Add a description..."
                    className={styles.editInput}
                  />
                </div>

                <div className={styles.editActions}>
                  <button
                    onClick={handleUpdateCategory}
                    className={styles.saveBtn}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Save Changes
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className={styles.cancelBtn}
                  >
                    <FontAwesomeIcon icon={faXmark} /> Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.categoryInfo}>
              <div className={styles.categoryName}>
                {level > 0 && (
                  <span className={styles.subcategoryIndicator}>↳ </span>
                )}
                {category.name}
              </div>
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
                    onClick={() =>
                      category.id && handleDeleteCategory(category.id)
                    }
                    className={styles.deleteBtn}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                  {level === 0 && (
                    <button
                      onClick={() => setAddingSubcategoryTo(category.id!)}
                      className={styles.addSubBtn}
                      title="Add subcategory"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Subcategory Form */}
        {addingSubcategoryTo === category.id && (
          <div className={styles.addSubcategoryForm}>
            <div className={styles.subcategoryFormHeader}>
              <div
                className={styles.colorIndicator}
                style={{ backgroundColor: category.color }}
              ></div>
              <h5>Add Subcategory to "{category.name}"</h5>
            </div>

            <div className={styles.formGroup}>
              <input
                type="text"
                value={newSubcategory.name}
                onChange={e =>
                  setNewSubcategory({ ...newSubcategory, name: e.target.value })
                }
                placeholder="Enter subcategory name (e.g., Top, Side, 60°)..."
                className={styles.subcategoryNameInput}
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <input
                type="text"
                value={newSubcategory.description}
                onChange={e =>
                  setNewSubcategory({
                    ...newSubcategory,
                    description: e.target.value,
                  })
                }
                placeholder="Description (optional)..."
                className={styles.subcategoryDescriptionInput}
              />
            </div>

            <div className={styles.subcategoryActions}>
              <button
                onClick={() =>
                  handleCreateSubcategory(category.id!, category.color)
                }
                disabled={!newSubcategory.name.trim()}
                className={styles.createSubcategoryBtn}
              >
                <FontAwesomeIcon icon={faCheck} /> Add Subcategory
              </button>
              <button
                onClick={() => {
                  setAddingSubcategoryTo(null);
                  setNewSubcategory({
                    name: "",
                    color: "#4CAF50",
                    description: "",
                  });
                }}
                className={styles.cancelBtn}
              >
                <FontAwesomeIcon icon={faXmark} /> Cancel
              </button>
            </div>
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className={styles.subcategories}>
            {category.children!.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
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
          <FontAwesomeIcon icon={faFolderTree} /> {t("app.categories.title")}
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={styles.editToggleBtn}
        >
          {isEditing ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> {t("app.buttons.done")}
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faEdit} /> {t("app.buttons.edit")}
            </>
          )}
        </button>
      </div>

      <div className={styles.presetManager}>
        <h4>{t("app.categories.presets.title")}</h4>
        <div className={styles.presetControls}>
          <input
            type="text"
            value={newPresetName}
            onChange={e => setNewPresetName(e.target.value)}
            placeholder={t("app.categories.presets.enterName")}
            className={styles.presetNameInput}
          />
          <button
            onClick={handleSavePreset}
            disabled={!newPresetName.trim()}
            className={styles.savePresetBtn}
          >
            {t("app.categories.presets.save")}
          </button>
        </div>
        {presets.length > 0 && (
          <div className={styles.presetList}>
            <h4>{t("app.categories.presets.load")}</h4>
            <div className={styles.presetButtons}>
              {presets.map(preset => (
                <button
                  key={preset}
                  onClick={() => handleLoadPreset(preset)}
                  className={styles.loadPresetBtn}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category List */}
      <div className={styles.categoryList}>
        {/* Debug Info */}
        <div
          style={{
            padding: "10px",
            background: "#f0f0f0",
            margin: "10px 0",
            borderRadius: "5px",
          }}
        >
          <strong>Debug Info:</strong>
          <div>Total categories loaded: {categories.length}</div>
          <div>
            Categories with children:{" "}
            {categories.filter(c => c.children && c.children.length > 0).length}
          </div>
          <div>
            Expanded categories: {Array.from(expandedCategories).join(", ")}
          </div>
        </div>

        {categories
          .filter(category => !category.parent_id) // Only show top-level categories
          .map(category => renderCategory(category))}
      </div>

      {/* Add New Category */}
      {isEditing && (
        <div className={styles.addCategoryForm}>
          <h4>
            <FontAwesomeIcon icon={faPlus} /> {t("app.categories.addNew")}
          </h4>

          <input
            type="text"
            value={newCategory.name}
            onChange={e =>
              setNewCategory({ ...newCategory, name: e.target.value })
            }
            placeholder={t("app.categories.placeholder")}
            className={styles.categoryNameInput}
          />

          <div className={styles.colorPicker}>
            <label>{t("app.categories.colorLabel")}</label>
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
            placeholder={t("app.categories.descriptionPlaceholder")}
            className={styles.categoryDescriptionInput}
          />

          <button
            onClick={handleCreateCategory}
            disabled={!newCategory.name.trim()}
            className={styles.createCategoryBtn}
          >
            <FontAwesomeIcon icon={faPlus} /> {t("app.categories.add")}
          </button>
        </div>
      )}
    </div>
  );
};
