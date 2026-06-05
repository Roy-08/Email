export default function Header() {
  return (
    <div className="bg-gradient-to-r from-[#0d47a1] via-[#1565c0] to-[#1976d2] text-white px-8 py-6">
      <div className="max-w-[1200px] mx-auto flex items-center gap-4">
        <div className="w-12 h-12 bg-white/15 rounded-lg flex items-center justify-center border border-white/25">
          <span className="material-icons-outlined text-[28px] text-white">mail</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Saraswat Engineering Services</h1>
          <p className="text-[13px] opacity-80">Vendor Email System with BOQ Integration</p>
        </div>
      </div>
    </div>
  );
}