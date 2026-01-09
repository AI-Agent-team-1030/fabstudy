"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { getSubjectsByGrade } from "@/types";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function KidsStudyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const subjects = user ? getSubjectsByGrade(user.grade) : [];

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
      const q = query(
        logsRef,
        where("userId", "==", user.id)
      );
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

  const handleSubmit = async () => {
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

      toast.success("きろくしたよ！すごい！");
      setSubject("");
      setDuration("");
      loadRecentLogs();
    } catch (error) {
      console.error("Failed to add log:", error);
      toast.error("きろくできなかった...");
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
    if (hours === 0) return `${mins}ぷん`;
    if (mins === 0) return `${hours}じかん`;
    return `${hours}じかん${mins}ぷん`;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-green-100 flex items-center justify-center">
        <p className="text-2xl">よみこみちゅう...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-green-100 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-400 to-green-400 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-white text-center">
          べんきょうをきろく
        </h1>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 記録フォーム */}
        <Card className="bg-white/90 border-4 border-blue-400 shadow-xl">
          <CardContent className="p-6 space-y-6">
            {/* 科目選択 */}
            <div>
              <div className="text-lg font-bold text-gray-700 mb-3">なにをべんきょうした？</div>
              <div className="grid grid-cols-3 gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSubject(s.key)}
                    className={`p-3 rounded-xl text-center font-bold transition-all ${
                      subject === s.key
                        ? "bg-blue-500 text-white scale-105 shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 時間入力 */}
            <div>
              <div className="text-lg font-bold text-gray-700 mb-3">どれくらいべんきょうした？</div>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((min) => (
                  <button
                    key={min}
                    onClick={() => setDuration(String(min))}
                    className={`p-3 rounded-xl text-center font-bold transition-all ${
                      duration === String(min)
                        ? "bg-green-500 text-white scale-105 shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {min}ぷん
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-gray-600">そのた:</span>
                <Input
                  type="number"
                  placeholder="じかん"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-24 text-center text-lg"
                  min="1"
                />
                <span className="text-gray-600">ぷん</span>
              </div>
            </div>

            {/* 日付 */}
            <div>
              <div className="text-lg font-bold text-gray-700 mb-2">いつべんきょうした？</div>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-lg"
              />
            </div>

            {/* 記録ボタン */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !subject || !duration}
              className="w-full h-16 text-2xl bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:opacity-50"
            >
              {submitting ? "きろくちゅう..." : "きろくする！"}
            </Button>
          </CardContent>
        </Card>

        {/* 最近の記録 */}
        <Card className="bg-white/90 border-4 border-green-400 shadow-xl">
          <CardContent className="p-4">
            <div className="text-lg font-bold text-gray-700 mb-3">さいきんのきろく</div>
            {recentLogs.length === 0 ? (
              <p className="text-center text-gray-500 py-4">まだきろくがないよ</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-center p-3 bg-green-50 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📚</span>
                      <span className="font-bold">{getSubjectLabel(log.subject)}</span>
                    </div>
                    <span className="text-green-600 font-bold">{formatTime(log.duration)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-yellow-400 z-50">
        <div className="flex justify-around items-center h-20 max-w-lg mx-auto">
          <Link href="/kids/dashboard" className={`flex flex-col items-center ${pathname === "/kids/dashboard" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">🏠</span>
            <span className="text-xs">ホーム</span>
          </Link>
          <Link href="/kids/study" className={`flex flex-col items-center ${pathname === "/kids/study" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">📝</span>
            <span className="text-xs">きろく</span>
          </Link>
          <Link href="/kids/wishlist" className={`flex flex-col items-center ${pathname === "/kids/wishlist" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">📋</span>
            <span className="text-xs">やりたいこと</span>
          </Link>
          <Link href="/kids/messages" className={`flex flex-col items-center ${pathname === "/kids/messages" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">💬</span>
            <span className="text-xs">メッセージ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
