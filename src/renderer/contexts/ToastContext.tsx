import React, { createContext, useContext } from "react";
import { useToast } from "../hooks/useToast";
import { ToastContainer } from "../components/Toast";

interface ToastContextValue {
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } =
    useToast();

  return (
    <ToastContext.Provider
      value={{ showSuccess, showError, showWarning, showInfo }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToastContext = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return context;
};
