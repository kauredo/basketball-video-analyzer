import { useState, useCallback } from "react";
import { ToastType } from "../components/Toast";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType, duration?: number) => {
      const id = Date.now().toString();
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
      };

      setToasts(prev => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "success", duration);
    },
    [addToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "error", duration);
    },
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "warning", duration);
    },
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "info", duration);
    },
    [addToast]
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
  };
};
