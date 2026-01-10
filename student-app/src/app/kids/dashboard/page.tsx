"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getLevelFromExp, LEVEL_CONFIG, SUBJECTS } from "@/types";
import { KidsBottomNav } from "@/components/common/KidsBottomNav";

interface StudyLog {
  id: string;
  subject: string;
  duration: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const getSubjectLabel = (key: string) => {
  return SUBJECTS.find((s) => s.key === key)?.label || key;
};

export default function KidsDashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user && !user.isElementary) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const logsRef = collection(db, "studyLogs");
      const q = query(logsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);

      let total = 0;
      let today = 0;
      let weekly = 0;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayStr = todayDate.toISOString().split("T")[0];

      // 今週の開始日（月曜日）
      const dayOfWeek = todayDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(todayDate);
      weekStart.setDate(todayDate.getDate() + mondayOffset);

      const uniqueDates = new Set<string>();
      const logsData: StudyLog[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        total += data.duration || 0;

        const logDate = data.date?.toDate?.() || new Date(data.date);
        const logDateOnly = new Date(logDate);
        logDateOnly.setHours(0, 0, 0, 0);
        const logDateStr = logDateOnly.toISOString().split("T")[0];
        uniqueDates.add(logDateStr);

        if (logDateStr === todayStr) {
          today += data.duration || 0;
        }

        if (logDateOnly >= weekStart) {
          weekly += data.duration || 0;
        }

        logsData.push({
          id: doc.id,
          subject: data.subject,
          duration: data.duration,
          date: data.date,
        });
      });

      setTotalMinutes(total);
      setTodayMinutes(today);
      setWeeklyMinutes(weekly);
      setLogs(logsData);

      // 連続記録を計算
      const sortedDates = Array.from(uniqueDates).sort().reverse();
      let streak = 0;
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      for (const dateStr of sortedDates) {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diff = Math.floor((checkDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diff === 0 || diff === 1) {
          streak++;
          checkDate = d;
        } else {
          break;
        }
      }
      setCurrentStreak(streak);

    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // 時間のフォーマット（漢字＋ルビ）
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return <>{mins}<ruby>分<rt>ふん</rt></ruby></>;
    if (mins === 0) return <>{hours}<ruby>時間<rt>じかん</rt></ruby></>;
    return <>{hours}<ruby>時間<rt>じかん</rt></ruby>{mins}<ruby>分<rt>ふん</rt></ruby></>;
  };

  // トロフィー数を計算（1時間 = 1トロフィー）
  const getTrophyCount = () => {
    return Math.floor(totalMinutes / 60);
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

  const weeklyData = getWeeklyData();
  const maxDailyMinutes = Math.max(
    ...weeklyData.map((d) =>
      Object.values(d.subjects).reduce((sum, v) => sum + v, 0)
    ),
    60
  );

  // 経験値とレベル
  const totalExp = totalMinutes * LEVEL_CONFIG.expPerMinute + logs.length * LEVEL_CONFIG.expPerRecord;
  const levelInfo = getLevelFromExp(totalExp);
  const expProgress = levelInfo.nextLevelExp > 0 ? (levelInfo.currentExp / levelInfo.nextLevelExp) * 100 : 0;

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl"><ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const trophyCount = getTrophyCount();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
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

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          こんにちは、{user.name}さん
        </h2>

        {/* 今週の勉強時間 */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              <ruby>今週<rt>こんしゅう</rt></ruby>の<ruby>勉強<rt>べんきょう</rt></ruby><ruby>時間<rt>じかん</rt></ruby>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600 text-center py-4">
              {formatTime(weeklyMinutes)}
            </div>
          </CardContent>
        </Card>

        {/* レベルと経験値 */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">レベル {levelInfo.level}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span><ruby>経験値<rt>けいけんち</rt></ruby></span>
                <span>{levelInfo.currentExp} / {levelInfo.nextLevelExp}</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${expProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 学習時間サマリー */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              <ruby>学習<rt>がくしゅう</rt></ruby><ruby>時間<rt>じかん</rt></ruby>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-3 border-y bg-gray-100">
              <div className="text-center py-2 border-r">
                <div className="text-sm text-gray-500"><ruby>今日<rt>きょう</rt></ruby></div>
              </div>
              <div className="text-center py-2 border-r">
                <div className="text-sm text-gray-500">
                  <ruby>連続<rt>れんぞく</rt></ruby><ruby>記録<rt>きろく</rt></ruby>
                </div>
              </div>
              <div className="text-center py-2">
                <div className="text-sm text-gray-500">
                  <ruby>合計<rt>ごうけい</rt></ruby>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3">
              <div className="text-center py-4 border-r">
                <span className="text-xl font-bold text-blue-600">{formatTime(todayMinutes)}</span>
              </div>
              <div className="text-center py-4 border-r">
                <span className="text-xl font-bold text-orange-500">{currentStreak}<ruby>日<rt>にち</rt></ruby></span>
              </div>
              <div className="text-center py-4">
                <span className="text-xl font-bold">{formatTime(totalMinutes)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 週間棒グラフ */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              <ruby>今週<rt>こんしゅう</rt></ruby>の<ruby>学習<rt>がくしゅう</rt></ruby><ruby>記録<rt>きろく</rt></ruby>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-2 h-48">
              <div className="flex flex-col justify-between text-xs text-gray-500 pr-2 pb-6">
                <span>{Math.ceil(maxDailyMinutes / 60)}<ruby>時間<rt>じかん</rt></ruby></span>
                <span>{Math.ceil(maxDailyMinutes / 120)}<ruby>時間<rt>じかん</rt></ruby></span>
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
          </CardContent>
        </Card>

        {/* トロフィー */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              <ruby>獲得<rt>かくとく</rt></ruby>トロフィー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 rounded-lg p-4 mb-4 text-sm text-yellow-800">
              <p className="font-bold mb-1">トロフィーのもらい<ruby>方<rt>かた</rt></ruby></p>
              <p>
                1<ruby>時間<rt>じかん</rt></ruby><ruby>勉強<rt>べんきょう</rt></ruby>すると、トロフィーが1<ruby>個<rt>こ</rt></ruby>もらえるよ！
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 py-4">
              <span className="text-6xl">🏆</span>
              <div className="text-center">
                <span className="text-4xl font-bold text-yellow-600">{trophyCount}</span>
                <span className="text-xl text-gray-600 ml-1"><ruby>個<rt>こ</rt></ruby></span>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500 border-t pt-3">
              <ruby>合計<rt>ごうけい</rt></ruby>{formatTime(totalMinutes)}<ruby>勉強<rt>べんきょう</rt></ruby>
              → <ruby>次<rt>つぎ</rt></ruby>のトロフィーまで<ruby>あと<rt></rt></ruby>{60 - (totalMinutes % 60)}<ruby>分<rt>ふん</rt></ruby>
            </div>
          </CardContent>
        </Card>
      </main>

      <KidsBottomNav />
    </div>
  );
}
