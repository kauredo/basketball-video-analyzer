import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faPlus, faPen, faTrash, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/PlayerManager.module.css";
import { useToastContext } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { Player } from "../../types/global";

interface PlayerManagerProps {
  currentProject: any | null;
  onPlayersChange?: () => void;
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({
  currentProject,
  onPlayersChange,
}) => {
  const { t } = useTranslation();
  const { showError } = useToastContext();
  const { confirm } = useConfirm();
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const loadPlayers = useCallback(async () => {
    if (!currentProject) return;
    try {
      const result = await window.electronAPI.getPlayers(currentProject.id);
      setPlayers(result);
    } catch (error) {
      console.error("Error loading players:", error);
    }
  }, [currentProject]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !currentProject) return;
    try {
      await window.electronAPI.createPlayer({
        name,
        number: newNumber.trim() || null,
        project_id: currentProject.id,
      });
      setNewName("");
      setNewNumber("");
      await loadPlayers();
      onPlayersChange?.();
    } catch (error) {
      console.error("Error creating player:", error);
      showError(t("app.players.errorCreating"));
    }
  };

  const startEdit = (player: Player) => {
    setEditingId(player.id!);
    setEditName(player.name);
    setEditNumber(player.number || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditNumber("");
  };

  const handleSaveEdit = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await window.electronAPI.updatePlayer(id, {
        name,
        number: editNumber.trim() || null,
      });
      cancelEdit();
      await loadPlayers();
      onPlayersChange?.();
    } catch (error) {
      console.error("Error updating player:", error);
      showError(t("app.players.errorUpdating"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm({ message: t("app.players.confirmDelete"), danger: true }))) {
      return;
    }
    try {
      await window.electronAPI.deletePlayer(id);
      await loadPlayers();
      onPlayersChange?.();
    } catch (error) {
      console.error("Error deleting player:", error);
      showError(t("app.players.errorDeleting"));
    }
  };

  if (!currentProject) {
    return null;
  }

  return (
    <div className={styles.playerManager}>
      <h3>
        <FontAwesomeIcon icon={faUser} /> {t("app.players.title")}
      </h3>

      {/* Add form */}
      <div className={styles.addForm}>
        <input
          type="text"
          value={newNumber}
          onChange={e => setNewNumber(e.target.value)}
          placeholder={t("app.players.numberPlaceholder")}
          className={styles.numberInput}
          aria-label={t("app.players.number")}
        />
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          placeholder={t("app.players.namePlaceholder")}
          className={styles.nameInput}
          aria-label={t("app.players.name")}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newName.trim()}
          className={styles.addBtn}
        >
          <FontAwesomeIcon icon={faPlus} /> {t("app.players.add")}
        </button>
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <p className={styles.emptyHint}>{t("app.players.empty")}</p>
      ) : (
        <ul className={styles.playerList}>
          {players.map(player => (
            <li key={player.id} className={styles.playerRow}>
              {editingId === player.id ? (
                <>
                  <input
                    type="text"
                    value={editNumber}
                    onChange={e => setEditNumber(e.target.value)}
                    className={styles.numberInput}
                    aria-label={t("app.players.number")}
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(player.id!); }}
                    className={styles.nameInput}
                    aria-label={t("app.players.name")}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(player.id!)}
                    className={styles.iconBtn}
                    aria-label={t("app.buttons.save")}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className={styles.iconBtn}
                    aria-label={t("app.buttons.cancel")}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.playerName}>
                    {player.number && <span className={styles.playerNumber}>#{player.number}</span>}
                    {player.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(player)}
                    className={styles.iconBtn}
                    aria-label={t("app.buttons.edit")}
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(player.id!)}
                    className={styles.iconBtn}
                    aria-label={t("app.players.delete")}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
