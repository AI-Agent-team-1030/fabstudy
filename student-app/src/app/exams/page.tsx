"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExamsPage() {
  const router = useRouter();

  useEffect(() => {
    // テスト記録は学習記録ページに統合されたのでリダイレクト
    router.replace("/study");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>リダイレクト中...</p>
    </div>
  );
}
