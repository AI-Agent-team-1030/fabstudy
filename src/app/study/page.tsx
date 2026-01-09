"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
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
import { SUBJECTS, getSubjectsByGrade } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

// 科目ごとの色を取得（同カテゴリでも別の色）
const SUBJECT_COLORS: Record<string, string> = {
  // 英語系
  english: "#EF4444",      // 赤
  english_r: "#DC2626",    // 濃い赤
  english_l: "#F87171",    // 薄い赤

  // 数学系
  math: "#3B82F6",         // 青
  math_1a: "#2563EB",      // 濃い青
  math_2bc: "#60A5FA",     // 薄い青
  math_3: "#1D4ED8",       // もっと濃い青

  // 国語系
  japanese: "#F97316",     // オレンジ

  // 理科系（それぞれ異なる色）
  physics: "#8B5CF6",      // 紫
  chemistry: "#22C55E",    // 緑
  biology: "#EC4899",      // ピンク
  earth_science: "#06B6D4", // シアン

  // 地歴系
  world_history: "#92400E",    // 茶色
  japanese_history: "#B45309", // オレンジ茶
  geography: "#65A30D",        // ライム

  // 公民系
  civics: "#0891B2",           // ティール
  politics_economics: "#7C3AED", // バイオレット
  ethics: "#DB2777",           // マゼンタ

  // 情報
  information: "#6366F1",  // インディゴ
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || "#6B7280";
};

export default function StudyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user]);

  const loadLogs = async () => {
    if (!user) return;
    try {
      const logsRef = collection(db, "studyLogs");
      const q = query(logsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      logsData.sort((a: any, b: any) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setLogs(logsData);
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = subject === "other" ? customSubject : subject;
    if (!user || !finalSubject || !duration) return;

    setSubmitting(true);
    try {
      const logsRef = collection(db, "studyLogs");
      await addDoc(logsRef, {
        userId: user.id,
        subject: finalSubject,
        duration: Number(duration),
        date: Timestamp.fromDate(new Date(date)),
        createdAt: Timestamp.now(),
      });

      toast.success("学習ログを記録しました！");
      setSubject("");
      setCustomSubject("");
      setDuration("");
      loadLogs();
    } catch (error) {
      console.error("Failed to add log:", error);
      toast.error("記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const getSubjectLabel = (key: string) => {
    return SUBJECTS.find((s) => s.key === key)?.label || key;
  };

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  // 今日・今月・総計の計算
  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let todayTotal = 0;
    let monthTotal = 0;
    let allTotal = 0;

    logs.forEach((log) => {
      const logDate = log.date?.toDate?.() || new Date(log.date);
      logDate.setHours(0, 0, 0, 0);
      const duration = log.duration || 0;

      allTotal += duration;

      if (logDate.getTime() === today.getTime()) {
        todayTotal += duration;
      }

      if (logDate >= thisMonthStart) {
        monthTotal += duration;
      }
    });

    return { todayTotal, monthTotal, allTotal };
  };

  // 週間データ（日付×科目）
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

  // 科目別合計（円グラフ用 - 今日のデータのみ）
  const getSubjectTotals = () => {
    const totals: Record<string, number> = {};
    let total = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    logs.forEach((log) => {
      const logDate = log.date?.toDate?.() || new Date(log.date);
      logDate.setHours(0, 0, 0, 0);

      // 今日のデータのみ
      if (logDate.getTime() === today.getTime()) {
        const subj = log.subject || "other";
        const duration = log.duration || 0;
        totals[subj] = (totals[subj] || 0) + duration;
        total += duration;
      }
    });

    return { totals, total };
  };

  const stats = calculateStats();
  const weeklyData = getWeeklyData();
  const { totals: subjectTotals, total: grandTotal } = getSubjectTotals();
  const maxDailyMinutes = Math.max(
    ...weeklyData.map((d) =>
      Object.values(d.subjects).reduce((sum, v) => sum + v, 0)
    ),
    60
  );

  // 円グラフ用のデータ
  const getPieChartData = () => {
    return Object.entries(subjectTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([subj, minutes]) => ({
        name: getSubjectLabel(subj),
        value: minutes,
        color: getSubjectColor(subj),
      }));
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="student" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">学習記録</h2>
          <Button variant="outline" onClick={() => router.push("/study/archive")}>
            過去の記録を見る
          </Button>
        </div>

        {/* 記録フォーム - 目立つ位置に */}
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-800">勉強を記録する</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>科目</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="科目を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubjectsByGrade(user.grade).map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">その他（入力）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {subject === "other" && (
                  <div className="space-y-2">
                    <Label>科目名を入力</Label>
                    <Input
                      className="bg-white"
                      placeholder="例: 現代文、古典、リスニング"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>勉強時間（分）</Label>
                  <Input
                    className="bg-white"
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
                    className="bg-white"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={submitting || !subject || (subject === "other" && !customSubject) || !duration}
                  >
                    {submitting ? "記録中..." : "記録する"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 学習時間サマリー */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">学習時間（カテゴリ）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* 今日・今月・総計 */}
            <div className="grid grid-cols-3 border-y bg-gray-100">
              <div className="text-center py-2 border-r">
                <div className="text-sm text-gray-500">今日</div>
              </div>
              <div className="text-center py-2 border-r">
                <div className="text-sm text-gray-500">今月</div>
              </div>
              <div className="text-center py-2">
                <div className="text-sm text-gray-500">総計</div>
              </div>
            </div>
            <div className="grid grid-cols-3 border-b">
              <div className="text-center py-3 border-r">
                <span className="text-xl font-bold">{formatMinutesToHours(stats.todayTotal)}</span>
              </div>
              <div className="text-center py-3 border-r">
                <span className="text-xl font-bold">{formatMinutesToHours(stats.monthTotal)}</span>
              </div>
              <div className="text-center py-3">
                <span className="text-xl font-bold">{formatMinutesToHours(stats.allTotal)}</span>
              </div>
            </div>

            {/* 積み上げ棒グラフ */}
            <div className="p-4">
              <div className="flex gap-2 h-48">
                {/* Y軸ラベル */}
                <div className="flex flex-col justify-between text-xs text-gray-500 pr-2 pb-6">
                  <span>{Math.ceil(maxDailyMinutes / 60)}時間</span>
                  <span>{Math.ceil(maxDailyMinutes / 120)}時間</span>
                  <span>0</span>
                </div>

                {/* バー */}
                <div className="flex-1 flex items-end gap-2">
                  {weeklyData.map((day, index) => {
                    const dayTotal = Object.values(day.subjects).reduce((sum, v) => sum + v, 0);
                    const maxHeight = 160; // px
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
            </div>
          </CardContent>
        </Card>

        {/* 時間配分（円グラフ） */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">今日の時間配分</CardTitle>
          </CardHeader>
          <CardContent>
            {grandTotal > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* 円グラフ */}
                <div className="w-full md:w-1/2" style={{ height: 250, minHeight: 250 }}>
                  <ResponsiveContainer width="100%" height={250} minHeight={250}>
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percent }) => `${Math.round((percent || 0) * 100)}%`}
                        labelLine={false}
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}分`, "勉強時間"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 凡例 */}
                <div className="flex-1 space-y-2">
                  {Object.entries(subjectTotals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([subj, minutes]) => {
                      const percentage = grandTotal > 0 ? Math.round((minutes / grandTotal) * 100) : 0;
                      return (
                        <div key={subj} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getSubjectColor(subj) }}
                          />
                          <span className="text-sm">{getSubjectLabel(subj)}</span>
                          <span className="text-sm text-gray-500 ml-auto">
                            {formatMinutesToHours(minutes)} ({percentage}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">データがありません</p>
            )}
          </CardContent>
        </Card>

        {/* 最近の記録 */}
        <Card>
          <CardHeader>
            <CardTitle>最近の記録</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">まだ記録がありません</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.slice(0, 5).map((log) => (
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
                    <span className="text-blue-600 font-bold">{log.duration}分</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
