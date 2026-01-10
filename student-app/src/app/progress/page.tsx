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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { toast } from "sonner";
import { SUBJECTS, getSubjectsByGrade } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TargetSchool {
  id: string;
  userId: string;
  schoolName: string;
  targetTotalScore: number;
  targetScores: Record<string, number>;
  priority: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ExamRecord {
  id: string;
  userId: string;
  examType: string;
  examName: string;
  examDate: Timestamp;
  subject: string;
  score: number;
  maxScore: number;
  deviation?: number;
}

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

export default function ProgressPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [targets, setTargets] = useState<TargetSchool[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetSchool | null>(null);

  // フォームstate
  const [schoolName, setSchoolName] = useState("");
  const [targetTotalScore, setTargetTotalScore] = useState("");
  const [targetScores, setTargetScores] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user?.isElementary) {
      router.push("/kids/dashboard");
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
      // 目標を取得
      const targetsRef = collection(db, "targetSchools");
      const targetsQuery = query(targetsRef, where("userId", "==", user.id));
      const targetsSnapshot = await getDocs(targetsQuery);
      const targetsData = targetsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TargetSchool[];
      targetsData.sort((a, b) => a.priority - b.priority);
      setTargets(targetsData);

      // テスト記録を取得
      const examsRef = collection(db, "examRecords");
      const examsQuery = query(examsRef, where("userId", "==", user.id));
      const examsSnapshot = await getDocs(examsQuery);
      const examsData = examsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ExamRecord[];
      examsData.sort((a, b) => {
        const dateA = a.examDate?.toDate?.() || new Date(0);
        const dateB = b.examDate?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setExams(examsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddTarget = async () => {
    if (!user || !schoolName) return;

    setSubmitting(true);
    try {
      const targetsRef = collection(db, "targetSchools");
      const parsedTargetScores: Record<string, number> = {};
      Object.entries(targetScores).forEach(([key, value]) => {
        if (value) {
          parsedTargetScores[key] = Number(value);
        }
      });

      await addDoc(targetsRef, {
        userId: user.id,
        schoolName,
        targetTotalScore: Number(targetTotalScore) || 0,
        targetScores: parsedTargetScores,
        priority: targets.length + 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      toast.success("目標を追加しました！");
      setShowAddTarget(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Failed to add target:", error);
      toast.error("追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTarget = async () => {
    if (!editingTarget) return;

    setSubmitting(true);
    try {
      const targetRef = doc(db, "targetSchools", editingTarget.id);
      const parsedTargetScores: Record<string, number> = {};
      Object.entries(targetScores).forEach(([key, value]) => {
        if (value) {
          parsedTargetScores[key] = Number(value);
        }
      });

      await updateDoc(targetRef, {
        schoolName,
        targetTotalScore: Number(targetTotalScore) || 0,
        targetScores: parsedTargetScores,
        updatedAt: Timestamp.now(),
      });

      toast.success("目標を更新しました！");
      setEditingTarget(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Failed to update target:", error);
      toast.error("更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm("この目標を削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "targetSchools", id));
      toast.success("目標を削除しました");
      loadData();
    } catch (error) {
      console.error("Failed to delete target:", error);
      toast.error("削除に失敗しました");
    }
  };

  const resetForm = () => {
    setSchoolName("");
    setTargetTotalScore("");
    setTargetScores({});
  };

  const openEditDialog = (target: TargetSchool) => {
    setEditingTarget(target);
    setSchoolName(target.schoolName);
    setTargetTotalScore(target.targetTotalScore.toString());
    const scores: Record<string, string> = {};
    Object.entries(target.targetScores || {}).forEach(([key, value]) => {
      scores[key] = value.toString();
    });
    setTargetScores(scores);
  };

  const getSubjectLabel = (key: string) => {
    return SUBJECTS.find((s) => s.key === key)?.label || key;
  };

  const getSubjectColor = (subject: string): string => {
    return SUBJECT_COLORS[subject] || "#6B7280";
  };

  // 直近のテストデータを科目ごとにグループ化
  const getLatestExamsBySubject = () => {
    const subjectMap: Record<string, ExamRecord> = {};
    exams.forEach((exam) => {
      if (!subjectMap[exam.subject]) {
        subjectMap[exam.subject] = exam;
      }
    });
    return subjectMap;
  };

  // 科目別のギャップを計算
  const calculateGaps = (target: TargetSchool) => {
    const latestExams = getLatestExamsBySubject();
    const gaps: { subject: string; current: number; target: number; gap: number; percentage: number }[] = [];

    Object.entries(target.targetScores || {}).forEach(([subject, targetScore]) => {
      const latestExam = latestExams[subject];
      if (latestExam) {
        const percentage = (latestExam.score / latestExam.maxScore) * 100;
        gaps.push({
          subject,
          current: latestExam.score,
          target: targetScore,
          gap: targetScore - latestExam.score,
          percentage,
        });
      } else {
        gaps.push({
          subject,
          current: 0,
          target: targetScore,
          gap: targetScore,
          percentage: 0,
        });
      }
    });

    return gaps.sort((a, b) => b.gap - a.gap);
  };

  // 科目別のテスト推移データを取得
  const getSubjectTrendData = (subject: string) => {
    const subjectExams = exams
      .filter((e) => e.subject === subject)
      .sort((a, b) => {
        const dateA = a.examDate?.toDate?.() || new Date(0);
        const dateB = b.examDate?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

    return subjectExams.map((exam) => ({
      date: exam.examDate?.toDate?.().toLocaleDateString("ja-JP") || "",
      score: exam.score,
      examName: exam.examName,
    }));
  };

  // 記録のある科目を取得
  const getRecordedSubjects = () => {
    const subjects = new Set<string>();
    exams.forEach((e) => subjects.add(e.subject));
    return Array.from(subjects);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const recordedSubjects = getRecordedSubjects();
  const availableSubjects = getSubjectsByGrade(user.grade);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header variant="student" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">現状把握</h2>

        {/* 目標設定セクション */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">志望校・目標</CardTitle>
            <Button onClick={() => setShowAddTarget(true)} size="sm">
              + 追加
            </Button>
          </CardHeader>
          <CardContent>
            {targets.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                まだ目標が設定されていません
              </p>
            ) : (
              <div className="space-y-4">
                {targets.map((target, index) => (
                  <div
                    key={target.id}
                    className="border rounded-lg p-4 bg-white"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm text-blue-600 font-medium">
                          第{index + 1}志望
                        </span>
                        <h3 className="font-bold text-lg">{target.schoolName}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(target)}
                        >
                          編集
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTarget(target.id)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>

                    {/* ギャップ表示 */}
                    {Object.keys(target.targetScores || {}).length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-sm font-medium text-gray-600 mb-2">
                          目標とのギャップ
                        </p>
                        {calculateGaps(target).map((gap) => (
                          <div key={gap.subject} className="flex items-center gap-3">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getSubjectColor(gap.subject) }}
                            />
                            <span className="w-20 text-sm truncate">
                              {getSubjectLabel(gap.subject)}
                            </span>
                            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full ${gap.gap <= 0 ? "bg-green-500" : "bg-blue-500"}`}
                                style={{
                                  width: `${Math.min((gap.current / gap.target) * 100, 100)}%`,
                                }}
                              />
                              {gap.target > 0 && (
                                <div
                                  className="absolute top-0 bottom-0 w-1 bg-red-500"
                                  style={{
                                    left: `${Math.min((gap.target / (gap.target + Math.max(gap.gap, 0))) * 100, 100)}%`,
                                  }}
                                />
                              )}
                            </div>
                            <span className="w-16 text-right text-sm">
                              {gap.current}/{gap.target}
                            </span>
                            <span
                              className={`w-16 text-right text-sm font-medium ${
                                gap.gap <= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {gap.gap <= 0 ? "達成！" : `あと${gap.gap}点`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 科目別推移グラフ */}
        {recordedSubjects.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">科目別成績推移</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recordedSubjects.map((subject) => {
                  const trendData = getSubjectTrendData(subject);
                  const target = targets[0]; // 第1志望の目標
                  const targetScore = target?.targetScores?.[subject];

                  if (trendData.length === 0) return null;

                  return (
                    <div key={subject} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getSubjectColor(subject) }}
                        />
                        <h4 className="font-bold">{getSubjectLabel(subject)}</h4>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis domain={[0, 100]} fontSize={12} />
                            <Tooltip
                              formatter={(value) => [`${value}点`, "得点"]}
                              labelFormatter={(label) => `日付: ${label}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="score"
                              name="得点"
                              stroke={getSubjectColor(subject)}
                              strokeWidth={2}
                              dot={{ fill: getSubjectColor(subject) }}
                            />
                            {targetScore && (
                              <ReferenceLine
                                y={targetScore}
                                stroke="#EF4444"
                                strokeDasharray="5 5"
                                label={{ value: `目標: ${targetScore}`, position: "right", fill: "#EF4444" }}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 強み・弱み分析 */}
        {targets.length > 0 && recordedSubjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">強み・弱み分析</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const gaps = calculateGaps(targets[0]);
                const strengths = gaps.filter((g) => g.gap <= 0);
                const weaknesses = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-bold text-green-700 mb-3">強み（目標達成）</h4>
                      {strengths.length === 0 ? (
                        <p className="text-gray-500 text-sm">まだありません</p>
                      ) : (
                        <ul className="space-y-2">
                          {strengths.map((s) => (
                            <li key={s.subject} className="flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              <span>{getSubjectLabel(s.subject)}</span>
                              <span className="text-sm text-gray-500">
                                ({s.current}点 / 目標{s.target}点)
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="font-bold text-red-700 mb-3">弱み（要強化）</h4>
                      {weaknesses.length === 0 ? (
                        <p className="text-gray-500 text-sm">全科目目標達成！</p>
                      ) : (
                        <ul className="space-y-2">
                          {weaknesses.slice(0, 5).map((w) => (
                            <li key={w.subject} className="flex items-center gap-2">
                              <span className="text-red-500">!</span>
                              <span>{getSubjectLabel(w.subject)}</span>
                              <span className="text-sm text-gray-500">
                                (あと{w.gap}点)
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </main>
      <BottomNav />

      {/* 目標追加ダイアログ */}
      <Dialog open={showAddTarget} onOpenChange={setShowAddTarget}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>目標を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>志望校名</Label>
              <Input
                placeholder="例: 東京大学"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>科目別目標点</Label>
              <p className="text-sm text-gray-500">
                目標を設定したい科目のみ入力してください
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {availableSubjects.map((subj) => (
                  <div key={subj.key} className="flex items-center gap-2">
                    <Label className="w-20 text-sm truncate">{subj.label}</Label>
                    <Input
                      type="number"
                      placeholder="点"
                      className="w-20"
                      value={targetScores[subj.key] || ""}
                      onChange={(e) =>
                        setTargetScores({ ...targetScores, [subj.key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddTarget(false);
                  resetForm();
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handleAddTarget} disabled={submitting || !schoolName}>
                {submitting ? "追加中..." : "追加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 目標編集ダイアログ */}
      <Dialog open={!!editingTarget} onOpenChange={(open) => !open && setEditingTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>目標を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>志望校名</Label>
              <Input
                placeholder="例: 東京大学"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>科目別目標点</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {availableSubjects.map((subj) => (
                  <div key={subj.key} className="flex items-center gap-2">
                    <Label className="w-20 text-sm truncate">{subj.label}</Label>
                    <Input
                      type="number"
                      placeholder="点"
                      className="w-20"
                      value={targetScores[subj.key] || ""}
                      onChange={(e) =>
                        setTargetScores({ ...targetScores, [subj.key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTarget(null);
                  resetForm();
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handleUpdateTarget} disabled={submitting || !schoolName}>
                {submitting ? "更新中..." : "更新"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
