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
import { KidsBottomNav } from "@/components/common/KidsBottomNav";

interface StudyLog {
  id: string;
  subject: string;
  duration: number;
  date: any;
}

// 科目ごとの色
const SUBJECT_COLORS: Record<string, string> = {
  kokugo: "#F97316",
  sansu: "#3B82F6",
  rika_elem: "#22C55E",
  shakai_elem: "#92400E",
  eigo_elem: "#EF4444",
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || "#6B7280";
};

export default function KidsStudyPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<StudyLog[]>([]);
  const [allLogs, setAllLogs] = useState<StudyLog[]>([]);

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
        subject: doc.data().subject,
        duration: doc.data().duration,
        date: doc.data().date,
      })) as StudyLog[];
      logs.sort((a: any, b: any) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setAllLogs(logs);
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
    if (hours === 0) return <>{mins}<ruby>分<rt>ふん</rt></ruby></>;
    if (mins === 0) return <>{hours}<ruby>時間<rt>じかん</rt></ruby></>;
    return <>{hours}<ruby>時間<rt>じかん</rt></ruby>{mins}<ruby>分<rt>ふん</rt></ruby></>;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p><ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</p>
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
              <h1 className="font-bold text-lg">
                <ruby>学習<rt>がくしゅう</rt></ruby>
                <ruby>進捗<rt>しんちょく</rt></ruby>
                <ruby>管理<rt>かんり</rt></ruby>
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
            <CardTitle className="text-lg">
              <ruby>勉強<rt>べんきょう</rt></ruby>を<ruby>記録<rt>きろく</rt></ruby>する
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label><ruby>科目<rt>かもく</rt></ruby></Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="科目をえらぶ" />
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
                  <Label><ruby>勉強<rt>べんきょう</rt></ruby><ruby>時間<rt>じかん</rt></ruby>（<ruby>分<rt>ふん</rt></ruby>）</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label><ruby>日<rt>ひ</rt></ruby>づけ</Label>
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
            <CardTitle className="text-lg">
              <ruby>最近<rt>さいきん</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">まだ<ruby>記録<rt>きろく</rt></ruby>がないよ</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getSubjectColor(log.subject) }}
                      />
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

      <KidsBottomNav />
    </div>
  );
}
