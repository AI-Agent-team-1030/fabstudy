"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, grade: Number(grade), role: "student" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登録に失敗しました");
        return;
      }

      login(data.user);

      // 小学生は専用UIへ、それ以外は通常のダッシュボードへ
      if (data.user.isElementary) {
        router.push("/kids/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("登録処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const grades = [
    { value: "1", label: "小学1年生" },
    { value: "2", label: "小学2年生" },
    { value: "3", label: "小学3年生" },
    { value: "4", label: "小学4年生" },
    { value: "5", label: "小学5年生" },
    { value: "6", label: "小学6年生" },
    { value: "7", label: "中学1年生" },
    { value: "8", label: "中学2年生" },
    { value: "9", label: "中学3年生" },
    { value: "10", label: "高校1年生" },
    { value: "11", label: "高校2年生" },
    { value: "12", label: "高校3年生" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">
            新規登録
          </CardTitle>
          <CardDescription>
            アカウントを作成して学習を始めよう
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名前</Label>
              <Input
                id="name"
                type="text"
                placeholder="山田 太郎"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="4文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">学年</Label>
              <Select value={grade} onValueChange={setGrade} required>
                <SelectTrigger>
                  <SelectValue placeholder="学年を選択" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading || !grade}
            >
              {loading ? "登録中..." : "登録する"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a
              href="/login"
              className="text-sm text-emerald-600 hover:underline"
            >
              既にアカウントをお持ちの方はこちら
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
