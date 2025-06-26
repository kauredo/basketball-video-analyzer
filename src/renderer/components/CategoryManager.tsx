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
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [newCategory, setNewCategory] = useState({
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
      const cats = await window.electronAPI.getCategories();
      setCategories(cats);
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
        {categories.map(category => (
          <div key={category.id} className={styles.categoryItem}>
            <div
              className={styles.categoryColorIndicator}
              style={{ backgroundColor: category.color }}
            />

            {editingCategory?.id === category.id && editingCategory ? (
              <div className={styles.categoryEditForm}>
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
                  className={styles.categoryNameInput}
                  placeholder={t("app.categories.placeholder")}
                />

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
                  className={styles.categoryDescriptionInput}
                  placeholder={t("app.categories.descriptionPlaceholder")}
                />

                <div className={styles.editActions}>
                  <button
                    onClick={handleUpdateCategory}
                    className={styles.saveBtn}
                  >
                    <FontAwesomeIcon icon={faSave} /> {t("app.buttons.save")}
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className={styles.cancelBtn}
                  >
                    <FontAwesomeIcon icon={faXmark} /> {t("app.buttons.cancel")}
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
                      onClick={() =>
                        category.id && handleDeleteCategory(category.id)
                      }
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
