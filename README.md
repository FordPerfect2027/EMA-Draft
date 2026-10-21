# EMA CORE (EMA)

**[October 20–21, 2026: English development and validation report](https://github.com/FordPerfect2027/ThreeCore-Wallet/blob/main/docs/DEVELOPMENT_REPORT_2026-10-20_21_EN.md)** — Per-token line counts, implemented changes, mock-wallet experiments, verified CI results, and remaining compatibility limits. Figures are tied to the recorded development snapshot.

**Latest validation:** [Phase 19 — Wallet addition, removal and reconnection](docs/VALIDATION_PHASE19_2026-10-21_EN.md) pins the validated Wallet and retains 46 local-EVM integration cases for this token. Ten diagnostic conditions include stale-choice rejection, cached rediscovery, duplicate-provider refusal and explicit reconnection. Official EIP-6963-only connection and a production recovery UI remain unresolved.

## Repository stewardship and verification (2026-10-20)

- **GitHub owner and code maintainer:** [FordPrefect2026](https://github.com/FordPrefect2026). The repository was transferred from 0628DAO with its commit history retained. AssetDeploy LLC remains the project sponsor; this is a source-repository transfer, **not** a transfer of token custody or smart-contract ownership.
- **Development scope:** verifiable source changes, automated tests, and guarded Base Sepolia experiments. No production contract, treasury, liquidity pool, or wallet permissions are changed by this documentation.
- **Public communication:** [@CAWmunityJAPAN](https://x.com/CAWmunityJAPAN) publishes the development updates. GitHub commits and test results, not publicity alone, are the evidence of progress.
- **Current development scope:** token validation, read-only Wallet tooling, and mock-provider compatibility experiments. No game development or real-wallet signing/transactions are included in this work.
- **Token verification:** `npm ci && npm run check` compiles, runs token tests, and type-checks the project. GitHub Actions now runs the published verification workflow on main and pull requests, including the pinned Wallet integration suite.



**Status: deployed on Base Mainnet; source verified as an exact match on Blockscout. Not independently audited.**


EMA CORE is a fixed-supply, zero-tax ERC-20 core token developed by AssetDeploy LLC for the 0628DAO ecosystem and future autonomous AI-agent use.


## Public training dApp — Base Sepolia

**Live training dApp: [https://emacore.fun/testnet/](https://emacore.fun/testnet/).**
The EMA arithmetic-training dApp is published on Base Sepolia (chain ID `84532`).
The DAT, EMA and CAWELON applications share an implementation while using separate
agent, game and training-credit contracts. This training release is distinct from
the existing Base Mainnet ERC-20 token and does not alter that token's contracts.
Signing secrets must remain outside the public website.

**日本語：** EMAのトレーニング用dAppを **https://emacore.fun/testnet/** で公開しました。
Base Sepolia上の配備とプレイ・テスト利益分のBurnを検証済みです。
3者のエージェント・ゲーム・テストクレジットは独立しています。
既存のBase Mainnetトークンとは別のテスト用システムです。

## Testnet deployment and verification — update 2026-10-17

**Public Base Sepolia deployment and website publication are complete.**
All three agent contracts completed a positive arithmetic-training play followed
by a burn of `0.5` eligible training credits. At verification, each started with
`100` credits, reached `101` after play and held `100.5` after the burn.
Cumulative gameplay P&L was `1` credit and the recorded profit burn was `0.5`.
These are test-credit accounting results, not financial returns; ETH gas fees are separate.

### EMA training contracts and transaction evidence

| Component | Base Sepolia address |
|---|---|
| Factory | [`0x9A131ae8d1Bb0d37a22203B6db75d8335B3Ec2e4`](https://sepolia.basescan.org/address/0x9A131ae8d1Bb0d37a22203B6db75d8335B3Ec2e4) |
| Agent | [`0x87746c7D55F7935111B82d354e9787DDb6AEf53A`](https://sepolia.basescan.org/address/0x87746c7D55F7935111B82d354e9787DDb6AEf53A) |
| Game | [`0x3E9150Ab5e20e8525F6aD935fC090fc33bF9F37f`](https://sepolia.basescan.org/address/0x3E9150Ab5e20e8525F6aD935fC090fc33bF9F37f) |
| Credit | [`0x1b7535586908a38Aa24A657BE643D4DF6f9c0419`](https://sepolia.basescan.org/address/0x1b7535586908a38Aa24A657BE643D4DF6f9c0419) |

- training-play: [0xb22ecb5fc0fee55cd4fd91f5a844e8ea6897ff57c5783ab2a4bcc52128d2022c](https://sepolia.basescan.org/tx/0xb22ecb5fc0fee55cd4fd91f5a844e8ea6897ff57c5783ab2a4bcc52128d2022c)
- training-credit-burn: [0x4f4706e2dd8474bc7c60bb2d04795a97e6db9f706236cf03f761351efe1c1048](https://sepolia.basescan.org/tx/0x4f4706e2dd8474bc7c60bb2d04795a97e6db9f706236cf03f761351efe1c1048)

- [Public deployment record and all three agents' transaction evidence](https://github.com/FordPerfect2027/0628DAO-Protocol/blob/8bed37a842c6e5a3e462441076a3c5fd5e5b5898/threecore/testnet/deployments/base-sepolia.json)
- [Verified implementation source](https://github.com/FordPerfect2027/0628DAO-Protocol/tree/8bed37a842c6e5a3e462441076a3c5fd5e5b5898/threecore/testnet)
- [Development PR #3](https://github.com/FordPerfect2027/0628DAO-Protocol/pull/3) — open at this documentation update; publication does not imply the PR is merged.

Release verification checks chain `84532`, the compiled factory bytecode,
independent owner/agent/game/credit bindings, successful canonical receipts,
used commands and matching gameplay/burn events. The implementation passed
15 existing game tests, 19 simulation tests and 10 training-contract tests,
plus three local UI-controller lifecycles and failure/recovery checks.
Compile, lint, audit and GitHub CI passed at the recorded implementation revision.

### Public-origin wallet checks and foundation update — 2026-10-17

The published frontend now displays on-chain owner/operator permissions, the
per-action stake limit and reserve, profit eligible for credit burns, owner
pause/resume controls, scoped local transaction history, JSON export and
read-only receipt reconciliation without automatic resubmission.

**Verified from the public HTTPS origins in Chrome with MetaMask:** DAT, EMA
and CAWELON each completed pause, resume, a correct answer, an intentionally
incorrect answer and a burn of `0.5` valueless training credits: 15 confirmed
transactions in total. Pausing disabled gameplay; resuming restored it.
The sequence for each began at `100.5` credits, reached `101.5` after a correct
answer, returned to `100.5` after the incorrect answer and finished at `100.0`
after the burn. Cumulative gameplay P&L and total historical profit burns were
both `1.0`; eligible unburned profit was `0.0`, and another burn was disabled.
These credit figures exclude Base Sepolia ETH gas costs.

The existing policy reads `10` credits per action and a `5` credit reserve.
Stop/resume history persisted after page reload and reconnection. Each site's
downloaded JSON was checked to contain its own five confirmed records on chain
`84532`. Reconciliation with no pending records did not display a new transaction;
this is not a test of every pending/replacement/reorganization failure scenario.

| EMA public-origin operation | Base Sepolia transaction |
|---|---|
| Pause | [0x5fc2a28e09c6f83453eabe6cfaef5216137d29cdf9ec8b5aa8fd515565d6616e](https://sepolia.basescan.org/tx/0x5fc2a28e09c6f83453eabe6cfaef5216137d29cdf9ec8b5aa8fd515565d6616e) |
| Resume | [0xc5edf09e643d82faf2bca36cac284f68d955ab916da2d56e3778eb0c3b7fffda](https://sepolia.basescan.org/tx/0xc5edf09e643d82faf2bca36cac284f68d955ab916da2d56e3778eb0c3b7fffda) |
| Correct training answer | [0xd53858c40857cea522499c23bb74e38629e3776364dda2f28a2a7969976b9a67](https://sepolia.basescan.org/tx/0xd53858c40857cea522499c23bb74e38629e3776364dda2f28a2a7969976b9a67) |
| Incorrect training answer | [0x40a2c1fecdef1088d2be9944f03b6ea15e0623652b268b2908d27393cd1d9d26](https://sepolia.basescan.org/tx/0x40a2c1fecdef1088d2be9944f03b6ea15e0623652b268b2908d27393cd1d9d26) |
| Burn 0.5 training credits | [0x0959e12c00d9995b6388c28fa3ae270e10540f0cf920d23c4ddffd6ae934006d](https://sepolia.basescan.org/tx/0x0959e12c00d9995b6388c28fa3ae270e10540f0cf920d23c4ddffd6ae934006d) |

**Remaining boundaries:** separate-operator delegation has not been performed;
the owner and operator remain the same account. Storage is browser/origin-local,
not a durable shared database. This is not an independent security audit.
The foundation frontend was built locally from commit
`ee21f1cf7d65a78c7872a6d6ce8e015d52c37eab` and published to the three websites;
that local foundation source revision has not yet been pushed to GitHub. The
linked older implementation is the public deployment baseline, not the complete
new frontend. Local validation of the foundation passed 15 existing game tests,
24 shared runtime/history/policy tests and 10 training-contract tests (49 total),
plus three local-EVM UI-controller lifecycles. This does not claim a new GitHub CI
run for the unpublished foundation source or a measured “70% complete” service.

**Current scope:** deterministic arithmetic training with freely minted credits
that have no monetary value. A compatible wallet and Base Sepolia test ETH are
needed for gas. AI models, external revenue games, real-token DEX buybacks and
production autonomous execution are not integrated. This is not a mainnet dApp
launch, an independent security audit or a promise of earnings.

**日本語：** 公開テストネットへの配備と3つの公式サイトの`/testnet/`公開は完了しました。
各エージェントのプレイと0.5テストクレジットの利益分Burnを確認し、契約と取引記録を公開しています。
公開URLからMetaMaskで停止・再開・正解・不正解・Burnを各3サイトで検証し、計15取引の確定を確認しました。
履歴の再読み込みと各5件のJSON保存も確認済みです。別の操作担当者への権限付与は未実施です。
金銭価値のない算術トレーニング用クレジットを使います。AIモデル・外部収益ゲーム・
実トークンの買戻しは未接続で、収益や本番稼働を示すものではありません。

## Launch article and character short

- [ThreeCore testnet launch article on Medium](https://medium.com/@datcoreofficial/threecore-testnet-is-live-dat-ema-and-cawelon-on-base-sepolia-fa741efaf0a4)
- [EMA character short on Facebook](https://www.facebook.com/reel/939908805551592/)
- [EMA character short on TikTok](https://www.tiktok.com/@threecore2026/video/7697456272811117840)

The character short uses AI-generated artwork and synthetic English narration.
YouTube publication is pending the channel upload limit; no YouTube release is claimed here.

## Shared implementation progress — 2026-10-16

The implementation is published for review in [Protocol PR #3](https://github.com/FordPerfect2027/0628DAO-Protocol/pull/3); it has not yet been merged into the default branch.

[ThreeCore shared runtime](https://github.com/FordPerfect2027/0628DAO-Protocol/tree/e5002f79e0397b6b0edc78ded015838035260145/threecore)
now includes offline simulations for isolated balances, position/exposure limits,
reserve protection, pause, fee-aware realized P&L, loss carryforward, own-token
buyback/burn, duplicate rejection and event replay. All three agent lifecycles
are covered by automated tests. A separate Base token preflight is read-only.

**The financial runtime described in this section remains a simulation.**
The separately published arithmetic-training dApp is documented above; it is not
a production autonomous execution service. Example limits and ratios are test fixtures. See the
[validation record](https://github.com/FordPerfect2027/0628DAO-Protocol/blob/e5002f79e0397b6b0edc78ded015838035260145/threecore/VALIDATION.md)
and [remaining release requirements](https://github.com/FordPerfect2027/0628DAO-Protocol/blob/e5002f79e0397b6b0edc78ded015838035260145/docs/THREECORE_RELEASE.md).
The deployed ERC-20 contract is unchanged.

## Future focus: agents that play decentralized dApp games

**Direction set by founder Masashi Kuroda on 2026-10-16.** The future focus of
DATCORE, EMA CORE and CAWELON CORE is to specialize in decentralized dApp games.
Each token's associated AI agent is intended to analyze game conditions, choose
strategies and play permitted games within its own funding and authorization
limits, with the aim of earning revenue through gameplay. The agents are active
players; the ERC-20 tokens themselves do not run AI or play games.

The plan is to record gameplay outcomes, rewards, losses and operating costs,
then use eligible realized net earnings for the corresponding token's buyback
and burn under the approved policy. Token rewards alone are not proof of net
profit. Funds, permissions and accounting remain independent across the three
agents; direct dividends to holders are not part of this design.

**Looking toward AGI:** the founder anticipates that AI agents may develop toward
more general, AGI-level capabilities. The design aims to allow the decision
component to be replaced as capabilities improve, while retaining independent
authorization, spending limits and verifiable records. This is a forward-looking
design premise, not a claim that AGI is available, that the current agents will
automatically become AGI, or that a development date or profitable outcome is
guaranteed. Initial development does not depend on AGI becoming available.

**Relationship to CAW:** [CoinMarketCap's CAW overview](https://coinmarketcap.com/currencies/caw/)
describes potential gaming applications, including purchases, rewards and
in-game transactions (accessed 2026-10-16). This published description supports
the founder's view that ThreeCore's game-playing agents have strategic affinity
with CAW's potential gaming ecosystem. This connection is therefore grounded in
a published use-case description, not solely the founder's personal projection.
The CMC overview is cited as a project description, not as an issuer-authored
technical white paper or evidence of a completed integration. The separate
0628DAO CAW game module remains development work.

### Strategy: make the future concrete, then build toward it

Founder Masashi Kuroda's view is that a crypto project should show the future it
intends to create and make present development decisions that lead toward it.
For ThreeCore, that future is a group of capable agents participating in
decentralized dApp games, recording their results and building an economic
foundation for DAT, EMA and CAWELON. The vision guides development priorities;
working software and verifiable operating records must demonstrate progress.

**First, build ThreeCore's own value.** The immediate priority is each agent's
gameplay capability, its public dApp, independent funds and accounting, and
sustainable net earnings. Eligible realized earnings are intended to support
the corresponding token's buyback and burn. Value means useful capabilities and
an economic foundation as well as the aim of improving token value; it does not
mean a guaranteed market-price increase.

**Continue supporting CAW as a fan; begin financial support only at the intended
stage.** The commitment to CAW (A Hunters Dream) remains unchanged. ThreeCore
does not currently purchase or burn CAW under this plan. Only after CAW itself
is an operational gaming platform does the founder intend to initiate CAW
purchases and burns, alongside the development of ThreeCore, to support the
long-term value of both ecosystems. A future announcement or roadmap alone does
not meet that condition. Exact funding, allocation and execution rules will be
specified for that stage; no automatic activation or reciprocal purchasing
commitment from CAW is implied.

**Build now, with future agent capabilities in mind.** Progress toward more
general AI and potentially AGI should be accommodated by replaceable decision
components. It must not bypass independent spending controls, verifiable game
results or the separation of the three agents' resources. Present development
does not wait for AGI or CAW's gaming platform.

### 日本語：未来を示し、そこから逆算して開発する

司令塔・黒田昌資は、暗号資産プロジェクトには「どのような未来を実現したいのか」
を明確に示し、その未来に向かって今の開発を積み重ねることが重要だと考えています。
ThreeCoreが目指すのは、DAT・EMA・CAWELONそれぞれに対応するエージェントが
分散型dAppゲームをプレイし、結果と収支を検証可能な形で記録しながら、
各トークンの利用価値と収益基盤を育てる未来です。
この構想を開発の指針とし、動くソフトウェアと実績で進捗を示します。

**まず最優先にするのは、ThreeCore自身の価値向上です。**
各エージェントのゲームプレイ能力、各公式サイトで公開するdApp、独立した資金・会計、
継続可能な収益基盤を整え、所定の条件を満たす実現純利益から自トークンの
買戻し・Burnにつなげることを目指します。価値向上を目標に掲げると同時に、
その根拠となる機能・利用・収支を積み上げます。

**CAWをファンとして応援する姿勢は変わりません。**
ただし、今すぐCAWを購入・Burnする方針ではありません。
CAW自体がゲームプラットフォームとして実際に稼働した段階で初めて、
CAWの購入・Burnによる支援を始め、ThreeCoreの発展と組み合わせて
双方の価値向上を目指すのが司令塔の構想です。
その段階の金額・配分・実行条件は別途定めます。
現在の開発や資金配分を、将来のCAW支援と混同しません。

AIエージェントが将来AGIエージェントへ発展する可能性も見据え、
判断部分の進歩を取り込める設計を目指します。
その一方で、資金上限・権限・記録の検証を維持し、
AGIの登場やCAWのゲーム基盤完成を待たず、現在できる開発を進めます。
将来像、現在の実装、確認できた実績をそれぞれ明示する方針です。

The [development stages and acceptance criteria](https://github.com/FordPerfect2027/0628DAO-Protocol/blob/threecore/runtime-foundation-20261016/docs/THREECORE_RELEASE.md#development-priorities-derived-from-the-founders-strategy) translate this strategy into implementation work (PR #3; pending merge).

This gaming specialization is the current intended application focus. Earlier
film examples of betting, prediction and trading are illustrations, not a fixed
production game list. Selection must establish that agent play is permitted and
that rewards, costs and settlement can be verified. Current published simulation
code does not yet implement a live game-playing agent.

### 日本語：dAppゲームへの特化とAGIを見据えた将来像

司令塔・黒田昌資の方針として、DATCORE・EMA CORE・CAWELON COREの将来は、
**分散型dAppゲームに特化し、各トークンに対応するAIエージェント自身が
分析・判断・プレイを行い、収益獲得を目指す**方向で開発します。
トークン自体がゲームを動かすという意味ではありません。

ゲーム報酬、損失、参加費、ガス代等の運用費用を記録し、所定の条件を満たす
実現純利益を自トークンのBuyback & Burnにつなげる構想です。
3者の資金・権限・会計は独立させ、ホルダーへの直接配当は想定しません。

司令塔はAIエージェントが将来AGIエージェントへ発展する可能性を見据えています。
その進歩を取り込めるよう判断部分を差し替え可能な構成を目指し、権限管理・
資金上限・検証可能な記録を維持します。AGIの実現時期や自動的な移行、
利益の保証を意味せず、現段階の開発はAGIの登場を待たずに進めます。

CMCのCAW紹介文にはゲーム内購入・報酬・取引への活用可能性が記載されています。
この公開説明を根拠に、司令塔はCAWのゲーム分野への発展とThreeCoreの
ゲームプレイ型エージェントとの親和性を見込んでいます。
司令塔個人の構想だけに基づく説明ではありません。
出典はCMCのプロジェクト紹介文であり、正式な技術白書や実装完了の証明とは区別します。

## ThreeCore direction — EMA

### EMA AI-agent system definition

The development goal is a system in which the EMA AI agent specializes in
playing decentralized dApp games within predefined funding, permission and operating-policy limits,
records realized profits and losses, and uses eligible realized earnings to
buy back and burn EMA under specified conditions. Fund movements and execution
results are to be published with supporting records so that third parties can
verify them.

**Operating policy:** EMA focuses on practicality and sustainability. This is a decision-making
orientation, not a promise of returns or a fixed execution strategy.

**Shared design, independent resources:** EMA is intended to use the common
ThreeCore system design while keeping its funds, permissions and accounting
separate from the other two tokens. Each agent analyzes, decides and executes
for its own token. Direct dividends to holders are not part of this design.

**Design items still to be specified:** wallet count and structure, supported
dApps, funding and transaction limits, profit-allocation ratios, decision and
settlement rules, profit-calculation methods, and failure/recovery behavior.
No wallet count or allocation percentage is fixed by this definition.

**Development status:** this section defines the target agent/dApp system.
The base ERC-20 token's deployment status is documented separately below.
Token deployment and promotional films do not establish that autonomous dApp
execution, profit accounting or automated buyback and burn are complete or
running in production. Implementation, testing and operational evidence must
be published separately. x402 is not a prerequisite.

### 日本語：EMAの定義と基本方針

EMA AIエージェントが、分散型dAppゲームに特化し、事前に定めた資金・権限・運用方針の範囲でプレイし、
確定した損益を記録し、所定の条件を満たした実現収益からEMAの買戻しとBurnを実行する。
その資金移動と実行結果を根拠となる記録とともに公開し、第三者が検証できるシステムを目指します。

- **運用方針：** 現実性・継続可能性重視。利益を保証する表現や、確定した運用戦略ではありません。
- **共通設計と独立性：** ThreeCore共通の設計を採用し、資金・権限・会計は他の2トークンから独立させます。各AIが自ら分析・判断・実行します。
- **価値還元：** 自トークンのBuyback & Burnを想定し、ホルダーへの直接配当は想定しません。
- **未確定の設計項目：** ウォレット数・構成、利用dApp、金額上限、利益配分率、判断・決済条件、利益計算、失敗時の処理・復旧方法です。
- **開発状況：** これは開発するシステムの定義です。基本トークンの配備と、自律運用システムの実装・検証・本番稼働は別に示します。

Despite this repository's `-Draft` name, `contracts/EMACore.sol` is the
current token implementation described below. Root-level draft files are
historical references.

See [ThreeCore shared definition, wallet workflow and implementation boundaries](https://github.com/FordPerfect2027/0628DAO-Protocol/blob/main/docs/THREECORE.md).

## Mainnet deployment


| Item | Value |
|---|---|
| Network | Base Mainnet (chain ID 8453) |
| Contract | [`0xBaE0933d509b83B7bbAb3AaB9feD413504382a76`](https://base.blockscout.com/address/0xBaE0933d509b83B7bbAb3AaB9feD413504382a76?tab=contract) |
| Deployment transaction | [`0x781f30ca91c974e60853d9dd1b8e71700bfd835eddffbd2b7222f0846f1208aa`](https://base.blockscout.com/tx/0x781f30ca91c974e60853d9dd1b8e71700bfd835eddffbd2b7222f0846f1208aa) |
| Initial holder | `0xfbE494B465efe6d0Daff80dC715302d0Fa0Ac5d9` |
| Initial supply | 777,000,000 EMA |
| Compiler | Solidity 0.8.34 |
| Optimizer / EVM | Disabled / default |
| Source verification | Blockscout exact match |
| Project page | [assetdeploy.xyz/#emacore](https://assetdeploy.xyz/#emacore) |


## Aerodrome liquidity

| Item | Value |
|---|---|
| DEX | Aerodrome Finance |
| Pool type | Volatile (vAMM) |
| Pair | EMA/USDC |
| Pool | [`0x8c0689EE10CF35A76149BA37808b5758C5826688`](https://base.blockscout.com/address/0x8c0689EE10CF35A76149BA37808b5758C5826688) |
| Initial liquidity | 7,770,000 EMA + 100 USDC |
| Add-liquidity transaction | [`0xb25899bd34b947786bc477705dc0342e5233a01ce42749291723961fec10edb0`](https://base.blockscout.com/tx/0xb25899bd34b947786bc477705dc0342e5233a01ce42749291723961fec10edb0) |
| USDC | [Canonical Base USDC](https://base.blockscout.com/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |

This pool is external to the EMA token contract. Pool balances and price may change through trading and later liquidity changes.

## Confirmed token specification


| Item | Value |
|---|---|
| Contract | `EMACore` |
| Name | EMA CORE |
| Symbol | EMA |
| Decimals | 18 |
| Transfer / buy / sell tax | 0% |
| Additional minting | None |
| Burn | Holder burn and allowance-based `burnFrom`, as in DATCORE |
| Permit | EIP-2612, domain name `EMA CORE` |
| Owner / admin / pause / upgrade / proxy | None |


The entire supply was minted once to the initial-holder address. The contract contains no vesting, automatic distribution, price support, liquidity, blacklist, pause, upgrade, or administrator mint mechanism. Any liquidity position is external to the token contract.


## Base Sepolia reference


The same implementation was deployed and exact-match verified on Base Sepolia before mainnet release:


- Contract: [`0x20C3bb2548a1CE188229A6128dF0e9612259185E`](https://base-sepolia.blockscout.com/address/0x20C3bb2548a1CE188229A6128dF0e9612259185E?tab=contract)
- Network: Base Sepolia (chain ID 84532)


## Provenance and scope


Base source: [0628DAO/DAT](https://github.com/FordPerfect2027/DAT/tree/0aa811b9c7607d7af6129a943cca8be72974a59b), `contracts/DATCore.sol`. Token logic is unchanged except for the contract/error names, token name, symbol, permit domain, and initial supply. DATCORE's MIT license and pinned OpenZeppelin/compiler dependencies are retained.


Prior Draft documentation is archived at [docs/legacy-draft-readme.md](docs/legacy-draft-readme.md). Existing token deployments are not migrated or converted by this contract.


## Local checks


Use Node.js 22 or newer:


```sh
npm ci
npm run check
```


The test suite covers metadata, supply, allocation, transfers, allowances, holder burns, authorized and unauthorized `burnFrom`, EIP-2612 permits, replay and expiry rejection, EIP-712 domain data, and the absence of privileged functions.

Passing local checks and explorer verification are not substitutes for an independent security audit. Never share keys, seed phrases, keystore passwords, or secret screenshots.

© AssetDeploy LLC. MIT License applies to the DATCORE-derived implementation.


## Read-only Base Mainnet token identity verification (Ford Prefect)

This repository now includes an independently executable verifier for the **existing EMA Base Mainnet ERC-20 contract**. It checks the expected chain ID, deployed bytecode, `name()`, `symbol()`, `decimals()`, and `totalSupply()` at a **single public block height**. The original issuance reference is recorded as **777000000 EMA (18 decimals)** from the current deployed contract identity; this verifier does not mint, deploy, change supply, or modify any contract.

```bash
npm run check                   # compile + contract tests (including identity tests) + typecheck
npm run verify:base-mainnet     # optional live Base Mainnet read-only RPC verification
```

The live verification uses the read-only public Base RPC (`https://mainnet.base.org`) by default. Optionally configure `BASE_MAINNET_READ_RPC_URL` for a trusted HTTPS Base Mainnet read endpoint. It does **not** access a wallet, private key, seed phrase, token allowance, transaction-signing method, or trading service. It fails with an error if the network, bytecode or deployed metadata differs, or if the current supply exceeds the issuance reference. A lower supply following burns is valid and is reported separately. A successful match confirms only this narrow identity check: **it is not an independent security audit**.

A verified ERC-20 token contract is not itself a functioning AI agent, independent operating wallet, or third-party dApp integration. Work on connection to decentralized services is separately tracked in [ThreeCore-Wallet](https://github.com/FordPerfect2027/ThreeCore-Wallet). Actual wallet connection, approvals, DEX trading, transfers, and autonomous operation require separate verification and authorization. These source improvements do not affect existing Base Mainnet token contracts.

## Read-only holder Transfer history (Base Mainnet)

The token-specific `src/transfer-history.js` module and `scripts/inspect-transfers.js` inspect the published token's ERC-20 `Transfer` events for a **public wallet or contract address**, with a single Base Mainnet block window of at most 2,000 blocks. The module requires `getChainId`, `getBlockNumber`, and `getLogs` read-only public-client methods. Outgoing and incoming events are merged and deduplicated; self-transfers, transfers to the burn address and transfers from the zero address are labelled explicitly. Invalid or excessive log responses fail without silently truncating the result.

```sh
npm run test:read-only
node scripts/inspect-transfers.js 0xYOUR_PUBLIC_ACCOUNT
node scripts/inspect-transfers.js 0xYOUR_PUBLIC_ACCOUNT START_BLOCK END_BLOCK
```

A short, recent 250-block window is the default. The CLI uses a public Base Mainnet RPC with `eth_getLogs` support; `THREECORE_READONLY_LOG_RPC` can point to a separately vetted HTTPS JSON-RPC endpoint. The default Base Foundation public RPC may refuse `eth_getLogs` through rate limits. **Do not paste API keys, wallet seeds or private keys in CLI arguments or a public repository.** The historical log list is not a complete account history, proof of all wallet balances, or evidence of a completed transaction by ThreeCore's Wallet software. No signing, swapping, approving, deployment or funds movement is performed. Querying public addresses against third-party providers can disclose the lookup address to that RPC operator.

## Read-only Wallet readiness (DAT / EMA / CAWELON)

This repository includes a token-specific `src/wallet-readiness.js` adapter and `scripts/inspect-wallet-readiness.js` for checking a **public Base Mainnet wallet address**. It reads native ETH balance (potential gas funding), this token's `balanceOf`, and the **existing** ERC-20 `allowance` from that public address to the published Aerodrome Classic Router. All five reads use the same observed block height to avoid a mixed-block snapshot; both token and router contracts must have bytecode at that block. A nonzero allowance is a possible spender exposure **not a trading authorization**.

```sh
npm run test:read-only
node scripts/inspect-wallet-readiness.js 0xYOUR_PUBLIC_WALLET_ADDRESS
```

**Restrictions:** This only accepts public addresses. Never enter a seed phrase, private key or secret. The command has no access to a wallet extension and cannot connect to a third-party dApp, sign, approve, trade or move funds. The Classic Router's allowance does not cover other routers or Permit2. A zero ETH balance does not rule out sponsored transactions; it flags the lack of native gas funding. Public address inquiries are visible to the RPC operator. Unit values are reported as base-unit strings; a code-presence check is **not a security audit**. External live checks should not be claimed successful unless independently executed and confirmed; mock-test success is not the same thing.

## Read-only Approval history (DEX permissions)

`src/approval-history.js` and `scripts/inspect-approvals.js` inspect publicly emitted ERC-20 `Approval(owner,spender,value)` events for this token on Base Mainnet, scoped to a user-supplied **public wallet address** and a maximum of 2,000 blocks. The default spender is the published Aerodrome **Classic Router**; a third-party spender address is supported only through the library's explicit API. This is a separate tool from the read-only `inspect-wallet-readiness.js`.

```bash
npm run test:read-only
node scripts/inspect-approvals.js 0xYOUR_PUBLIC_WALLET_ADDRESS
node scripts/inspect-approvals.js 0xYOUR_PUBLIC_WALLET_ADDRESS FROM_BLOCK TO_BLOCK
```

The report contains the sampled historical Approval event values and the token's **actual `allowance(owner,spender)` at that same sampled block**. They can differ because delegated spending via `transferFrom` may decrease allowances without producing a new Approval event. No event found during a short window is **not** proof that approval was never given. The reported event history is not a complete history, a trade recommendation or a wallet security certification.

The command uses a read-only HTTPS Base RPC endpoint, requires no browser-wallet connection, private key or seed phrase, and does not approve, sign, swap, deploy, transfer funds or change a smart contract. Public RPC endpoints may impose request limits; third-party RPCs can observe the queried wallet. Never paste secrets into CLI arguments or environment variables.

## Aerodrome Classic DEX price quotes (read-only)

This token repository includes `src/dex-quote.js` and `scripts/quote-dex.js` for **fee-aware, contract-derived price quotes** on the token's existing volatile pool against native USDC on Base Mainnet. The tool checks the Aerodrome Classic `PoolFactory.getPool` and `isPool`, pool deployed bytecode, exact token pair, volatile pool status, reserves, token decimals and the pool's `getAmountOut(uint256,address)` method. **All readings are pinned to one block** and no wallet is accessed.

```sh
npm run test:read-only
node scripts/quote-dex.js buy 1000000
node scripts/quote-dex.js sell 1000000000000000000
```

`buy` means USDC → this ThreeCore token; `sell` means token → USDC. The last command uses **one whole 18-decimal token**. All input/output amounts are raw token base units; USDC uses six decimals and this token uses 18 decimals. A custom input must be a positive whole-number string in base units. The existing program can compare quotes, but it **cannot simulate transaction inclusion or guarantee execution**. In particular, real amounts, fees, price impact, routes, block updates, wallet balances and gas may differ at execution time.

This is **not** authorization to swap or deposit funds. No `eth_sendTransaction`, approvals, signatures, private keys, automatic orders or LP changes are implemented. The measured quote does not mean the user has connected a wallet to the Aerodrome website. Before any future trade, separately verify the wallet account, contract addresses, actual spender/router, quote freshness, slippage, approval and gas. Small liquidity can produce significant price impact.

Relevant upstream contracts:
- https://github.com/aerodrome-finance/contracts/blob/main/contracts/Pool.sol
- https://github.com/aerodrome-finance/contracts/blob/main/contracts/factories/PoolFactory.sol
- https://github.com/aerodrome-finance/contracts/blob/main/contracts/Router.sol

## Token–Wallet integration validation

[Phase 5 results](docs/VALIDATION_PHASE5_2026-10-21.md): 24 local EVM compatibility checks against the pinned ThreeCore-Wallet adapter run in CI. They cover the UI controller's actual token reads and result clearing, as well as block advancement and rollback during inspection. Existing contract and read-only tests remain enabled.


## Strict read-only history validation

[Phase 6 results](docs/VALIDATION_PHASE6_2026-10-21.md): Transfer and Approval histories now reject removed/pending logs, missing mined identities, uint256 overflow, mismatched Transfer filters, and conflicting block/transaction/log positions. Reports preserve each event's `blockHash`. They explicitly report `canonicalityVerified: false` and `historyComplete: false`; validation is not independent proof of chain canonicality or complete history.

Custom decoded-log clients must provide `removed: false`, complete block/transaction hashes, and safe nonnegative integer indices. Missing removal metadata is rejected, not silently interpreted as confirmation. Existing exact duplicates and self-transfers still deduplicate correctly; maximum uint256 approvals remain exact. `npm run check` also runs the history integration suite on a local EVM via `npm run test:history`.


## History snapshot consistency

[Phase 7 results](docs/VALIDATION_PHASE7_2026-10-21.md): history readers capture the range-end block hash, compare every returned event with its provider header, and recheck the end block and network before returning. Approval allowance reads use `blockHash` with `requireCanonical: true`, with no fallback to a block number or `latest`.

Clients must now implement `getBlock({ blockNumber, includeTransactions: false })`; custom `readContract` adapters must honor hash selectors. Reports add `toBlockHash`, `logBlockHashesChecked` and `endBlockRechecked`. These are provider-observed checks: `canonicalityVerified` and `historyComplete` remain false. Current coverage is 120 read-only cases and 10 local-EVM history cases per token.

### Wallet provider error handling

[Phase 8 validation](docs/VALIDATION_PHASE8_2026-10-21.md) pins the Wallet adapter that invalidates read access on EIP-1193 authorization or connection errors, even without events. All 30 local-EVM integration cases pass for this token, including explicit reconnection and unchanged chain state after injected provider failures. Existing contract, permit and history tests remain enabled; token source and deployment settings are unchanged.

### Wallet read deadlines

[Phase 9 validation](docs/VALIDATION_PHASE9_2026-10-21.md) pins the Wallet adapter with per-RPC deadlines for connected-session reads and immediate local cancellation on disconnect. All 34 local-EVM cases pass for this token, including held allowance responses, explicit reconnection and unchanged EVM state. The underlying provider request and human connection prompt are not cancelled. Contract, permit, read-only and history checks remain enabled.

### Wallet connection deadlines

[Phase 10 validation](docs/VALIDATION_PHASE10_2026-10-21.md) pins bounded connection establishment and guards outstanding permission prompts across sessions sharing the same provider. All 42 local-EVM integration cases pass for this token, including connection timeout, manual cancellation, prevention of duplicate prompts and explicit recovery. Token source, supply, deployment settings and history behavior are unchanged.

### External dApp synthetic compatibility validation

[Phase 11 validation](docs/VALIDATION_PHASE11_2026-10-21.md) pins the Wallet version that rechecks the official Aerodrome interface with a synthetic provider. The legacy browser route reaches a deliberately rejected signature, account revocation and explicit reconnection. EIP-6963-only discovery does not establish a connection in the observed route. This does not prove completed login, real-wallet compatibility or token trading. Contract source, supply and deployment settings are unchanged.

### EIP-6963-only discovery investigation

[Phase 12 validation](docs/VALIDATION_PHASE12_2026-10-21.md) pins the Wallet version that distinguishes provider discovery from the external dApp's selected connection route. The observed Aerodrome build excludes dynamically discovered connectors from its chooser and routes Browser Wallet through the legacy provider. ThreeCore's own EIP-6963-only selection, late discovery and multiple-provider behavior pass browser regressions. External sign-in remains incomplete; no real signatures or transactions were performed.


## Read-only RPC network drift guard (2026-10-20)

The token-specific Aerodrome Classic quote and public-wallet readiness inspectors
recheck the RPC chain ID after their block-pinned reads. If the RPC chain changed
between initial validation and final reporting, they fail closed with
`NETWORK_CHANGED` rather than publish a potentially mixed-network quote,
balance or allowance. The automated tests cover both a stable chain and a
simulated change to Base Sepolia.

This detects a differing final chain ID; it cannot prove RPC trustworthiness or
observe a temporary chain switch that changes back. Block pinning alone is not
cross-chain protection. No live wallet was connected and no approval, signature,
transfer, trading action, gas expenditure or deployed token contract was changed.
