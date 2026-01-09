import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { User, SessionUser } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { name, password, role } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "パスワードを入力してください" },
        { status: 400 }
      );
    }

    // ユーザーを検索（教師の場合はパスワードのみで検索）
    const usersRef = collection(db, "users");
    let q;
    if (role === "teacher") {
      // 教師はマスターパスワードのみでログイン
      q = query(usersRef, where("role", "==", "teacher"));
    } else {
      // 生徒は名前とパスワードでログイン
      if (!name) {
        return NextResponse.json(
          { error: "名前を入力してください" },
          { status: 400 }
        );
      }
      q = query(
        usersRef,
        where("name", "==", name),
        where("role", "==", "student")
      );
    }
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 401 }
      );
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data() as Omit<User, "id">;

    // パスワード検証
    const isValid = await bcrypt.compare(password, userData.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "パスワードが正しくありません" },
        { status: 401 }
      );
    }

    // セッション用のユーザー情報を返す
    const sessionUser: SessionUser = {
      id: userDoc.id,
      name: userData.name,
      role: userData.role,
      grade: userData.grade,
      isElementary: userData.isElementary,
    };

    return NextResponse.json({ user: sessionUser });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "ログイン処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
