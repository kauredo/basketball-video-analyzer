import { useState, useCallback } from "react";
import { ToastType, ToastAction } from "../components/Toast";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType, duration?: number, action?: ToastAction) => {
      const id = Date.now().toString();
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
        action,
      };

      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number, action?: ToastAction) => {
      return addToast(message, "success", duration, action);
    },
    [addToast],
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "error", duration);
    },
    [addToast],
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "warning", duration);
    },
    [addToast],
  );

  const showInfo = useCallback(
    (message: string, duration?: number, action?: ToastAction) => {
      return addToast(message, "info", duration, action);
    },
    [addToast],
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
