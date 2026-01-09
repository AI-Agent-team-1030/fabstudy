import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

// 週の開始日（月曜日）を取得
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // 日曜日(0)の場合は-6、それ以外は1-dayで月曜日に戻る
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// 週キーを生成（YYYY-MM-DD形式で週の開始日を使用）
function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date);
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, "0");
  const day = String(weekStart.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function POST() {
  try {
    // 1週間前の日付
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(23, 59, 59, 999);

    // 古い勉強ログを取得
    const logsRef = collection(db, "studyLogs");
    const logsSnap = await getDocs(logsRef);

    // ユーザーごと、週ごとにグループ化
    const archives: Record<string, Record<string, {
      userId: string;
      weekKey: string;
      weekStart: Date;
      subjects: Record<string, number>;
      totalDuration: number;
      logCount: number;
    }>> = {};

    const logsToDelete: string[] = [];

    logsSnap.docs.forEach((docSnap) => {
      const log = docSnap.data();
      const logDate = log.date?.toDate?.() || new Date(log.date);

      // 1週間以上前のデータのみ対象
      if (logDate <= oneWeekAgo) {
        const userId = log.userId;
        const weekKey = getWeekKey(logDate);
        const weekStart = getWeekStart(logDate);

        if (!archives[userId]) {
          archives[userId] = {};
        }

        if (!archives[userId][weekKey]) {
          archives[userId][weekKey] = {
            userId,
            weekKey,
            weekStart,
            subjects: {},
            totalDuration: 0,
            logCount: 0,
          };
        }

        const subject = log.subject || "other";
        const duration = log.duration || 0;

        archives[userId][weekKey].subjects[subject] =
          (archives[userId][weekKey].subjects[subject] || 0) + duration;
        archives[userId][weekKey].totalDuration += duration;
        archives[userId][weekKey].logCount += 1;

        logsToDelete.push(docSnap.id);
      }
    });

    // アーカイブを保存
    const archivesRef = collection(db, "studyLogArchives");
    let archivedCount = 0;

    for (const userId of Object.keys(archives)) {
      for (const weekKey of Object.keys(archives[userId])) {
        const archive = archives[userId][weekKey];

        // 既存のアーカイブがあるか確認
        const existingQuery = query(
          archivesRef,
          where("userId", "==", userId),
          where("weekKey", "==", weekKey)
        );
        const existingSnap = await getDocs(existingQuery);

        if (existingSnap.empty) {
          // 新規作成
          await addDoc(archivesRef, {
            userId: archive.userId,
            weekKey: archive.weekKey,
            weekStart: Timestamp.fromDate(archive.weekStart),
            subjects: archive.subjects,
            totalDuration: archive.totalDuration,
            logCount: archive.logCount,
            createdAt: Timestamp.now(),
          });
          archivedCount++;
        }
      }
    }

    // 元のログを削除
    for (const logId of logsToDelete) {
      await deleteDoc(doc(db, "studyLogs", logId));
    }

    return NextResponse.json({
      success: true,
      message: `${archivedCount}件のアーカイブを作成、${logsToDelete.length}件のログを削除しました`,
      archivedWeeks: archivedCount,
      deletedLogs: logsToDelete.length,
    });
  } catch (error) {
    console.error("Archive error:", error);
    return NextResponse.json(
      { error: "アーカイブ処理に失敗しました" },
      { status: 500 }
    );
  }
}

// アーカイブ一覧を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const archivesRef = collection(db, "studyLogArchives");
    const q = query(archivesRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    const archives = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 週キーでソート（新しい順）
    archives.sort((a: any, b: any) => b.weekKey.localeCompare(a.weekKey));

    return NextResponse.json({ archives });
  } catch (error) {
    console.error("Get archives error:", error);
    return NextResponse.json(
      { error: "アーカイブ取得に失敗しました" },
      { status: 500 }
    );
  }
}
