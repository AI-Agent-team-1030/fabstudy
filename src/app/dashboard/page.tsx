"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
}

interface StudyStats {
  thisWeek: number;
  lastWeek: number;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [studyStats, setStudyStats] = useState<StudyStats>({ thisWeek: 0, lastWeek: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user?.role === "teacher") {
      router.push("/teacher/students");
    }
    if (!loading && user?.isElementary) {
      router.push("/kids/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadGoals();
      loadStudyStats();
    }
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    try {
      const tasksRef = collection(db, "tasks");
      const q = query(
        tasksRef,
        where("userId", "==", user.id),
        where("level", "==", "goal")
      );
      const snapshot = await getDocs(q);
      const goalsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        progress: doc.data().progress || 0,
        status: doc.data().status,
      }));
      setGoals(goalsData);
    } catch (error) {
      console.error("Failed to load goals:", error);
    } finally {
      setLoadingGoals(false);
    }
  };

  const loadStudyStats = async () => {
    if (!user) return;
    try {
      const logsRef = collection(db, "studyLogs");
      const q = query(logsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);

      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() + mondayOffset);
      thisWeekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);

      let thisWeekTotal = 0;
      let lastWeekTotal = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const logDate = data.date?.toDate?.() || new Date(data.date);
        const duration = data.duration || 0;

        if (logDate >= thisWeekStart) {
          thisWeekTotal += duration;
        } else if (logDate >= lastWeekStart && logDate <= lastWeekEnd) {
          lastWeekTotal += duration;
        }
      });

      setStudyStats({
        thisWeek: thisWeekTotal,
        lastWeek: lastWeekTotal,
      });
    } catch (error) {
      console.error("Failed to load study stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const formatMinutesToDisplay = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="student" />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          こんにちは、{user.name}さん
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 今週の勉強時間 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">今週の勉強時間</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <p className="text-gray-500">読み込み中...</p>
              ) : (
                <>
                  <div className="text-4xl font-bold text-blue-600">
                    {formatMinutesToDisplay(studyStats.thisWeek)}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    先週: {formatMinutesToDisplay(studyStats.lastWeek)}
                    {studyStats.thisWeek > studyStats.lastWeek && studyStats.lastWeek > 0 && (
                      <span className="text-green-600 ml-2">
                        +{Math.round(((studyStats.thisWeek - studyStats.lastWeek) / studyStats.lastWeek) * 100)}%
                      </span>
                    )}
                    {studyStats.thisWeek < studyStats.lastWeek && studyStats.lastWeek > 0 && (
                      <span className="text-red-600 ml-2">
                        {Math.round(((studyStats.thisWeek - studyStats.lastWeek) / studyStats.lastWeek) * 100)}%
                      </span>
                    )}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Goal一覧 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">目標</CardTitle>
              <CardDescription>進捗状況</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGoals ? (
                <p className="text-gray-500">読み込み中...</p>
              ) : goals.length === 0 ? (
                <p className="text-gray-500">まだ目標がありません</p>
              ) : (
                <ul className="space-y-3">
                  {goals.map((goal) => (
                    <li key={goal.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{goal.title}</p>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${goal.status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-blue-600">{goal.progress}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* クイックアクション */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">クイックアクション</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => router.push("/study")}>
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">学</span>
                </div>
                <p className="font-medium">勉強を記録</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-green-50 transition-colors" onClick={() => router.push("/tasks")}>
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold">目</span>
                </div>
                <p className="font-medium">目標を確認</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-yellow-50 transition-colors" onClick={() => router.push("/exams")}>
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 font-bold">試</span>
                </div>
                <p className="font-medium">テストを記録</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => router.push("/messages")}>
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-bold">連</span>
                </div>
                <p className="font-medium">メッセージ</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
