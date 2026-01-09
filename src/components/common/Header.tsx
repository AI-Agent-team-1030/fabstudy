"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  variant?: "student" | "teacher" | "kids";
}

export function Header({ variant = "student" }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getNavItems = () => {
    if (variant === "teacher") {
      return [
        { href: "/teacher/students", label: "生徒一覧" },
        { href: "/teacher/messages", label: "メッセージ" },
        { href: "/teacher/notes", label: "メモ" },
      ];
    }
    if (variant === "kids") {
      return [
        { href: "/kids/dashboard", label: "ホーム" },
        { href: "/kids/study", label: "べんきょう" },
        { href: "/kids/tasks", label: "タスク" },
        { href: "/kids/messages", label: "おしらせ" },
      ];
    }
    return [
      { href: "/dashboard", label: "ダッシュボード" },
      { href: "/study", label: "学習記録" },
      { href: "/tasks", label: "目標" },
      { href: "/exams", label: "テスト記録" },
      { href: "/messages", label: "メッセージ" },
    ];
  };

  const bgColor = variant === "teacher"
    ? "bg-purple-700"
    : variant === "kids"
    ? "bg-green-600"
    : "bg-blue-700";

  return (
    <header className={`${bgColor} text-white shadow-md`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className={`font-bold ${variant === "kids" ? "text-xl" : "text-lg"}`}>
              {variant === "teacher" ? "先生用ダッシュボード" : "学習進捗管理"}
            </h1>
            {user && (
              <Badge variant="secondary" className="ml-2">
                {user.name}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`text-white hover:bg-white/20 ${variant === "kids" ? "text-lg px-6" : ""}`}
          >
            ログアウト
          </Button>
        </div>
        <nav className="mt-3 flex space-x-1 overflow-x-auto pb-1">
          {getNavItems().map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md transition-colors whitespace-nowrap ${
                variant === "kids" ? "text-lg px-4" : "text-sm"
              } ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-white/20 font-medium"
                  : "hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
