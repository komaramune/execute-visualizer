# Execute Visualizer (Local Web App)

Minecraft Java Edition の `execute <subcommands> run ~` における、コマンドソースの位置・向き変化を 3D で可視化するローカル Web アプリの土台です。

## Tech Stack
- Vite
- React
- TypeScript
- Three.js
- Local only (no backend)

## ローカル起動手順
1. Node.js 20+ を用意
2. 依存関係インストール

```bash
npm install
```

3. 開発サーバー起動

```bash
npm run dev
```

4. ブラウザで表示 (`http://localhost:5173`)

## 現在のファイル構成（提案）

```text
src/
  parser/
    executeParser.ts        # execute サブコマンドの字句分割/構文解析
  simulator/
    executeSimulator.ts     # 各ステップ before/after 状態の計算
  types/
    execute.ts              # AST / Token / 状態 / 結果型
  viewer/
    ThreeViewer.tsx         # Three.js ビューアー基盤
  App.tsx                   # 1ページUI（入力欄/ビューアー/エンティティ設定）
  App.css                   # レイアウトとスタイル
  main.tsx
  index.css
```

## 対応済み（骨組み）
- サブコマンド AST バリアント分離
  - `as <Entity>`
  - `at <Entity>`
  - `positioned <pos>`
  - `positioned as <Entity>`
  - `rotated <yaw> <pitch>`
  - `rotated as <Entity>`
  - `facing <pos>`
  - `facing entity <Entity> feet`
- 座標トークン分離 (`absolute`, `relative(~)`, `local(^)`)
- 角度トークン分離 (`absolute`, `relative(~)`)
- 不正座標混在エラー
  - `^` と絶対/`~` の混在
  - `^` 使用時の 3軸不統一
- 未対応構文エラー
- 各ステップの `before / after` 状態保持
- 3D 表示基盤
  - グリッド
  - 座標軸
  - エンティティ向き
  - ステップ結果向き
  - OrbitControls による回転/ズーム
- サブコマンド項目ホバー時の強調表示（色）

## 制約
- エンティティは 1 体のみ
- `<Entity>` は単なる名前文字列として扱い、定義済み名と一致した場合のみ有効
- `anchor` は `feet` 固定
- `run` は現在 `run ~` のみ許可
