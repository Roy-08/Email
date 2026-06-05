interface NotificationProps {
  message: string;
  type: "success" | "error" | "warning" | "info";
  onClose?: () => void;
}

const icons: Record<string, string> = {
  success: "check_circle",
  error: "error",
  warning: "warning_amber",
  info: "info",
};

const styles: Record<string, string> = {
  success: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
  error: "bg-[#ffebee] text-[#b71c1c] border-[#ef9a9a]",
  warning: "bg-[#fff8e1] text-[#e65100] border-[#ffe082]",
  info: "bg-[#e3f2fd] text-[#0d47a1] border-[#90caf9]",
};

export default function Notification({ message, type, onClose }: NotificationProps) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2.5 p-3 px-4 rounded-md mb-3.5 text-[13px] font-medium border animate-[slideDown_0.3s_ease] ${styles[type]}`}>
      <span className="material-icons-outlined text-[20px] shrink-0">{icons[type]}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <span className="cursor-pointer text-[18px] opacity-60 hover:opacity-100 shrink-0" onClick={onClose}>
          &times;
        </span>
      )}
    </div>
  );
}