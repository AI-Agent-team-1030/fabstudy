"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { getLevelFromExp, LEVEL_CONFIG, BADGES, UserGameData } from "@/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function KidsDashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [gameData, setGameData] = useState<UserGameData | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
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
      // 学習ログを取得
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
      });

      setTotalMinutes(total);
      setTodayMinutes(today);
      setWeeklyMinutes(weekly);
      setTotalRecords(snapshot.docs.length);

      // ゲームデータを取得または作成
      const gameDataRef = doc(db, "userGameData", user.id);
      const gameDataSnap = await getDoc(gameDataRef);

      // 経験値を計算（勉強時間 × 2 + 記録数 × 10）
      const totalExp = total * LEVEL_CONFIG.expPerMinute + snapshot.docs.length * LEVEL_CONFIG.expPerRecord;

      // 連続記録を計算
      const sortedDates = Array.from(uniqueDates).sort().reverse();
      let currentStreak = 0;
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      for (const dateStr of sortedDates) {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diff = Math.floor((checkDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diff === 0 || diff === 1) {
          currentStreak++;
          checkDate = d;
        } else {
          break;
        }
      }

      // 獲得バッジをチェック
      const earnedBadges: string[] = [];
      BADGES.forEach((badge) => {
        if (badge.condition === "streak" && currentStreak >= badge.threshold) {
          earnedBadges.push(badge.id);
        } else if (badge.condition === "total_time" && total >= badge.threshold) {
          earnedBadges.push(badge.id);
        }
      });

      const newGameData: UserGameData = {
        id: user.id,
        userId: user.id,
        totalExp,
        earnedBadges,
        currentStreak,
        longestStreak: Math.max(currentStreak, gameDataSnap.exists() ? gameDataSnap.data().longestStreak || 0 : 0),
        lastRecordDate: sortedDates[0] || "",
        updatedAt: Timestamp.now(),
      };

      // Firestoreに保存
      await setDoc(gameDataRef, newGameData);
      setGameData(newGameData);

    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const levelInfo = gameData ? getLevelFromExp(gameData.totalExp) : { level: 1, currentExp: 0, nextLevelExp: 100 };
  const expProgress = levelInfo.nextLevelExp > 0 ? (levelInfo.currentExp / levelInfo.nextLevelExp) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー - 高校生版と同じスタイル */}
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg">学習進捗管理</h1>
              <Badge variant="secondary" className="ml-2">
                {user.name}
              </Badge>
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
            <CardTitle className="text-lg">今週の勉強時間</CardTitle>
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
                <span>経験値</span>
                <span>{levelInfo.currentExp} / {levelInfo.nextLevelExp}</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${expProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 統計カード */}
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
                <div className="text-sm text-gray-500">連続記録</div>
              </div>
              <div className="text-center py-2">
                <div className="text-sm text-gray-500">総計</div>
              </div>
            </div>
            <div className="grid grid-cols-3">
              <div className="text-center py-4 border-r">
                <span className="text-xl font-bold text-blue-600">{formatTime(todayMinutes)}</span>
              </div>
              <div className="text-center py-4 border-r">
                <span className="text-xl font-bold text-orange-500">{gameData?.currentStreak || 0}日</span>
              </div>
              <div className="text-center py-4">
                <span className="text-xl font-bold">{formatTime(totalMinutes)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* バッジコレクション */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">バッジ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {BADGES.map((badge) => {
                const isEarned = gameData?.earnedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`text-2xl text-center p-2 rounded-lg transition-all ${
                      isEarned
                        ? "bg-yellow-100"
                        : "bg-gray-100 grayscale opacity-40"
                    }`}
                    title={isEarned ? badge.name : "???"}
                  >
                    {badge.icon}
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-3 text-sm text-gray-500">
              {gameData?.earnedBadges.length || 0} / {BADGES.length} 個獲得
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 下部ナビゲーション - 高校生版と同じスタイル */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <Link href="/kids/dashboard" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/dashboard" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">ホーム</span>
          </Link>
          <Link href="/kids/study" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/study" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">学習記録</span>
          </Link>
          <Link href="/kids/wishlist" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/wishlist" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">目標</span>
          </Link>
          <Link href="/kids/messages" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/messages" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">メッセージ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
