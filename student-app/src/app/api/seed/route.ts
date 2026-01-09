import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp, getDocs, query, where } from "firebase/firestore";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const now = Timestamp.now();
    const usersRef = collection(db, "users");

    // 既存のテストユーザーをチェック
    const existingQuery = query(usersRef, where("name", "==", "山田太郎"));
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
      return NextResponse.json({
        message: "テストユーザーは既に存在します",
        accounts: [
          { name: "テスト先生", password: "teacher123", type: "先生用" },
          { name: "山田太郎", password: "test123", type: "生徒用（高校生）" },
          { name: "鈴木花子", password: "test123", type: "生徒用（小学生）" },
        ]
      });
    }

    // テスト用ユーザーを作成
    const users = [
      {
        name: "テスト先生",
        password: await bcrypt.hash("teacher123", 10),
        grade: 0,
        role: "teacher",
        isElementary: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "山田太郎",
        password: await bcrypt.hash("test123", 10),
        grade: 10,
        role: "student",
        isElementary: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "鈴木花子",
        password: await bcrypt.hash("test123", 10),
        grade: 4,
        role: "student",
        isElementary: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const created = [];
    for (const user of users) {
      const docRef = await addDoc(usersRef, user);
      created.push({ name: user.name, id: docRef.id });
    }

    return NextResponse.json({
      message: "テストユーザーを作成しました",
      created,
      accounts: [
        { name: "テスト先生", password: "teacher123", type: "先生用" },
        { name: "山田太郎", password: "test123", type: "生徒用（高校生）" },
        { name: "鈴木花子", password: "test123", type: "生徒用（小学生）" },
      ]
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "テストデータの作成に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
