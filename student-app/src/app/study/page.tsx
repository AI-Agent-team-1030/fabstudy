"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
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

interface SubjectEntry {
  id: string;
  subject: string;
  customSubject: string;
  score: string;
  maxScore: string;
  deviation: string;
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

export default function StudyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 学習記録のstate
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // テスト記録のstate
  const [examType, setExamType] = useState("");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [subjectEntries, setSubjectEntries] = useState<SubjectEntry[]>([
    { id: "1", subject: "", customSubject: "", score: "", maxScore: "100", deviation: "" }
  ]);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [exams, setExams] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadLogs();
      loadExams();
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

  const loadExams = async () => {
    if (!user) return;
    try {
      const examsRef = collection(db, "examRecords");
      const q = query(examsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const examsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      examsData.sort((a: any, b: any) => {
        const dateA = a.examDate?.toDate?.() || new Date(0);
        const dateB = b.examDate?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setExams(examsData);
    } catch (error) {
      console.error("Failed to load exams:", error);
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

  // テスト記録の関数
  const addSubjectEntry = () => {
    setSubjectEntries([
      ...subjectEntries,
      { id: Date.now().toString(), subject: "", customSubject: "", score: "", maxScore: "100", deviation: "" }
    ]);
  };

  const removeSubjectEntry = (id: string) => {
    if (subjectEntries.length > 1) {
      setSubjectEntries(subjectEntries.filter(e => e.id !== id));
    }
  };

  const updateSubjectEntry = (id: string, field: keyof SubjectEntry, value: string) => {
    setSubjectEntries(subjectEntries.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const handleExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !examType || !examName) return;

    const validEntries = subjectEntries.filter(entry => {
      const finalSubject = entry.subject === "other" ? entry.customSubject : entry.subject;
      return finalSubject && entry.score;
    });

    if (validEntries.length === 0) {
      toast.error("少なくとも1科目を入力してください");
      return;
    }

    setSubmittingExam(true);
    try {
      const examsRef = collection(db, "examRecords");

      for (const entry of validEntries) {
        const finalSubject = entry.subject === "other" ? entry.customSubject : entry.subject;
        await addDoc(examsRef, {
          userId: user.id,
          examType,
          examName,
          subject: finalSubject,
          score: Number(entry.score),
          maxScore: Number(entry.maxScore),
          deviation: entry.deviation ? Number(entry.deviation) : null,
          examDate: Timestamp.fromDate(new Date(examDate)),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      toast.success(`${validEntries.length}科目を記録しました！`);
      setExamType("");
      setExamName("");
      setSubjectEntries([
        { id: "1", subject: "", customSubject: "", score: "", maxScore: "100", deviation: "" }
      ]);
      loadExams();
    } catch (error) {
      console.error("Failed to add exam:", error);
      toast.error("記録に失敗しました");
    } finally {
      setSubmittingExam(false);
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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ja-JP");
  };

  // 模試ごとにグループ化
  const groupedExams = () => {
    const groups: { [key: string]: { examName: string; examDate: any; examType: string; subjects: any[] } } = {};

    exams.forEach((exam) => {
      const dateStr = formatDate(exam.examDate);
      const key = `${exam.examName}_${dateStr}`;

      if (!groups[key]) {
        groups[key] = {
          examName: exam.examName,
          examDate: exam.examDate,
          examType: exam.examType,
          subjects: [],
        };
      }
      groups[key].subjects.push({
        subject: exam.subject,
        score: exam.score,
        maxScore: exam.maxScore,
        deviation: exam.deviation,
      });
    });

    return Object.values(groups).sort((a, b) => {
      const dateA = a.examDate?.toDate?.() || new Date(0);
      const dateB = b.examDate?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const canSubmitExam = () => {
    if (!examType || !examName) return false;
    return subjectEntries.some(entry => {
      const finalSubject = entry.subject === "other" ? entry.customSubject : entry.subject;
      return finalSubject && entry.score;
    });
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

  const stats = calculateStats();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header variant="student" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">学習記録</h2>
          <Button variant="outline" onClick={() => router.push("/study/archive")}>
            過去の記録を見る
          </Button>
        </div>

        {/* 記録フォーム */}
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
            <CardTitle className="text-lg">学習時間</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>

        {/* 最近の記録 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>最近の学習記録</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">まだ記録がありません</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
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

        {/* テスト記録セクション */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">テスト記録</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* テスト記録フォーム */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">テスト結果を記録する</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExamSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>テスト種類</Label>
                      <Select value={examType} onValueChange={setExamType}>
                        <SelectTrigger>
                          <SelectValue placeholder="種類を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mock">模試</SelectItem>
                          <SelectItem value="regular">定期テスト</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>受験日</Label>
                      <Input
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>テスト名</Label>
                    <Input
                      placeholder="例: 第1回駿台全国模試"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                    />
                  </div>

                  {/* 科目リスト */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>科目別成績</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addSubjectEntry}>
                        + 科目追加
                      </Button>
                    </div>

                    {subjectEntries.map((entry, index) => (
                      <div key={entry.id} className="p-3 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">科目 {index + 1}</span>
                          {subjectEntries.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 h-6 px-2"
                              onClick={() => removeSubjectEntry(entry.id)}
                            >
                              削除
                            </Button>
                          )}
                        </div>

                        <Select
                          value={entry.subject}
                          onValueChange={(v) => updateSubjectEntry(entry.id, "subject", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="科目を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECTS.map((s) => (
                              <SelectItem key={s.key} value={s.key}>
                                {s.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="other">その他（入力）</SelectItem>
                          </SelectContent>
                        </Select>

                        {entry.subject === "other" && (
                          <Input
                            placeholder="科目名を入力"
                            value={entry.customSubject}
                            onChange={(e) => updateSubjectEntry(entry.id, "customSubject", e.target.value)}
                          />
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">得点</Label>
                            <Input
                              type="number"
                              placeholder="85"
                              value={entry.score}
                              onChange={(e) => updateSubjectEntry(entry.id, "score", e.target.value)}
                              min="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">満点</Label>
                            <Input
                              type="number"
                              placeholder="100"
                              value={entry.maxScore}
                              onChange={(e) => updateSubjectEntry(entry.id, "maxScore", e.target.value)}
                              min="1"
                            />
                          </div>
                          {examType === "mock" && (
                            <div>
                              <Label className="text-xs">偏差値</Label>
                              <Input
                                type="number"
                                placeholder="55"
                                value={entry.deviation}
                                onChange={(e) => updateSubjectEntry(entry.id, "deviation", e.target.value)}
                                step="0.1"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submittingExam || !canSubmitExam()}
                  >
                    {submittingExam ? "記録中..." : `記録する（${subjectEntries.filter(e => e.subject && e.score).length}科目）`}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* テスト履歴 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">テスト履歴</CardTitle>
              </CardHeader>
              <CardContent>
                {exams.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    まだ記録がありません
                  </p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {groupedExams().slice(0, 5).map((group, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex justify-between items-center mb-3 pb-2 border-b">
                          <div>
                            <p className="font-bold">{group.examName}</p>
                            <p className="text-sm text-gray-500">
                              {formatDate(group.examDate)}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {group.examType === "mock" ? "模試" : "定期テスト"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {group.subjects.map((subj, subIndex) => (
                            <div
                              key={subIndex}
                              className="flex justify-between items-center py-1"
                            >
                              <span className="text-sm text-gray-700">{getSubjectLabel(subj.subject)}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-600">
                                  {subj.score}/{subj.maxScore}
                                </span>
                                {subj.deviation && (
                                  <span className="text-xs text-gray-500">
                                    偏差値{subj.deviation}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
