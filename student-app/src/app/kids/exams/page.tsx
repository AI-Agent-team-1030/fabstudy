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

interface ExamRecord {
  id: string;
  examType: string;
  examName: string;
  examDate: any;
  subject: string;
  score: number;
  maxScore: number;
}

export default function KidsExamsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // フォームstate
  const [examType, setExamType] = useState("");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [submitting, setSubmitting] = useState(false);

  // 記録一覧
  const [exams, setExams] = useState<ExamRecord[]>([]);
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
      router.push("/exams");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadExams();
    }
  }, [user]);

  const loadExams = async () => {
    if (!user) return;
    try {
      const examsRef = collection(db, "examRecords");
      const q = query(examsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const examsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ExamRecord[];
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
    if (!user || !examType || !examName || !subject || !score) return;

    setSubmitting(true);
    try {
      const examsRef = collection(db, "examRecords");
      await addDoc(examsRef, {
        userId: user.id,
        examType,
        examName,
        subject,
        score: Number(score),
        maxScore: Number(maxScore),
        examDate: Timestamp.fromDate(new Date(examDate)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      toast.success("きろくしました！");
      setExamType("");
      setExamName("");
      setSubject("");
      setScore("");
      setMaxScore("100");
      loadExams();
    } catch (error) {
      console.error("Failed to add exam:", error);
      toast.error("きろくできませんでした");
    } finally {
      setSubmitting(false);
    }
  };

  const getSubjectLabel = (key: string) => {
    return subjects.find((s) => s.key === key)?.label || key;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ja-JP");
  };

  // テストごとにグループ化
  const groupedExams = () => {
    const groups: { [key: string]: { key: string; examName: string; examDate: any; examType: string; subjects: any[] } } = {};

    exams.forEach((exam) => {
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
        <p className="text-xl">よみこみちゅう...</p>
      </div>
    );
  }

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

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 記録フォーム */}
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-yellow-800">
              テストの<ruby>結果<rt>けっか</rt></ruby>を<ruby>記録<rt>きろく</rt></ruby>する
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-lg">テストの<ruby>種類<rt>しゅるい</rt></ruby></Label>
                  <Select value={examType} onValueChange={setExamType}>
                    <SelectTrigger className="bg-white text-lg py-6">
                      <SelectValue placeholder="えらんでね" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular" className="text-lg">
                        <ruby>学校<rt>がっこう</rt></ruby>のテスト
                      </SelectItem>
                      <SelectItem value="mock" className="text-lg">
                        <ruby>塾<rt>じゅく</rt></ruby>のテスト・<ruby>模試<rt>もし</rt></ruby>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-lg"><ruby>日<rt>ひ</rt></ruby>づけ</Label>
                  <Input
                    type="date"
                    className="bg-white text-lg py-6"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-lg">テストの<ruby>名前<rt>なまえ</rt></ruby></Label>
                <Input
                  className="bg-white text-lg py-6"
                  placeholder="れい: 1がっきまつテスト"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-lg"><ruby>科目<rt>かもく</rt></ruby></Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="bg-white text-lg py-6">
                      <SelectValue placeholder="えらんでね" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.key} value={s.key} className="text-lg">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-lg"><ruby>点数<rt>てんすう</rt></ruby></Label>
                  <Input
                    type="number"
                    className="bg-white text-lg py-6"
                    placeholder="85"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-lg"><ruby>満点<rt>まんてん</rt></ruby></Label>
                  <Input
                    type="number"
                    className="bg-white text-lg py-6"
                    placeholder="100"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full text-lg py-6 bg-yellow-500 hover:bg-yellow-600"
                disabled={submitting || !examType || !examName || !subject || !score}
              >
                {submitting ? "きろくちゅう..." : "きろくする！"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* テスト履歴 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              テストの<ruby>履歴<rt>りれき</rt></ruby>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exams.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-lg">
                まだきろくがないよ
              </p>
            ) : (
              <div className="space-y-3">
                {groupedExams().map((group) => {
                  const isExpanded = expandedExams.has(group.key);
                  return (
                    <div
                      key={group.key}
                      className="bg-gray-50 rounded-xl overflow-hidden border-2"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExamExpand(group.key)}
                        className="w-full p-4 flex justify-between items-center hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{isExpanded ? "▼" : "▶"}</span>
                          <div className="text-left">
                            <p className="font-bold text-lg">{group.examName}</p>
                            <p className="text-gray-500">
                              {formatDate(group.examDate)} · {group.subjects.length}かもく
                            </p>
                          </div>
                        </div>
                        <span className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                          {group.examType === "mock" ? "じゅくテスト" : "がっこう"}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 border-t">
                          {group.subjects.map((subj, subIndex) => (
                            <div
                              key={subIndex}
                              className="flex justify-between items-center py-3 bg-white rounded-lg px-4 mt-2"
                            >
                              <span className="text-lg">{getSubjectLabel(subj.subject)}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {getScoreEmoji(subj.score, subj.maxScore)}
                                </span>
                                <span className="font-bold text-xl text-blue-600">
                                  {subj.score}<span className="text-gray-400 text-lg">/{subj.maxScore}</span>てん
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
      </main>

      <KidsBottomNav />
    </div>
  );
}
