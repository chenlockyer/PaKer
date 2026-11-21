# 纸牌宫殿 · 存档

![宫殿在客户端里](screenshots/palace-in-app.png)

一座 **222 张牌**的纸牌宫殿，已经写进本机客户端的存档库，名字叫 **纸牌宫殿**：

> 主菜单 → 自由搭建 → 读档 → 纸牌宫殿 → 读取

（桌面客户端的存档在 `%APPDATA%\Electron` 下；浏览器版是另一个 profile，两边不互通。）

## 一、用的是哪两种「格」

你蓝图库里保存的三种模块，直接从 `hoc_blueprints_v1` 导出成 `scripts/palace/modules.json`，
宫殿就是拿它们拼的（不是照着重画）：

| 模块 | 张数 | 尺寸 | 在宫殿里做什么 |
|---|---|---|---|
| **田字格**（低格） | 11 | 5.62 × 5.81 × 1.85 | 台基与月台：3 × 3 + 1 块拼成 17.9 × 18.4 的格状高台 |
| **顺高格**（高格） | 4 | 2.06 × 2.10 × 2.79 | 塔身：中塔 4 层、四角塔各 2 层 |
| **逆格** | 4 | 4.22 × 4.25 × 1.78 | 门前两座亭子（原本想当连廊，见下文） |

合起来：台基 9 × 11 + 月台 11 + 中塔 4×（4+4）+ 角塔 4×2×（4+4）+ 宫门 8 + 亭 2×4 = **222 张**，
占地 **19.42 × 28.73 m**，最高 **13.19 m**。

## 二、原创的部分

模块本身是你的，宫殿的「新结构」全在 `scripts/palace/palace-parts.mjs` 里，一共四件：

1. **月台**：台基正前方再压一块田字格，形成「凸」形台面 —— 有台阶的仪式感，但不用做斜面。
2. **层间四板**：顺高格叠层时，每层顶铺 2 + 2 张平板（下层沿 x、上层沿 z，错开 0.91 m）。
   这是把「中空方柱」变成「塔」的关键——四种叠法只有它站得住（见第三节）。
3. **宫门**：两根高格门柱 + 一块 2.8 长门楣 + 两层向外的檐板 + 脊板，一个能看穿的门楼。
4. **四角塔 / 中塔**：同一模块的不同叠法，中塔 4 层、角塔 2 层，靠高度差造出主次。

## 三、为什么这么叠（都是实测出来的）

这些不是猜的：`scripts/palace/physics-check.mjs` 用**同一套物理参数**（0.1 kg、摩擦 1、
地面 1.1、阻尼 0.5、60 Hz、−9.81）在 Node 里裸跑 Rapier，不用开浏览器，一次 0.5 秒：

```bash
node scripts/palace/physics-check.mjs      # 全塔 8 秒模拟，输出最差倾角/下沉
PALACE_STAGE=3 node scripts/palace/physics-check.mjs   # 只建到台基+角塔，用来二分定位
```

踩到并修掉的坑，按发现顺序：

| 试法 | 结果 | 结论 |
|---|---|---|
| 顺高格直接叠顺高格 | 倾角 95°、掉 4.2 m | 四张牌的顶是四条棱，上层落脚找不到面，必须加层板 |
| 单张平板当层板 | 倾角 17°、掉 2.8 m | 一张板只压住两条棱，上层悬在板边 |
| 两张**同高**十字板 | 板与板互相穿模 0.02 | 十字要上下错开叠，不能共面 |
| 两张十字板上下错开 | 倾角 0.1°，但每层下沉 5 cm | 板的四角仍压在棱外，还是悬 |
| **四张板（2+2 错层）** | 倾角 0.4°，2 层下沉 3.6 cm | ✅ 采用：整面盖住 2.8 × 2.8 的柱顶 |
| 逆格架在台基上当连廊 | 倾角 166°，整层塌 | 逆格 4.2 m 跨，台基顶面只有中间 2.4 × 2.8 有板 → 改放地面当门前亭 |
| 倾斜平板当台阶 | 倾角 41°，滑下来 | 2.8 长的板爬 1.85 高是 41°，边缘线接触撑不住 → 改成月台 |
| 叠涩门洞（三层内收板） | 0.02 穿模 | 2.4 m 洞口的门楣比一张牌还长，牌只有 2.8 → 门洞收窄成 2.5 m 的单板门楣 |

最终 222 张全塔 8 秒模拟：**倾角 ≤ 0.82°、下沉 ≤ 11 cm**（下沉是层板之间的缝在压合，
塔整体均匀下沉，不是局部塌），没有任何牌倒下。

## 四、验证链

```bash
npm run palace:build     # 生成 saves/paper-palace.paker-save.json（过 validateGameSave）
npm run palace:check     # Node 里裸跑 Rapier 8 秒（无浏览器，0.5 秒出结果）
npm run palace:verify    # 无头浏览器：走真实读档 UI → 物理跑 7 秒 → 逐张比对
npm run palace:seed      # 启动真实 Electron 客户端，写进真实存档库并读档截图
```

`palace:verify` 会把「存档里的位姿」和「7 秒后的实时位姿」逐张对比：倾角 < 8°、下沉 < 15 cm、
位移 < 16 cm。最近一次（`saves/paper-palace.verification.json`）：`PASS`。

`palace:seed` 用 Playwright 启动 `electron electron/main.cjs`（和 `npm run dev` 同一入口，
因此落在同一个 `%APPDATA%\Electron` profile），把存档合并进 `paker_build_save_library_v2`，
旧存档原样保留、旧库先备份，然后重新加载页面、点开读档、读取宫殿、截图、核对牌数。

## 五、代码

```text
scripts/palace/
  dump-blueprints.mjs    从客户端蓝图库导出（只读），生成 blueprints.dump.json
  extract-modules.mjs    从 dump 里挑出 田字格 / 顺高格 / 逆格 → modules.json
  modules.json           三个模块的卡片数据（用户自定义结构）
  palace-modules.mjs     模块实例化（yaw + 平移，卡牌尺寸补齐）
  palace-parts.mjs       原创构件：vPair / plank / terrace / wallRing / gateTower
  palace-structure.mjs   宫殿总装（stage 1..5 可分层构建）
  physics-check.mjs      Node + Rapier 物理自检（0.5 秒）
  build-save.mjs         几何 → 存档 JSON（validateGameSave 校验）
  verify-palace.mjs      无头浏览器物理验证 + 截图
  seed-save.mjs          写进真实客户端并读档验证
saves/
  paper-palace.paker-save.json       存档本体（可直接拷给别人）
  paper-palace.verification.json     最近一次验证结果
```

> 注意：`npm run palace:seed` 需要 Playwright，且**必须清掉 `ELECTRON_RUN_AS_NODE`**
> —— DSH 自己是 Electron，会把这个变量导给子进程，不清掉的话 electron 会当纯 Node 跑，
> 直接报 `app.isPackaged` undefined。脚本里已经删掉了。

## 六、想改的话

```bash
node scripts/palace/dump-blueprints.mjs     # 蓝图库变了就重新导出
node scripts/palace/extract-modules.mjs     # 重新生成 modules.json
node scripts/palace/palace-structure.mjs    # 只看几何摘要：牌数 / 尺寸 / 间隙
npm run palace:build && npm run palace:check && npm run palace:seed
```

布局都在 `buildPalace()` 里：`stepX/stepZ`（台基网格间距）、`towerLevel(... levels)`（层数）、
`gateTower({ opening })`（门洞宽度）。间隙和物理都不用自己算，`palace:check` 会告诉你哪一层先塌。
