"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { getSubjectsByGrade } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function KidsStudyPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const subjects = user ? getSubjectsByGrade(user.grade) : [];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user && !user.isElementary) {
      router.push("/study");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadRecentLogs();
    }
  }, [user]);

  const loadRecentLogs = async () => {
    if (!user) return;
    try {
      const logsRef = collection(db, "studyLogs");
      const q = query(logsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      logs.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setRecentLogs(logs.slice(0, 5));
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject || !duration) return;

    setSubmitting(true);
    try {
      const logsRef = collection(db, "studyLogs");
      await addDoc(logsRef, {
        userId: user.id,
        subject,
        duration: Number(duration),
        date: Timestamp.fromDate(new Date(date)),
        createdAt: Timestamp.now(),
      });

      toast.success("記録しました！");
      setSubject("");
      setDuration("");
      loadRecentLogs();
    } catch (error) {
      console.error("Failed to add log:", error);
      toast.error("記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const getSubjectLabel = (key: string) => {
    return subjects.find((s) => s.key === key)?.label || key;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー - 高校生版と同じスタイル */}
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg">学習進捗管理</h1>
              {user && (
                <Badge variant="secondary" className="ml-2">
                  {user.name}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-white hover:bg-white/20"
            >
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 記録フォーム */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">勉強を記録する</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>科目</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="科目を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>勉強時間（分）</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>日付</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting || !subject || !duration}
                  >
                    {submitting ? "記録中..." : "記録する"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 最近の記録 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近の記録</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">まだ記録がありません</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getSubjectLabel(log.subject)}</span>
                      <span className="text-gray-500 text-sm">
                        {log.date?.toDate?.().toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                    <span className="text-blue-600 font-bold">{formatTime(log.duration)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <Link href="/kids/dashboard" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/dashboard" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">つみあげひょう</span>
          </Link>
          <Link href="/kids/wishlist" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/wishlist" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">やりたいことリスト</span>
          </Link>
          <Link href="/kids/messages" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/messages" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">メッセージ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
