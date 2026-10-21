# EMA-Draft・外部dApp模擬接続検証の連携

実施日：2026年10月21日（日本時間）

CIのWallet固定版を 2b6a23b61d04cd72f3d868f66c037a1aae07776b に更新しました。トークンのSolidity、供給量、配備設定、履歴処理は変更していません。

公式Aerodromeを拡張機能・既存アカウントのない一時Chromeで再検証しました。window.ethereumとEIP-6963を公開する模擬Walletでは、接続許可、署名要求と4001による拒否、模擬許可の取り消しによる接続画面への復帰、明示的な再接続を確認しました。

EIP-6963のみではeth_accounts照会はありましたが接続許可の要求は観測されず、接続成立は未確認です。診断完了を互換性合格と読み替えてはいけません。いずれもログイン完了・実取引の検証ではありません。

模擬Walletの許可応答とアカウント変更イベントを補い、許可要求のみで進む実際のサイト経路に検査条件を合わせました。Wallet基本349件（27件追加）が成功し、公式サイト診断は2方式を別々に記録しています。

本リポジトリのCIでは契約/permit/型検査、読み取り120件、履歴EVM10件、Wallet結合42件を継続します。Wallet結合検査はforkなしの模擬EVM上でBase/Base SepoliaのチェーンIDを用い、実ネットワークや実Walletは使用しません。最終コミットのActionsと検証記録でCI成否を確認できます。

実Walletでの署名・売買・送金・承認・LP追加、ゲーム開発は行っていません。他のdApp、WalletConnect、Coinbase/Binance拡張、署名ログイン完了、トークン取引の互換性、第三者監査は未検証です。

[Walletの詳細](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/2b6a23b61d04cd72f3d868f66c037a1aae07776b/docs/VALIDATION_PHASE11_2026-10-21.md) / [公式サイト診断](https://github.com/FordPrefect2026/ThreeCore-Wallet/actions/runs/39495046594)
