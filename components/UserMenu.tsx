"use client";

import { useAuth } from "@/context/AuthContext";

export default function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const label = user.displayName || user.email || user.phoneNumber || "Member";

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-[var(--muted)] sm:inline">{label}</span>
      <button
        type="button"
        onClick={() => void logout()}
        className="focus-ring rounded-md border border-[var(--line)] px-3 py-2 font-medium hover:bg-[#eef1ea]"
      >
        Sign out
      </button>
    </div>
  );
}
