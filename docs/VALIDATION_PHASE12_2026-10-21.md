# EMA-Draft・EIP-6963のみの接続経路調査

実施日：2026年10月21日（日本時間）

CIのWallet固定版を bb8cd3c8ef76de6cf6b5effc7daed10234e13276 に更新しました。トークンSolidity、供給量、配備設定、履歴処理は変更していません。

公式Aerodromeの現在のデスクトップ画面では、EIP-6963検出は成功しますが、画面の候補が初期設定コネクター数で切り詰められます。Browser Walletはwindow.ethereumを参照する従来コネクターです。このためEIP-6963のみの模擬Walletは照会されても選択できず、接続許可要求に進みません。公開JavaScriptの指紋と処理、検出イベント、クリック前後のRPC、待機・再通知・再クリックを照合しました。

外部サイトは変更しておらず、この公式画面のEIP-6963のみの接続は未成立のままです。外部サイト側では検出候補を初期設定数で除外せず、利用者が選んだコネクターへ接続する対応が必要です。ThreeCoreの画面ではEIP-6963のみ、遅延検出、複数候補からの選択が模擬Chrome検査で成功しました。

Walletの診断記録と検証を改善し、基本361件（12件追加）とブラウザー21件（3件追加）が成功しました。本リポジトリは契約/permit/型検査、読み取り120件、履歴EVM10件、Wallet結合42件を維持します。最終mainのCI成否はActionsと検証記録で確認します。結合検査はforkなしの模擬EVMを使用し、実Walletや実ネットワーク取引ではありません。

実Wallet署名、売買、送金、承認、LP追加、ゲーム開発は行っていません。署名ログイン完了、他dApp、WalletConnect/実拡張、第三者監査は未検証です。

[Walletの原因分析](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/bb8cd3c8ef76de6cf6b5effc7daed10234e13276/docs/VALIDATION_PHASE12_2026-10-21.md) / [公式画面と模擬ブラウザー検証](https://github.com/FordPrefect2026/ThreeCore-Wallet/actions/runs/39498715359)
