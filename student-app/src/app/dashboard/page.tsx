"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { SUBJECTS } from "@/types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
}

interface StudyLog {
  id: string;
  subject: string;
  duration: number;
  date: { toDate?: () => Date } | string | Date;
}

// 科目ごとの色
const SUBJECT_COLORS: Record<string, string> = {
  english: "#EF4444",
  english_r: "#DC2626",
  english_l: "#F87171",
  math: "#3B82F6",
  math_1a: "#2563EB",
  math_2bc: "#60A5FA",
  math_3: "#1D4ED8",
  japanese: "#F97316",
  modern_japanese: "#F97316",
  classics: "#EA580C",
  kanbun: "#C2410C",
  physics: "#8B5CF6",
  chemistry: "#22C55E",
  biology: "#EC4899",
  earth_science: "#06B6D4",
  world_history: "#92400E",
  japanese_history: "#B45309",
  geography: "#65A30D",
  civics: "#0891B2",
  politics_economics: "#7C3AED",
  ethics: "#DB2777",
  information: "#6366F1",
  kokugo: "#F97316",
  sansu: "#3B82F6",
  rika: "#22C55E",
  shakai: "#92400E",
  japanese_jr: "#F97316",
  math_jr: "#3B82F6",
  science_jr: "#22C55E",
  social_jr: "#92400E",
  english_jr: "#EF4444",
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || "#6B7280";
};

const getSubjectLabel = (key: string) => {
  return SUBJECTS.find((s) => s.key === key)?.label || key;
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

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
      loadLogs();
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

  const loadLogs = async () => {
    if (!user) return;
    try {
      const logsRef = collection(db, "studyLogs");
      const q = query(logsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        subject: doc.data().subject,
        duration: doc.data().duration,
        date: doc.data().date,
      }));
      setLogs(logsData);
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // 今週の勉強時間を計算
  const getWeeklyStudyTime = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() + mondayOffset);
    thisWeekStart.setHours(0, 0, 0, 0);

    let thisWeekTotal = 0;
    logs.forEach((log) => {
      const logDate = log.date?.toDate?.() || new Date(log.date);
      if (logDate >= thisWeekStart) {
        thisWeekTotal += log.duration || 0;
      }
    });

    return thisWeekTotal;
  };

  // 週間データ（日付×科目）- 棒グラフ用
  const getWeeklyData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: { dateKey: string; label: string; subjects: Record<string, number> }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({
        dateKey,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        subjects: {},
      });
    }

    logs.forEach((log) => {
      const logDate = log.date?.toDate?.() || new Date(log.date);
      const logDateKey = `${logDate.getFullYear()}-${logDate.getMonth()}-${logDate.getDate()}`;

      const day = days.find((d) => d.dateKey === logDateKey);
      if (day) {
        const subj = log.subject || "other";
        day.subjects[subj] = (day.subjects[subj] || 0) + (log.duration || 0);
      }
    });

    return days;
  };

  // 週間データに含まれる科目を取得
  const getWeeklySubjects = () => {
    const subjects = new Set<string>();
    weeklyData.forEach((day) => {
      Object.keys(day.subjects).forEach((subj) => subjects.add(subj));
    });
    return Array.from(subjects);
  };

  // 総計を計算
  const getAllTimeTotal = () => {
    return logs.reduce((sum, log) => sum + (log.duration || 0), 0);
  };

  // 今日の科目別合計（円グラフ用）
  const getTodaySubjectTotals = () => {
    const totals: Record<string, number> = {};
    let total = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    logs.forEach((log) => {
      const logDate = log.date?.toDate?.() || new Date(log.date);
      const logDateOnly = new Date(logDate);
      logDateOnly.setHours(0, 0, 0, 0);

      if (logDateOnly.getTime() === today.getTime()) {
        const subj = log.subject || "other";
        const duration = log.duration || 0;
        totals[subj] = (totals[subj] || 0) + duration;
        total += duration;
      }
    });

    return { totals, total };
  };

  const formatMinutesToDisplay = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  const weeklyData = getWeeklyData();
  const maxDailyMinutes = Math.max(
    ...weeklyData.map((d) =>
      Object.values(d.subjects).reduce((sum, v) => sum + v, 0)
    ),
    60
  );
  const { totals: todayTotals, total: todayTotal } = getTodaySubjectTotals();

  const getPieChartData = () => {
    return Object.entries(todayTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([subj, minutes]) => ({
        name: getSubjectLabel(subj),
        value: minutes,
        color: getSubjectColor(subj),
      }));
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header variant="student" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          こんにちは、{user.name}さん
        </h2>

        {/* 今週の勉強時間 */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">今週の勉強時間</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <p className="text-gray-500">読み込み中...</p>
            ) : (
              <div className="text-4xl font-bold text-blue-600 text-center py-4">
                {formatMinutesToDisplay(getWeeklyStudyTime())}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal一覧（2番目に配置） */}
        <Card className="mb-6">
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

        {/* 週間棒グラフ */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">学習時間（カテゴリ）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLogs ? (
              <div className="p-4">
                <p className="text-gray-500">読み込み中...</p>
              </div>
            ) : (
              <>
                {/* 今日・今週・総計 */}
                <div className="grid grid-cols-3 border-y bg-gray-100">
                  <div className="text-center py-2 border-r">
                    <div className="text-sm text-gray-500">今日</div>
                  </div>
                  <div className="text-center py-2 border-r">
                    <div className="text-sm text-gray-500">今週</div>
                  </div>
                  <div className="text-center py-2">
                    <div className="text-sm text-gray-500">総計</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 border-b">
                  <div className="text-center py-3 border-r">
                    <span className="text-xl font-bold">{formatMinutesToDisplay(todayTotal)}</span>
                  </div>
                  <div className="text-center py-3 border-r">
                    <span className="text-xl font-bold">{formatMinutesToDisplay(getWeeklyStudyTime())}</span>
                  </div>
                  <div className="text-center py-3">
                    <span className="text-xl font-bold">{formatMinutesToDisplay(getAllTimeTotal())}</span>
                  </div>
                </div>

                {/* 棒グラフ */}
                <div className="p-4">
                  <div className="flex gap-2 h-48">
                    <div className="flex flex-col justify-between text-xs text-gray-500 pr-2 pb-6">
                      <span>{Math.ceil(maxDailyMinutes / 60)}時間</span>
                      <span>{Math.ceil(maxDailyMinutes / 120)}時間</span>
                      <span>0</span>
                    </div>
                    <div className="flex-1 flex items-end gap-2">
                      {weeklyData.map((day, index) => {
                        const dayTotal = Object.values(day.subjects).reduce((sum, v) => sum + v, 0);
                        const maxHeight = 160;
                        const barHeight = maxDailyMinutes > 0 ? (dayTotal / maxDailyMinutes) * maxHeight : 0;

                        return (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div className="w-full flex flex-col justify-end" style={{ height: `${maxHeight}px` }}>
                              <div
                                className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                                style={{ height: `${barHeight}px` }}
                              >
                                {Object.entries(day.subjects).map(([subj, minutes]) => {
                                  const segmentHeight = dayTotal > 0 ? (minutes / dayTotal) * barHeight : 0;
                                  return (
                                    <div
                                      key={subj}
                                      style={{
                                        height: `${segmentHeight}px`,
                                        backgroundColor: getSubjectColor(subj),
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 mt-2">{day.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 科目凡例 */}
                  {getWeeklySubjects().length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                      {getWeeklySubjects().map((subj) => (
                        <div key={subj} className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: getSubjectColor(subj) }}
                          />
                          <span className="text-xs text-gray-600">{getSubjectLabel(subj)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 今日の時間配分（円グラフ） */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">今日の時間配分</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <p className="text-gray-500">読み込み中...</p>
            ) : todayTotal > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:w-1/2" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percent }) => `${Math.round((percent || 0) * 100)}%`}
                        labelLine={false}
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}分`, "勉強時間"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {Object.entries(todayTotals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([subj, minutes]) => {
                      const percentage = todayTotal > 0 ? Math.round((minutes / todayTotal) * 100) : 0;
                      return (
                        <div key={subj} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getSubjectColor(subj) }}
                          />
                          <span className="text-sm">{getSubjectLabel(subj)}</span>
                          <span className="text-sm text-gray-500 ml-auto">
                            {formatMinutesToDisplay(minutes)} ({percentage}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">今日はまだ記録がありません</p>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
