"use client";

import Link from "next/link";

export default function MemberSectionNav({
  memberId,
  active,
}: {
  memberId: string;
  active: "achievements" | "performance";
}) {
  const links = [
    { id: "achievements" as const, href: `/members/${memberId}/achievements`, label: "Achievements" },
    { id: "performance" as const, href: `/members/${memberId}/performance`, label: "Past Year Performance" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            active === link.id
              ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
              : "border border-[var(--line)] bg-white text-[var(--accent)]"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
