# 学習進捗管理ツール (fabstudy)

塾の生徒の学習進捗を管理するツールです。

## プロジェクト構成

```
study-tracker/
├── student-app/    # 生徒用アプリ
└── teacher-app/    # 教師用アプリ
```

## デプロイ先

- 生徒用: fabstudy-student.vercel.app
- 教師用: fabstudy-teacher.vercel.app

## 開発環境のセットアップ

### 生徒用アプリ

```bash
cd student-app
npm install
npm run dev
```

### 教師用アプリ

```bash
cd teacher-app
npm install
npm run dev
```

## 環境変数

各アプリのディレクトリに `.env.local` を作成してください。

```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

## Vercelでのデプロイ

同じリポジトリから2つのプロジェクトとしてデプロイします。

1. Vercelで「New Project」を作成
2. このリポジトリをインポート
3. 「Root Directory」を `student-app` に設定
4. デプロイ

5. 再度「New Project」を作成
6. 同じリポジトリをインポート
7. 「Root Directory」を `teacher-app` に設定
8. デプロイ
