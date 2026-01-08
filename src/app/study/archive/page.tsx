"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SUBJECTS } from "@/types";

interface Archive {
  id: string;
  weekKey: string;
  weekStart: { toDate: () => Date };
  subjects: Record<string, number>;
  totalDuration: number;
  logCount: number;
}

// 科目ごとの色
const SUBJECT_COLORS: Record<string, string> = {
  english: "bg-red-100 text-red-800",
  english_r: "bg-red-100 text-red-800",
  english_l: "bg-red-100 text-red-800",
  math: "bg-blue-100 text-blue-800",
  math_1a: "bg-blue-100 text-blue-800",
  math_2bc: "bg-blue-100 text-blue-800",
  math_3: "bg-blue-100 text-blue-800",
  japanese: "bg-orange-100 text-orange-800",
  physics: "bg-purple-100 text-purple-800",
  chemistry: "bg-green-100 text-green-800",
  biology: "bg-pink-100 text-pink-800",
  earth_science: "bg-cyan-100 text-cyan-800",
  world_history: "bg-amber-100 text-amber-800",
  japanese_history: "bg-amber-100 text-amber-800",
  geography: "bg-lime-100 text-lime-800",
  civics: "bg-teal-100 text-teal-800",
  politics_economics: "bg-violet-100 text-violet-800",
  ethics: "bg-fuchsia-100 text-fuchsia-800",
  information: "bg-indigo-100 text-indigo-800",
};

export default function ArchivePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadArchives();
    }
  }, [user]);

  const loadArchives = async () => {
    try {
      const res = await fetch(`/api/archive/weekly?userId=${user!.id}`);
      const data = await res.json();
      setArchives(data.archives || []);
    } catch (error) {
      console.error("Failed to load archives:", error);
    } finally {
      setLoadingArchives(false);
    }
  };

  const getSubjectLabel = (key: string) => {
    return SUBJECTS.find((s) => s.key === key)?.label || key;
  };

  const getSubjectColor = (key: string) => {
    return SUBJECT_COLORS[key] || "bg-gray-100 text-gray-800";
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  const formatWeekLabel = (weekKey: string, weekStart: Date) => {
    // weekKeyは YYYY-MM-DD 形式
    const startMonth = weekStart.getMonth() + 1;
    const startDay = weekStart.getDate();
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();

    return `${startMonth}/${startDay} - ${endMonth}/${endDay}`;
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">学習アーカイブ</h2>
          <Button variant="outline" onClick={() => router.push("/study")}>
            ← 戻る
          </Button>
        </div>

        {loadingArchives ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center">読み込み中...</p>
            </CardContent>
          </Card>
        ) : archives.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-2">アーカイブはまだありません</p>
              <p className="text-sm text-gray-400">
                1週間以上前のデータが自動的にアーカイブされます
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {archives.map((archive) => {
              const weekStart = archive.weekStart?.toDate?.() || new Date();
              return (
                <Card key={archive.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">
                        {formatWeekLabel(archive.weekKey, weekStart)}
                      </CardTitle>
                      <Badge variant="secondary">
                        {archive.logCount}件の記録
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg text-center">
                      <span className="text-sm text-gray-500">合計</span>
                      <span className="text-2xl font-bold text-blue-600 ml-2">
                        {formatDuration(archive.totalDuration)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(archive.subjects)
                        .sort((a, b) => b[1] - a[1])
                        .map(([subject, duration]) => (
                          <div
                            key={subject}
                            className={`px-3 py-2 rounded-lg ${getSubjectColor(subject)}`}
                          >
                            <span className="font-medium">
                              {getSubjectLabel(subject)}
                            </span>
                            <span className="ml-2 opacity-75">
                              {formatDuration(duration)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
