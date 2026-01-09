"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
import { Badge } from "@/components/ui/badge";
import { KidsBottomNav } from "@/components/common/KidsBottomNav";

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
}

export default function KidsProgressPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [targets, setTargets] = useState<TargetSchool[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddTarget, setShowAddTarget] = useState(false);

  // フォームstate
  const [schoolName, setSchoolName] = useState("");
  const [targetScores, setTargetScores] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
      router.push("/progress");
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
        targetTotalScore: 0,
        targetScores: parsedTargetScores,
        priority: targets.length + 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      toast.success("もくひょうをついかしました！");
      setShowAddTarget(false);
      setSchoolName("");
      setTargetScores({});
      loadData();
    } catch (error) {
      console.error("Failed to add target:", error);
      toast.error("ついかできませんでした");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm("けしてもいい？")) return;

    try {
      await deleteDoc(doc(db, "targetSchools", id));
      toast.success("けしました");
      loadData();
    } catch (error) {
      console.error("Failed to delete target:", error);
      toast.error("けせませんでした");
    }
  };

  const getSubjectLabel = (key: string) => {
    return SUBJECTS.find((s) => s.key === key)?.label || key;
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
    const gaps: { subject: string; current: number; target: number; gap: number; maxScore: number }[] = [];

    Object.entries(target.targetScores || {}).forEach(([subject, targetScore]) => {
      const latestExam = latestExams[subject];
      if (latestExam) {
        gaps.push({
          subject,
          current: latestExam.score,
          target: targetScore,
          gap: targetScore - latestExam.score,
          maxScore: latestExam.maxScore,
        });
      } else {
        gaps.push({
          subject,
          current: 0,
          target: targetScore,
          gap: targetScore,
          maxScore: 100,
        });
      }
    });

    return gaps.sort((a, b) => b.gap - a.gap);
  };

  // ギャップに応じた絵文字
  const getGapEmoji = (gap: number) => {
    if (gap <= 0) return "🎉";
    if (gap <= 10) return "😊";
    if (gap <= 20) return "💪";
    return "📚";
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl">よみこみちゅう...</p>
      </div>
    );
  }

  if (!user) {
    return null;
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
        <h2 className="text-2xl font-bold text-gray-800">
          <ruby>目標<rt>もくひょう</rt></ruby>と<ruby>今<rt>いま</rt></ruby>の<ruby>力<rt>ちから</rt></ruby>
        </h2>

        {/* 目標設定 */}
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl text-purple-800">
              <ruby>目標<rt>もくひょう</rt></ruby>
            </CardTitle>
            <Button
              onClick={() => setShowAddTarget(true)}
              className="bg-purple-500 hover:bg-purple-600 text-lg"
            >
              + ついか
            </Button>
          </CardHeader>
          <CardContent>
            {targets.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-lg">
                まだ<ruby>目標<rt>もくひょう</rt></ruby>がないよ
              </p>
            ) : (
              <div className="space-y-4">
                {targets.map((target, index) => (
                  <div
                    key={target.id}
                    className="bg-white rounded-xl p-4 border-2"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-sm text-purple-600 font-bold">
                          だい{index + 1}の<ruby>目標<rt>もくひょう</rt></ruby>
                        </span>
                        <h3 className="font-bold text-xl">{target.schoolName}</h3>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTarget(target.id)}
                      >
                        けす
                      </Button>
                    </div>

                    {/* ギャップ表示 */}
                    {Object.keys(target.targetScores || {}).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-gray-600">
                          <ruby>科目<rt>かもく</rt></ruby>ごとの<ruby>進捗<rt>しんちょく</rt></ruby>
                        </p>
                        {calculateGaps(target).map((gap) => (
                          <div key={gap.subject} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-lg">
                                {getSubjectLabel(gap.subject)}
                              </span>
                              <span className="text-2xl">{getGapEmoji(gap.gap)}</span>
                            </div>
                            <div className="h-6 bg-gray-200 rounded-full overflow-hidden mb-2">
                              <div
                                className={`h-full ${gap.gap <= 0 ? "bg-green-500" : "bg-blue-500"}`}
                                style={{
                                  width: `${Math.min((gap.current / gap.target) * 100, 100)}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>
                                <ruby>今<rt>いま</rt></ruby>: <strong className="text-blue-600">{gap.current}てん</strong>
                              </span>
                              <span>
                                <ruby>目標<rt>もくひょう</rt></ruby>: <strong className="text-purple-600">{gap.target}てん</strong>
                              </span>
                              <span className={gap.gap <= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                {gap.gap <= 0 ? "たっせい！" : `あと${gap.gap}てん`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {Object.keys(target.targetScores || {}).length === 0 && (
                      <p className="text-gray-500 text-center py-2">
                        まだ<ruby>科目<rt>かもく</rt></ruby>ごとの<ruby>目標<rt>もくひょう</rt></ruby>がないよ
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 強み・弱み */}
        {targets.length > 0 && Object.keys(targets[0].targetScores || {}).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-lg text-green-700">
                  <ruby>得意<rt>とくい</rt></ruby>な<ruby>科目<rt>かもく</rt></ruby> 💪
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const gaps = calculateGaps(targets[0]);
                  const strengths = gaps.filter((g) => g.gap <= 0);
                  return strengths.length === 0 ? (
                    <p className="text-gray-500">もうすこしがんばろう！</p>
                  ) : (
                    <ul className="space-y-2">
                      {strengths.map((s) => (
                        <li key={s.subject} className="flex items-center gap-2 text-lg">
                          <span className="text-green-500 text-xl">✓</span>
                          <span className="font-bold">{getSubjectLabel(s.subject)}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-lg text-orange-700">
                  がんばりたい<ruby>科目<rt>かもく</rt></ruby> 📚
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const gaps = calculateGaps(targets[0]);
                  const weaknesses = gaps.filter((g) => g.gap > 0).slice(0, 3);
                  return weaknesses.length === 0 ? (
                    <p className="text-gray-500">ぜんぶたっせい！すごい！</p>
                  ) : (
                    <ul className="space-y-2">
                      {weaknesses.map((w) => (
                        <li key={w.subject} className="flex items-center gap-2 text-lg">
                          <span className="text-orange-500 text-xl">!</span>
                          <span className="font-bold">{getSubjectLabel(w.subject)}</span>
                          <span className="text-sm text-gray-500">（あと{w.gap}てん）</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* 目標追加ダイアログ */}
      <Dialog open={showAddTarget} onOpenChange={setShowAddTarget}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              <ruby>目標<rt>もくひょう</rt></ruby>をついか
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg">
                <ruby>目標<rt>もくひょう</rt></ruby>の<ruby>名前<rt>なまえ</rt></ruby>
              </Label>
              <Input
                className="text-lg py-6"
                placeholder="れい: 2がっきのテストでがんばる"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-lg">
                <ruby>科目<rt>かもく</rt></ruby>ごとの<ruby>目標<rt>もくひょう</rt></ruby><ruby>点数<rt>てんすう</rt></ruby>
              </Label>
              <p className="text-sm text-gray-500">
                もくひょうにしたいかもくだけにゅうりょくしてね
              </p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {subjects.map((subj) => (
                  <div key={subj.key} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <Label className="flex-1 text-base">{subj.label}</Label>
                    <Input
                      type="number"
                      placeholder="てん"
                      className="w-20 text-center"
                      value={targetScores[subj.key] || ""}
                      onChange={(e) =>
                        setTargetScores({ ...targetScores, [subj.key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="text-lg py-6 px-6"
                onClick={() => {
                  setShowAddTarget(false);
                  setSchoolName("");
                  setTargetScores({});
                }}
              >
                やめる
              </Button>
              <Button
                className="text-lg py-6 px-6 bg-purple-500 hover:bg-purple-600"
                onClick={handleAddTarget}
                disabled={submitting || !schoolName}
              >
                {submitting ? "ついかちゅう..." : "ついか！"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <KidsBottomNav />
    </div>
  );
}
