import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { SessionUser } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { name, password, grade, role } = await request.json();

    if (!name || !password || grade === undefined) {
      return NextResponse.json(
        { error: "名前、パスワード、学年を入力してください" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "パスワードは4文字以上で入力してください" },
        { status: 400 }
      );
    }

    // 同じ名前のユーザーが存在するかチェック
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("name", "==", name));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return NextResponse.json(
        { error: "この名前は既に使用されています" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Timestamp.now();
    const gradeNum = Number(grade);

    // ユーザーを作成
    const newUser = {
      name,
      password: hashedPassword,
      grade: gradeNum,
      role: role || "student",
      isElementary: gradeNum <= 6,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(usersRef, newUser);

    // セッション用のユーザー情報を返す
    const sessionUser: SessionUser = {
      id: docRef.id,
      name: newUser.name,
      role: newUser.role as "student" | "teacher",
      grade: newUser.grade,
      isElementary: newUser.isElementary,
    };

    return NextResponse.json({ user: sessionUser });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "登録処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
