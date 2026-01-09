"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { getLevelFromExp, LEVEL_CONFIG, BADGES, UserGameData } from "@/types";
import Link from "next/link";

export default function KidsDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [gameData, setGameData] = useState<UserGameData | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

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
      const todayStr = new Date().toISOString().split("T")[0];
      const uniqueDates = new Set<string>();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        total += data.duration || 0;

        const logDate = data.date?.toDate?.() || new Date(data.date);
        const logDateStr = logDate.toISOString().split("T")[0];
        uniqueDates.add(logDateStr);

        if (logDateStr === todayStr) {
          today += data.duration || 0;
        }
      });

      setTotalMinutes(total);
      setTodayMinutes(today);
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
    if (hours === 0) return `${mins}ぷん`;
    if (mins === 0) return `${hours}じかん`;
    return `${hours}じかん${mins}ぷん`;
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-100 to-orange-100 flex items-center justify-center">
        <p className="text-2xl">よみこみちゅう...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const levelInfo = gameData ? getLevelFromExp(gameData.totalExp) : { level: 1, currentExp: 0, nextLevelExp: 100 };
  const expProgress = levelInfo.nextLevelExp > 0 ? (levelInfo.currentExp / levelInfo.nextLevelExp) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-100 to-orange-100 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-orange-400 to-yellow-400 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-white text-center">
          {user.name}さんの へや
        </h1>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* レベル表示 */}
        <Card className="bg-white/90 border-4 border-yellow-400 shadow-xl">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="text-6xl mb-2">⭐</div>
              <div className="text-3xl font-bold text-yellow-600">
                レベル {levelInfo.level}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>けいけんち</span>
                <span>{levelInfo.currentExp} / {levelInfo.nextLevelExp}</span>
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${expProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 連続記録 */}
        <Card className="bg-white/90 border-4 border-red-400 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-4xl">🔥</div>
              <div className="text-center flex-1">
                <div className="text-lg text-gray-600">れんぞくきろく</div>
                <div className="text-4xl font-bold text-red-500">
                  {gameData?.currentStreak || 0}にち
                </div>
              </div>
              <div className="text-4xl">🔥</div>
            </div>
          </CardContent>
        </Card>

        {/* 今日の勉強時間 */}
        <Card className="bg-white/90 border-4 border-blue-400 shadow-xl">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-lg text-gray-600 mb-2">きょうのべんきょう</div>
              <div className="text-4xl font-bold text-blue-600">
                {formatTime(todayMinutes)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* バッジコレクション */}
        <Card className="bg-white/90 border-4 border-purple-400 shadow-xl">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-purple-600">バッジコレクション</div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {BADGES.map((badge) => {
                const isEarned = gameData?.earnedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`text-3xl text-center p-2 rounded-lg transition-all ${
                      isEarned
                        ? "bg-yellow-100 scale-110"
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
              {gameData?.earnedBadges.length || 0} / {BADGES.length} コンプリート
            </div>
          </CardContent>
        </Card>

        {/* 累計 */}
        <Card className="bg-white/90 border-4 border-green-400 shadow-xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600">ぜんぶで</div>
                <div className="text-2xl font-bold text-green-600">{formatTime(totalMinutes)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">きろくした回数</div>
                <div className="text-2xl font-bold text-green-600">{totalRecords}かい</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-yellow-400 z-50">
        <div className="flex justify-around items-center h-20 max-w-lg mx-auto">
          <Link href="/kids/dashboard" className="flex flex-col items-center text-yellow-600 font-bold">
            <span className="text-2xl">🏠</span>
            <span className="text-xs">ホーム</span>
          </Link>
          <Link href="/kids/study" className="flex flex-col items-center text-gray-500">
            <span className="text-2xl">📝</span>
            <span className="text-xs">きろく</span>
          </Link>
          <Link href="/kids/wishlist" className="flex flex-col items-center text-gray-500">
            <span className="text-2xl">📋</span>
            <span className="text-xs">やりたいこと</span>
          </Link>
          <Link href="/kids/messages" className="flex flex-col items-center text-gray-500">
            <span className="text-2xl">💬</span>
            <span className="text-xs">メッセージ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
