"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "つみあげ表" },
  { href: "/study", label: "学習記録" },
  { href: "/tasks", label: "目標" },
  { href: "/progress", label: "現状把握" },
  { href: "/messages", label: "メッセージ" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center w-full h-full transition-colors ${
                isActive
                  ? "text-blue-600 font-bold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="text-sm">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
