// テスト用データを投入するスクリプト
// 実行: npx ts-node scripts/seed.ts

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, Timestamp } from "firebase/firestore";
import bcrypt from "bcryptjs";

const firebaseConfig = {
  apiKey: "AIzaSyAjSdOcCAmWYWP4wFw6xiI5xuf2H85EQII",
  authDomain: "fabstudy-pro.firebaseapp.com",
  projectId: "fabstudy-pro",
  storageBucket: "fabstudy-pro.firebasestorage.app",
  messagingSenderId: "783915397276",
  appId: "1:783915397276:web:82c2ba2f1ede986660bd59",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log("テストデータを投入中...");

  const now = Timestamp.now();

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
      grade: 10, // 高1
      role: "student",
      isElementary: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      name: "鈴木花子",
      password: await bcrypt.hash("test123", 10),
      grade: 4, // 小4
      role: "student",
      isElementary: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const usersRef = collection(db, "users");

  for (const user of users) {
    const docRef = await addDoc(usersRef, user);
    console.log(`ユーザー作成: ${user.name} (ID: ${docRef.id})`);
  }

  console.log("\n完了！以下のアカウントでログインできます:");
  console.log("----------------------------------------");
  console.log("【先生用】");
  console.log("  名前: テスト先生");
  console.log("  パスワード: teacher123");
  console.log("");
  console.log("【生徒用（高校生）】");
  console.log("  名前: 山田太郎");
  console.log("  パスワード: test123");
  console.log("");
  console.log("【生徒用（小学生）】");
  console.log("  名前: 鈴木花子");
  console.log("  パスワード: test123");
  console.log("----------------------------------------");

  process.exit(0);
}

seed().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});
