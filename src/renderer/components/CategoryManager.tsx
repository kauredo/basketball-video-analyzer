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
import { useToastContext } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";

import { Category } from "../../types/global";

const DEFAULT_CATEGORY_COLOR = "#4CAF50";

const colorPresets: Array<{ hex: string; name: string }> = [
  { hex: "#4CAF50", name: "Green" },
  { hex: "#2196F3", name: "Blue" },
  { hex: "#FF9800", name: "Orange" },
  { hex: "#f44336", name: "Red" },
  { hex: "#9C27B0", name: "Purple" },
  { hex: "#00BCD4", name: "Cyan" },
  { hex: "#8BC34A", name: "Light Green" },
  { hex: "#FFC107", name: "Amber" },
  { hex: "#E91E63", name: "Pink" },
  { hex: "#795548", name: "Brown" },
  { hex: "#607D8B", name: "Blue Grey" },
  { hex: "#FF5722", name: "Deep Orange" },
  { hex: "#3F51B5", name: "Indigo" },
  { hex: "#009688", name: "Teal" },
  { hex: "#CDDC39", name: "Lime" },
];

interface CategoryManagerProps {
  onCategoriesChange: () => void;
  currentProject: any | null;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  onCategoriesChange,
  currentProject,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError, showWarning } = useToastContext();
  const { confirm } = useConfirm();
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
    color: DEFAULT_CATEGORY_COLOR,
    description: "",
  });
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<number | null>(
    null
  );
  const [newSubcategory, setNewSubcategory] = useState({
    name: "",
    color: DEFAULT_CATEGORY_COLOR,
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

  // Focus input when entering edit mode (only on ID change, not on every state update)
  useEffect(() => {
    if (editingCategory?.id && editInputRef.current) {
      // Use requestAnimationFrame for smoother focus without delay
      requestAnimationFrame(() => {
        const input = editInputRef.current;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }
  }, [editingCategory?.id]); // Only depend on ID, not the whole object

  // Focus subcategory input when adding subcategory
  useEffect(() => {
    if (addingSubcategoryTo !== null && subcategoryInputRef.current) {
      requestAnimationFrame(() => {
        subcategoryInputRef.current?.focus();
      });
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

      setNewCategory({ name: "", color: DEFAULT_CATEGORY_COLOR, description: "" });
      await loadCategories();
      onCategoriesChange();
      showSuccess(t("app.categories.categoryCreated"));
    } catch (error) {
      console.error("Error creating category:", error);
      showError(t("app.categories.errorCreating"));
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

      setNewSubcategory({ name: "", color: DEFAULT_CATEGORY_COLOR, description: "" });
      setAddingSubcategoryTo(null);
      // Expand the parent category to show the new subcategory
      setExpandedCategories(prev => new Set([...prev, parentId]));
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error("Error creating subcategory:", error);
      showError(t("app.categories.errorCreating"));
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
      showSuccess(t("app.categories.categoryUpdated"));
    } catch (error) {
      console.error("Error updating category:", error);
      showError(t("app.categories.errorUpdating"));
    }
  }, [editingCategory, loadCategories, onCategoriesChange, t, showSuccess]);

  const handleDeleteCategory = async (id: number) => {
    if (!(await confirm({ message: t("app.categories.confirmDelete"), danger: true }))) {
      return;
    }

    try {
      await window.electronAPI.deleteCategory(id);
      await loadCategories();
      onCategoriesChange();
      showSuccess(t("app.categories.categoryDeleted"));
    } catch (error) {
      console.error("Error deleting category:", error);
      showError(t("app.categories.errorDeleting"));
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      showWarning(t("app.categories.enterPresetName"));
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
      showSuccess(t("app.categories.presets.saveSuccess"));
    } catch (error) {
      console.error("Failed to save preset:", error);
      showError(t("app.categories.presets.saveFailed"));
    }
  };

  const handleLoadPreset = async (presetName: string) => {
    if (!(await confirm({ message: t("app.categories.presets.confirmLoad", { presetName }) }))) {
      return;
    }

    if (!currentProject) {
      showWarning(t("app.clips.noProjectLoaded"));
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
        showError(t("app.categories.presets.loadFailed"));
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
        showSuccess(t("app.categories.presets.loadSuccess"));
      } else {
        showWarning(t("app.categories.noCategoriesFromPreset"));
      }
    } catch (error) {
      console.error("Failed to load preset:", error);
      showError(t("app.categories.presets.loadFailed"));
    }
  };

  const handleDeletePreset = async (presetName: string) => {
    const confirmMessage = t("app.categories.presets.confirmDelete", {
      presetName,
    });
    if (!(await confirm({ message: confirmMessage, danger: true }))) {
      return;
    }

    try {
      await window.electronAPI.deletePreset(presetName);
      await loadPresets();
      showSuccess(t("app.categories.presets.deleteSuccess"));
    } catch (error) {
      console.error("Failed to delete preset:", error);
      showError(t("app.categories.presets.deleteFailed"));
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
                type="button"
                onClick={() => hasChildren && toggleExpanded(category.id!)}
                className={`${styles.expandButton} ${
                  hasChildren ? styles.hasChildren : styles.noChildren
                }`}
                disabled={!hasChildren}
                aria-expanded={isExpanded}
                aria-label={category.name}
              >
                {hasChildren ? (isExpanded ? "▼" : "▶") : "○"}
              </button>
            )}

            {editingCategory?.id === category.id && editingCategory ? (
              <div className={styles.categoryEditForm}>
                <div className={styles.editFormHeader}>
                  <h4>{t("app.categories.editCategory")}</h4>
                </div>

                <div className={styles.editFormContent}>
                  <div className={styles.formGroup}>
                    <label>{t("app.categories.categoryName")}</label>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingCategory.name}
                      onChange={e => {
                        e.stopPropagation();
                        const value = e.target.value;
                        setEditingCategory({
                          ...editingCategory,
                          name: value,
                        });
                      }}
                      onKeyDown={e => {
                        // Prevent event bubbling that might interfere with typing
                        e.stopPropagation();
                      }}
                      className={styles.editInput}
                      placeholder={t("app.categories.enterCategoryName")}
                    />
                  </div>

                  {/* Only show color picker for parent categories */}
                  {level === 0 && (
                    <div className={styles.formGroup}>
                      <label>{t("app.categories.color")}</label>
                      <div className={styles.colorPicker}>
                        {colorPresets.map(({ hex, name }) => (
                          <button
                            type="button"
                            key={hex}
                            className={`${styles.colorOption} ${
                              editingCategory.color === hex
                                ? styles.selected
                                : ""
                            }`}
                            style={{ backgroundColor: hex }}
                            onClick={() => {
                              const updatedCategory: Category = {
                                ...editingCategory,
                                color: hex,
                              };
                              setEditingCategory(updatedCategory);
                            }}
                            aria-label={name}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label>{t("app.categories.descriptionOptional")}</label>
                    <input
                      ref={editDescriptionRef}
                      type="text"
                      value={editingCategory.description || ""}
                      onChange={e => {
                        e.stopPropagation();
                        const value = e.target.value;
                        setEditingCategory({
                          ...editingCategory,
                          description: value,
                        });
                      }}
                      onKeyDown={e => {
                        e.stopPropagation();
                      }}
                      placeholder={t("app.categories.addDescription")}
                      className={styles.editInput}
                    />
                  </div>

                  <div className={styles.editActions}>
                    <button
                      type="button"
                      onClick={handleUpdateCategory}
                      className={styles.saveBtn}
                    >
                      <FontAwesomeIcon icon={faCheck} /> {t("app.categories.saveChanges")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className={styles.cancelBtn}
                    >
                      <FontAwesomeIcon icon={faXmark} /> {t("app.buttons.cancel")}
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
                      type="button"
                      onClick={() => setEditingCategory(category)}
                      className={styles.editBtn}
                      aria-label={t("app.buttons.edit")}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        category.id && handleDeleteCategory(category.id)
                      }
                      className={styles.deleteBtn}
                      aria-label={t("app.categories.confirmDelete")}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                    {level === 0 && (
                      <button
                        type="button"
                        onClick={() => setAddingSubcategoryTo(category.id!)}
                        className={styles.addSubBtn}
                        title={t("app.categories.addSubcategoryTooltip")}
                        aria-label={t("app.categories.addSubcategoryTooltip")}
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
                <h5>{t("app.categories.addSubcategoryTo", { name: category.name })}</h5>
              </div>

              <div className={styles.formGroup}>
                <input
                  ref={subcategoryInputRef}
                  type="text"
                  value={newSubcategory.name}
                  onChange={e => {
                    e.stopPropagation();
                    setNewSubcategory({
                      ...newSubcategory,
                      name: e.target.value,
                    });
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                  }}
                  placeholder={t("app.categories.subcategoryPlaceholder")}
                  className={styles.subcategoryNameInput}
                />
              </div>

              <div className={styles.formGroup}>
                <input
                  type="text"
                  value={newSubcategory.description}
                  onChange={e => {
                    e.stopPropagation();
                    setNewSubcategory({
                      ...newSubcategory,
                      description: e.target.value,
                    });
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                  }}
                  placeholder={t("app.categories.subcategoryDescriptionPlaceholder")}
                  className={styles.subcategoryDescriptionInput}
                />
              </div>

              <div className={`${styles.editActions} ${styles.spacingMd}`}>
                <button
                  type="button"
                  onClick={() =>
                    handleCreateSubcategory(category.id!, category.color)
                  }
                  disabled={!newSubcategory.name.trim()}
                  className={styles.createSubcategoryBtn}
                >
                  <FontAwesomeIcon icon={faCheck} /> {t("app.categories.addSubcategory")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingSubcategoryTo(null);
                    setNewSubcategory({
                      name: "",
                      color: DEFAULT_CATEGORY_COLOR,
                      description: "",
                    });
                  }}
                  className={styles.cancelBtn}
                >
                  <FontAwesomeIcon icon={faXmark} /> {t("app.buttons.cancel")}
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

  return (
    <div className={styles.categoryManager}>
      <div className={styles.categoryHeader}>
        <h3>
          <FontAwesomeIcon icon={faFolderTree} /> {t("app.categories.title")}
        </h3>
        <button
          type="button"
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
              onChange={e => {
                // Prevent interference during rapid updates
                e.stopPropagation();
                setNewPresetName(e.target.value);
              }}
              placeholder={t("app.categories.presets.enterName")}
              className={styles.presetNameInput}
              onFocus={e => {
                // Ensure cursor is at end and field is ready for input
                e.target.setSelectionRange(
                  e.target.value.length,
                  e.target.value.length
                );
              }}
            />
            <button
              onClick={handleSavePreset}
              disabled={!newPresetName.trim()}
              className={styles.savePresetBtn}
              type="button"
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
                    type="button"
                    onClick={() => handleLoadPreset(preset)}
                    className={styles.loadPresetBtn}
                    title={t("app.categories.presets.loadTooltip", {
                      presetName: preset,
                    })}
                  >
                    <FontAwesomeIcon icon={faFolderTree} /> {preset}
                  </button>
                  <button
                    type="button"
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
            onChange={e => {
              // Prevent interference during rapid updates
              e.stopPropagation();
              setNewCategory({ ...newCategory, name: e.target.value });
            }}
            placeholder={t("app.categories.placeholder")}
            className={styles.categoryNameInput}
            onFocus={e => {
              // Ensure cursor is at end and field is ready for input
              e.target.setSelectionRange(
                e.target.value.length,
                e.target.value.length
              );
            }}
          />

          <div className={styles.colorPicker}>
            <label>{t("app.categories.colorLabel")}</label>
            {colorPresets.map(({ hex, name }) => (
              <button
                type="button"
                key={hex}
                className={`${styles.colorOption} ${
                  newCategory.color === hex ? styles.selected : ""
                }`}
                style={{ backgroundColor: hex }}
                onClick={() => setNewCategory({ ...newCategory, color: hex })}
                aria-label={name}
              />
            ))}
          </div>

          <input
            type="text"
            value={newCategory.description}
            onChange={e => {
              // Prevent interference during rapid updates
              e.stopPropagation();
              setNewCategory({ ...newCategory, description: e.target.value });
            }}
            placeholder={t("app.categories.descriptionPlaceholder")}
            className={styles.categoryDescriptionInput}
            onFocus={e => {
              // Ensure cursor is at end and field is ready for input
              e.target.setSelectionRange(
                e.target.value.length,
                e.target.value.length
              );
            }}
          />

          <button
            onClick={handleCreateCategory}
            disabled={!newCategory.name.trim()}
            className={styles.createCategoryBtn}
            type="button"
          >
            <FontAwesomeIcon icon={faPlus} /> {t("app.categories.add")}
          </button>
        </div>
      )}
    </div>
  );
};
