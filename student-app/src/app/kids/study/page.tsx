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

  // テスト記録のstate
  const [examType, setExamType] = useState("");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [examSubject, setExamSubject] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [submittingExam, setSubmittingExam] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set());

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
      loadExams();
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
      setRecentLogs(logs.slice(0, 5));
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

  // テスト記録送信
  const handleExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !examType || !examName || !examSubject || !score) return;

    setSubmittingExam(true);
    try {
      const examsRef = collection(db, "examRecords");
      await addDoc(examsRef, {
        userId: user.id,
        examType,
        examName,
        subject: examSubject,
        score: Number(score),
        maxScore: Number(maxScore),
        examDate: Timestamp.fromDate(new Date(examDate)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      toast.success("きろくしました！");
      setExamType("");
      setExamName("");
      setExamSubject("");
      setScore("");
      setMaxScore("100");
      loadExams();
    } catch (error) {
      console.error("Failed to add exam:", error);
      toast.error("きろくできませんでした");
    } finally {
      setSubmittingExam(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ja-JP");
  };

  // テストごとにグループ化
  const groupedExams = () => {
    const groups: { [key: string]: { key: string; examName: string; examDate: any; examType: string; subjects: any[] } } = {};

    exams.forEach((exam: any) => {
      const dateStr = formatDate(exam.examDate);
      const key = `${exam.examName}_${dateStr}`;

      if (!groups[key]) {
        groups[key] = {
          key,
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
      });
    });

    return Object.values(groups).sort((a, b) => {
      const dateA = a.examDate?.toDate?.() || new Date(0);
      const dateB = b.examDate?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const toggleExamExpand = (key: string) => {
    setExpandedExams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // スコアに応じた評価
  const getScoreEmoji = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return "🌟";
    if (percentage >= 80) return "⭐";
    if (percentage >= 70) return "👍";
    if (percentage >= 60) return "😊";
    return "💪";
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

        {/* テスト記録セクション */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            テストの<ruby>記録<rt>きろく</rt></ruby>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* テスト記録フォーム */}
            <Card className="border-2 border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-yellow-800">
                  テストの<ruby>結果<rt>けっか</rt></ruby>を<ruby>記録<rt>きろく</rt></ruby>する
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExamSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>テストの<ruby>種類<rt>しゅるい</rt></ruby></Label>
                      <Select value={examType} onValueChange={setExamType}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="えらんでね" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">
                            <ruby>学校<rt>がっこう</rt></ruby>のテスト
                          </SelectItem>
                          <SelectItem value="mock">
                            <ruby>塾<rt>じゅく</rt></ruby>のテスト
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label><ruby>日<rt>ひ</rt></ruby>づけ</Label>
                      <Input
                        type="date"
                        className="bg-white"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>テストの<ruby>名前<rt>なまえ</rt></ruby></Label>
                    <Input
                      className="bg-white"
                      placeholder="れい: 1がっきまつテスト"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label><ruby>科目<rt>かもく</rt></ruby></Label>
                      <Select value={examSubject} onValueChange={setExamSubject}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="えらんでね" />
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
                      <Label><ruby>点数<rt>てんすう</rt></ruby></Label>
                      <Input
                        type="number"
                        className="bg-white"
                        placeholder="85"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label><ruby>満点<rt>まんてん</rt></ruby></Label>
                      <Input
                        type="number"
                        className="bg-white"
                        placeholder="100"
                        value={maxScore}
                        onChange={(e) => setMaxScore(e.target.value)}
                        min="1"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-yellow-500 hover:bg-yellow-600"
                    disabled={submittingExam || !examType || !examName || !examSubject || !score}
                  >
                    {submittingExam ? "きろくちゅう..." : "きろくする！"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* テスト履歴 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  テストの<ruby>履歴<rt>りれき</rt></ruby>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {exams.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    まだきろくがないよ
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {groupedExams().map((group) => {
                      const isExpanded = expandedExams.has(group.key);
                      return (
                        <div
                          key={group.key}
                          className="bg-gray-50 rounded-lg overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleExamExpand(group.key)}
                            className="w-full p-3 flex justify-between items-center hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
                              <div className="text-left">
                                <p className="font-bold">{group.examName}</p>
                                <p className="text-sm text-gray-500">
                                  {formatDate(group.examDate)} · {group.subjects.length}かもく
                                </p>
                              </div>
                            </div>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {group.examType === "mock" ? "じゅく" : "がっこう"}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-3 space-y-1 border-t">
                              {group.subjects.map((subj: any, subIndex: number) => (
                                <div
                                  key={subIndex}
                                  className="flex justify-between items-center py-2"
                                >
                                  <span className="text-sm text-gray-700">{getSubjectLabel(subj.subject)}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">
                                      {getScoreEmoji(subj.score, subj.maxScore)}
                                    </span>
                                    <span className="font-bold text-blue-600">
                                      {subj.score}/{subj.maxScore}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <KidsBottomNav />
    </div>
  );
}
