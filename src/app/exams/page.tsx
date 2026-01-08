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
import { SUBJECTS } from "@/types";
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

export default function ExamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [examType, setExamType] = useState("");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [subjectEntries, setSubjectEntries] = useState<SubjectEntry[]>([
    { id: "1", subject: "", customSubject: "", score: "", maxScore: "100", deviation: "" }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [exams, setExams] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
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
      const q = query(
        examsRef,
        where("userId", "==", user.id)
      );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !examType || !examName) return;

    // 有効なエントリのみフィルタ
    const validEntries = subjectEntries.filter(entry => {
      const finalSubject = entry.subject === "other" ? entry.customSubject : entry.subject;
      return finalSubject && entry.score;
    });

    if (validEntries.length === 0) {
      toast.error("少なくとも1科目を入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const examsRef = collection(db, "examRecords");

      // 各科目を個別に保存
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
      setSubmitting(false);
    }
  };

  const getSubjectLabel = (key: string) => {
    return SUBJECTS.find((s) => s.key === key)?.label || key;
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

  const canSubmit = () => {
    if (!examType || !examName) return false;
    return subjectEntries.some(entry => {
      const finalSubject = entry.subject === "other" ? entry.customSubject : entry.subject;
      return finalSubject && entry.score;
    });
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
        <h2 className="text-2xl font-bold text-gray-800 mb-6">テスト記録</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 記録フォーム */}
          <Card>
            <CardHeader>
              <CardTitle>テスト結果を記録する</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  disabled={submitting || !canSubmit()}
                >
                  {submitting ? "記録中..." : `記録する（${subjectEntries.filter(e => e.subject && e.score).length}科目）`}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 履歴 */}
          <Card>
            <CardHeader>
              <CardTitle>テスト履歴</CardTitle>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  まだ記録がありません
                </p>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {groupedExams().map((group, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex justify-between items-center mb-3 pb-2 border-b">
                        <div>
                          <p className="font-bold text-lg">{group.examName}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(group.examDate)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {group.examType === "mock" ? "模試" : "定期テスト"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.subjects.map((subj, subIndex) => (
                          <div
                            key={subIndex}
                            className="flex justify-between items-center py-1"
                          >
                            <span className="text-gray-700">{getSubjectLabel(subj.subject)}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-blue-600">
                                {subj.score}/{subj.maxScore}
                              </span>
                              {subj.deviation && (
                                <span className="text-sm text-gray-500">
                                  偏差値 {subj.deviation}
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

      </main>
    </div>
  );
}
