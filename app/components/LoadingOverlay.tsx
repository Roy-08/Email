interface LoadingOverlayProps {
  visible: boolean;
  text: string;
}

export default function LoadingOverlay({ visible, text }: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[9999]">
      <div className="bg-white p-8 rounded-lg text-center shadow-lg">
        <div className="inline-block w-7 h-7 border-[3px] border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
        <p className="mt-3.5 text-[var(--text-secondary)] text-sm font-medium">{text}</p>
      </div>
    </div>
  );
}