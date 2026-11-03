// The 28 levels, one per historic hack. Figures are the commonly reported numbers.
import type { Text } from '../i18n';

// phisher, mev and lazarus are never in a level's pool: they join by stage (see difficulty.ts specials).
export type EnemyKind = 'bug' | 'drainer' | 'bot' | 'airdrop' | 'rug' | 'whale' | 'ninja' | 'phisher' | 'mev' | 'lazarus';
export type BossArt = 'vault' | 'slime' | 'duo' | 'bomb' | 'hood' | 'portal' | 'tower' | 'oracle' | 'final';

export interface LevelDef {
  id: number;           // 1-based
  date: string;         // YYYY.MM
  name: string;         // event name (latin, shown in both languages)
  loss: Text;
  boss: Text;           // boss display name
  tag: Text;            // short mechanic title for the big banner
  flavor: Text;         // story hook on the intro card
  hint: Text;           // how the mechanic works
  goal: Text;           // win condition, shown on the intro card and in the HUD
  art: BossArt;
  color: string;
  pool: EnemyKind[];
  duration: number;     // seconds of waves before the boss arrives
  floor: [string, string, string];
}

const ERA1: EnemyKind[] = ['bug', 'drainer', 'bot'];
const ERA2: EnemyKind[] = ['bug', 'drainer', 'bot', 'airdrop', 'rug'];
const ERA3: EnemyKind[] = ['bug', 'drainer', 'bot', 'airdrop', 'rug', 'whale'];
const ERA4: EnemyKind[] = ['bug', 'drainer', 'bot', 'ninja', 'airdrop', 'rug', 'ninja', 'whale'];

const F1: [string, string, string] = ['#0f0c1c', '#1d1733', '#f7931a'];
const F2: [string, string, string] = ['#0c1020', '#18213d', '#29d3ff'];
const F3: [string, string, string] = ['#120a1e', '#251536', '#ff3d8b'];
const F4: [string, string, string] = ['#140808', '#2a1216', '#ff4545'];

const t = (zh: string, en: string): Text => ({ zh, en });

export const LEVELS: LevelDef[] = [
  { id: 1, date: '2014.02', name: 'MT.GOX', loss: t('85 万 BTC', '850,000 BTC'), art: 'vault', color: '#9aa3c7', pool: ERA1, duration: 120, floor: F1,
    boss: t('漏币金库', 'The Leaking Vault'), tag: t('漏财', 'LEAK'),
    flavor: t('世界第一大交易所的金库在漏币！85 万枚 BTC 正一枚枚溜走——别让你的血条也跟着漏光。', "The world's biggest exchange has a hole in its vault. 850,000 BTC are slipping away — don't let your HP follow."),
    hint: t('Boss 战中你会持续掉血，冲过去捡它喷出的 BTC 回血。', 'Your HP drains during the fight. Grab the BTC it sprays to heal.'),
    goal: t('击败漏币金库', 'Destroy the Leaking Vault') },
  { id: 2, date: '2016.06', name: 'THE DAO', loss: t('360 万 ETH', '3.6M ETH'), art: 'slime', color: '#627eea', pool: ERA1, duration: 120, floor: F1,
    boss: t('重入史莱姆', 'Reentrancy Slime'), tag: t('重入分裂', 'REENTRANCY'),
    flavor: t('一个函数，被调用了一遍又一遍……360 万 ETH 被吸干，整条链都裂成了两半！', 'One function, called again... and again... 3.6M ETH drained so hard the chain split in two.'),
    hint: t('史莱姆每次被击败都会分裂成两只小的，最多分裂两次。', 'Each slime splits in two when killed, up to two times.'),
    goal: t('消灭所有史莱姆', 'Wipe out every slime') },
  { id: 3, date: '2016.08', name: 'BITFINEX', loss: t('119,756 BTC', '119,756 BTC'), art: 'duo', color: '#2fbf71', pool: ERA1, duration: 120, floor: F1,
    boss: t('雌雄大盗', 'The Heist Duo'), tag: t('双人大盗', 'DOUBLE TROUBLE'),
    flavor: t('12 万 BTC 一夜蒸发！幕后黑手是一对搭档——一个负责洗钱，一个负责说唱。', '120K BTC vanish overnight! Behind it: a duo — one launders, one raps.'),
    hint: t('两个 Boss 同时出现。先打倒一个，另一个会狂暴加速。', 'Two bosses at once. Drop one and the other goes berserk.'),
    goal: t('击败两名大盗', 'Take down both thieves') },
  { id: 4, date: '2017.11', name: 'PARITY', loss: t('51 万 ETH 冻结', '513K ETH frozen'), art: 'bomb', color: '#ff4545', pool: ERA1, duration: 120, floor: F1,
    boss: t('自毁合约', 'Self-Destruct Contract'), tag: t('自毁', 'SELF-DESTRUCT'),
    flavor: t('"我好像不小心把它删了？"一行 kill()，51 万 ETH 被永久冻结！', '"Oops, I think I deleted it?" One kill() call and 513K ETH froze forever.'),
    hint: t('Boss 被打倒时会自爆。逃出红圈，否则一件武器会被冻结。', 'It explodes when defeated. Escape the red circle or a weapon gets frozen.'),
    goal: t('击败自毁合约并躲开爆炸', 'Defeat it, then dodge the blast') },
  { id: 5, date: '2018.01', name: 'COINCHECK', loss: t('5.3 亿美元 NEM', '$530M NEM'), art: 'vault', color: '#ff7a3d', pool: ERA2, duration: 120, floor: F2,
    boss: t('烈焰热钱包', 'Blazing Hot Wallet'), tag: t('热钱包着火', 'HOT WALLET'),
    flavor: t('5 亿美元全放在联网的热钱包里？黑客：谢谢款待！整个场地都烧起来了！', '$530M sitting in an online hot wallet? Hackers: thanks for the meal! The floor is on fire!'),
    hint: t('地面不断燃起火圈，Boss 走过的地方也会着火。', 'Fire zones keep spawning, and the boss leaves a burning trail.'),
    goal: t('击败烈焰热钱包', 'Put out the Blazing Hot Wallet') },
  { id: 6, date: '2019.05', name: 'BINANCE 2019', loss: t('7,000 BTC', '7,000 BTC'), art: 'tower', color: '#f3ba2f', pool: ERA2, duration: 120, floor: F2,
    boss: t('钓鱼塔', 'The Phishing Tower'), tag: t('钓鱼', 'PHISHING'),
    flavor: t('钓鱼网站铺天盖地，7000 BTC 被一网打尽！别慌——Funds are SAFU。', 'Phishing sites everywhere — 7,000 BTC hooked in one go! Relax. Funds are SAFU.'),
    hint: t('红色宝石是钓鱼陷阱，碰到会受伤。击败 Boss 后生命回满。', 'Red gems are phishing bait — they hurt. Win and SAFU restores your HP.'),
    goal: t('击败钓鱼塔', 'Topple the Phishing Tower') },
  { id: 7, date: '2020.09', name: 'KUCOIN', loss: t('2.81 亿美元', '$281M'), art: 'hood', color: '#24ae8f', pool: ERA2, duration: 120, floor: F2,
    boss: t('Lazarus 影武者', 'Lazarus Shadow'), tag: t('Lazarus 登场', 'LAZARUS'),
    flavor: t('传说中的 Lazarus 第一次现身！2.81 亿美元，在你眼皮底下消失。', 'The infamous Lazarus Group makes its debut. $281M vanish right under your nose.'),
    hint: t('Boss 会瞬移到你身边，并不断召唤忍者。', 'It teleports next to you and keeps summoning ninjas.'),
    goal: t('击败 Lazarus 影武者', 'Defeat the Lazarus Shadow') },
  { id: 8, date: '2021.08', name: 'POLY NETWORK', loss: t('6.11 亿美元', '$611M'), art: 'portal', color: '#f4f4f8', pool: ERA2, duration: 120, floor: F2,
    boss: t('白帽先生', 'Mr. White Hat'), tag: t('白帽保管', 'WHITE HAT'),
    flavor: t('6.11 亿美元被盗！……等等，黑客说他只是在"帮忙保管"？', '$611M stolen! ...wait, the hacker says he\'s just "keeping it safe"?'),
    hint: t('Boss 会偷走你的经验值。击败它后，经验连本带息归还。', 'It steals your XP. Beat it and you get it all back — with a bounty.'),
    goal: t('击败白帽先生，拿回经验', 'Beat Mr. White Hat to get your XP back') },
  { id: 9, date: '2022.02', name: 'WORMHOLE', loss: t('12 万 ETH', '120,000 ETH'), art: 'portal', color: '#b07cff', pool: ERA3, duration: 120, floor: F3,
    boss: t('伪签虫洞', 'The Forged Wormhole'), tag: t('伪造签名', 'FORGED SIG'),
    flavor: t('签名验证被绕过！12 万 ETH 凭空出现——假签名、假身份，到处都是分身。', 'Signature check bypassed! 120K ETH minted from nothing — fake signatures, fake copies everywhere.'),
    hint: t('四个虫洞里只有一个是真身（头顶闪光）。子弹会穿过假身。', 'Only one of the four wormholes is real (it sparkles). Shots pass through fakes.'),
    goal: t('找出并击败真身', 'Find and destroy the real one') },
  { id: 10, date: '2022.03', name: 'RONIN BRIDGE', loss: t('6.25 亿美元', '$625M'), art: 'hood', color: '#1273ea', pool: ERA3, duration: 120, floor: F3,
    boss: t('九钥守卫', 'Keeper of Nine Keys'), tag: t('5/9 多签', '5-OF-9'),
    flavor: t('一份"高薪 offer"里藏着木马……9 把钥匙丢了 5 把，桥塌了！', "A 'dream job offer' hid a trojan... 5 of 9 keys stolen, and the bridge falls!"),
    hint: t('Boss 有 9 把钥匙护体。钥匙不少于 5 把时它无敌。', '9 keys shield the boss. While 5 or more remain, it is immune.'),
    goal: t('打碎 5 把钥匙，再击败 Boss', 'Break 5 keys, then defeat the boss') },
  { id: 11, date: '2022.04', name: 'BEANSTALK', loss: t('1.82 亿美元', '$182M'), art: 'oracle', color: '#3fc35f', pool: ERA3, duration: 120, floor: F3,
    boss: t('闪电贷魔豆', 'Flash Loan Beanstalk'), tag: t('闪电贷', 'FLASH LOAN'),
    flavor: t('借 10 亿、投一票、卷走 1.82 亿、再还钱——全在一笔交易里完成！', 'Borrow $1B, cast a vote, steal $182M, repay — all in one transaction!'),
    hint: t('Boss 会周期性借贷变成金色无敌，还款时虚弱，伤害翻倍。', 'It turns gold and immune while borrowing; when repaying it takes double damage.'),
    goal: t('趁还款时击败魔豆', 'Strike during repayment and take it down') },
  { id: 12, date: '2022.08', name: 'NOMAD', loss: t('1.9 亿美元', '$190M'), art: 'portal', color: '#ff9f1c', pool: ERA3, duration: 120, floor: F3,
    boss: t('复制粘贴之门', 'The Copy-Paste Gate'), tag: t('复制粘贴', 'COPY-PASTE'),
    flavor: t('漏洞简单到复制粘贴就能抢！几百人蜂拥而上，一场全民大劫案！', 'An exploit so easy you just copy-paste it! Hundreds join in — a crowd-sourced heist!'),
    hint: t('场上的小怪会不断复制自己，越拖越多。', 'Minions keep cloning themselves. The longer you wait, the worse it gets.'),
    goal: t('趁小怪泛滥前击败复制粘贴之门', 'Destroy the gate before the clones swarm') },
  { id: 13, date: '2022.10', name: 'BNB BRIDGE', loss: t('凭空增发 200 万 BNB', '2M BNB minted'), art: 'portal', color: '#f3ba2f', pool: ERA3, duration: 120, floor: F3,
    boss: t('铸币巨兽', 'The Mint Beast'), tag: t('链停摆', 'CHAIN HALT'),
    flavor: t('200 万 BNB 凭空印了出来！全链紧急暂停——你也被冻住了！', '2 million BNB printed out of thin air! The whole chain halts — and so do you!'),
    hint: t('警告出现后你会被冻结 1 秒，Boss 趁机冲撞，提前走位。', 'After the warning you freeze for a second while it charges — reposition early.'),
    goal: t('击败铸币巨兽', 'Defeat the Mint Beast') },
  { id: 14, date: '2022.10', name: 'MANGO', loss: t('1.14 亿美元', '$114M'), art: 'oracle', color: '#ffb000', pool: ERA3, duration: 120, floor: F3,
    boss: t('预言机操纵者', 'The Oracle Manipulator'), tag: t('操纵预言机', 'ORACLE PUMP'),
    flavor: t('把价格拉上天，借空整个金库——"这只是一个高盈利交易策略"。', "Pump the price, borrow the vault dry — 'just a highly profitable trading strategy.'"),
    hint: t('价格越涨敌人越强。打碎黄色预言机，价格归零重来。', 'The higher the price, the stronger enemies get. Smash the yellow oracle to reset it.'),
    goal: t('击败预言机操纵者', 'Defeat the Oracle Manipulator') },
  { id: 15, date: '2022.11', name: 'FTX', loss: t('4.77 亿美元', '$477M'), art: 'tower', color: '#5fcade', pool: ERA3, duration: 120, floor: F3,
    boss: t('破产之塔', 'The Bankrupt Tower'), tag: t('暂停提现', 'WITHDRAWALS OFF'),
    flavor: t('交易所破产当晚，4.77 亿美元不翼而飞。提现？已暂停。', 'The night it went bankrupt, $477M disappeared. Withdrawals? Paused.'),
    hint: t('Boss 存活期间经验宝石被冻结，无法拾取。挤兑人潮会包围你。', 'XP gems are frozen while it lives. Bank-run mobs will surround you.'),
    goal: t('击败破产之塔，解冻提现', 'Defeat it to unfreeze withdrawals') },
  { id: 16, date: '2023.03', name: 'EULER', loss: t('1.97 亿美元', '$197M'), art: 'slime', color: '#e05bd9', pool: ERA3, duration: 120, floor: F3,
    boss: t('坏账史莱姆', 'Bad Debt Slime'), tag: t('坏账', 'BAD DEBT'),
    flavor: t('"捐赠"按钮其实是个漏洞！1.97 亿美元被借走，变成了一地坏账。', "The 'donate' button was a bug! $197M borrowed and turned into bad debt."),
    hint: t('Boss 周围会生出紫色坏账区，站在里面攻击会给它回血。', 'Purple bad-debt pools form around it. Attacking from inside heals it.'),
    goal: t('站在坏账区外击败史莱姆', 'Stay out of the debt and defeat it') },
  { id: 17, date: '2023.07', name: 'CURVE', loss: t('约 7000 万美元', '~$70M'), art: 'slime', color: '#ff4f6d', pool: ERA3, duration: 120, floor: F3,
    boss: t('断锁史莱姆', 'Broken Lock Slime'), tag: t('锁失效', 'LOCK FAILURE'),
    flavor: t('编译器说"已上锁"，可那把锁从来就没起过作用！', "The compiler said 'locked'. The lock never worked."),
    hint: t('冷钱包护盾会周期性失灵，Boss 的子弹会分裂。', 'Your Cold Wallet Shield fails periodically. Its bullets split.'),
    goal: t('击败断锁史莱姆', 'Defeat the Broken Lock Slime') },
  { id: 18, date: '2023.07', name: 'MULTICHAIN', loss: t('1.26 亿美元', '$126M'), art: 'portal', color: '#5f6bff', pool: ERA3, duration: 120, floor: F3,
    boss: t('失联 CEO', 'The Vanished CEO'), tag: t('CEO 失联', 'CEO MIA'),
    flavor: t('CEO 失联了，全部私钥都在他一个人手里……桥正在一点点坍塌。', 'The CEO went dark — and he held every key. The bridge is collapsing.'),
    hint: t('Boss 会隐身消失。红圈安全区不断缩小，出圈会掉血。', 'It vanishes from sight. The safe zone keeps shrinking — leaving it hurts.'),
    goal: t('在安全区内击败失联 CEO', 'Defeat the CEO inside the safe zone') },
  { id: 19, date: '2024.05', name: 'DMM BITCOIN', loss: t('4,502 BTC', '4,502 BTC'), art: 'hood', color: '#c0c0d0', pool: ERA4, duration: 120, floor: F4,
    boss: t('疾影忍者', 'Shadow Ninja'), tag: t('疾影突袭', 'SHADOW DASH'),
    flavor: t('Lazarus 精英出手，4502 BTC 瞬间消失，一家交易所就此关门。', 'A Lazarus elite strikes: 4,502 BTC gone in a flash, and an exchange shuts its doors.'),
    hint: t('Boss 闪烁后会高速突进，看到闪烁立刻横向闪避。', 'When it flashes, it dashes — sidestep immediately.'),
    goal: t('击败疾影忍者', 'Defeat the Shadow Ninja') },
  { id: 20, date: '2024.07', name: 'WAZIRX', loss: t('2.35 亿美元', '$235M'), art: 'hood', color: '#3067f0', pool: ERA4, duration: 120, floor: F4,
    boss: t('篡改者', 'The Tamperer'), tag: t('界面篡改', 'UI TAMPERED'),
    flavor: t('屏幕上显示的，和你实际签下的，根本不是一回事！', 'What the screen shows and what you actually sign are not the same thing!'),
    hint: t('警告后方向会反转 4 秒：左就是右，上就是下。', 'After the warning, controls invert for 4 seconds. Left is right.'),
    goal: t('击败篡改者', 'Defeat the Tamperer') },
  { id: 21, date: '2025.02', name: 'BYBIT', loss: t('14.6 亿美元', '$1.46B'), art: 'hood', color: '#f7a600', pool: ERA4, duration: 120, floor: F4,
    boss: t('盲签幽灵', 'The Blind-Sign Phantom'), tag: t('盲签', 'BLIND SIGNING'),
    flavor: t('钱包前端被动了手脚，签名人一路点"确认"——14.6 亿美元，史上最大一笔！', "The wallet UI was rigged and signers kept clicking 'confirm' — $1.46B, a record heist!"),
    hint: t('本关升级卡里混有伪造卡（名字会闪出乱码），选错会受罚。', 'Some upgrade cards this level are fakes (their names glitch). Pick wrong and pay.'),
    goal: t('识破伪造卡，击败盲签幽灵', 'Spot the fakes and defeat the Phantom') },
  { id: 22, date: '2025.05', name: 'CETUS', loss: t('2.23 亿美元', '$223M'), art: 'oracle', color: '#2ad4c9', pool: ERA4, duration: 120, floor: F4,
    boss: t('溢出之眼', 'The Overflow Eye'), tag: t('整数溢出', 'OVERFLOW'),
    flavor: t('溢出检查写错了一位，2.23 亿美元就从数字缝隙里漏了出去。', 'One wrong bit in an overflow check, and $223M slipped through the cracks.'),
    hint: t('Boss 周身发红（u64 MAX）时别打它，伤害会变成回血。', 'When it glows red (u64 MAX), stop hitting it — damage turns into healing.'),
    goal: t('避开溢出窗口，击败溢出之眼', 'Avoid the overflow window and defeat it') },
  { id: 23, date: '2025.11', name: 'BALANCER', loss: t('1.28 亿美元', '$128M'), art: 'oracle', color: '#e0e0e0', pool: ERA4, duration: 120, floor: F4,
    boss: t('舍入幽灵', 'The Rounding Ghost'), tag: t('舍入误差', 'ROUNDING'),
    flavor: t('每次只偷一点点舍入误差……重复一万次，就是 1.28 亿美元。', "Steal a tiny rounding error... repeat ten thousand times, and it's $128M."),
    hint: t('无论伤害多高，每次命中都只造成 1 点。攻速越快越好。', 'Every hit deals exactly 1 damage, no matter what. Attack speed is king.'),
    goal: t('用海量命中击败舍入幽灵', 'Overwhelm it with sheer number of hits') },
  { id: 24, date: '2026.04', name: 'DRIFT', loss: t('2.85 亿美元', '$285M'), art: 'oracle', color: '#9b6bff', pool: ERA4, duration: 120, floor: F4,
    boss: t('闪击之眼', 'The Blitz Eye'), tag: t('限时 60 秒', '60 SECONDS'),
    flavor: t('12 分钟，2.85 亿美元，一场闪电战！', '12 minutes. $285M. A lightning raid.'),
    hint: t('你只有 60 秒，超时资产会被一口气掏空。', "You have 60 seconds. Run out of time and you're drained."),
    goal: t('60 秒内击败闪击之眼', 'Defeat it within 60 seconds') },
  { id: 25, date: '2026.04', name: 'KELPDAO', loss: t('116,500 rsETH', '116,500 rsETH'), art: 'portal', color: '#14b8a6', pool: ERA4, duration: 120, floor: F4,
    boss: t('跨链穿梭者', 'The Bridge Jumper'), tag: t('传送门', 'PORTALS'),
    flavor: t('跨链桥被攻破，11.65 万 rsETH 在传送门之间来回穿梭！', 'The bridge is breached — 116,500 rsETH zipping between portals!'),
    hint: t('Boss 在三座传送门间穿梭，传送门还在时它无敌。', 'It hops between three portals and stays immune while any portal stands.'),
    goal: t('拆掉 3 座传送门，再击败 Boss', 'Destroy all 3 portals, then the boss') },
  { id: 26, date: '2026.09', name: 'LIQUID', loss: t('3.19 亿美元 BTC', '$319M BTC'), art: 'vault', color: '#f7931a', pool: ERA4, duration: 120, floor: F4,
    boss: t('侧链金库', 'The Sidechain Vault'), tag: t('锚定区', 'PEG ZONE'),
    flavor: t('比特币侧链被掏走 3.19 亿美元……然后黑客又退回了 85%？', '$319M drained from a Bitcoin sidechain... then the hacker sent back 85%?'),
    hint: t('站在绿色锚定圈（PEG）里 Boss 才会受伤。敌人进不了圈，子弹能。', 'It only takes damage while you stand in the green PEG. Enemies can\'t enter; bullets can.'),
    goal: t('站进锚定圈，击败侧链金库', 'Hold the PEG zone and defeat it') },
  { id: 27, date: '2026.09', name: 'BITGET', loss: t('3.88 亿美元', '$388M'), art: 'hood', color: '#00c4c4', pool: ERA4, duration: 120, floor: F4,
    boss: t('TraderTraitor 先锋', 'TraderTraitor Vanguard'), tag: t('螺旋弹幕', 'BULLET HELL'),
    flavor: t('3.88 亿美元只是开胃菜。真正的风暴，就在一个月后……', '$388M was just the appetizer. The real storm hits next month...'),
    hint: t('Boss 释放螺旋弹幕，找到弹幕缝隙穿过去。', 'Spiral bullet hell. Find the gaps and slip through.'),
    goal: t('穿越弹幕，击败先锋', 'Weave through the bullets and defeat it') },
  { id: 28, date: '2026.10', name: 'BINANCE 2026', loss: t('63 亿美元', '$6.3B'), art: 'final', color: '#f3ba2f', pool: ERA4, duration: 180, floor: ['#100a00', '#2a1d05', '#f3ba2f'],
    boss: t('TraderTraitor', 'TraderTraitor'), tag: t('终局之战', 'ENDGAME'),
    flavor: t('20 分钟，10 条链，63 亿美元。史上最大的加密货币盗窃案，正在发生。', '20 minutes. 10 chains. $6.3 billion. The biggest crypto heist in history is happening now.'),
    hint: t('先切断 10 条链上的攻击节点，Boss 随后会轮番使出历代黑客手法。', 'First cut the attack nodes on all 10 chains, then face every hacker trick in history.'),
    goal: t('在 $6.3B 被转走前击败 TraderTraitor', 'Defeat it before $6.3B is gone') },
];
