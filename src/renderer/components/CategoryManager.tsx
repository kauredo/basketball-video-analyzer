import React, { useState, useEffect, useRef, useCallback } from "react";
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
  currentProject: any | null;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  onCategoriesChange,
  currentProject,
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

  // Refs for focus management
  const editInputRef = useRef<HTMLInputElement>(null);
  const editDescriptionRef = useRef<HTMLInputElement>(null);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);

  // Debounce timer to prevent excessive updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadCategories();
    }
    loadPresets();
  }, [currentProject]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingCategory && editInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        editInputRef.current?.focus();
        const input = editInputRef.current;
        if (input) {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 100);
    }
  }, [editingCategory]);

  // Focus subcategory input when adding subcategory
  useEffect(() => {
    if (addingSubcategoryTo && subcategoryInputRef.current) {
      setTimeout(() => {
        subcategoryInputRef.current?.focus();
      }, 100);
    }
  }, [addingSubcategoryTo]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      if (!currentProject) return;

      const cats = await window.electronAPI.getCategoriesHierarchical(
        currentProject.id
      );
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
  }, [currentProject]);

  const loadPresets = async () => {
    try {
      const presetList = await window.electronAPI.getPresets();
      setPresets(presetList);
    } catch (error) {
      console.error("Failed to load presets:", error);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim() || !currentProject) return;

    try {
      await window.electronAPI.createCategory({
        name: newCategory.name.trim(),
        color: newCategory.color,
        description: newCategory.description.trim() || undefined,
        project_id: currentProject.id,
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
    if (!newSubcategory.name.trim() || !currentProject) return;

    try {
      await window.electronAPI.createCategory({
        name: newSubcategory.name.trim(),
        color: parentColor, // Inherit parent color
        description: newSubcategory.description.trim() || undefined,
        parent_id: parentId,
        project_id: currentProject.id,
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

  const handleUpdateCategory = useCallback(async () => {
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
  }, [editingCategory, loadCategories, onCategoriesChange, t]);

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
      // Flatten the hierarchical categories structure into a flat array
      const flatCategories: Category[] = [];

      categories.forEach(parentCategory => {
        // Add the parent category
        flatCategories.push(parentCategory);

        // Add all children if they exist
        if (parentCategory.children && parentCategory.children.length > 0) {
          parentCategory.children.forEach(child => {
            flatCategories.push(child);
          });
        }
      });

      await window.electronAPI.savePreset(newPresetName, flatCategories);
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

    if (!currentProject) {
      alert("No project selected");
      return;
    }

    try {
      const loadedCategories = await window.electronAPI.loadPreset(presetName);

      // Filter out categories with invalid names
      const validCategories = loadedCategories.filter(
        category =>
          category.category_name && category.category_name.trim() !== ""
      );

      if (validCategories.length === 0) {
        console.warn("No valid categories found in preset:", presetName);
        alert(t("app.categories.presets.loadFailed"));
        return;
      }

      // Clear all existing categories for this project first
      await window.electronAPI.clearProjectCategories(currentProject.id);

      // After clearing, there should be no existing categories for this project
      const existingNames = new Set<string>();

      // Create new categories from preset, handling parent-child relationships
      const createdCategories = [];
      const categoryMap = new Map<string, number>(); // Map preset category names to created IDs

      // First pass: Create all parent categories (those without parent_name)
      for (const category of validCategories.filter(cat => !cat.parent_name)) {
        let categoryName = category.category_name;
        let counter = 1;

        // Make name unique if it already exists
        while (existingNames.has(categoryName.toLowerCase())) {
          categoryName = `${category.category_name} (${counter})`;
          counter++;
        }

        try {
          const newCategory = await window.electronAPI.createCategory({
            name: categoryName,
            color: category.color,
            description: category.description || "",
            project_id: currentProject.id,
            parent_id: null,
          });

          if (newCategory) {
            // Add to existing names to avoid duplicates within this preset
            existingNames.add(categoryName.toLowerCase());
            createdCategories.push(categoryName);
            categoryMap.set(category.category_name, newCategory.id);
          }
        } catch (error) {
          console.warn(
            `Failed to create parent category "${categoryName}":`,
            error
          );
        }
      }

      // Second pass: Create subcategories (those with parent_name)
      for (const category of validCategories.filter(cat => cat.parent_name)) {
        const parentId = categoryMap.get(category.parent_name);
        if (!parentId) {
          console.warn(
            `Parent category "${category.parent_name}" not found for "${category.category_name}"`
          );
          continue;
        }

        let categoryName = category.category_name;
        let counter = 1;

        // For subcategories, we need to ensure names are unique within the parent
        // Since we cleared all categories, we just need to check within this preset creation
        const subcategoriesInThisParent = new Set<string>();

        while (subcategoriesInThisParent.has(categoryName.toLowerCase())) {
          categoryName = `${category.category_name} (${counter})`;
          counter++;
        }

        try {
          const newCategory = await window.electronAPI.createCategory({
            name: categoryName,
            color: category.color,
            description: category.description || "",
            project_id: currentProject.id,
            parent_id: parentId,
          });

          if (newCategory) {
            createdCategories.push(categoryName);
            subcategoriesInThisParent.add(categoryName.toLowerCase());
          }
        } catch (error) {
          console.warn(
            `Failed to create subcategory "${categoryName}":`,
            error
          );
        }
      }

      await loadCategories();
      onCategoriesChange();

      if (createdCategories.length > 0) {
        alert(t("app.categories.presets.loadSuccess"));
      } else {
        alert("No categories could be created from the preset");
      }
    } catch (error) {
      console.error("Failed to load preset:", error);
      alert(t("app.categories.presets.loadFailed"));
    }
  };

  const handleDeletePreset = async (presetName: string) => {
    const confirmMessage = t("app.categories.presets.confirmDelete", {
      presetName,
    });
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await window.electronAPI.deletePreset(presetName);
      await loadPresets();
      alert(t("app.categories.presets.deleteSuccess"));
    } catch (error) {
      console.error("Failed to delete preset:", error);
      alert(t("app.categories.presets.deleteFailed"));
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

  const renderCategory = useCallback(
    (category: Category, level: number = 0) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.id!);

      return (
        <div
          key={`${category.id}-${level}-${isEditing}-${
            editingCategory?.id === category.id
          }`}
          className={`${styles.categoryItem} ${
            level > 0 ? styles.subcategoryItem : ""
          }`}
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
                      ref={editInputRef}
                      type="text"
                      value={editingCategory.name}
                      onChange={e => {
                        // Prevent interference during rapid updates
                        e.stopPropagation();

                        // Clear any pending updates
                        if (updateTimeoutRef.current) {
                          clearTimeout(updateTimeoutRef.current);
                        }

                        const value = e.target.value;

                        // Update immediately for responsive UI
                        const updatedCategory: Category = {
                          ...editingCategory,
                          name: value,
                        };
                        setEditingCategory(updatedCategory);
                      }}
                      className={styles.editInput}
                      placeholder="Enter category name..."
                      autoFocus
                      onFocus={e => {
                        // Prevent losing focus due to re-renders
                        e.target.setSelectionRange(
                          e.target.value.length,
                          e.target.value.length
                        );
                      }}
                    />
                  </div>

                  {/* Only show color picker for parent categories */}
                  {level === 0 && (
                    <div className={styles.formGroup}>
                      <label>Color</label>
                      <div className={styles.colorPicker}>
                        {colorPresets.map(color => (
                          <button
                            key={color}
                            className={`${styles.colorOption} ${
                              editingCategory.color === color
                                ? styles.selected
                                : ""
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
                  )}

                  <div className={styles.formGroup}>
                    <label>Description (optional)</label>
                    <input
                      ref={editDescriptionRef}
                      type="text"
                      value={editingCategory.description || ""}
                      onChange={e => {
                        // Prevent interference during rapid updates
                        e.stopPropagation();

                        const value = e.target.value;

                        // Update immediately for responsive UI
                        const updatedCategory: Category = {
                          ...editingCategory,
                          description: value,
                        };
                        setEditingCategory(updatedCategory);
                      }}
                      placeholder="Add a description..."
                      className={styles.editInput}
                      onFocus={e => {
                        // Prevent losing focus due to re-renders
                        e.target.setSelectionRange(
                          e.target.value.length,
                          e.target.value.length
                        );
                      }}
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
                  ref={subcategoryInputRef}
                  type="text"
                  value={newSubcategory.name}
                  onChange={e => {
                    // Prevent interference during rapid updates
                    e.stopPropagation();
                    setNewSubcategory({
                      ...newSubcategory,
                      name: e.target.value,
                    });
                  }}
                  placeholder="Enter subcategory name (e.g., Top, Side, 60°)..."
                  className={styles.subcategoryNameInput}
                  autoFocus
                  onFocus={e => {
                    // Ensure cursor is at end and field is ready for input
                    setTimeout(() => {
                      e.target.setSelectionRange(
                        e.target.value.length,
                        e.target.value.length
                      );
                    }, 0);
                  }}
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

              <div className={`${styles.editActions} ${styles.spacingMd}`}>
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
              {category.children!.map(child =>
                renderCategory(child, level + 1)
              )}
            </div>
          )}
        </div>
      );
    },
    [
      expandedCategories,
      isEditing,
      editingCategory,
      addingSubcategoryTo,
      newSubcategory,
      t,
      styles,
    ]
  );

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
        <p className={styles.presetDescription}>
          {t("app.categories.presets.description")}
        </p>

        <div className={styles.savePresetSection}>
          <h5>{t("app.categories.presets.saveCurrentCategories")}</h5>
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
              <FontAwesomeIcon icon={faSave} />{" "}
              {t("app.categories.presets.save")}
            </button>
          </div>
        </div>

        {presets.length > 0 ? (
          <div className={styles.presetList}>
            <h5>
              {t("app.categories.presets.yourSavedPresets")} ({presets.length})
            </h5>
            <p className={styles.presetListDescription}>
              {t("app.categories.presets.loadDescription")}
            </p>
            <div className={styles.presetButtons}>
              {presets.map(preset => (
                <div key={preset} className={styles.presetItem}>
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className={styles.loadPresetBtn}
                    title={t("app.categories.presets.loadTooltip", {
                      presetName: preset,
                    })}
                  >
                    <FontAwesomeIcon icon={faFolderTree} /> {preset}
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset)}
                    className={styles.deletePresetBtn}
                    title={t("app.categories.presets.deleteTooltip", {
                      presetName: preset,
                    })}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.noPresetsMessage}>
            <p>{t("app.categories.presets.noPresetsYet")}</p>
            <p className={styles.noPresetsHint}>
              {t("app.categories.presets.createFirstPreset")}
            </p>
          </div>
        )}
      </div>

      {/* Category List */}
      <div className={styles.categoryList}>
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
