> Design spec for the Kids mode, chosen by a judged design panel. Mentions of "the scratchpad" refer to one-off helper scripts and prototype files that are not part of this repository; everything needed to build is written out below.

# Tempo Kids: "Pip's Chess Quest" (final build spec)

Status: FINAL. This is the single source of truth for the engineers building Kids mode.
Base: Proposal 1, "Pip's Chess Quest" (winner, 3 of 3 judge votes). It includes the grafts the judges recommended from "Pip's Quest" (P2) and "Pip's Chess Kingdom" (P3), and fixes every mustFix item (see section 18).

Repo: /home/user/chess-training (React 19, TypeScript 7, Vite 8, chess.js 1.4, vitest 5).
Everything new lives under `src/kids/` and `tests/kids*.test.ts`, except the small shared-file diffs listed in section 14.

Every FEN, par, solution count and puzzle-pool count in this document was re-checked with chess.js, a BFS/DFS solver, or a count over `src/data/puzzles.json` while this spec was written. Section 17 lists the corrections. None of those checks replace the tests: every level set must pass its activity's `validate()` in CI (section 15).

---

## 0. Contents

1. Product summary and principles
2. Age bands (exact tuning table)
3. Skill, placement and adaptivity
4. Curriculum: 8 worlds and every node
5. Progression rules: unlocking, bosses, stars, mastery, warm-ups
6. Rewards
7. Look and feel: tokens, type, shapes, motion, sound
8. Component-by-component treatments
9. Screens
10. Speech, accessibility, safety, privacy
11. Architecture: files, contracts, data model, routing
12. Shared libraries: miniRules, danger, bots, puzzles, engine use
13. Activities: exact rules, data, scoring, validation, level data
14. Shared-file edits outside `src/kids` (exact diffs)
15. Tests
16. Build plan: framework step, then packs A-E (file ownership)
17. Verified facts and corrections
18. MustFix resolution table and graft ledger

---

## 1. Product summary and principles

**Idea: the Pawn's Journey.** Each kid is a little Pawn Buddy (a pawn avatar they design). The course is an island shaped like a board. The pawn walks up it one rank at a time, and each of the 8 ranks is a world. At rank 8 the pawn PROMOTES: it gets a crown and becomes a Queen or King (the kid picks). That is graduation. The metaphor is true to chess: a pawn that keeps going becomes a queen.

**Guide: Pip**, a friendly knight-pony. His running joke is "I hop funny: two steps and a turn!" Pip demonstrates every new idea ("Watch me!"), cheers, thinks out loud, sometimes owns his own mistakes ("Oops, I left my pawn alone! You can take it!"), and never scolds.

**Principles** (these are hard requirements; reviewers reject work that breaks them):

1. **Touch the board within 2 seconds.** Say one sentence, then "Your turn!" The very first thing a new kid does is move a rook to a star (w1-hello). There are no quiz or board-vision screens before that first move.
2. **One new idea at a time.** The order is movement, then capturing, then danger (lava), then check and mate, then special rules, then whole games with training wheels, then tactics.
3. **Concrete before abstract.** A star (a goal) comes before lava (attacked squares), and lava comes before check (the king standing in lava).
4. **Play from day one.** Goal-based mini-games (stars, Gobble, Pawn Wars, Capture the Crown) come long before full chess.
5. **Real mastery checks, but no dead ends.** Bosses gate the next world. Every age band has a guaranteed path through, using ease ladders, "Skip for now" and a grown-up unlock (section 5.3).
6. **Errorless for the young, productive struggle for the older.** The hint ladder always ends with "Watch Pip", so every item can be finished. Finishing always earns at least 1 star.
7. **Thinking habits are taught explicitly.** "Is my piece safe?" becomes the Danger Alarm. "What does my opponent want?" becomes Threat Spotting. Champions also learn "Checks, captures, threats".
8. **Real pieces, real board.** Kids use the real Board component and real piece art (3D Staunton by default), so the skills carry over to a real set. Pieces never get faces. The personality comes from Pip and the buddies.
9. **No manipulation.** No currency, shop, ads, loot boxes, random rewards, lost streaks, notifications, leaderboards or sibling comparisons. There are no timers except the opt-in Champion Dash modes.
10. **Private by default.** Data is local only. Kids data is never included in cloud sync. Every exit is behind the parent gate.

Tone rules: praise effort and strategy, never talent ("You checked where the bishop could go first. Smart thinking!"). Mistakes are discoveries ("Hmm, the rook can't jump. Let's find another road!"). Nothing depends on the words "left" and "right". The grown-up report says "needed help with", never "failed" or "errors".

---

## 2. Age bands

A grown-up picks the kid's age on number buttons 4 to 12. Each number is spoken when tapped (P3 graft). The age is mapped to a band and only the band is stored: 4-6 is `sprout`, 7-9 is `explorer`, 10-12 is `champion`. A grown-up can change the band later.

Bands change presentation, pace and help, never the rules of chess. **Band and skill are independent axes.** A 5-year-old club player can start high up and still keep Sprout presentation.

`src/kids/curriculum/tuning.ts` exports `BAND_TUNING: Record<AgeBand, BandTuning>` with exactly these values:

| field | sprout (4-6) | explorer (7-9) | champion (10-12) |
|---|---|---|---|
| `bodyPx` (body text) | 22 | 19 | 17 |
| `bubblePx` (Pip's bubble) | 24 | 20 | 18 |
| `titlePx` | 36 | 32 | 28 |
| `buttonPx` (min button height) | 72 | 56 | 48 |
| `buttonLabelPx` | 26 | 22 | 19 |
| `gapPx` (min gap between targets) | 12 | 12 | 8 |
| `captionMaxWords` | 6 | 10 | 16 |
| `voice` default | `'auto'` (every line spoken) | `'first'` (a new idea's first line spoken, others on the speaker button) | `'off'` (speaker button only) |
| `speechRate` / `pitch` | 0.9 / 1.1 | 0.95 / 1.05 | 1.0 / 1.0 |
| `itemsPerRun` | 3 | 5 | 6 |
| `startTier` | 1 | 1 (2 after placement) | 2 |
| `hintAfterWrong` | 1 | 2 | 2 (auto-offer only after 3; bulb always available) |
| `hintAfterIdleSec` | 10 | 25 | never (bulb pulses at 40 s) |
| `showDests` | `'always'` (kids-size dots) | `'until-mastered'` (dots until the piece's world boss is 3-starred, then on long-press or after a mistake) | `'on-mistake'` |
| `autoSelectLone` | true | true | false |
| `coordinates` | false (never) | false (kid setting; w2-treasure-map turns on the edge labels during its items) | true |
| `notation` | never shown or spoken | spoken as "e four"; SAN hidden | SAN move list shown in games |
| `lavaVisible` | `'always'` | `'after-mistake'` | `'after-mistake'` |
| `parSlack` (star scoring) | 1 | 0 | 0 |
| `takebacks` (games) | `'always'` | `'three'` (3 per game) | `'one'` |
| `dangerAlarm` default | on (kid cannot turn off) | on (grown-up can turn off) | on (the kid can switch it off: "I'm ready!") |
| `threatLights` default | on | off | off |
| `oopsShield` (engine alarm) | n/a | n/a | optional, off |
| `promotion` in chess.js activities | `'auto'` (auto-queen) | `'picker'` from w5-promo on | `'picker'` |
| `bossPass` (stars needed on non-game bosses) | 1 | 2 | 2 |
| `warmupItems` | 1 | 2 | 3 |
| `sessionMinDefault` | 10 | 20 | 30 |
| `placementCap` (highest checkpoint) | w5 | w8 | w8 |
| `timers` | none | none | opt-in Dash modes only |
| `pipChatter` | full | short | coach mode (calmer, fewer "!") |

Sprouts (4-6) are pre-readers or emerging readers. Everything they need is spoken and shown as icon + 6 words or fewer, and every answer is a picture. Early piece items use **cloud areas** (a 4x4 or 5x5 play area; see KidsBoard `area`) so the board feels small and safe. Numbers are shown as dots as well as digits. There are no square names. Their curriculum is trimmed with per-node `bands` (section 4).

Explorers (7-9) read short sentences. They learn square names in a friendly "treasure map" framing and play the full curriculum except the Champion-only nodes.

Champions (10-12) want to feel "real": text first, coordinates on, SAN in games, calmer "Coach Pip", opt-in Dash modes, puzzles from the database, and optional Stockfish buddies.

---

## 3. Skill, placement and adaptivity

### 3.1 Entry points
Step (c) of New Player shows three picture cards:
1. "Brand new!" (a seedling): starts at w1-hello. No placement.
2. "I know how the pieces move" (a knight with arrows): runs placement from the **w1** checkpoint.
3. "I play real games" (two kings): runs placement from the **w3** checkpoint. Passing w3 also marks w1-w2 as tested out. Failing w3 restarts placement at w1.

A grown-up can skip placement ("Start at the beginning") or later set the starting world (or "Unlock all") in Grown-ups.

### 3.2 Placement ("Show Pip what you know!", `kids/placement`)
It is never called a test.
- Each world has a **framework-owned checkpoint** of 3 items: `cp1`...`cp8` in `src/kids/content/checkpoints.ts`, using only the framework activities `stars` and `find-move`. Placement therefore works with no packs installed. Exact data is in section 13.1 and 13.2.
- Pip walks up from the entry world. For each world:
  - If the kid passes 2 of the 3 items (an item passes at score 2 or more, with at most hint level 1), the world is marked **tested out**: every visible node gets `stars: 1, tested: true`. The boss counts as passed. No stickers are granted, so they can still be earned.
  - If the kid misses 2 of the 3, placement stops. The kid starts at that world's first node.
- Placement stops at the band's `placementCap` (Sprouts: w5 is the last checkpoint, so they start at most at w6 and keep the Sprout scaffolding).
- Placement sets the puzzle rating: 600 + 40 per world tested out, capped at 850.
- UI: a 3-dot path per world, no score display. It ends on "You start at Rank 5: Pawn Parade!", and the pawn hops up the map.
- Tested-out nodes show a small paper-plane badge on the map. They can be played normally, and a real completion replaces `tested` and grants the sticker.

### 3.3 Adaptivity during play (the ActivityPlayer does all of this)
1. **Hint ladder** per item, shown after `hintAfterWrong` mistakes or `hintAfterIdleSec` idle, or when the kid taps the bulb:
   - Level 1: Pip restates the rule ("Rooks go in straight lines").
   - Level 2: highlight the piece to move (tone `hint`, a pulsing berry ring).
   - Level 3: arrow to the target.
   - Level 4: "Watch Pip": Pip plays it (the move animates), the board resets, and the kid repeats it.
   Activities supply the steps with `player.setHints()`. The player has generic fallbacks (level 1 is the activity's `rule` line, and level 4 plays `item`'s known solution).
2. **Item score** (all activities unless stated): 3 means 0 mistakes and hint level 1 or less. 2 means 2 or fewer mistakes, or hint level 2. 1 means completed with more help. Nobody fails an item.
3. **Tiers.** Items carry `tier: 1|2|3` (default 1). A run picks `itemsPerRun` items from the set, starting at `startTier`. It drops a tier after an item scores 1 and rises a tier after two 3-star items in a row.
4. **"Easier one?"** (P2 graft). After 3 mistakes on one item, Pip offers three big buttons:
   - "Easier one" swaps in an item one tier lower, or the item's lower-band `tune` if there is none.
   - "Keep trying".
   - "Skip this one": the item counts as score 1.
5. **"Super Star?"** (P2 graft). After 3 perfect items in a row, Pip offers the item's `superTune` (or a tier-3 item) for a **golden star**. The golden star is cosmetic, shown as a gold sparkle on the node.
6. **Fast track.** If the kid 3-stars the first two non-bonus nodes of a world with 0 mistakes, Pip offers "Want to try the boss now?". Passing the boss marks the skipped nodes `tested`.
7. **World skip.** Any locked world shows "Challenge to skip ahead", which runs that world's checkpoint (section 3.2 rules, for one world).
8. **Games.** Ease ladder and "Skip for now" (section 5.3). After 3 wins in a row against a buddy, Pip suggests the next one.
9. **Puzzle rating.** Elo with K=40 for the first 20 attempts, then K=24. The floor is 500. It is used only by Pack E.

---

## 4. Curriculum: 8 worlds and every node

The framework declares **every** world and node in `src/kids/curriculum/worlds.ts`, including nodes whose level sets come from packs. Packs never edit the curriculum.

Conventions:
- Node id equals level-set id.
- `bands` defaults to all three: S = sprout, E = explorer, C = champion.
- `bonus` nodes are optional flower stones: they never block unlocking and are not needed for crowns.
- Owner: F = framework, A-E = packs (section 16).
- A node whose activity or level set is not registered renders as a "Coming soon" cloud and is ignored by unlocking (section 5.2).

**Sprout-visible sequence** (checked by a test): every world must have at least 3 Sprout-visible non-bonus nodes including the boss.

### Rank 1: ROOK ROAD (bg `#dbeefe`, accent `#3f86c6`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w1-hello` | Hello, Rook! | stars | F | SEC | FIRST THING EVER PLAYED. Watch Pip intro, then rook to a star within 30 s. Sprouts get the area `a1:d4`. |
| 2 | `w1-rook-stars` | Rook Road | stars | F | SEC | |
| 3 | `w1-rook-paint` | Where can Rook go? | paint | A | SEC | |
| 4 | `w1-roads` | Light up the road | board-vision (tap-line: files and ranks) | A | SEC | A short interlude of 3 items. |
| 5 | `w1-rook-gobble` | Rook's Lunch | gobble | A | SEC | |
| 6 | `w1-colors` | Light and dark | board-vision (tap-color) | A | S E | bonus |
| B | `w1-boss` | Rook Maze | stars (rocks) | F | SEC | boss |

### Rank 2: BISHOP WOODS (bg `#dcefd0`, accent `#3f8f4f`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w2-bishop-stars` | Bishop Slide | stars | F | SEC | |
| 2 | `w2-bishop-paint` | Where can Bishop go? | paint | A | SEC | |
| 3 | `w2-bishop-color` | Bishop stays on her color | quiz (bishop-reach) | C | SEC | Sprouts answer with Sun/Moon pictures. |
| 4 | `w2-bishop-gobble` | Bishop's Lunch | gobble | A | SEC | |
| 5 | `w2-treasure-map` | Treasure map (square names) | board-vision (find-square) | A | E C | |
| B | `w2-boss` | Two Friends | stars (rook + bishop) | F | SEC | boss |

### Rank 3: ROYAL GARDEN, the Queen and the King (bg `#fbe0ef`, accent `#c2477f`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w3-queen-stars` | Queen Zoom | stars | F | SEC | |
| 2 | `w3-queen-paint` | Where can Queen go? | paint | A | E C | |
| 3 | `w3-queen-gobble` | Queen's Feast | gobble | A | SEC | |
| 4 | `w3-king-stars` | King's Tiny Steps | stars | F | SEC | |
| 5 | `w3-king-lava` | The Floor is Lava! | stars (statues) | F | SEC | "The king never steps where he can be taken." |
| B | `w3-boss` | Royal Garden | stars (rocks + lava) | F | SEC | boss |

### Rank 4: KNIGHT HILLS (bg `#efe3cc`, accent `#a86b2d`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w4-knight-hops` | Pip's Hops | stars | F | SEC | Pip is a knight: "Two steps and a turn!" |
| 2 | `w4-knight-paint` | Where can Knight go? | paint | A | SEC | |
| 3 | `w4-knight-count` | Count the hops | quiz (count) | C | E C | |
| 4 | `w4-knight-jump` | Jump the rocks | stars (rocks) | F | SEC | |
| 5 | `w4-knight-gobble` | Knight's Lunch | gobble | A | SEC | |
| B | `w4-boss` | Knight Trek | stars | F | SEC | boss; Champions a1 to h8 in 6 |

### Rank 5: PAWN PARADE (bg `#fff1c2`, accent `#c18a00`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w5-pawn-steps` | Pawn Steps | stars | F | SEC | includes the first-move double step |
| 2 | `w5-pawn-slant` | Straight to walk, slanty to eat | gobble (pawn) | A | SEC | Owned by Pack A (fixes the cross-pack dependency). |
| 3 | `w5-promo` | Pawn becomes a Queen! | stars (promotion) | F | SEC | |
| 4 | `w5-pawn-war-mini` | Little Pawn War | battle | B | SEC | 3 v 3 |
| 5 | `w5-army` | Meet the whole army | board-vision (name-piece) | A | SEC | |
| 6 | `w5-setup` | Set up the board | board-vision (setup) | A | SEC | Moved here from Rank 1: every piece is known by now. Sprouts do the back row with color hints. |
| B | `w5-boss` | Pawn War | battle | B | SEC | game boss; Sprouts play 3 v 3 in the area `a1:c8` at depth 1 |

### Rank 6: CAPTURE COVE (bg `#d4f1ef`, accent `#1f8a84`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w6-candy` | Candy values | quiz (value) | C | SEC | P1 N3 B3 R5 Q9 |
| 2 | `w6-free-lunch` | Free lunch! | find-move (capture, safe-capture) | F | SEC | |
| 3 | `w6-lava` | Lava everywhere | stars (statues, all pieces) | F | SEC | |
| 4 | `w6-bite` | Snacks bite back | gobble (bite) | A | E C | Introduces "protected". |
| 5 | `w6-protect` | Guard your friend | find-move (protect) | C | E C | |
| 6 | `w6-trade` | Good trade? | quiz (trade) | C | E C | |
| 7 | `w6-battles` | Mini battles | battle | B | SEC | Knight vs pawns, Queen vs 8 pawns |
| 8 | `w6-crown-game` | Capture the Crown | capture-crown | B | SEC | A whole-army game with no check rule: capturing the king wins. The bridge before check. It is the Sprouts' main "real game". |
| B | `w6-boss` | Snack Attack | find-move (mix) | F | SEC | boss |

### Rank 7: CHECK MOUNTAIN (bg `#e6e9fb`, accent `#5a63c9`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w7-check` | Check! | find-move (check) | F | SEC | "The king is standing in lava!" |
| 2 | `w7-spot-check` | Is the king in trouble? | quiz (status 2-way, tap the attacker) | C | SEC | scared-king / calm-king buttons |
| 3 | `w7-escape` | Run, Block, Capture | find-move (escape) | C | SEC | Sprouts: any one escape. |
| 4 | `w7-mate1` | Checkmate! | find-move (mate) | F | SEC | Sprout items use a queen or the back rank. |
| 5 | `w7-mate-or-not` | Detective Pip | quiz (status 4-way) | C | E C | Check / Checkmate / Stalemate / All fine |
| 6 | `w7-stalemate` | Mate, not stalemate | quiz + find-move | C | E C | |
| 7 | `w7-castle` | Castle time | quiz (can-castle + reason) + find-move (flag k/q) | C | SEC | Sprouts: the castle move only. |
| 8 | `w7-en-passant` | Sneaky pawn trick | find-move (flag e) | C | E C | |
| 9 | `w7-armies` | Mini armies | play-bot vs Shelly | D | SEC | kings+pawns, then +knights, then +bishops |
| B | `w7-boss` | First real game | play-bot | D | SEC | game boss: S and E vs Hop with Hop's queen left at home; C vs Tuck, full armies |

### Rank 8: CROWN TOWER (bg `#fde7b8`, accent `#b07a12`)
| # | node id | title | activity | owner | bands | notes |
|---|---|---|---|---|---|---|
| 1 | `w8-golden-rules` | Golden Rules | play-bot (mission develop) | D | E C | |
| 2 | `w8-mate-hunt` | Mate Hunt | puzzles | E | SEC | Sprouts: 3 hand-authored queen/rook mate-in-1s. E: database mateIn1 at 800 or below. C: at 1000 or below. |
| 3 | `w8-ladder` | Rook Ladder | mate-drill (ladder) | C | SEC | |
| 4 | `w8-box` | Queen Box | mate-drill (box) | C | E C | |
| 5 | `w8-rook-mate` | Rook alone | mate-drill (rook) | C | C | |
| 6 | `w8-forks` | Family forks | puzzles (hand) | E | E C | 20 hand-authored forks |
| 7 | `w8-pins` | Pins | puzzles (db pin at 1100 or below) | E | C | |
| 8 | `w8-threats` | What does Tuck want? | find-move (no-hang) | E | E C | |
| 9 | `w8-buddy-ladder` | Buddy Ladder | play-bot | D | SEC | S: beat Hop (full army). E: beat Tuck. C: beat Fox. |
| F | `w8-crown` | The Crown | play-bot | D | SEC | FINAL boss: S beat Hop (full army, Hop's queen home). E beat Fox. C beat Owl. Passing it means PROMOTION and GRADUATION. |

**Graduation** requires `w8-crown` passed (a real win; it cannot be skipped) plus 1 star or more on every registered, visible, non-bonus Rank 8 node. For Sprouts that includes `w8-mate-hunt`, which clarifies "beat Hop + 3 queen mates": three mate-in-1s with a queen or rook, not the box mate.

**After graduation.** The Playground stays open. Grown-ups see a card: "Ready for the main Tempo app: Learn and Puzzles".

`curriculum/skills.ts` defines each node's `skills: SkillId[]` and the "can do" statements used in the report:
- `move-rook` "Moves the rook correctly"
- `move-bishop`, `move-queen`, `move-king`, `move-knight`, `move-pawn`
- `board-colors`, `board-lines`, `square-names`, `setup`
- `capture` "Captures pieces"
- `safety` "Keeps pieces safe"
- `values` "Knows what pieces are worth"
- `protect`
- `check` "Spots checks"
- `escape` "Gets out of check"
- `mate1` "Checkmates in one"
- `stalemate`, `castle`, `en-passant`, `promotion`
- `mate-ladder` "Checkmates with two rooks"
- `mate-box` "Checkmates with K+Q"
- `mate-rook`
- `forks`, `pins`, `threats`
- `play` "Plays a whole game"
- `develop`

---

## 5. Progression rules

### 5.1 Nodes and worlds
- Nodes in a world unlock in order. The next node opens when the previous non-bonus node has 1 star or more, or is `tested` or `skipped`. Bonus nodes are always open.
- Every unlocked node can be replayed at any time. Stars never go down; the best result is kept.
- **The next world unlocks when the current world's boss is PASSED** (5.3) or skipped (5.3), or the world was tested out, or a grown-up unlocked it.

### 5.2 Missing packs (the framework must ship playable on its own)
- A node is **registered** if its level set exists in `LEVEL_SETS` and the set's activity exists in `ACTIVITIES`. Unregistered nodes render as a "Coming soon" cloud, are not tappable, and are ignored by every rule below.
- If a world's boss is unregistered, the world counts as passed once every registered, visible, non-bonus node in it has 1 star or more.
- If a world has no registered visible nodes at all, it is passed automatically (it shows only clouds).
- Graduation ignores unregistered Rank 8 nodes. If `w8-crown` is unregistered, graduation is not available and the Crown Tower shows "Coming soon".
- These rules are unit-tested in `tests/kids.test.ts` with fake pack lists.

### 5.3 Bosses: pass rules per band, ease ladder, "Skip for now"
- Bosses use **the same scoring** as other nodes (5.4).
- **Non-game bosses** (stars, find-move) pass at `score >= bossPass[band]`: Sprout 1 star, Explorer 2, Champion 2. The hint ladder guarantees at least 1 star, so Sprouts always pass. Explorers and Champions who score 1 star:
  - after the 2nd attempt, Pip offers "Practice first", which opens the node in this world with the lowest stars;
  - after the 3rd attempt below the pass mark, a "Skip for now" button appears.
- **Game bosses** (battle, capture-crown, play-bot) pass on a WIN. The **ease ladder** makes a win reachable:
  - `NodeProgress.losses` counts consecutive losses and `NodeProgress.ease` holds the current ease step (0 = as authored).
  - After loss 2, Pip offers "Want me to play sleepier?" (ease +1) and turns the helpers on (Danger Alarm, threat lights).
  - After loss 3, ease +1 is applied automatically, with Pip saying so ("I'll play sleepier. Let's go!"). Nothing is secretly weakened: the ease step is shown on the buddy card as sleepy "Zzz" marks, and the grown-up report lists it.
  - After loss 4, "Skip for now" appears (all bands, all game bosses except `w8-crown`).
  - Each game item declares `ease: Partial<Item>[]`, a list of successively easier variants that the player merges over the item (section 11.3). The **last ease step of every game boss is Shelly the Snail (random moves) plus a handicap**, so a win is practically guaranteed. `w8-crown` cannot be skipped but has the same ladder.
- **Skip for now** sets `skipped: true`. It unlocks the next world, like a pass. It gives no stars, and it does not count for crowns or graduation. The node shows a dotted outline and a small "come back" leaf. Pip: "We'll come back to this one later!"
- **Showing the requirement up front.** On the map and on the World screen, the boss node shows its pass requirement in kid form before it is played: two empty star outlines and a lock-opening icon, "★★ opens Rank 3" (Sprouts see one star outline). Game bosses show "Win to open Rank 6!" with the buddy's face.
- A grown-up can unlock any world, or everything, in Grown-ups.

### 5.4 Stars
- A node's score is `max(1, round(mean(item scores)))`.
- **Game activities** (`game: true`) return one item result: win 3, draw 2, loss 1. A loss **always** earns at least 1 star, whatever the number of moves (this replaces P1's "10 moves" rule).
- The stars activity scores by par (13.1). The Sprout `parSlack` of 1 makes that gentler.
- A golden star is cosmetic: par with no hints, or a Super Star item.

### 5.5 Mastery and crowns
- A node is **mastered** at 3 stars, or at 2 stars on two different days (`masteredDays`).
- **Silver crown** on a world: its boss is passed (not skipped).
- **Gold crown** on a world: every registered, visible, non-bonus node is mastered and none is skipped.

### 5.6 Light spaced repetition ("Pip's Warm-up")
- Every completed node has a `box` from 1 to 5, due after `[1, 2, 4, 7, 14]` days.
- Finishing with 3 stars moves it up one box. 2 stars keeps it (minimum box 2). 1 star sends it to box 1.
- The warm-up runs at the start of the first PLAY of a session. It has **`warmupItems[band]` items (S1, E2, C3)**, each from a different overdue node, most overdue first.
- **There is no warm-up on the kid's first play day**, and none when fewer than 2 nodes are completed.
- Warm-up items come from the node's level set. The player picks an item whose id is not in `NodeProgress.lastItems` (the last 6 item ids played for that node), using the seeded RNG.
- A warm-up pass (score 2 or more) moves the box up one. A miss sends it to box 1 and shows a small "practice leaf" on the map node. No stars are removed.
- Warm-ups can be skipped with one tap ("Skip warm-up"). There is no guilt copy.

---

## 6. Rewards

Everything is deterministic and visible in advance. There is no random loot.

- **Stars**, 1 to 3 per node, shown under each map node. The total is in the top bar. Each new star adds 1 to the **Family Star Jar** (see below).
- **Stickers.** Each node has a sticker (`s-<nodeId>`) granted on its first real completion (not on test-out). Bosses have a shiny sticker. Unearned stickers show as a silhouette with the node name ("Play Rook Maze!"). Tapping an earned sticker speaks its one-line fact aloud (P2 graft), for example "Rooks move in straight lines, like a train on tracks!".
- **Moment stickers**, granted by activities through `player.award(id)`:
  - `st-first-capture`, `st-first-check`, `st-first-mate`
  - `st-en-passant`, `st-castle`, `st-promotion`
  - `st-knight-trek`, `st-surprise-knight` (underpromotion to a knight with check)
  - `st-pawn-war-win`, `st-crown-captured`, `st-ladder-mate`
  - `st-brave-try` (P3 graft): the first time a node is finished after 3 or more mistakes on one item. It rewards persistence.
  - `st-friend-game`: a pass-and-play game was finished. It is unranked, and both profiles get it.
- **Trophies** (a shelf in the Sticker Book):
  - First Checkmate, Pawn War Winner, Castle Builder, En Passant Expert
  - Knight Trekker (a1 to h8)
  - Ladder Mate, Box Mate
  - Fork Finder (10 forks solved)
  - Beat `<buddy>`, one per buddy in the kid's band ladder
  - "Beat all my buddies": only the band ladder (S: Shelly, Hop, Tuck; E: Shelly to Owl; C: Shelly to Owl). Bear and Ember never gate a trophy.
  - Stars 50/100/250
  - Gold Crown x1/x4/x8
  - Graduate
- **Wardrobe** (Pawn Buddy):
  - 8 colors and 6 faces are free from the start.
  - Hats unlock at total stars 10 (red scarf), 25 (blue cap), 50 (pirate hat), 80 (flower band), 120 (wizard hat), 160 (astronaut helmet), 200 (rainbow scarf) and 250 (golden cape).
  - Each world boss passed gives a world hat: w1 tower hat, w2 leaf hat, w3 garden bow, w4 knight helmet, w5 drum-major hat, w6 sailor cap, w7 snow hat.
  - Each buddy beaten gives a matching hat (snail shell, bunny ears, turtle cap, fox ears, owl feathers, bear ears, dragon horns).
  - The **crown is reserved for graduation**.
- **Pip's Garden** (P1 stamp card merged with P2 garden). Each day with any play plants one flower in a 5-pot strip. A full strip earns sticker `st-garden-<n>` and starts a new strip. It shows TOTAL flowers. Missed days are never shown or mentioned, and nothing ever wilts or resets.
- **Family Star Jar** (P2 graft). All kids' stars pour into one shared jar on the profile picker. Every 100 family stars triggers a "Family Party": confetti on the picker and sticker `st-family-<n>` in every profile's book. It is cooperative only; there is never a per-kid comparison.
- **Personal bests only**: Coordinate Dash best, longest puzzle streak, fewest moves on the ladder mate, fewest moves on the Knight Trek. There are no leaderboards.
- **Graduation**: the pawn promotes on screen into a crowned Queen or King avatar (the kid picks), with Pip's speech and a printable certificate (behind the gate).

**Patterns we avoid on purpose:** streak loss, "you'll lose your progress", countdowns outside the Champion Dash modes, energy or lives, currency, purchases, ads, loot boxes, push notifications, variable-ratio rewards, and auto-starting the next level. Confetti is saved for bosses, world completions and graduation. Ordinary items get a small star pop.

---
## 7. Look and feel

The look is a bright "toy box on a sunny day". It is clearly different from the grown-up navy-and-brass app, but just as crafted: chunky rounded shapes, solid "toy" bottom edges instead of blurry shadows, tactile press-down buttons, and lots of breathing room. The one link to the brand is a thin brass ring (`#a8741b`) on the Pip avatar badge in the top bar.

### 7.1 Tokens (`src/kids/kids.css`, scoped to `.kids-app`, all prefixed `--k-`)

```css
.kids-app {
  /* surfaces */
  --k-sky: #bfe6ff;            /* page gradient top */
  --k-meadow: #e9f7d8;         /* page gradient bottom */
  --k-card: #fffaf0;           /* cards (cream) */
  --k-card-2: #ffffff;         /* speech bubble, keypad */
  --k-line: rgb(31 42 68 / 0.12);
  --k-edge: rgb(31 42 68 / 0.18); /* solid toy bottom edge */
  /* text */
  --k-ink: #1f2a44;            /* 13.7:1 on cream */
  --k-ink-soft: #4a5578;       /* 7.05:1 on cream */
  --k-good-ink: #26733b;       /* success text, 5.6:1 on cream */
  --k-oops-ink: #b8391a;       /* rare warning text, 5.5:1 on cream */
  /* fills: ALWAYS paired with --k-ink text (never white text) */
  --k-sun: #ffc83d;      --k-sun-edge: #d99a00;     /* primary, stars; ink 9.2:1 */
  --k-grass: #9ad48f;    --k-grass-edge: #5fa55a;   /* go / success; ink 8.3:1 */
  --k-sea: #7ab0e0;      --k-sea-edge: #4a86bd;     /* info; ink 6.2:1 */
  --k-coral: #ff9f7f;    --k-coral-edge: #e0734f;   /* boss / alert; ink 7.1:1 */
  --k-berry: #c9b3ff;    --k-berry-edge: #9a7fe6;   /* magic / promotion / hint; ink 7.7:1 */
  --k-cream-edge: #e6dcc4;                          /* secondary button edge */
  /* chess signals */
  --k-lava: rgb(255 90 54 / 0.35);   /* attacked squares; ALWAYS with the flame glyph + hatch */
  --k-good-glow: rgb(63 158 85 / 0.45);
  --k-hint-ring: #8e6cef;
  /* board */
  --k-sq-light: #f6f1dc;
  --k-sq-dark: #8cc084;
  --k-frame: linear-gradient(180deg, #d9a066, #c98d4f);
  --k-frame-edge: #9c6532;
  --k-hl-last: rgb(255 200 61 / 0.45);
  --k-hl-select: rgb(255 200 61 / 0.75);
  --k-dot: rgb(31 42 68 / 0.28);
  /* shape */
  --k-r-sm: 12px; --k-r: 20px; --k-r-lg: 28px; --k-r-pill: 999px;
  --k-press: 0 6px 0 var(--k-edge);
  --k-press-down: 0 2px 0 var(--k-edge);
  --k-lift: 0 12px 24px rgb(31 42 68 / 0.14);
  /* spacing */
  --k-1: 4px; --k-2: 8px; --k-3: 12px; --k-4: 16px; --k-5: 24px; --k-6: 32px; --k-7: 48px;
  /* motion */
  --k-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --k-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  /* type (sizes come from data-band, see 7.2) */
  --k-font-display: 'Fredoka Variable', 'Fredoka', ui-rounded, system-ui, sans-serif;
  --k-font-body: 'Andika', 'Fredoka Variable', system-ui, sans-serif;
  --k-font-num: 'Fredoka Variable', ui-rounded, system-ui, sans-serif;
  color-scheme: light;
  background: linear-gradient(180deg, var(--k-sky) 0%, var(--k-meadow) 70%) fixed, var(--k-meadow);
  color: var(--k-ink);
}
```

**Bedtime (night) colors.** They apply when the kid setting is `bedtime: 'on'`, or when it is `'system'` and `prefers-color-scheme: dark` matches. Selector: `.kids-app[data-night="1"]`. KidsApp computes the attribute, so there is no need to duplicate the rules under `@media`.

```css
.kids-app[data-night="1"] {
  --k-sky: #1b2440; --k-meadow: #202b4d;
  --k-card: #283463; --k-card-2: #2f3c70; --k-line: rgb(244 241 255 / 0.12); --k-edge: rgb(0 0 0 / 0.35);
  --k-ink: #f4f1ff;       /* 10.7:1 on card */
  --k-ink-soft: #c3c8e8;  /* 7.2:1 */
  --k-good-ink: #8fd49a; --k-oops-ink: #ff9f7f;
  --k-sun: #ffd35c; --k-grass: #8fd49a; --k-sea: #7ab0e0; --k-coral: #ff9f7f; --k-berry: #b69cff;
  /* fills keep --k-button-ink: #1b2440 text (10.7:1 on sun, 8.9:1 on grass) */
  --k-sq-light: #e9e4cf; --k-sq-dark: #6fa56a;
  --k-frame: linear-gradient(180deg, #a8764a, #8f5f38); --k-frame-edge: #5e3d22;
  color-scheme: dark;
}
```
- Buttons use `color: var(--k-button-ink, var(--k-ink))`. The night theme sets `--k-button-ink: #1b2440`, so the pastel fills keep dark text.
- The night background adds a twinkling star-dot pattern: a CSS radial-gradient layer, animated at opacity 0.6 to 1 over 4 s. It is static under reduced motion.
- The day background adds 3 slow-drifting SVG clouds (60 s linear), which are paused under reduced motion.

### 7.2 Type
- Fonts are self-hosted from npm and imported **only** in `src/kids/fonts.ts`, which only KidsApp imports (a lazy chunk):
  - `@fontsource-variable/fredoka` (display, buttons, numbers; weights 500-700).
  - `@fontsource/andika` 400 and 700 (body, captions and bubbles). SIL's literacy font has a single-storey a and g and clear b/d/p/q and I/l/1.
  - Import the **latin subset** CSS files if the installed package version ships them (check `node_modules/@fontsource*/`; for example `latin-400.css` and `latin-700.css`, and the latin `wght` file). Otherwise use the default CSS. This keeps the `build:single` output small, because vite-plugin-singlefile inlines font files as base64.
- Sizes come from `.kids-app[data-band="sprout|explorer|champion"]`, which sets `--k-body`, `--k-bubble`, `--k-title` and `--k-btn-label` from the tuning table (section 2).
- Line height is 1.4 for body text and 1.15 for titles. Reading text is never all-caps. Line length in bubbles is at most 32 characters for Sprouts and at most 40 otherwise.
- Numbers use Fredoka with tabular figures (`font-variant-numeric: tabular-nums`).

### 7.3 Board look (KidsBoard)
- **Frame.** `.kids-board` is a wooden-toy frame around the Board:
  - padding 10px (8px for Sprouts on phones)
  - background `var(--k-frame)`
  - border-radius 18px
  - box-shadow `0 6px 0 var(--k-frame-edge), var(--k-lift)`
  - the inner `.board` gets border-radius 8px.
- **Square colors, applied without touching the BoardTheme union or other themes' variables:**
  ```css
  .kids-board .sq.light { background: var(--k-sq-light); }   /* specificity 0,3,0 beats .board-x .sq.light (0,2,0) */
  .kids-board .sq.dark  { background: var(--k-sq-dark); }    /* the shorthand also resets any texture image */
  .kids-board .board { --hl-last: var(--k-hl-last); --hl-select: var(--k-hl-select); --hl-last-dark: var(--k-hl-last); --hl-select-dark: var(--k-hl-select); --dest-dot: var(--k-dot); box-shadow: none; }
  ```
  KidsBoard passes `boardTheme="tourney"` (a flat theme) so that nothing else themed leaks in.
  **Contract with the board team** (written into the PR description, and checked by the screenshot check in section 16):
  1. Board keeps the `.sq.light` and `.sq.dark` class names on square elements.
  2. Board keeps `.dest` and `.dest.capture` for move dots.
  3. The frame and bevel either live outside `.board` or can be switched off by a scoped rule. If the board team adds an in-board frame element, they give it the class `.board-frame`, and kids.css adds `.kids-board .board-frame { display: none; }`.
  4. Wood and marble textures are drawn with `background` or `background-image` on `.sq.light` and `.sq.dark`, which the scoped rule above resets.
- **Move dots**: `.kids-board .dest` is 36% of the square, uses `--k-dot`, and bounces in (180ms, `--k-ease-spring`). `.dest.capture` is a ring with 10% stroke width.
- **Tones** (they always carry a glyph, drawn by KidsBoard through `squareContent`):
  - `good`: `--k-good-glow` plus a check glyph.
  - `bad`: coral wash plus a 300 ms wobble.
  - `hint`: a pulsing berry ring (1.2 s, pulse at most 1 Hz).
- **Coordinates.** When shown (Explorer optional, Champion on), `.kids-board .coord` uses 13px Fredoka 600 and `--k-ink-soft`.
- **Pieces.** The default is `'staunton3d'` if it is available, otherwise `'cburnett'` (runtime probe, 11.6). The kid setting can pick either. Pieces never get faces.

### 7.4 Square art (`src/kids/ui/SquareArt.tsx`, inline SVG, 100x100 viewBox, fills the square)
| art key | look | animation |
|---|---|---|
| `star` | 5-point `#ffc83d` star, 3px `#1f2a44` outline, tiny highlight, 70% of the square | idle twinkle (scale 1 to 1.06, 2.4 s); collect: scale 1 to 1.5 to 0 in 280 ms plus 8 sparkles, and a clone flies to the top-bar counter (FLIP, 600 ms, `--k-ease-out`) |
| `rock` | grey boulder `#a7b0bd` with a `#d6dbe2` highlight and a `#6b7686` base | none |
| `lava` | `--k-lava` wash plus a 45° hatch (4px stripes at 30% opacity) plus a 28% flame glyph in the corner | a slow flicker (opacity 0.8 to 1, 1.6 s) |
| `statue-eyes` | overlay on a statue piece: sleepy closed eyes, open eyes when it wakes | "wake" pop, 200 ms |
| `cloud` | puffy white `#ffffff` at 95% opacity with an `#e3eef9` shadow, covering squares outside the area | a very slow bob, 6 s |
| `candy:<n>` | a round candy badge in the corner with the value n (1/3/5/9) plus n dots for Sprouts | none |
| `footprints` | two small `#8b5a2b` prints | fade in |
| `splat:<color>` | a paint splat in one of 6 colors (paint activity) | a 180 ms pop |
| `check` | a green check glyph in the corner (tone good) | a 180 ms pop |
| `target` | a treasure X for find-square and "tap here" | none |
| `danger` | a red ring plus a flame glyph on a threatened own piece (threat lights) | a slow pulse (1 Hz max) |
| `dot` | kid-size move dot (auto-selected lone piece) | bounce-in |
| `ghost:<piece>` | a 40% opacity piece image (a "Watch Pip" demo trail) | fade |

### 7.5 Mascot and character art (inline SVG React components; no image files)
- **Pip** (`ui/Pip.tsx`, viewBox 0 0 120 120). A round knight-pony head and neck in profile, facing right: cream body `#fff3d6`, sun-yellow mane `#ffc83d` with `#e0a100` shading, big eyes (ink with a white highlight), a rosy cheek `#ff9f7f` at 45%, and a 3px `#1f2a44` outline. Props: `mood`, `size` (64/80/120/160) and `hat?`.
  | mood | treatment |
  |---|---|
  | `idle` | blinks every 4-6 s (random); breathes (scale 1 to 1.02 over 3 s) |
  | `talk` | the mouth toggles open and closed every 140 ms while speech plays |
  | `cheer` | a hop (translateY -18px with squash on landing, 500 ms) plus 6 sparkles |
  | `think` | eyes up, a "..." bubble (dots fade in turn) |
  | `oops` | a sweat drop and an 8° head tilt; gentle, never sad |
  | `sleepy` | droopy lids and floating "z z" (break screen, sleepy buddy) |
  | `wow` | pupils grow 1.3x |
- **Pawn Buddy** (`ui/PawnBuddy.tsx`). A pawn silhouette with 8 colors (sun, coral, grass, sea, berry, sky `#9fd3ff`, cream `#fff3d6`, plum `#9b6fb0`), 6 faces (smile, grin, wow, wink, calm, cool) and hats from the wardrobe. The crown is locked until graduation. Sizes: 48, 96, 160.
- **Buddies** (`ui/BuddyFace.tsx`). 7 animal heads in the same flat style with a soft shade. Each has 3 moods: `thinking`, `happy`, `surprised`.
  | id | name | art |
  |---|---|---|
  | `shelly` | Shelly the Snail | pink shell `#f4a3c1` |
  | `hop` | Hop the Bunny | white `#f2f2f2`, pink ears |
  | `tuck` | Tuck the Turtle | green `#7cc47f` |
  | `fern` | Fern the Fox | orange `#ff9a4d` |
  | `olive` | Olive the Owl | brown `#b48a5a`, big eyes |
  | `bruno` | Bruno the Bear (Champion, optional) | `#8b5a2b` |
  | `ember` | Ember the Dragon (Champion, optional) | `#e2554a` |
  The ease step is shown as 0-2 "Zzz" marks on the buddy card.

### 7.6 Motion
- A wrong move plays the piece, wobbles it (translateX 0, -6, 6, -6, 0 over 300 ms), then hops back (the FEN reverts after 450 ms, with a reversed `lastMove` so Board animates it back).
- Results: stars fill one by one, 250 ms apart, each with a spring overshoot (scale 0 to 1.25 to 1) and a rising pop note.
- Confetti: 40 CSS particles (stars, tiny crowns, pawns) over 1.4 s; always under 2.5 s. It is used only for bosses, worlds, graduation and family parties.
- Sticker peel-in: rotateX 60° to 0 plus scale 0.6 to 1, 450 ms.
- Map pawn walk: hops along the path from node to node, 350 ms per hop.
- Crown drop (boss pass): 700 ms with a bounce.
- Nothing flashes faster than 3 Hz.
- **Reduced motion** (the `prefers-reduced-motion` media query, OR the kid setting `reducedMotion: 'on'`, which sets `.kids-app[data-motion="reduced"]`): every transform animation becomes a 150 ms opacity fade. Wobble, confetti, bob, drift and twinkle are removed. Confetti becomes a static burst icon.

### 7.7 Sound (`src/kids/lib/kidsSound.ts`)
Sounds are synthesized with WebAudio in the style of `src/chess/sound.ts`, about 30% quieter, with no harsh square waves. **Kids code never imports `src/chess/sound.ts`**. That fact is enforced by a test, and it means the kid's mute also silences all move sounds. Board itself plays no sounds.

All sounds check `kid.settings.sound`. `kidsSound.unlock()` resumes the AudioContext on the first tap on the profile picker (iOS).

| name | use | synthesis |
|---|---|---|
| `move` | piece moves | the existing knock recipe (noise burst bandpassed at 660 Hz plus a 220 Hz sine, 70 ms), gain 0.35 |
| `capture` | captures in real games | two knocks, 180 then 150 Hz, 55 ms apart |
| `check` | check | knock plus an 880 Hz triangle blip, gain 0.02 |
| `pop` | star collect | two-note triangle blip; the pitch climbs a pentatonic ladder C5 D5 E5 G5 A5 C6 per star in the item |
| `chomp` | gobble / crown capture | low-passed noise burst (800 Hz, 90 ms) plus a 120 Hz triangle thump |
| `boop` | wrong | soft sine gliding 300 to 220 Hz over 180 ms, gain 0.04; never a buzzer |
| `whoosh` | page and card transitions | bandpass noise sweep 400 to 2400 Hz, 250 ms |
| `sparkle` | promotion, hint, golden star | 3 random high sines (1.5-3 kHz), 60 ms apart |
| `fanfare` | node complete | C-E-G-C' arpeggio, triangle through a 2 kHz lowpass, 100 ms steps |
| `chime` | sticker | 3 random pentatonic notes, bell (sine plus a 2.76x partial) |
| `crown` | boss pass, graduation | bell C6 plus E6, 1.2 s decay |
| `tick` | Champion Dash only | 1200 Hz, 40 ms, gain 0.02 |

There is no background music.

### 7.8 Layout
- Breakpoints: **phone** is below 700px wide. **Tablet** is 700px or more. **Desktop** is 1100px or more. The layout is **landscape** when width / height is above 1.1 and width is at least 700px.
- The side gutter is 16px (8px for Sprouts on phones in the player, so the board gets the width). There is no horizontal scroll at 360px (checked by a screenshot and an e2e step).
- **Player, portrait phone**, top to bottom:
  - top bar, 64px
  - coach row, 88px: Pip at 72px plus the bubble
  - board, width `min(100vw - 2*gutter, 100svh - 64 - 88 - trayH - 24px)`
  - action tray: 96px for Sprouts, 80px otherwise; hidden when empty.
- **Player, landscape**: a grid of `[coach 280px] [board] [tray 240px]`. The board is `min(100svh - 112px, 720px, 100vw - 600px)`. The `leftHanded` setting mirrors the columns to `[tray] [board] [coach]`.
- Squares on a 360px phone are about 41px (360 - 2x8 gutter - 2x8 frame = 328, and 328 / 8 = 41). On a 390px phone they are about 45px. Sprouts on phones never need precise aim: tap-tap, auto-select of a lone piece, 36% dots, and cloud areas that remove distractions.
- Map, portrait: a vertical scroll with Rank 1 at the bottom and auto-scroll to the current node; the PLAY button is sticky at the bottom. Map, landscape: the same path, plus a right side panel (360px) with the Garden, "Next up" and Pip's tip.

---

## 8. Component-by-component treatments (`src/kids/ui/`)

| component | treatment |
|---|---|
| `BigButton` | Variants: `primary` (sun), `go` (grass), `info` (sea), `boss` (coral), `magic` (berry), `plain` (cream fill, `--k-cream-edge`). Height `var(--k-btn-h)` from the band (72/56/48), padding 0 24px, radius `--k-r`, Fredoka 600 at `--k-btn-label`. Shadow `0 6px 0 var(--edge)`. `:active` gives translateY(4px) and shadow `0 2px 0`. Focus ring: 4px `--k-hint-ring` with a 2px offset. There is always an icon plus a word; icon-only buttons need `aria-label`. `disabled` is 50% opacity with no press. Minimum width is equal to the height. |
| `PlayButton` | The map's giant PLAY: 88px tall, full width up to 420px, sun fill, a play-triangle icon plus "Play!" (Fredoka 700, 30px), and a gentle 2 s scale pulse that is off under reduced motion. |
| `Card` | `--k-card` fill, radius `--k-r-lg`, 3px `--k-line` border, `--k-press` bottom edge, padding 16/24. |
| `TopBar` (player) | 64px, transparent over the gradient. Left: an X button (56px, plain). Center: progress pips. Right: hint bulb (56px, berry when hints are available, with a pulse when the ladder auto-offers) and speaker (56px). Sprouts' buttons are 64px. |
| `ProgressPips` | One pip per item: 14px circles with 8px gaps; the current one is 18px with a sun fill; done ones are grass with a white check; skipped ones are cream with a dash. |
| `SpeechBubble` | `--k-card-2` fill, radius 20px, a 3px `--k-line` border, and a 14px tail toward Pip. Text is `--k-bubble` Andika. Karaoke: the spoken word gets a sun underline 4px thick. There is a 56px speaker button inside the bubble at the end (hidden for the gate). `aria-live="polite"` (P2 graft). |
| `Coach` | Pip plus the bubble. Portrait: a row. Landscape: a column (Pip at 120px above the bubble). |
| `StarRow` | 1-3 stars at 20/28/48px. Empty stars are outlined `--k-line`; earned stars are sun with an ink outline; a golden star adds a sparkle glyph. |
| `NodeBubble` (map) | A 72px circle (the boss is an 88px castle shape, the final boss a 96px tower). The fill is the world accent at 20% on cream, with a 3px ink outline and the node icon (a piece sprite for piece nodes). Below it: a StarRow at 20px. States: locked (a padlock and 60% opacity), current (the Pawn Buddy stands on it, plus a sun ring pulse), tested (a paper-plane badge), skipped (a dotted outline and a leaf), due (a practice leaf), coming soon (a cloud over it, not tappable). |
| `WorldBand` (map) | A full-width band with the world `bg`, a 28px radius on top, an illustrated SVG header (simple shapes: towers, trees, hills, tents), the title (Fredoka 700, `--k-title`), a crown slot (silver/gold) and a dotted trail path (4px, ink at 25%) linking the nodes. |
| `BossCard` | Coral edge, the buddy face (for game bosses) or a castle icon, the requirement row ("★★ opens Rank 3" / "Win to open!"), and a "Play" BigButton `boss`. |
| `Tray` | The bottom action area. Answer buttons are laid out 2 per row (Sprout) or up to 4 per row, each at least `--k-btn-h`, with a 12px gap. |
| `ResultsOverlay` | A dim backdrop (ink at 40%), then a centered Card (up to 440px): a drumroll (600 ms), stars filling, Pip cheering, a sticker peel-in on first completion, and a one-line recap ("You can checkmate with a queen!"). Buttons: Next (primary, auto-focused, Enter works), Again (plain), Map (plain). Boss pass: crown drop, then "Rank 4 is open!", then a pawn-walk animation on dismiss. Nothing auto-advances. |
| `DangerAlarm` modal | A bottom sheet: Pip in `wow` mood plus the bubble "Uh-oh! Is your knight safe?". The threatened piece's square pulses (`danger` art) and the attacker gets an arrow. Two buttons: "Undo" (go, primary) and "Keep it" (plain). |
| `ParentGate` modal | Ink backdrop at 70%, a cream card, the title "Grown-ups only". Step 1 is a 96px hold ring that fills over 2 s. Step 2 is the question and a 3x4 keypad of 64px keys. It is never spoken. |
| `Keypad` | 64px keys, Fredoka 600 at 28px, a cream fill with an edge; backspace and OK keys. |
| `AvatarTile` (picker) | 160px (phone: 2 columns; tablet: 3-4). The Pawn Buddy at 96px, the name (Fredoka 600, 22px), a rank badge ("Rank 5"), the total stars and the garden count. |
| `StickerSlot` | A 96px circle or badge shape per world. Earned: full color, a 3px ink outline and a ribbon title. Missing: a `--k-line` silhouette plus "Play Rook Maze!". |
| `Toast` (kids) | A cream pill at the top center, 56px tall, auto-hides after 2.5 s. Used only for saves and gate messages. It reuses the app's toast store and is styled by `.kids-app .toast`. |
| `KidsPromoPicker` | A modal over the board with 4 pieces as 96px buttons (Queen, Rook, Bishop, Knight). Each shows the real piece image plus its name; the name is spoken on focus for Sprouts and Explorers; Queen is first and highlighted. |
| `Confetti` | 40 absolutely positioned spans; CSS variables for color, angle and delay; removed after 1.4 s. |

Icons: `ui/KidsIcon.tsx` has 32 glyphs drawn as 24x24 stroke-3 rounded SVGs:
`play, again, home, x, bulb, speaker, lock, door, map, book, trophy, gift, star, crown, castle, flag, rock, flame, candy, road, eye, puzzle, swords, shield, leaf, plane, cloud, clock, heart, check, dots, plus`.
Piece icons reuse the real piece sprites: `<span class="piece pc-wR">` inside a sized box, under the kid's `pieces-<set>` class.

---

## 9. Screens

All routes live under `#/kids/...` and are rendered by KidsApp full-screen, with no grown-up sidebar.

1. **Who's playing?** (`kids`)
   - The Family Star Jar is at the top center, showing its fill level plus the count.
   - A grid of AvatarTiles plus a dashed "+ New player" tile. Adding a player needs the gate once one profile exists.
   - Bottom corners: "Grown-ups" (lock icon) and "Exit" (door icon), both small and low-contrast, both behind the gate.
   - The first tap anywhere calls `speech.unlock()` and `kidsSound.unlock()`.
   - With exactly one profile, a "Hi Mia!" splash shows with a tap to continue.
   - Up to 8 profiles.
2. **New player** (`kids/new`)
   - 4 steps with big Next buttons, a back arrow and Pip narrating:
     - (a) Name: an optional field for a grown-up to type (12 characters max; the hint says "first name or nickname"), or 12 fun-name chips such as "Brave Otter".
     - (b) Age: number buttons 4-12 (80px), each spoken.
     - (c) Experience: three picture cards.
     - (d) Build your Pawn Buddy: color, face and free hat, with a live preview.
   - Then Placement (for experience b or c) or `kids/map`.
3. **Show Pip what you know!** (`kids/placement`): see 3.2.
4. **Map** (`kids/map`, home)
   - The vertical island with the 8 WorldBands, the Pawn Buddy on the current node, and sticky PLAY.
   - Top bar: avatar chip (tap to switch player; no gate), total stars, Sticker Book button, Playground button (unlocked when w5 is passed, or for start = 'games').
   - PLAY runs the warm-up if one is due (5.6), then the next unplayed node, or the lowest-starred node if everything is played.
   - Tapping a WorldBand opens the World screen. Locked worlds show clouds plus "Challenge to skip ahead".
5. **World** (`kids/world/<w1..w8>`)
   - A banner with the world name, crown progress, and Pip's one-line world intro (spoken on the first visit).
   - A node path in a larger layout. Each node card shows its icon, title, StarRow and "Play" / "Again". The boss uses a BossCard.
6. **Activity player** (`kids/play/<nodeId>`, `kids/warmup`, `kids/playground/<entryId>`)
   - TopBar, Coach, KidsBoard, Tray.
   - "Watch Pip" plays before item 1 the first time a node is opened (it is skippable).
   - The X asks "Leave? Your stars are saved" only mid-item. Stay is the primary button.
   - Session checks happen between items and at results (10.5).
7. **Results** (overlay): see 8, ResultsOverlay.
8. **Game variant** of the player (play-bot, battle, capture-crown)
   - The buddy card on top (face, name, Zzz ease marks, thinking bubble for 600-1200 ms), the board, and the kid card at the bottom with the captured "candy" and a material bar.
   - Buttons: Hint (with its count), Undo (if allowed), Start over.
   - Game end: a result card plus "See how it ended" (the final position with arrows).
9. **Playground** (`kids/playground`)
   - Tiles for the registered `PlaygroundEntry`s that are unlocked for this kid. Playing here gives trophies and personal bests but does not change map progress.
   - Framework tiles: "Star Hunt Endless" (stars `review()` generator) and "Puzzle of the Day" (only if Pack E is registered).
   - Empty state: "More games are coming!"
10. **Sticker Book** (`kids/stickers`)
    - Tabs: Stickers (one page per world plus Specials), Trophies (a shelf), Wardrobe (dress up the Pawn Buddy; locked items show "Earn 50 stars"), and My Scene (P3 graft, framework later step: drag earned stickers onto a meadow; positions saved in `kid.scene`).
    - Swipe or arrow paging, with a page-turn whoosh.
11. **Break time** (overlay, `kids/break` route not needed)
    - Shown when the session limit is reached, at the next item or results boundary (never mid-item).
    - Pip yawns: "Great playing! Your brain grew today." It shows today's stars and stickers.
    - One big button, "Bye for now!", goes back to the picker. A small "Grown-up: 10 more minutes" button needs the gate.
12. **Graduation** (`kids/graduate`)
    - Pip walks the pawn onto rank 8, the screen goes gold, and the kid picks Queen or King. Crown drop, fanfare, confetti.
    - The certificate is offered to grown-ups: `kids/certificate/<kidId>`, a print-styled page (behind the gate) with the name, the date, "Can move all the pieces, give checkmate, and play a full game", and the avatar. It uses `window.print()` with `@media print` CSS.
13. **Grown-ups** (`kids/grownups`, behind the gate; the pass lasts 5 minutes, held in memory only)
    - A per-kid switcher.
    - **Report**:
      - "can do" checklist per skill (a check mark once every node with that skill has 2 stars or more; a half mark for 1 star)
      - "needed help with" (nodes with hint level 3 or more at their last play)
      - minutes per day for the last 7 days (bars)
      - stars, current rank, buddies beaten, ease steps used
      - Coaching tips per current world, for example w5: "Play Pawn Wars together on a real board!"
    - **Settings per kid**:
      - band
      - voice (auto/first/off), voice picker plus preview, speech rate 0.7-1.2
      - sounds
      - Bedtime colors (off/on/system)
      - reduced motion (system/on)
      - session limit (off/10/15/20/30/45)
      - takebacks
      - Danger Alarm, Oops shield (Champion), threat lights
      - coordinates
      - hints (generous/normal/few, which moves `hintAfterWrong` by -1/0/+1)
      - move dots (always/until-mastered/on-mistake)
      - piece set
      - tap only (no drag)
      - left-handed
    - **Actions**: set starting world, unlock all, reset progress, delete profile (hold to confirm), print certificate.
    - **Device**: set or clear the 4-digit PIN, "Lock Kids mode on this device" (P3 graft; the app opens `#/kids` when launched), export or import kids data (a JSON file), "Delete all kids data", "Exit to Tempo".
14. **Parent gate** (modal): see 10.4.

**Entry from the grown-up app**: a "Kids mode" nav item in the sidebar's Play group, a Home card ("Teaching a kid? Open Kids mode"), and a Settings row. They all call `navigate('kids')`. The mobile tab bar is unchanged; on phones the entry is through the Home card and the Settings row.

---

## 10. Speech, accessibility, safety, privacy

### 10.1 Speech (`src/kids/player/speech.ts`)
- It wraps `window.speechSynthesis` and is feature-detected. With no speech, captions and icons carry everything (every instruction has an icon, and every answer can be a picture).
- **Voice loading.** Listen for `voiceschanged` and re-pick the voice then.
  - Preference order: the grown-up's chosen `voiceURI`; then the first voice with `localService === true` and `lang` starting with `en-US`, `en-GB`, then `en`; then any `en` voice.
  - Prefer on-device voices so no text goes to cloud voice services.
- **First-gesture unlock (iOS).** `speech.unlock()` is called from the first pointerdown on the picker. It speaks an empty utterance at volume 0. `speak()` queues lines until `unlocked` is true.
- **Queue.** `speak(lines, {onWord, onEnd})` cancels the previous speech, then queues the lines. `speech.cancel()` runs on every route change (a KidsApp effect on `route`) and on player unmount.
- **Karaoke.** `onboundary` word events underline the current word. **Graceful fallback**: if no boundary event arrives within 700 ms of `onstart`, switch to timed highlighting at `2.4 * rate` words per second. If `onstart` never fires, highlight nothing (the whole bubble stays readable).
- **Pronunciation map** (`pronounce(text, band)`), applied only to the spoken string, never to the caption:
  - squares `/\b([a-h])([1-8])\b/` become "ay four" for a, and "`<letter>` `<number word>`" for the others (e.g. "e four")
  - SAN pieces K/Q/R/B/N become King/Queen/Rook/Bishop/Knight
  - `x` becomes "takes", `+` becomes ", check", `#` becomes ", checkmate"
  - `O-O` becomes "castles king side" and `O-O-O` becomes "castles queen side"
  - `=Q` becomes "becomes a queen"
  - Sprout text never contains notation; `validate` warns if a Sprout-visible `say` matches the square regex.
- Rate and pitch come from the band table, overridden by the grown-up rate.
- **The parent gate is never spoken.** ParentGate calls `speech.cancel()` on open, has no speaker button, and speech is muted while it is open.
- Pip's talk mood follows `onstart` and `onend`.

### 10.2 Motor and input
- Tap-tap everywhere; drag is optional. `tapOnly` turns off drag-and-drop without a Board change. KidsBoard's wrapper div gets `onPointerMoveCapture={e => { if (tapOnly) e.stopPropagation(); }}`, so Board's `onPointerMove` never sees movement and never sets `drag.moved`. On pointerup, Board then treats the press as a click, which selects the piece, and the next tap on a target square moves it through Board's click-move path. This was checked against `src/chess/Board.tsx` (`onPointerDown`, `onPointerMove`, `onPointerUp`). Sprouts default to `tapOnly: true`, which also absorbs shaky micro-drags. Explorers and Champions default to false.
- **Auto-select of a lone piece** (P3 graft) needs no Board change. When `autoSelectLone` is on and a freeMoves activity has exactly one movable piece, KidsBoard draws kid-size `dot` art on its dests and intercepts `onSquareClick`: a tap on a dest square calls `freeMoves.onMove(from, sq)` directly (a one-tap move). Board's own selection still works if the kid taps the piece.
- Targets meet the band minimums; the gap is at least 12px. There is no double-tap, no required long-press (long-press is only an optional shortcut; the gate's hold is grown-up only), no swipe-only UI and no hover-only UI.
- **Keyboard / switch access.** KidsBoard adds an optional roving cursor: when the board wrapper has focus, the arrow keys move a 4px focus ring over squares and Enter/Space act as a tap on that square, and KidsBoard implements this itself, with no Board change:
  - Enter on a movable piece sets KidsBoard's own `kbdFrom` and draws `dot` art on its targets. The targets are the freeMoves dests, or the chess.js legal moves from that square.
  - Enter on a target completes the move. KidsBoard calls `freeMoves.onMove(from, to)`, or builds the `Move` with `new Chess(fen).move({from, to, promotion})` and calls the activity's `onMove`. A promotion goes through KidsPromoPicker.
  - Enter on any other square calls `onSquareClick(sq)`.
  - Synthetic pointer events are NOT used, because Board calls `setPointerCapture`, which throws for a fake pointer id. Every control is a real `<button>` with a label; Tab order goes top bar, board, tray; Enter triggers Next on results.

### 10.3 No failure shame, color and sensory
- No lives, no red X screens, no buzzers. The hint ladder guarantees completion. Losses still earn a star and a learning replay.
- Tones and signals always carry a glyph or a pattern (check, flame plus hatch, ring). Text contrast is at least 4.5:1 (most is 7:1 or more; see the tokens). UI graphics are at least 3:1.
- Reduced motion: section 7.6. Nothing flashes above 3 Hz. Confetti is at most 2.5 s.

### 10.4 Parent gate (`ui/ParentGate.tsx`)
- **Step 1**: "Grown-ups: press and hold" on a 96px ring that fills over 2 s. Releasing early resets it.
- **Step 2**:
  - If a PIN is set: a 4-digit PIN keypad.
  - Otherwise: an arithmetic question in words, `a` times `b` with `a` from 11 to 19 and `b` from 3 to 9, for example "What is fourteen times three?", answered on the keypad. A wrong answer gives a new question.
  - It is a speed bump, not security. The grown-up text says so plainly.
- **PIN storage**: `{ pinSalt, pinHash }` where the hash is SHA-256 over salt + PIN via `crypto.subtle`. If `crypto.subtle` is unavailable (an insecure context), the PIN option is hidden and the arithmetic gate is used.
- **Guards**:
  - exit to Tempo
  - the Grown-ups area
  - extending the session
  - adding a profile once one exists
  - deleting a profile or all data
  - reset
  - import/export
  - unlock all / set starting world / band change
  - printing the certificate
  - turning off the device lock
- It is never spoken (10.1).

### 10.5 Session length (`player/useSession.ts`)
- Active minutes are visibility-aware (P3 graft). Time counts only while `document.visibilityState === 'visible'` and the last pointer or key event was less than 120 s ago. Minutes accumulate into `kid.days[dayKey].minutes`.
- Defaults: Sprout 10, Explorer 20, Champion 30 (not "off").
- When the limit is reached, the Break screen shows at the next item or results boundary, never mid-item. Continuing needs the gate (+10 minutes).
- There are no autoplay chains: after results the kid must choose.

### 10.6 Privacy
- All kids data is in `localStorage['tempo.kids.v1']`, and the device lock is in `localStorage['tempo.kids.lock.v1']`. Both are separate from `'tempo.profile.v1'`.
- **They are never synced.** `src/store/cloud.ts` must not import from `src/kids` or reference `tempo.kids`, and a test asserts both.
- Names are optional nicknames. No photos, no birthdates (band only), no chat, no external links, no ads, no analytics, no network calls. Fonts are self-hosted and Stockfish is local WASM.
- Export is a local JSON download. Import validates with `normalizeKids()`.
- Siblings see only each other's name, avatar, rank and stars on the picker.
- **Robustness**: every localStorage access is wrapped in try/catch, with an in-memory fallback (private mode or sandboxed frame). When saving fails, Grown-ups shows a small note: "Progress won't be saved on this device."

---
## 11. Architecture

### 11.1 File layout and ownership
Owner F is the framework step; A-E are the packs. **No file has two owners.** The only shared line-level touch point is one import and one array entry per pack in `src/kids/packs.ts` (section 16).

```
src/kids/
  KidsApp.tsx            F  root; keeps the NAMED export `KidsApp`; parses routes; kid gate; imports ./fonts and ./kids.css;
                             sets data-band / data-night / data-motion on .kids-app; cancels speech on route change
  lock.ts                F  isKidsLocked() / setKidsLocked(on) over localStorage 'tempo.kids.lock.v1' (tiny; App.tsx imports it statically)
  fonts.ts               F  @fontsource imports (7.2)
  kids.css               F  tokens, shell, map, player, results, sticker book, KidsBoard overrides, square art, reduced motion
  routes.ts              F  go.picker(), go.map(), go.world(id), go.play(nodeId), go.warmup(), go.playground(id?), go.stickers(tab?), go.grownups(kidId?), go.graduate(), go.certificate(kidId)
  packs.ts               F  PACKS registry + derived ACTIVITIES, LEVEL_SETS, PLAYGROUND, isRegistered(nodeId)
  store/kidsStore.ts     F  KidsState/KidProfile types, load/save/normalizeKids, useKids(), useActiveKid(), updateKid(id, fn), updateKids(fn), awardTo(kidId, id)
  store/progress.ts      F  pure: recordRun, unlock/pass logic, mastery, crowns, Leitner, dueNodes, applyPlacement, grants (stickers/trophies/wardrobe/family jar), graduation check
  curriculum/worlds.ts   F  WORLDS (8) and all NODES (section 4)
  curriculum/skills.ts   F  SkillId union and "can do" statements
  curriculum/stickers.ts F  every sticker and trophy id, title, fact, art spec, and trophy predicates
  curriculum/wardrobe.ts F  colors, faces, hats and unlock rules
  curriculum/buddies.ts  F  buddy metadata only: id, name, colors, band ladders, ease labels (no move logic)
  curriculum/tuning.ts   F  BAND_TUNING (section 2), resolveItem()
  activities/types.ts    F  contracts (11.3)
  activities/stars/      F  index.ts, logic.ts, StarCollector.tsx, stars.css
  activities/findMove/   F  index.ts, logic.ts, FindMove.tsx, findMove.css
  activities/boardVision/ A  index.ts, logic.ts, BoardVision.tsx, PieceTray.tsx, boardVision.css
  activities/paint/      A  index.ts, logic.ts, PaintMoves.tsx, paint.css
  activities/gobble/     A  index.ts, logic.ts, Gobble.tsx, gobble.css
  activities/memory/     A  index.ts, logic.ts, MagicMemory.tsx, memory.css   (playground only)
  activities/battle/     B  index.ts, logic.ts, miniBot.ts, Battle.tsx, battle.css
  activities/captureCrown/ B index.ts, logic.ts, crownBot.ts, CaptureCrown.tsx, crown.css
  activities/quiz/       C  index.ts, logic.ts, Quiz.tsx, BalanceScale.tsx, quiz.css
  activities/mateDrill/  C  index.ts, logic.ts, defense.ts, MateDrill.tsx, mateDrill.css
  activities/playBot/    D  index.ts, logic.ts, kidBot.ts, missions.ts, PlayBot.tsx, BuddyCard.tsx, playBot.css
  activities/puzzles/    E  index.ts, logic.ts, kidPuzzles.ts, daily.ts, Puzzles.tsx, puzzles.css
  content/core.ts        F  corePack: stars + find-move activities; framework level sets (13.1, 13.2)
  content/checkpoints.ts F  cp1..cp8 (placement)
  content/movement.ts    A  movementPack
  content/minigames.ts   B  minigamesPack
  content/rules.ts       C  rulesPack
  content/games.ts       D  buddiesPack
  content/tactics.ts     E  tacticsPack
  player/ActivityPlayer.tsx F  run loop, intro, hints, scoring, easier/super, ease ladder, results, warm-up/placement/playground modes
  player/run.ts          F  item selection (tiers, lastItems, seeded rng)
  player/KidsBoard.tsx   F  Board wrapper (11.5)
  player/KidsPromoPicker.tsx F
  player/Intro.tsx       F  "Watch Pip" script player
  player/Results.tsx     F
  player/speech.ts       F  (10.1)
  player/useSession.ts   F  (10.5)
  ui/                    F  Pip, PawnBuddy, BuddyFace, BigButton, PlayButton, Card, TopBar, ProgressPips, SpeechBubble, Coach,
                            StarRow, NodeBubble, WorldBand, BossCard, Tray, Confetti, SquareArt, ParentGate, Keypad,
                            AvatarTile, StickerSlot, KidsIcon, DangerSheet
  screens/               F  ProfilePicker, NewKid, Placement, MapScreen, WorldScreen, Playground, StickerBook,
                            Grownups, BreakTime, Graduation, Certificate
  lib/miniRules.ts       F  (12.1)
  lib/danger.ts          F  (12.2) (shared by play-bot, capture-crown bells, find-move no-hang)
  lib/fen.ts             F  placementFen(), fenPlacement(), withTurn()
  lib/rng.ts             F  mulberry32(seed), hashSeed(...parts), pick, shuffle
  lib/kidsSound.ts       F  (7.7)
  lib/pronounce.ts       F  (10.1)
  lib/pieceProbe.ts      F  (11.6)
tests/kids.test.ts            F
tests/kids-movement.test.ts   A
tests/kids-minigames.test.ts  B
tests/kids-rules.test.ts      C
tests/kids-buddies.test.ts    D
tests/kids-tactics.test.ts    E
```

Activity folder rule: `logic.ts` is pure TypeScript (rules, `validate`, `review`, scoring) with no React or DOM imports, so vitest (node environment) can import it. `index.ts` builds the `ActivityDef` from `logic.ts` and the component. Pack CSS classes are prefixed `k-<activityId>-`, and each pack's CSS file is imported only by its own components. **Packs never edit `kids.css`.**

### 11.2 Registry (`src/kids/packs.ts`)
```ts
import { corePack } from './content/core';
// PACK A: import { movementPack } from './content/movement';
// PACK B: import { minigamesPack } from './content/minigames';
// PACK C: import { rulesPack } from './content/rules';
// PACK D: import { buddiesPack } from './content/games';
// PACK E: import { tacticsPack } from './content/tactics';
export const PACKS: KidsPack[] = [corePack /* , movementPack, minigamesPack, rulesPack, buddiesPack, tacticsPack */];
export const ACTIVITIES = new Map(PACKS.flatMap(p => p.activities).map(a => [a.id, a]));
export const LEVEL_SETS = new Map(PACKS.flatMap(p => p.levelSets).map(s => [s.id, s]));
export const PLAYGROUND = PACKS.flatMap(p => p.playground ?? []);
export const CHECKPOINTS = /* from content/checkpoints.ts */;
export function isRegistered(nodeId: string): boolean { const s = LEVEL_SETS.get(nodeId); return !!s && ACTIVITIES.has(s.activity); }
```
Each pack's only shared-file edit is uncommenting its own import line and adding its entry to the array.

### 11.3 Contracts (`src/kids/activities/types.ts`)
```ts
import type { ComponentType, ReactNode } from 'react';
import type { SquareTone } from '../../chess/Board';            // 'good' | 'bad' | 'hint' | 'focus'
import type { KidProfile } from '../store/kidsStore';
import type { BandTuning } from '../curriculum/tuning';
import type { KidsIconName } from '../ui/KidsIcon';
import type { PipMood } from '../ui/Pip';
import type { KidSound } from '../lib/kidsSound';

export type AgeBand = 'sprout' | 'explorer' | 'champion';
export type Tier = 1 | 2 | 3;
export type Sq = string;                                          // 'a1'..'h8'
export type PieceCode = 'K'|'Q'|'R'|'B'|'N'|'P'|'k'|'q'|'r'|'b'|'n'|'p';
export type Placement = Partial<Record<Sq, PieceCode>>;
export type BandText = string | ({ all: string } & Partial<Record<AgeBand, string>>);
export interface Arrow { from: Sq; to: Sq; color?: 'green' | 'red' | 'blue' | 'yellow' }
export type ArtKey = 'star' | 'rock' | 'lava' | 'statue-eyes' | 'cloud' | `candy:${1 | 3 | 5 | 9}` | 'footprints'
  | `splat:${0 | 1 | 2 | 3 | 4 | 5}` | 'check' | 'target' | 'danger' | 'dot' | `ghost:${PieceCode}`;

/** Fields any item may carry; the player reads these, activities ignore them. */
export interface ItemMeta {
  id?: string;                                           // stable id; default `${setId}#${index}` (append-only authoring)
  tier?: Tier;                                           // default 1
  bands?: AgeBand[];                                     // default all
  tune?: Partial<Record<AgeBand, Record<string, unknown>>>;  // per-band overrides merged over the item
  superTune?: Record<string, unknown>;                   // "Super Star" variant (golden star)
  ease?: Record<string, unknown>[];                      // game items: successively easier variants (5.3)
  say?: BandText;                                        // instruction line at item start
  rule?: BandText;                                       // hint level 1 line
}
export interface HintStep { say?: BandText; tones?: Record<Sq, SquareTone>; arrows?: Arrow[]; art?: Record<Sq, ArtKey>; demo?: string[] /* uci */ }
export interface ItemResult {
  score: 1 | 2 | 3; mistakes: number; hintLevel: 0 | 1 | 2 | 3 | 4;
  golden?: boolean; outcome?: 'win' | 'draw' | 'loss'; stats?: Record<string, number>;
}
export type PlayMode = 'node' | 'warmup' | 'placement' | 'playground';
export interface TrayButton {
  id: string; label: BandText; icon?: KidsIconName; art?: ReactNode;
  variant?: 'primary' | 'go' | 'info' | 'boss' | 'magic' | 'plain'; disabled?: boolean; onPress(): void;
}
export interface PlayerApi {
  readonly band: AgeBand; readonly tuning: BandTuning; readonly kid: KidProfile; readonly mode: PlayMode;
  say(text: BandText | BandText[], mood?: PipMood): void;   // bubble + speech per band voice rules
  mistake(text?: BandText): void;     // counts a mistake; boop; Pip 'oops'; advances hint ladder; may offer "Easier one?"
  setHints(steps: HintStep[]): void;  // ladder levels 1..4 for the current item (missing levels use generic fallbacks)
  readonly hint: HintStep | null;     // currently shown hint step (activity renders tones/arrows/art from it)
  readonly hintLevel: 0 | 1 | 2 | 3 | 4;
  progress(done: number, total: number): void;           // small counter chip in the top bar (e.g. stars 2/3)
  celebrate(kind: 'small' | 'big' | 'checkmate' | 'promotion'): void;
  sound(name: KidSound): void;
  award(id: string): void;            // sticker or trophy id declared in curriculum/stickers.ts; idempotent
  setTray(buttons: TrayButton[] | null): void;
  rng(): number;                      // seeded per run
  best(key: string, value: number, better: 'higher' | 'lower'): boolean;   // personal bests; true if improved
  puzzle: { rating: number; isSeen(id: string): boolean; report(id: string, rating: number, ok: boolean): void };
  engineReady(): boolean;             // engine.status === 'ready'
  opponent?: { kind: 'bot' } | { kind: 'friend'; kidId: string | null };   // playground friend mode
}
export interface ActivityProps<I> {
  item: I & ItemMeta;                 // already resolved: tune/superTune/ease merged
  itemKey: string;                    // remount key
  band: AgeBand; kid: KidProfile; player: PlayerApi;
  onDone(r: ItemResult): void;
}
export interface ActivityDef<I = unknown> {
  id: string; title: string; icon: KidsIconName;
  Component: ComponentType<ActivityProps<I>>;
  validate(item: I & ItemMeta, band: AgeBand): string[];  // MANDATORY; [] means valid
  review?(rng: () => number, band: AgeBand): I;           // endless / warm-up generator; output must validate
  game?: boolean;                                        // one item per run; outcome-based scoring; ease ladder
}
export interface IntroStep {
  say: BandText; fen?: string; pieces?: Placement; art?: Partial<Record<Sq, ArtKey>>;
  arrows?: Arrow[]; tones?: Partial<Record<Sq, SquareTone>>; move?: [Sq, Sq]; ms?: number;  // default 1800 ms after speech
  pick?: { answer: PieceCode; options: PieceCode[] };   // "Piece Parade" picture quiz: "Which one is the bishop?" (unscored;
                                                        // a wrong pick wiggles and Pip names it: "That's the knight! Find the bishop.")
}
export interface LevelSet<I = unknown> {
  id: string;                         // == node id (or cp1..cp8)
  activity: string;
  intro?: IntroStep[];                // "Watch Pip"; plays on the node's first open; replay = hint level 1
  items: (I & ItemMeta)[];
  perRun?: Partial<Record<AgeBand, number>>;
  order?: 'fixed' | 'tiered-shuffle'; // default 'tiered-shuffle'; game sets use 'fixed'
}
export interface PlaygroundEntry {
  id: string; title: BandText; icon: KidsIconName; activity: string; item: unknown;
  bands?: AgeBand[]; unlock?: { node?: string; stars?: number }; friend?: boolean;
}
export interface KidsPack {
  id: 'core' | 'movement' | 'minigames' | 'rules' | 'buddies' | 'tactics';
  activities: ActivityDef<any>[]; levelSets: LevelSet<any>[]; playground?: PlaygroundEntry[];
}
```

**`resolveItem(item, band, opts: { super?: boolean; ease?: number })`** (in `curriculum/tuning.ts`) returns a shallow merge of `item`, then `item.tune?.[band]`, then `superTune` (if `super`), then `item.ease[0..ease-1]` applied in order. `validate` runs on the resolved item for every band the item is visible to, at every ease step.

**Run rules** (`player/run.ts`):
- `visible` = the items whose `bands` include the band. `n` = `perRun[band] ?? tuning.itemsPerRun`, clamped to `visible.length`.
- `'fixed'`: the first n items in order. The w1-hello Sprout set and all intro-first sets use this.
- `'tiered-shuffle'`: pick from the current tier using `mulberry32(hashSeed(kid.id, nodeId, plays))`, preferring ids not in `lastItems`; tiers adapt (3.3).
- **Game sets** (`game: true`, `order: 'fixed'`, one item per run): the run plays the first item not in `NodeProgress.won`, else the last item.
- The node score is `max(1, round(mean))`. A game node's score is its single result.
- Warm-up: 1 item per due node (5.6). Placement: the 3 checkpoint items, in order.

### 11.4 Data model (`src/kids/store/kidsStore.ts`, key `'tempo.kids.v1'`)
It uses the same `useSyncExternalStore` / subscribe / update pattern as `src/store/profile.ts`, with `normalizeKids()` on load and import, and `dayKey()` from `src/lib/srs.ts`.

```ts
export interface KidsState {
  v: 1; activeKid: string | null; kids: KidProfile[];
  family: { stars: number; parties: number };
  device: { pinSalt?: string; pinHash?: string; voiceURI?: string };
  updatedAt: number;
}
export interface KidProfile {
  id: string; name: string;                       // nickname allowed; max 12 chars
  avatar: { color: AvatarColor; face: FaceId; hat: HatId | null };
  band: AgeBand; start: 'new' | 'moves' | 'games'; created: number;
  nodes: Record<string, NodeProgress>;
  stickers: Record<string, number>;               // id -> first time (ms)
  trophies: Record<string, number>;
  wardrobe: HatId[];                              // unlocked hats (colors/faces are always free)
  puzzle: { rating: number; attempts: number; seen: string[] /* ring buffer, max 300 */; streak: number; bestStreak: number; dailyDone?: string };
  bots: Partial<Record<BuddyId, { w: number; d: number; l: number }>>;
  bests: Record<string, number>;
  days: Record<string, { minutes: number; stars: number }>;   // pruned to the last 60 day keys on save
  garden: number;                                 // total play days (flowers)
  firsts: string[];                               // voice 'first' lines already auto-spoken (ids), max 400
  settings: KidSettings;
  scene?: { id: string; x: number; y: number }[]; // sticker scene (later framework step)
  graduated?: { t: number; form: 'queen' | 'king' };
}
export interface NodeProgress {
  stars: 0 | 1 | 2 | 3; golden?: boolean; plays: number; last: number;
  box: 1 | 2 | 3 | 4 | 5; due: string;            // dayKey
  tested?: boolean; skipped?: boolean;
  masteredDays: string[];                         // max 2 distinct day keys with >=2 stars
  lastItems: string[];                            // last 6 item ids played (warm-up variety)
  won?: string[];                                 // game sets: item ids won
  losses: number;                                 // consecutive game losses (reset on win)
  ease: number;                                   // current ease step for game nodes
  attemptsBelowPass?: number;                     // non-game boss attempts below the pass mark
  hintMax?: 0 | 1 | 2 | 3 | 4;                    // highest hint level at the last play (report "needed help with")
}
export interface KidSettings {
  voice: 'auto' | 'first' | 'off'; rate: number | null; sound: boolean;
  bedtime: 'off' | 'on' | 'system'; reducedMotion: 'system' | 'on';
  sessionMin: 0 | 10 | 15 | 20 | 30 | 45;
  takebacks: 'always' | 'three' | 'one' | 'off';
  dangerAlarm: boolean; oopsShield: boolean; threatLights: boolean;
  coordinates: boolean; hints: 'generous' | 'normal' | 'few';
  showDests: 'always' | 'until-mastered' | 'on-mistake';
  pieceSet: PieceSet | 'auto';                    // 'auto' = staunton3d if available, else cburnett
  tapOnly: boolean; leftHanded: boolean; unlockAll: boolean;
}
```
- Band defaults come from `BAND_TUNING` when a profile is created, and again whenever a grown-up changes the band (with a confirmation "Reset this kid's settings to the new age defaults?").
- At most 8 profiles.
- Every read and write is in try/catch, with an in-memory fallback.
- Every star gained adds the same amount to `family.stars`. Crossing a multiple of 100 increments `parties` and grants `st-family-<n>` to every kid.

### 11.5 KidsBoard (`src/kids/player/KidsBoard.tsx`)
It wraps `Board` and uses only public props, plus the one new optional prop `autoQueen` (section 14).

```ts
interface KidsBoardProps {
  fen: string;                                   // real FEN, or placementFen() for free-rule activities
  orientation?: 'white' | 'black';
  interactive?: boolean; playerColor?: 'w' | 'b';
  onMove?: (m: Move) => void;                    // chess.js activities
  freeMoves?: { dests: Record<Sq, Sq[]>; onMove: (from: Sq, to: Sq) => void };
  onSquareClick?: (sq: Sq) => void;
  lastMove?: [Sq, Sq] | null;
  area?: string;                                 // 'a1:d4' -> cloud art outside; outside squares filtered from dests and clicks
  art?: Partial<Record<Sq, ArtKey | ArtKey[]>>;  // declarative square art (7.4)
  tones?: Partial<Record<Sq, SquareTone>>;
  arrows?: Arrow[];
  wobble?: Sq | null;                            // shake this square's piece (300 ms)
  showDests?: boolean;                           // draw kid dots for the auto-selected/keyboard-selected piece
  promotion?: 'auto' | 'picker';                 // chess.js activities only; default from tuning
  label?: string;                                // aria-label for the wrapper
}
```
Behavior:
- It always renders `<Board drawable={false} boardTheme="tourney" pieceSet={resolvedPieceSet} coordinates={band coords || kid setting} autoQueen={true} .../>`, wrapped in `<div class="kids-board [tap-only]">`.
- It merges the art layers: activity `art`, the hint step's `art`, auto-dots, the area clouds, and `check`/`danger` glyphs for tones. The merge becomes one `squareContent` map, rendered with `<SquareArt>`.
- **Bounce-back helper**: `useBounce()` returns `bounce(beforeFen, afterFen, move)`. It sets the FEN to after with `lastMove=[from, to]`, then after 450 ms sets the FEN back to before with `lastMove=[to, from]`, and plays `boop` plus a wobble.
- **Promotion**: Board always auto-queens here. If `promotion === 'picker'` and the move is a promotion, KidsBoard holds the move, shows KidsPromoPicker, then rebuilds the `Move` with the chosen piece (`new Chess(fenBefore).move({from, to, promotion})`) and calls `onMove`. **Free-rule activities never reach Board's promotion path.** `freeMoves` has no promotion; their pawns auto-queen in `miniRules.applyMove`.
- Area: dests outside the area are removed before they are passed to Board, and `onSquareClick` ignores outside squares.
- Auto-select of a lone piece and the keyboard cursor: section 10.2.
- Kids-size dots: when `showDests` is on and the kid has a selected piece (tracked through `onSquareClick` on its own piece square and cleared when the FEN changes), KidsBoard adds `dot` art on its targets. Board's own `.dest` spans are restyled to the same 36% size.

### 11.6 Pieces fallback (`lib/pieceProbe.ts`)
`hasPieceSet('staunton3d')` checks once and memoizes. It mounts two hidden `.board.pieces-<set>` wrappers, each with a `.piece.pc-wK` child, and compares the computed `background-image` of the two. If they are equal, or the 3D one is `none`, the set is unavailable. When the kid's setting is `'auto'`, KidsBoard uses `staunton3d` if it is available, else `cburnett`. This covers the case where the pieces team has not landed yet, or lands later.

### 11.7 Routing (inside `#/kids`)
It uses the existing `navigate()`, `useRoute()` and `routeParts()`. Routes:
- `kids` (picker, or map if the device is locked and a kid is active)
- `kids/new`, `kids/placement`, `kids/map`
- `kids/world/w3`
- `kids/play/w3-queen-stars`, `kids/warmup`
- `kids/playground`, `kids/playground/pawn-war-8`
- `kids/stickers`, `kids/stickers/trophies`, `kids/stickers/wardrobe`, `kids/stickers/scene`
- `kids/grownups`, `kids/grownups/<kidId>`
- `kids/graduate`, `kids/certificate/<kidId>`

Rules:
- With no active kid, any route except `kids` and `kids/new` redirects to `kids`.
- Browser back works. A screen's own close or back button steps back through the history when the entry before it is the screen it goes to, and otherwise replaces its own entry, so Back never reopens an activity the kid just left. Results Next, "Try the boss!" and "Practice first" replace the activity's entry, and asking for the screen already showing adds nothing.
- The player guards leaving only mid-item.
- `speech.cancel()` runs on every route change.

---

## 12. Shared libraries (framework-owned; packs use them read-only)

### 12.1 `lib/miniRules.ts` (pure; unit-tested)
```ts
sqRange(area: string): Set<Sq>                                   // 'a1:d4' inclusive rectangle
placementFen(p: Placement, turn: 'w' | 'b' = 'w'): string        // {a1:'R'} -> '8/8/8/8/8/8/8/R7 w - - 0 1'
attacks(piece: PieceCode, from: Sq, occupied: Set<Sq>): Sq[]     // sliders stop at the first occupied square (included);
                                                                  // lowercase 'p' attacks downward
lavaSquares(statues: Placement, occupied: Set<Sq>): Set<Sq>
dests(piece: PieceCode, from: Sq, o: { blocked: Set<Sq>; capturable?: Set<Sq>; area?: Set<Sq>;
      mustCapture?: boolean; epSquare?: Sq }): Sq[]
  // R/B/Q slide until blocked (not included) or capturable (included, then stop); outside area = blocked
  // N and K step; N ignores blockers in between; P: 1 forward if empty, 2 from its start rank if both empty,
  // diagonal forward only onto capturable (or epSquare); forward squares must not be capturable
applyMove(p: Placement, from: Sq, to: Sq): Placement             // moves, captures, pawn on last rank -> queen (auto)
starPar(item: StarItem): number                                  // BFS over (placement, collected mask); -1 if unsolvable;
                                                                 // statue lava recomputed per state; up to 10 stars
gobbleSolutions(item: GobbleItem, limit = 50): Sq[][]            // DFS; each move must capture; bite: guarded targets not allowed
pseudoMoves(p: Placement, color: 'w' | 'b', o?: { epSquare?: Sq; pawnsOnly?: boolean }): { from: Sq; to: Sq; capture?: PieceCode }[]
```
The reference implementation used to verify this spec's levels is in the scratchpad (`verify/mini.mjs`). Port it to TypeScript.

### 12.2 `lib/danger.ts` (static exchange check; exact logic)
Values: P=1, N=3, B=3, R=5, Q=9. The king is never "hanging".
```ts
export function pieceLoss(chess: Chess, sq: Sq): number
//  chess: position with the OPPONENT to move; sq holds one of our pieces.
//  caps = chess.moves({verbose:true}).filter(m => m.to === sq)       // legal only: respects pins and check
//  if caps is empty -> 0
//  cheapest = the cap with the lowest value of m.piece (king = 100; a legal king capture means sq is undefended)
//  play cheapest; defended = our legal moves include one with to === sq; undo
//  return defended ? max(0, V[ours] - V[cheapest.piece]) : V[ours]
export function hangs(fen: string, color: 'w' | 'b'): { sq: Sq; piece: PieceCode; loss: number }[]
//  uses withTurn(fen, other(color)) when needed; returns pieces with loss > 0, highest first
export function dangerAfterMove(fenBefore: string, move: Move, threshold: number): { sq: Sq; piece: PieceCode; loss: number; attacker: Sq } | null
//  after = the position after move (opponent to move)
//  if after is checkmate -> null
//  gain = V[move.captured] ?? 0, plus 8 if the move promotes to a queen
//  worst = hangs(after, mover)[0]
//  alarm if worst && worst.loss - gain >= threshold
//  returns ONLY the single worst piece: at most one alarm per move
```
- Thresholds: Sprout and Explorer 3 (pieces, not pawns). Champion 2.
- Exclusions are built in:
  - Equal trades: NxN leaves our knight en prise, but loss 3 minus gain 3 is 0, so there is no alarm.
  - Checks: the opponent's legal replies already account for check.
  - Mates: excluded explicitly.
- UI rule: after "Keep it", no alarm until the kid's next move.
- **Oops shield** (Champion option, Pack D): if `engine.status === 'ready'`, run `engine.search(before, {depth: 8})` and `engine.search(after, {depth: 8})`. Alarm if the kid's point-of-view score drops by 250 cp or more. If the engine is not ready, or the search is cancelled or takes more than 1.5 s, use the static rule above.
- **Threat lights**: `hangs(fenWithOpponentToMove, kidColor)` gives the `danger` art on each square.
- `find-move` goal `no-hang` passes if `dangerAfterMove(before, move, 3)` is null.

### 12.3 Engine use and fallbacks
The engine is the existing `engine.search(fen, opts)` (`src/engine/engine.ts`). It falls back to the bundled JS backup worker automatically. `engine.status === 'failed'` means neither can run.

| use | engine call | when the engine is unavailable or the call rejects or returns null |
|---|---|---|
| Buddy Bruno (C, optional) | `{skill: 0, depth: 3, multipv: 3}`, then pick randomly among lines within 150 cp of the best | Olive (JS), with Pip: "Bruno is napping, Olive will play instead." |
| Buddy Ember (C, optional, Playground only) | `{skill: 3, depth: 6}` | Olive (JS), with the same message |
| Play-bot hints | `{depth: 10}`, best move as a green arrow | the `kidBot` Olive search's best move |
| Oops shield | `{depth: 8}` twice | static `dangerAfterMove` |
| Mate-drill defense | `{depth: 12}` | JS defender (13.12) |
| Anything else | none; buddies 1-5, Pawn Wars and Capture the Crown are pure JS, so early games never load WASM | n/a |

Never use `elo` (Stockfish's minimum is 1320, far too strong). Searches are cancelled with `engine.cancelAll()` on unmount. Ember at Elo 1320 from P1 is removed.

### 12.4 Other libs
- `lib/rng.ts`: `mulberry32(seed)`, `hashSeed(...parts: (string | number)[])` (FNV-1a), `pick`, `shuffle`.
- `lib/fen.ts`: `placementFen`, `fenPlacement(fen) -> Placement`, `withTurn(fen, c)` (also clears the en passant square).
- `lib/pronounce.ts`: 10.1.

---
## 13. Activities: exact rules, data, scoring, validation, level data

Every activity registers an `ActivityDef` with a **mandatory `validate()`**. Unless an activity says otherwise, item scoring follows 3.3 (0 mistakes and hint level 1 or less = 3; 2 or fewer mistakes, or hint level 2 = 2; else 1).

Notation used in this section: `{a1:'R'}` is a `Placement` (uppercase = the kid's white pieces, lowercase = black). "par" values were computed with the BFS in 12.1.

### 13.1 STARS: "Star Collector" (`stars`, framework flagship, freeMoves)
**Data**
```ts
interface StarItem {
  pieces: Placement;             // white pieces only (1-3)
  stars: Sq[];                   // 1-10
  rocks?: Sq[];                  // block landing and sliding; the knight jumps over
  statues?: Placement;           // sleeping black pieces; block like rocks; their attacked squares are LAVA
  area?: string;                 // play area (usually via tune.sprout)
  par: number;                   // must equal starPar() for every band after resolveItem (validate)
}
```
**Rules**
- The kid moves any white piece by its own rules (`miniRules.dests`, with `blocked` = rocks + statues + other white pieces, and `area`).
- Landing on a star collects it. Passing over a star does not.
- A pawn uses the double step from rank 2, never captures (there is nothing to capture here), and turns into a queen on rank 8 with a `sparkle` sound and the `promotion` celebration. It then keeps collecting.
- **Lava**: a move that lands on a statue-attacked square wakes the statue (`statue-eyes` pop plus a playful chomp). The piece bounces back to its previous square and it counts as a mistake. Lava is recomputed after every move, because white pieces can block statue lines.
- Lava visibility follows `lavaVisible`: always for Sprouts; for others, only after the first lava mistake in the item, and then it stays visible.
- A tap on an unreachable square gives a wobble plus `boop` but is **not** a mistake. After the 2nd such tap, the dots show for 2 s.
- The item finishes when every star is collected. There is no losing and no move limit.

**Scoring**: `moves <= par + parSlack` = 3; `moves <= par + 2 + parSlack` = 2; otherwise 1. The result is then capped by the standard mistake and hint score (lava bumps are mistakes). **Golden**: `moves === par`, 0 mistakes, no hint.

**UI**
- Par is shown as footprints in the top bar (Explorer and Champion): N outline prints that fill as the kid moves. Sprouts see only the star counter.
- Stars fly to the counter and the `pop` pitch climbs per star.
- On the last star, Pip hops.
- Auto-select a lone piece (10.2).

**Hints**
1. The rule line ("Rooks go in straight lines").
2. `hint` tone on the piece that starts an optimal route.
3. An arrow for the first optimal move (from the BFS path).
4. Watch Pip plays the whole optimal route, then resets.

**validate**: squares valid; no star, rock, statue or piece overlaps; no star or piece start on lava; everything inside the area; `par === starPar(resolved) >= 1`; `stars.length <= 10`.

**review()**: a random piece from {R, B, Q, K, N}, 3-5 stars reachable from the start (Sprouts: 2-3 inside area `a1:e5`), and 0-4 rocks; par comes from BFS. It retries until validate passes (at most 50 tries, then a fixed fallback item). The Playground's "Star Hunt Endless" uses it.

**Intro example (`w1-hello`)**
```ts
intro: [
  { say: { all: "I'm Pip! This is the rook. It zooms in straight lines, like a train!", champion: "This is the rook. It moves in straight lines." },
    pieces: { a1: 'R' }, arrows: [{ from: 'a1', to: 'a8' }, { from: 'a1', to: 'h1' }] },
  { say: "Watch me!", pieces: { a1: 'R' }, art: { a4: 'star' }, move: ['a1', 'a4'] },
  { say: "Your turn!" },
]
```

**Piece Parade intros.** The first node of each piece world has a Watch Pip intro of at most 3 speech steps plus one `pick` step ("Which one is the bishop?"; 3 real piece sprites, 96px), all under 30 s. Those nodes are w1-hello (rook), w2-bishop-stars, w3-queen-stars, w3-king-stars, w4-knight-hops and w5-pawn-steps. In w1-hello the `pick` step comes AFTER item h1, so the very first action is still a move.

**Level sets (content/core.ts)**. `S` marks `bands: ['sprout']` items, and `tune.sprout` is written inline. Unmarked items are all bands.

`w1-hello` (order `'fixed'`, perRun S4, E5, C4)
| id | item | par |
|---|---|---|
| h1 | `{pieces:{a1:'R'}, stars:['a3'], tune:{sprout:{area:'a1:d4'}}}` | 1 |
| h2 | `{pieces:{a1:'R'}, stars:['c1'], tune:{sprout:{area:'a1:d4'}}}` | 1 |
| h3 | `{pieces:{b2:'R'}, stars:['b4','d4'], tune:{sprout:{area:'a1:d4'}}}` | 2 |
| h4 | `{pieces:{a1:'R'}, stars:['a4','d4','d1'], tune:{sprout:{area:'a1:d4'}}}` | 3 |
| h5 | `{pieces:{a1:'R'}, stars:['a8'], tier:2}` "Zoom all the way!" | 1 |
| h6 | `{pieces:{a1:'R'}, stars:['a8','h8'], tier:2}` | 2 |

`w1-rook-stars`
| id | item | par |
|---|---|---|
| r1 S | `{pieces:{b2:'R'}, rocks:['b3','c2'], stars:['d4'], area:'a1:e5'}` | 3 |
| r2 S | `{pieces:{c1:'R'}, rocks:['c3','b1','d1'], stars:['a4','e4'], area:'a1:e5', tier:2}` | 4 |
| r3 | `{pieces:{d4:'R'}, stars:['d8','h8','h1','a1']}` | 4 |
| r4 | `{pieces:{a1:'R'}, rocks:['a4','d1'], stars:['a8']}` "Rooks can't jump!" | 3 |
| r5 | `{pieces:{e4:'R'}, rocks:['e6'], stars:['e7','b7','b2'], tier:2}` | 4 |
| r6 | `{pieces:{h1:'R'}, rocks:['h5','e1','e3'], stars:['a8'], tier:2}` | 3 |
| r7 | `{pieces:{a1:'R'}, rocks:['e1','c6'], stars:['h1','h8','c8','c3'], tier:3, bands:['explorer','champion']}` | 6 |

`w1-boss` (Rook Maze)
| id | item | par |
|---|---|---|
| b1 S | `{pieces:{a1:'R'}, rocks:['b2','c3','d1'], stars:['a4','d4','e2'], area:'a1:e5'}` | 4 |
| b2 | `{pieces:{a1:'R'}, rocks:['a5','b3','c3','d6','f2'], stars:['a4','d4','d8','h8'], tier:2}` | 5 |
| b3 | `{pieces:{a1:'R'}, rocks:['a3','c1','c4','f5','g2'], stars:['b3','h3','h8','a8'], tier:2}` | 5 |
| b4 | `{pieces:{e1:'R'}, rocks:['e3','b1','h4','b6'], stars:['a2','h2','h8','a8','e5'], tier:3, bands:['explorer','champion']}` | 7 |

`w2-bishop-stars`
| id | item | par |
|---|---|---|
| s1 S | `{pieces:{c1:'B'}, stars:['a3'], area:'a1:d4'}` | 1 |
| s2 S | `{pieces:{c1:'B'}, stars:['b2','d2'], area:'a1:d4'}` | 3 |
| s3 | `{pieces:{c1:'B'}, stars:['f4']}` | 1 |
| s4 | `{pieces:{c1:'B'}, stars:['e3','g5','d8']}` | 3 |
| s5 | `{pieces:{f1:'B'}, stars:['h3','c8','a6'], tier:2}` | 3 |
| s6 | `{pieces:{c1:'B'}, rocks:['e3'], stars:['f4','h6','d2'], tier:2}` | 5 |
| s7 | `{pieces:{f1:'B'}, rocks:['d3'], stars:['h1','a6'], tier:3}` | 4 |

`w2-boss` (Two Friends; the kid taps the piece they want to move)
| id | item | par |
|---|---|---|
| b1 S | `{pieces:{a1:'R', c1:'B'}, stars:['a4','b2','d2'], area:'a1:d4'}` | 4 |
| b2 | `{pieces:{a1:'R', f1:'B'}, stars:['a8','h3','c4']}` | 4 |
| b3 | `{pieces:{a1:'R', c1:'B'}, rocks:['a5','d2'], stars:['a4','g5','h8','e3'], tier:2}` | 6 |

`w3-queen-stars`
| id | item | par |
|---|---|---|
| q1 S | `{pieces:{a1:'Q'}, stars:['d4','a4'], area:'a1:d4'}` | 2 |
| q2 | `{pieces:{d1:'Q'}, stars:['d7','a4','h4']}` | 3 |
| q3 | `{pieces:{d1:'Q'}, rocks:['d4','e2','c2'], stars:['d8','h5','a8'], tier:2}` | 5 |
| q4 | `{pieces:{d1:'Q'}, rocks:['d4'], stars:['d8','a5','h5','h1','a1'], tier:2}` | 5 |
| q5 | `{pieces:{h1:'Q'}, rocks:['g2','h4','e1'], stars:['a8','b1'], tier:3}` | 5 |

`w3-king-stars`
| id | item | par |
|---|---|---|
| k1 S | `{pieces:{b1:'K'}, stars:['b2','c3'], area:'a1:d4'}` | 2 |
| k2 | `{pieces:{e1:'K'}, stars:['e2','e3','f4']}` | 3 |
| k3 | `{pieces:{e1:'K'}, stars:['e2','f3','g2']}` | 3 |
| k4 | `{pieces:{a1:'K'}, rocks:['b2','b1','a3','c3'], stars:['a4'], tier:2}` | 3 |
| k5 | `{pieces:{e1:'K'}, stars:['e8'], tier:2}` "The king walks slowly!" | 7 |

`w3-king-lava` (statues)
| id | item | par |
|---|---|---|
| l1 S | `{pieces:{a1:'K'}, statues:{c3:'n'}, stars:['a3'], area:'a1:d4'}` | 2 |
| l2 | `{pieces:{e1:'K'}, statues:{e5:'n'}, stars:['e8']}` | 7 |
| l3 | `{pieces:{e1:'K'}, statues:{d5:'b'}, stars:['e8'], tier:2}` | 7 |
| l4 | `{pieces:{a1:'K'}, statues:{c3:'n', e6:'b'}, stars:['h8'], tier:3, bands:['explorer','champion']}` | 8 |

`w3-boss` (Royal Garden)
| id | item | par |
|---|---|---|
| b1 S | `{pieces:{a1:'Q'}, statues:{c3:'n'}, stars:['d4','b4'], area:'a1:d4'}` | 3 |
| b2 | `{pieces:{d1:'Q'}, statues:{f6:'n'}, stars:['d8','h4']}` | 3 |
| b3 | `{pieces:{e1:'K'}, statues:{c4:'b', f5:'n'}, stars:['e8'], tier:2}` | 7 |
| b4 | `{pieces:{d1:'Q'}, rocks:['d3'], statues:{f5:'r'}, stars:['d8','h1','a4'], tier:2}` | 5 |

`w4-knight-hops`
| id | item | par |
|---|---|---|
| n1 S | `{pieces:{b1:'N'}, stars:['c3'], area:'a1:d4'}` | 1 |
| n2 S | `{pieces:{b1:'N'}, stars:['a3','d2'], area:'a1:d4'}` | 3 |
| n3 | `{pieces:{b1:'N'}, stars:['c3','e4','f6']}` | 3 |
| n4 | `{pieces:{g1:'N'}, stars:['g3']}` "The knight can't go straight!" | 2 |
| n5 | `{pieces:{b1:'N'}, stars:['c3','e4','g5'], tier:2}` | 3 |
| n6 | `{pieces:{a1:'N'}, stars:['b1'], tier:2}` "Right next door takes 3 hops!" | 3 |
| n7 | `{pieces:{a1:'N'}, stars:['b2'], tier:3}` | 4 |

`w4-knight-jump`
| id | item | par |
|---|---|---|
| j1 | `{pieces:{b1:'N'}, rocks:['a1','a2','b2','c2','c1'], stars:['c3','e2']}` "Knights jump over!" | 2 |
| j2 | `{pieces:{g1:'N'}, rocks:['f1','h1','f2','g2','h2'], stars:['f3','h3']}` | 3 |
| j3 | `{pieces:{d4:'N'}, rocks:['c4','e4','d3','d5','c3','e3','c5','e5'], stars:['e6','b3','f2'], tier:2}` | 6 |

`w4-boss` (Knight Trek)
| id | item | par |
|---|---|---|
| b1 S | `{pieces:{b1:'N'}, stars:['c3','d5'], area:'a1:d6'}` | 2 |
| b2 | `{pieces:{b1:'N'}, stars:['c3','e4','g5','h7']}` | 4 |
| b3 | `{pieces:{b1:'N'}, rocks:['c3','d2'], stars:['e4','g5','f7'], tier:2}` | 6 |
| b4 | `{pieces:{a1:'N'}, stars:['h8'], tier:3, bands:['champion']}`; awards `st-knight-trek` on completion; best key `trek-a1h8` | 6 |

`w5-pawn-steps`
| id | item | par |
|---|---|---|
| p1 | `{pieces:{e2:'P'}, stars:['e4']}` "On its first move a pawn may take two steps!" | 1 |
| p2 | `{pieces:{e2:'P'}, stars:['e3','e5']}` | 3 |
| p3 | `{pieces:{d2:'P'}, stars:['d4','d6']}` | 3 |
| p4 | `{pieces:{a2:'P', h2:'P'}, stars:['a4','h4'], tier:2}` | 2 |

`w5-promo`
| id | item | par |
|---|---|---|
| m1 | `{pieces:{b7:'P'}, stars:['b8','h2']}` (promote, then the queen flies b8 to h2) | 2 |
| m2 | `{pieces:{e6:'P'}, stars:['e8','a4']}` | 3 |
| m3 | `{pieces:{g5:'P'}, stars:['g8','a2'], tier:2}` | 4 |
The first promotion awards `st-promotion`.

`w6-lava`
| id | item | par |
|---|---|---|
| v1 | `{pieces:{a1:'R'}, statues:{c5:'b'}, stars:['h8']}` | 2 |
| v2 | `{pieces:{d1:'Q'}, statues:{f6:'n'}, stars:['d8','h4']}` (without the knight, par would be 2) | 3 |
| v3 | `{pieces:{b1:'N'}, statues:{d8:'r'}, stars:['e5']}` (d2 and the d-file are lava) | 3 |
| v4 | `{pieces:{c1:'B'}, statues:{f6:'p', b6:'n'}, stars:['h6','a3'], tier:2}` | 3 |
| v5 | `{pieces:{h1:'R'}, statues:{d4:'q'}, stars:['a8'], tier:2}` | 3 |
| v6 | `{pieces:{e1:'K'}, statues:{e5:'n'}, stars:['e8'], tier:2}` (the direct setup for check) | 7 |

**Checkpoints cp1-cp5** (`content/checkpoints.ts`, activity `stars`, no tune, `order: 'fixed'`, all bands)
- cp1: `{d4:'R'} stars [d8,h8,h1,a1]` par 4; `{a1:'R'} rocks [a4,d1] stars [a8]` par 3; `{e4:'R'} rocks [e6] stars [e7,b7,b2]` par 4
- cp2: `{c1:'B'} [e3,g5,d8]` par 3; `{f1:'B'} [h3,c8,a6]` par 3; `{c1:'B'} rocks [e3] [f4,h6,d2]` par 5
- cp3: `{d1:'Q'} rocks [d4,e2,c2] [d8,h5,a8]` par 5; `{e1:'K'} [e2,f3,g2]` par 3; `{e1:'K'} statues {e5:'n'} [e8]` par 7
- cp4: `{b1:'N'} [c3,e4,f6]` par 3; `{g1:'N'} [g3]` par 2; `{b1:'N'} rocks [a1,a2,b2,c2,c1] [c3,e2]` par 2
- cp5: `{e2:'P'} [e4]` par 1; `{b7:'P'} [b8,h2]` par 2; `{d2:'P'} [d4,d6]` par 3

### 13.2 FIND THE MOVE (`find-move`, framework flagship, chess.js)
**Data**
```ts
type Goal =
  | { kind: 'check' }
  | { kind: 'mate' }                                          // any mating move
  | { kind: 'capture'; square?: Sq }                          // any capture (on square if given)
  | { kind: 'safe-capture'; square?: Sq }                     // capture with gain - dangerLoss(capturer) > 0
  | { kind: 'protect'; square: Sq }                           // piece on square stays and chess.isAttacked(square, us)
  | { kind: 'escape'; ways: ('run' | 'block' | 'capture')[] | 'any' }
  | { kind: 'flag'; flag: 'k' | 'q' | 'e' | 'p' }             // O-O, O-O-O, en passant, promotion
  | { kind: 'line'; uci: string[] }                           // kid moves must match; replies auto-play; a final mate step accepts any mate
  | { kind: 'no-hang' };                                      // dangerAfterMove(before, move, 3) === null
interface FindMoveItem {
  fen: string; goal: Goal; lastMove?: [Sq, Sq]; hints?: HintStep[];
  replay?: { fen: string; uci: string };   // shown first: position `replay.fen`, then `uci` animates; the result must equal `fen`
}
```
**Flow**
- The board is interactive for the side to move (`playerColor` = turn).
- If `replay` is set, that move animates first. It is used for en passant ("Black's pawn just jumped two steps!").
- **Any** move that meets the goal counts, which teaches that there can be several right answers.
- A correct move gives tone `good` on the destination, `celebrate('small')`, and the matching sound. Mate gives `celebrate('checkmate')` and awards `st-first-mate`; check awards `st-first-check`; a flag goal awards the matching moment sticker.
- A wrong move gives the bounce-back (11.5) and a mistake with a goal-specific line:
  - check: "That's not check yet. Which piece can attack the king?"
  - mate: after a check that is not mate, "Check! But the king can escape!", with the escape square in tone `hint`. After a stalemating move, "Oops, the king has no moves but isn't in check. That's a tie!"
  - safe-capture: after a bad capture, the recapture plays out first, then everything rewinds, and Pip says "The pawn was guarding it!".
- `escape` with a list of ways: each way found lights its badge in the Tray (Run / Block / Capture, each an icon plus a word). The board resets between ways. A move of an already-found way gets "You found that way! Try another one." (not a mistake). `'any'` finishes after one escape.
- Move classification for escape:
  - king move without a capture: `run`
  - capture of the checking piece, by any piece including the king: `capture`
  - anything else: `block`

**Hints**
1. The rule line.
2. `hint` tone on a piece that has a solution move.
3. An arrow for one solution.
4. Watch Pip plays it and resets.

**validate**
- The FEN loads in chess.js and is not game over.
- At least 1 solution move exists for the goal.
- For check, mate, capture, safe-capture, protect, flag and no-hang, **not every** legal move is a solution.
- Protect: the side to move is not in check, and the target is attacked and undefended at the start (`isAttacked(sq, them) && !isAttacked(sq, us)`).
- Escape: the side to move is in check, and every listed way exists.
- Line: every UCI move is legal in sequence, and the last kid step meets its goal.
- Sprout-visible `say` text contains no square names (10.1).

**Level sets (content/core.ts)** (every FEN below was verified with chess.js; solution lists are complete)

`w6-free-lunch`
| id | fen | goal | solutions / notes | bands, tier |
|---|---|---|---|---|
| f1 | `4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1` | capture d5 | Rxd5 | all, 1 |
| f2 | `4k3/8/8/8/8/2n5/8/2R1K3 w - - 0 1` | capture c3 | Rxc3 | all, 1 |
| f3 | `4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1` | capture d4 | exd4 ("pawns eat slanty!") | all, 1 |
| f4 | `4k3/8/8/8/3b4/8/2N5/4K3 w - - 0 1` | capture d4 | Nxd4 | all, 2 |
| f5 | `4k3/8/8/1r6/8/8/4B3/4K3 w - - 0 1` | capture b5 | Bxb5+ | all, 2 |
| f6 | `4k3/8/8/8/6r1/8/8/3QK3 w - - 0 1` | capture g4 | Qxg4 | all, 2 |
| f7 | `4k3/8/p7/1n6/8/1R3b2/8/4K3 w - - 0 1` | safe-capture | Rxf3 is safe; Rxb5 is met by axb5 | E C, 3 |

`w6-boss` (Snack Attack): f5, f6, f7 (E C) from above, plus:
| id | fen | goal | notes | bands |
|---|---|---|---|---|
| s1 | `4k3/8/8/8/1b6/2N5/8/R3K3 w - - 0 1` | protect c3 | Ra3, Rc1, Kd2 (the knight is attacked and pinned) | E C |
| s2 | `4k3/8/2n5/8/3R4/8/8/4K1N1 w - - 0 1` | protect d4 | Ne2, Nf3 (the rook on d4 is attacked by the knight and undefended) | E C |
| s3 | `4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1` | capture d4 | exd4 | S |
| s4 | `4k3/8/8/8/8/2n5/8/2R1K3 w - - 0 1` | capture c3 | Rxc3 | S |
| s5 | `4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1` | capture d5 | Rxd5 | S |

`w7-check`
| id | fen | solutions | bands, tier |
|---|---|---|---|
| c1 | `4k3/8/8/8/8/8/8/R3K3 w - - 0 1` | Ra8+ only | all, 1 |
| c2 | `4k3/8/8/8/8/8/8/4K2R w - - 0 1` | Rh8+ only | all, 1 |
| c3 | `4k3/8/5P2/8/8/8/8/4K3 w - - 0 1` | f7+ only | all, 1 |
| c4 | `4k3/8/8/8/4N3/8/8/4K3 w - - 0 1` | Nd6+, Nf6+ | all, 2 |
| c5 | `4k3/8/8/8/8/8/8/3QK3 w - - 0 1` | Qa4+, Qd7+, Qd8+, Qe2+, Qh5+ | all, 2 |
| c6 | `4k3/8/8/8/8/8/8/1B2K3 w - - 0 1` | Bg6+ only | E C, 3 |

`w7-mate1`
| id | fen | solutions | bands, tier |
|---|---|---|---|
| m1 | `k7/2Q5/2K5/8/8/8/8/8 w - - 0 1` | Qb7# ("the Queen's kiss") | all, 1 |
| m2 | `k7/8/1K6/8/8/8/8/6Q1 w - - 0 1` | Qg8# (the old `.../7Q` position had Black already in check) | all, 1 |
| m3 | `7k/8/6K1/8/8/8/8/1Q6 w - - 0 1` | Qb8# (the old `.../Q7` position had Black already in check) | all, 2 |
| m4 | `6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1` | Ra8# (back rank) | all, 2 |
| m5 | `k7/7R/1K6/8/8/8/8/8 w - - 0 1` | Rh8# | E C, 2 |
| m6 | `1k6/7R/8/8/8/8/8/6RK w - - 0 1` | Rg8# (ladder) | E C, 2 |
| m7 | `4k3/R7/8/4K3/8/8/8/1R6 w - - 0 1` | Rb8# | E C, 3 |
| m8 | `r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4` | Qxf7# | E C, 3 |
| m9 | `k7/2P5/1K6/8/8/8/8/8 w - - 0 1` | c8=Q#, c8=R# | E C, 3 |
| m10 | `6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1` | Nf7# (smothered) | C, 3 |
The Sprout run is m1, m2, m3, m4: queen and back-rank mates.

**Checkpoints cp6-cp8** (`find-move`, `order: 'fixed'`)
- cp6: f1 (capture d5); f7 (safe-capture); f3 (exd4).
- cp7: c1 (Ra8+); `4k3/8/8/8/4r3/8/2B5/R2QK3 w - - 0 1` with goal escape `'any'` (legal moves: Bxe4, Qe2, Kd2, Kf2, Kf1); m2 (mate).
- cp8: m4 (Ra8#); `q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1` with goal line `['b5c7','e8d7','c7a8']` (Nc7+ Kd7 Nxa8); m1 (Qb7#).

### 13.3 BOARD EXPLORER (`board-vision`, Pack A)
The board is non-interactive: `interactive={false}` plus `onSquareClick`. There is also a piece tray for setup. Every kind is scored on mistakes (standard).

| kind | data | rules |
|---|---|---|
| `tap-color` | `{kind, color: 'light' \| 'dark', count: 1-3}` | "Tap a light square" (S: Sun/Moon icons on the Tray explain). Each correct tap drops a `splat`. Only the explicit counts. |
| `tap-line` | `{kind, through: Sq, line: 'file' \| 'rank' \| 'diagonal'}` | "Light up the road!" The kid taps every square on the line (the `through` square is pre-lit). Sprouts get files and ranks only. It finishes when all are lit. |
| `name-piece` | `{kind, fen, ask: 'k' \| 'q' \| 'r' \| 'b' \| 'n' \| 'p', color?: 'w' \| 'b'}` | "Where is the knight? Tap it!" Any matching piece counts. The piece name is spoken, and the Tray shows the piece sprite as the question. |
| `find-square` | `{kind, squares: Sq[] \| 'random', rounds: number, fadeCoords?: boolean}` | "Find e4!" (spoken "e four"). The edges show treasure-map labels during rounds 1 to ceil(rounds/2), and they fade after that when `fadeCoords` is set. After a miss, the file and rank of the answer light up for 1.5 s. E and C only. |
| `setup` | `{kind, pieces: string, rank?: 1, colorHints?: boolean}` | Tap a piece in the tray, then tap its square. `'RNBQKBNR'` is the whole back row; Sprouts get `'R N B'` pairs first, then the full row with `colorHints`. `colorHints` draws a `ghost:<piece>` outline on each target square and Pip says "Queen on her own color!". No hint uses the words left or right. A wrong square bounces the piece back to the tray and counts as a mistake. |
| `dash` (Playground, C) | `{kind: 'find-square', rounds: 999, timer: 30}` | Coordinate Dash: 30 s, as many as possible, a miss costs nothing, best key `dash-30`. `tick` sound. Champions only. |

validate: squares valid; a `name-piece` FEN contains the asked piece; setup strings contain only the letters RNBQKP; `tap-line` has at least 3 squares.

Level sets (content/movement.ts):
- `w1-roads` (perRun 3): tap-line through `a1` file; `d4` rank; `h8` file; plus E/C `c1` diagonal.
- `w1-colors`: tap-color light x1; dark x3; light x2.
- `w2-treasure-map`: find-square rounds 5 of `['a1','h8','e4','d5','c3']` with `fadeCoords`; then rounds 8 random; perRun E2, C2.
- `w5-army`: name-piece over the start position, asking k, q, r, b, n, p (6 items; perRun S3, E5, C6).
- `w5-setup`: S `setup 'R R'` with colorHints, then `'RNBQKBNR'` with colorHints; E and C `'RNBQKBNR'`, then both sides (`pieces: 'RNBQKBNR/PPPPPPPP'`).

### 13.4 PAINT THE MOVES (`paint`, Pack A, P2 graft)
- Data: `{pieces: Placement /* exactly 1 white */, blockers?: Sq[] /* white friends */, enemies?: Placement}`.
- The kid taps every square the piece could move to (captures of enemies count; blockers and squares beyond them do not). A counter shows n/N.
- A correct tap gives a `splat` in a rotating color plus a rising note. A wrong tap gives a wobble, "Rook can't go there", and counts as a mistake. It finishes when all are painted.
- Score: 0 wrong = 3, 2 or fewer = 2, else 1.
- Sprouts first watch a demo in which the piece glides to each square.
- Verified answers:
  - `{d4:'R'}` gives 14 squares.
  - `{d4:'B'}, blockers [f6], enemies {b2:'p'}` gives 9: e5, e3, f2, g1, c5, b6, a7, c3, b2.
  - `{b1:'N'}` gives 3: c3, d2, a3 ("only 3!").
  - `{e2:'P'}, enemies {d3:'n', e3:'p'}` gives 1: d3 (the blocked pawn is the "aha").
  - `{d4:'N'}` gives 8. `{a1:'N'}` gives 2: b3, c2.
  - `{d1:'Q'}, blockers [d2,e2,c2]` gives 7 (rank 1 only).
  - `{e1:'K'}` gives 5.
  - `{c1:'B'}, blockers [b2]` gives 5.
  - `{h1:'R'}, blockers [h4], enemies {c1:'b'}` gives 7: g1, f1, e1, d1, c1, h2, h3.
- validate: exactly one white piece; N is at least 1 (computed with `miniRules.dests`).
- Sets: `w1-rook-paint` (d4 R; h1 R with blockers; a1 R with enemies), `w2-bishop-paint`, `w3-queen-paint`, `w4-knight-paint` (b1, d4, a1, g1). Each has 4-5 items, all built from the verified examples.

### 13.5 GOBBLE! (`gobble`, Pack A; owns `w5-pawn-slant` too)
- Data: `{pieces: Placement /* 1 white */, targets: Placement /* black, never move */, rocks?: Sq[], area?: string, bite?: boolean}`.
- **Rules**: EVERY move must be a capture, so only capture targets are offered as dests (`mustCapture`). Eat them all.
  - `bite: true`: a target that another remaining target guards may not be eaten. Tapping it is a mistake: the guard's eyes open, Pip says "The pawn is guarding it!", and the guard glows.
  - Stuck (no capture available and targets left): Pip says "Oh no, no snacks left to reach!" and a big Reset button appears in the Tray. There is no fail state.
- Score: 0 resets and 0 mistakes = 3; 2 or fewer resets = 2; else 1.
- Each capture gives `chomp`, a poof cloud, and the eaten piece dropping into the candy jar in the Tray with its value (P1/N3/B3/R5/Q9, with dots for Sprouts).
- validate: `gobbleSolutions(item).length >= 1`.
- Verified examples (solution count in brackets):
  - `{a1:'R'}` vs `{a5:'p', e5:'n', e8:'b'}` [1: a5, e5, e8]
  - `{a1:'R'}` vs `{a4,d4,d7,g7,g1}` pawns [2]
  - `{b1:'N'}` vs `{c3,d5,f6,e4}` [2]
  - `{b1:'N'}` vs `{c3,e4,g5,e6}` [1]
  - `{a1:'N'}` vs `{b3,d4,c6}` [1]
  - `{d1:'Q'}` vs `{d4,a7,g4,g7,b4}` [3, with dead ends]
  - `{d1:'Q'}` vs `{d4:'p', g7:'n', g2:'b', b2:'r'}` [4]
  - `{c1:'B'}` vs `{e3,g5,d8,a5}` [1]
  - `{c1:'B'}` vs `{e3,g5,d8}` [1]
  - Sprout areas: `{a1:'R'}` vs `{a3,c3}` in `a1:d4` [1]; `{c1:'B'}` vs `{b2,a3}` in `a1:d4` [1]
  - Pawns (`w5-pawn-slant`, "straight to walk, slanty to eat"): `{e2:'P'}` vs `{d3,e4,d5}` [1]; `{c2:'P'}` vs `{d3,e4,d5,c6,d7}` [1]; `{f2:'P'}` vs `{g3:'n', f4:'p', e5:'b', d6:'r'}` [1]; `{b2:'P'}` vs `{c3,b4,c5,d6,c7, b8:'n'}` [1] (the pawn captures on b8 and becomes a queen)
  - Bite (`w6-bite`): `{d1:'Q'}` vs `{c5:'p', h5:'p', d4:'p'}` [1: h5, c5, d4; d4 is guarded by c5]. The pack authors 5 more, each with at least 1 DFS solution.
- Sets: `w1-rook-gobble`, `w2-bishop-gobble`, `w3-queen-gobble`, `w4-knight-gobble`, `w5-pawn-slant`, `w6-bite` (4-6 items each).
- **Solo mode, "Last Piece Standing"** (P2 graft; Champion Playground tile, and an optional `superTune` for `w6-bite`):
  - Data: `{mode:'solo', pieces: Placement}` (all white).
  - Every move must capture one of your OWN pieces. Each piece may make at most 2 captures (a badge shows how many are left). A king may never be captured. Win when one piece is left.
  - validate: at least 1 DFS solution.
  - Verified: `{a1:'R', a5:'B', e5:'N'}` has 1 solution (Rxa5, Rxe5). `{d1:'K', a2:'R', c2:'B'}` has 1 (Rxc2, Kxc2). `{c1:'R', c5:'B', e3:'N', d4:'P', a3:'Q'}` has 17.
  - Counter-example: `{b2:'N', d3:'B', c4:'R', f6:'Q'}` has 0 solutions, so it must fail validate.

### 13.6 MAGIC MEMORY (`memory`, Pack A, Playground only, E and C; P2 graft)
- `rebuild` mode: `{pieces: Placement, showMs}`. The position shows for `showMs`, then a "magic cloak" sweeps it away. The kid rebuilds it with the tray (as in setup).
- `what-moved` mode: `{pieces, move: [from, to], showMs}`. The kid taps the piece that moved.
- Score: pieces placed correctly on the first try (100% = 3, 70% or more = 2, else 1).
- Items: E `{d4:'N', f6:'p'}` at 6000 ms, `{e1:'K', d8:'q', c3:'N', g7:'b'}` at 6000 ms. C: 6-8 pieces at 5000 ms.
- Playground tile "Magic Memory".

### 13.7 PAWN WARS and MINI BATTLES (`battle`, Pack B, freeMoves + `battle/miniBot.ts`, `game: true`)
- Data:
  ```ts
  { white: Placement; black: Placement;
    win: 'promote' | 'capture-all' | 'stop-pawns'; area?: string; enPassant?: boolean;
    bot: { depth: 1 | 2 | 3 | 4; r: number };   // r = randomness in pawn units
    kidColor?: 'w' | 'b' }
  ```
- **Rules**: pieces without kings, under normal movement (miniRules), with no check.
  - `promote`: the first pawn to reach the last rank wins (crown pop; the pawn turns into a queen for the celebration).
  - `capture-all`: capturing every enemy piece wins.
  - `stop-pawns`: the kid wins by capturing all black pawns and loses if a black pawn promotes.
  - If the side to move has no legal move: "Stuck! It's a tie" (draw).
  - En passant only when `enPassant` is set, and only for kids who finished `w7-en-passant` (for Sprouts it is never set).
  - Kid pawns never promote mid-game except as the win in `promote` games (the game ends).
- **miniBot**: alpha-beta over `pseudoMoves`, searching to `depth`.
  - Eval, from the bot's side: material (P1 N3 B3 R5 Q9) + 0.1 × Σ(pawn advancement²) (advancement 0-5) + 50 per passed pawn with a clear path + ±1000 for a won or lost game.
  - It picks uniformly at random among the moves within `r` of the best.
  - It shows a thinking bubble for 600-1200 ms.
- **Score**: win 3, draw 2, loss 1 plus a "Rematch!" button first. Boss rules: 5.3.
- validate: squares valid; both sides have at least 1 move; the bot depth is 1-4; if `area` is set, every piece is inside it; each ease step also validates.
- **Friend mode** (Playground entries with `friend: true`): pass-and-play. The second player picks their avatar (another kid profile or "Guest"). A banner shows whose turn it is ("Maya's turn") with that avatar pulsing. An optional per-turn board flip. An optional handicap: the stronger player removes 1-3 pawns or a piece. **Nothing is scored for either player**; both get `st-friend-game`.
- Level sets (content/minigames.ts):
  - `w5-pawn-war-mini` (fixed, 1 per run):
    - S `{white:{a2:'P',b2:'P',c2:'P'}, black:{a7:'p',b7:'p',c7:'p'}, area:'a1:c8', win:'promote', bot:{depth:1, r:1.0}}`
    - E `{... bot:{depth:1, r:0.3}}`
    - C `{... bot:{depth:2, r:0.2}}`
  - `w5-boss` (Pawn War):
    - S: the mini 3v3 above with `bot:{depth:1, r:1.0}`; ease `[{bot:{depth:1, r:3}}, {black:{a7:'p', b7:'p'}}]`.
    - E: 8v8 (a2-h2 vs a7-h7) `bot:{depth:2, r:0.3}`; ease `[{bot:{depth:1, r:0.5}}, {bot:{depth:1, r:3}}, {black:<a7..h7 minus a7 and h7>, bot:{depth:1, r:3}}]`.
    - C: 8v8 `bot:{depth:3, r:0.1}, enPassant:true`; ease `[{bot:{depth:2, r:0.3}}, {bot:{depth:1, r:0.5}}, {bot:{depth:1, r:3}}]`.
  - `w6-battles` (fixed):
    - Knight vs 3 pawns `{white:{g1:'N'}, black:{a7:'p',b7:'p',c7:'p'}, win:'stop-pawns', bot:{depth:2, r:0.3}}`
    - Queen vs 8 pawns (the Steps classic) `{white:{d1:'Q'}, black: pawns a7-h7, win:'capture-all', bot:{depth:2, r:0.2}}` (loss if a pawn promotes)
    - C: Rook vs 3 pawns `{white:{a1:'R'}, black:{f7:'p',g7:'p',h7:'p'}, win:'stop-pawns', bot:{depth:3, r:0.1}}`
- Playground: Pawn War 3v3, Pawn War 8v8, Knight vs Pawns, Queen vs 8 Pawns (each also in friend mode).
- Moment stickers: `st-pawn-war-win`.

### 13.8 CAPTURE THE CROWN (`capture-crown`, Pack B, freeMoves + `captureCrown/crownBot.ts`, `game: true`; P3 graft)
- A whole-army game **before** check is taught. All pieces move normally, **capturing the king wins**, and there is no check or checkmate rule, so moving into danger is allowed and simply loses. Pawns auto-queen. No castling, no en passant. The Board renders normally from `placementFen` (kings included; chess.js may accept or reject the FEN; either way `freeMoves` drives play).
- **Danger bells** (Sprout and Explorer on, Champion off): after the kid's move, if the opponent could capture the kid's king (`miniRules`), the king wobbles, a bell chimes, and a sheet shows "Move anyway" / "Undo". This is the direct precursor of check.
- **crownBot**:
  - `sleepy`: random, but always captures the king if it can.
  - `playful`: capture the king if possible; else the highest-value capture that is not recaptured by a cheaper piece; else a move that does not leave its own piece en prise; else random.
  - `clever`: 2-ply material, king = 100.
  - Thinking delay 600-1200 ms.
- Data: `{placement: Placement, bot: 'sleepy' | 'playful' | 'clever'}`.
- Score: win 3, draw 2 (no captures in 50 moves, or both sides stuck), loss 1. Capturing the king awards `st-crown-captured`.
- Set `w6-crown-game` (fixed; 1 per run; ease drops the bot one level, then removes the bot's knights):
  - kings+pawns `4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3` bot `sleepy`
  - +knights `1n2k1n1/pppppppp/8/8/8/8/PPPPPPPP/1N2K1N1` bot `sleepy`
  - +bishops `2b1k1b1/pppppppp/8/8/8/8/PPPPPPPP/2B1K1B1` bot `playful`
  - E C: full `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR` bot `playful` (C: `clever`)
- Playground: "Capture the Crown" (vs bot or a friend).

### 13.9 WHAT'S HAPPENING? QUIZ (`quiz`, Pack C)
A static board (non-interactive, except for tap-the-attacker) plus big picture answer buttons in the Tray. A wrong answer gets Pip explaining with an arrow or glow; it counts as a mistake, and the item is re-queued at the end of the run once.

| kind | data | answers |
|---|---|---|
| `status2` (S+) | `{fen, answer: 'check' \| 'nothing', attacker?: Sq}` | Two giant buttons: a scared king with a lightning bolt (YES) and a calm king (NO). If the answer is check, a follow-up asks "Tap who's attacking!" (the attacker square). |
| `status4` (E C) | `{fen, answer: 'check' \| 'checkmate' \| 'stalemate' \| 'nothing'}` | Four cards; Pip then explains with an arrow. |
| `count` | `{pieces: Placement, answer: number}` | "How many squares can the knight jump to?" Number buttons with dots. |
| `value` | `{a: PieceCode, b: PieceCode}` | "Which is worth more?" Two candy jars; equal values get a third button "Same!". |
| `trade` | `{fen, move: [Sq, Sq], answer: boolean}` | "Good trade?" A balance-scale animation shows what goes into each pan. |
| `can-castle` | `{fen, side: 'k' \| 'q', answer: boolean, reason?: 'king-moved' \| 'rook-moved' \| 'in-the-way' \| 'in-check' \| 'path-attacked'}` | Yes/No; E and C then pick the reason from icon cards. `footprints` art on e1 shows "the king already walked". |
| `bishop-reach` | `{pieces: {c1:'B'}, star: Sq, answer: boolean}` | Sun/Moon plus Yes/No. |
| `munch` (E C; P2 "Who can munch?") | `{fen, target: Sq, answer: Sq[]}` | The target glows with a cookie ring. The kid taps ALL of their pieces that could capture it, then presses "Done!". validate: `answer` equals the set of `from` squares of legal captures on `target` (chess.js). |
| `move` | `{move: FindMoveItem}` | An embedded find-move item (see "Mixed nodes" below). |

validate:
- status answers are recomputed with chess.js (`isCheckmate` / `isStalemate` / `inCheck`) and must equal `answer`;
- `count` is recomputed with miniRules;
- `trade` plays the move and the best recapture in chess.js and compares values (`answer` = the net is 0 or more);
- `can-castle` checks that the O-O / O-O-O move exists in chess.js exactly when `answer` is true;
- `bishop-reach` compares square colors.

Verified data (content/rules.ts):
- `w7-spot-check` (status2):
  - `4k3/8/8/8/8/8/8/4R1K1 b - - 0 1` check, attacker e1
  - `4k3/8/8/8/8/8/8/3R2K1 b - - 0 1` nothing
  - `4k3/8/8/1B6/8/8/8/6K1 b - - 0 1` check, attacker b5
  - `4k3/8/3N4/8/8/8/8/6K1 b - - 0 1` check, attacker d6
  - `4k3/8/8/8/8/8/8/Q5K1 b - - 0 1` nothing
  - `4k3/5P2/8/8/8/8/8/4K3 b - - 0 1` check, attacker f7
- `w7-mate-or-not` (status4):
  - `7k/6Q1/6K1/8/8/8/8/8 b - - 0 1` checkmate
  - `7k/5Q2/6K1/8/8/8/8/8 b - - 0 1` stalemate
  - `k7/8/1K6/8/8/8/8/R7 b - - 0 1` check
  - `k7/8/1K6/8/8/8/8/7R b - - 0 1` nothing
  - `R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1` checkmate
  - `k7/1Q6/1K6/8/8/8/8/8 b - - 0 1` checkmate
  - `k7/2Q5/1K6/8/8/8/8/8 b - - 0 1` stalemate
  - `7k/7P/6K1/8/8/8/8/8 b - - 0 1` stalemate
- `w4-knight-count` (count): `{d4:'N'}` 8; `{a1:'N'}` 2; `{b1:'N'}` 3; `{g2:'N'}` 4. The surprise item is `{d4:'R'}` 14 ("a rook on any empty board square always has 14!").
- `w6-candy` (value): (p, n); (n, b) Same; (r, b); (q, r); (p, q); (b, r). Tier 3, E C munch item: `4k3/8/8/4p3/8/3N2B1/8/4RK2 w - - 0 1`, target e5, answer {d3, g3, e1} (legal captures Nxe5, Bxe5, Rxe5+).
- `w6-trade` (trade):
  - `4k3/4r3/8/4n3/8/8/8/4RK2 w - - 0 1` move e1-e5, **No** (Rxe5 Rxe5: 5 candies for 3)
  - `4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1` e1-e5, **Yes** (free knight)
  - `4k3/8/3p4/4q3/8/8/8/4RK2 w - - 0 1` e1-e5, **Yes** (9 for 5)
- `w7-castle` (can-castle):
  - `r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1` k Yes, q Yes
  - `r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1` k **No**, reason `king-moved` (footprints on e1)
  - `4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1` k **No**, reason `in-the-way`
  - `4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1` k **No**, reason `path-attacked` (f1); q Yes
  - Plus find-move items `{fen:'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', goal:{kind:'flag', flag:'k'}}` (O-O) and `{fen:'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', goal:{kind:'flag', flag:'q'}}`. **Sprouts get only the find-move items.**
  - **Mixed nodes, one activity.** The player runs exactly one activity per node. So the quiz supports a seventh kind, `{kind: 'move', move: FindMoveItem}`, which renders the framework's exported `FindMove` component (from `activities/findMove`, read-only for packs) with the same `player` and `onDone`. `w7-castle` and `w7-stalemate` are quiz level sets that mix quiz cards and `move` items. The quiz's validate delegates `move` items to the find-move validate.
- `w2-bishop-color` (bishop-reach): c1 to c2 No; c1 to h6 Yes; c1 to d3 No; f1 to a6 Yes; c1 to e3 Yes; f1 to f2 No.
- `w7-stalemate` (quiz with embedded find-move): status4 stalemate cards `7k/5Q2/6K1/...`, `k7/2Q5/1K6/...`; move item `k7/8/1K6/8/8/8/7Q/8 w` with goal mate ("Checkmate, not stalemate!"; Qc7 is stalemate and is answered with the stalemate line).

### 13.10 FIND-MOVE CONTENT OWNED BY PACK C (uses the framework `find-move` activity)
- `w6-protect`: s1 and s2 from 13.2, plus `4k3/8/8/7b/8/8/8/3R1NK1 w - - 0 1` protect d1 (the only solution is Ne3). Author 3 more with the same validate rule.
- `w7-escape`:
  - `R3r1k1/8/8/8/8/8/3N4/4K3 w - - 0 1` ways run, block, capture (legal: Rxe8+ capture, Ne4 block, Kf2/Kf1/Kd1 run)
  - `4k3/8/8/8/4r3/8/2B5/R2QK3 w - - 0 1` ways run, block, capture (Bxe4, Qe2, Kd2/Kf2/Kf1)
  - `4r1k1/8/8/8/8/8/8/4K3 w - - 0 1` ways ['run']
  - `4r1k1/8/8/8/8/8/8/3BK3 w - - 0 1` ways ['block','run'] (Be2 block)
  - `4k3/8/8/8/8/8/3q4/4K3 w - - 0 1` ways ['capture','run'] (Kxd2, Kf1)
  - Sprouts: every item uses `tune: {sprout: {goal: {kind: 'escape', ways: 'any'}}}`.
- `w7-en-passant` (checked: each replay produces exactly the item FEN):
  - `{fen:'4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 2', replay:{fen:'4k3/4p3/8/3P4/8/8/8/4K3 b - - 0 1', uci:'e7e5'}, goal:{kind:'flag', flag:'e'}}` (dxe6)
  - `{fen:'4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', replay:{fen:'4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', uci:'d7d5'}, goal:{kind:'flag', flag:'e'}}` (exd6)
  - Both award `st-en-passant`.
- Promotion flag items for w7 (E C, picker on): `8/4P3/8/8/8/2k5/8/4K3 w - - 0 1` goal flag p; an underpromotion to a knight with check awards `st-surprise-knight`.

### 13.11 CHECKMATE DRILLS (`mate-drill`, Pack C, chess.js + engine, with a JS fallback)
- Data: `{fen, method: 'ladder' | 'box' | 'rook', maxMoves: number}`.
- **Rules**: the kid has K+2R, K+Q or K+R against a lone king. The defending king plays `engine.search(fen, {depth: 12})`. **Fallback** (`mateDrill/defense.ts`) when the engine is not ready, or a search rejects or returns null or takes more than 2 s: from the legal king moves,
  1. prefer a move that captures an undefended piece;
  2. drop moves after which White has a mate-in-1;
  3. maximize the number of king moves available next turn (computed on the null-move FEN);
  4. tie-break by the smallest distance to the center.
- **Helpers**:
  - `ladder`: the two stair-step ranks are drawn with `art`.
  - `box`: the black king's box (the rectangle bounded by the queen's lines) is shaded, and it shrinks as the kid squeezes it: "Make the box smaller!"
  - A move counter "n / maxMoves".
- **Stalemate**: "Oops, it's a tie: the king had no moves but wasn't in check!" The kid retries from the position before the stalemating move. **Losing a piece** also means a gentle retry from the position before the blunder.
- **Score**: mate within maxMoves = 3, within 1.5x = 2, otherwise 1 (the kid may keep going; after 2x maxMoves, Watch Pip finishes the mate).
- Items:
  - `w8-ladder` `8/8/3k4/8/8/8/8/R3K2R w - - 0 1` maxMoves 12 (all bands)
  - `w8-box` `8/8/8/4k3/8/8/8/4K2Q w - - 0 1` maxMoves 15 (E C)
  - `w8-rook-mate` `8/8/8/4k3/8/8/8/R3K3 w - - 0 1` maxMoves 30 (C)
  - Each set has 2 more start positions authored by the pack (legal, not check, not stalemate; validated).
- Best keys: `ladder-moves` (lower is better). Trophies: Ladder Mate, Box Mate.

### 13.12 PLAY A BUDDY (`play-bot`, Pack D, chess.js + `playBot/kidBot.ts` + engine, `game: true`)
**Buddies** (metadata in `curriculum/buddies.ts`, move logic in `kidBot.ts`):

| # | id | play (pure JS unless stated) | bands |
|---|---|---|---|
| 1 | `shelly` | uniformly random legal move; if it has a mate-in-1 and other moves exist, it excludes the mating moves (P2 graft) | S E C |
| 2 | `hop` | the biggest capture available (by captured value, ties random), otherwise random; it never looks at recaptures; it takes a mate-in-1 50% of the time | S E C |
| 3 | `tuck` | 2-ply material minimax; 30% of its moves are random legal moves | S E C |
| 4 | `fern` | 2-ply minimax; eval = material + 0.1 × (own mobility - opponent mobility) + 0.2 per own pawn or knight on d4/e4/d5/e5; picks among the top 3 with weights 60/30/10 | E C |
| 5 | `olive` | alpha-beta iterative deepening to 3 plies with capture quiescence (2 plies); eval = material + simple piece-square bonuses (N/B center 0.1-0.3, pawn +0.05 per rank advanced); uniform noise ±0.3; always plays a mate-in-1; 400 ms budget (returns the deepest completed result) | E C |
| 6 | `bruno` | engine `{skill:0, depth:3, multipv:3}`, random among lines within 150 cp; falls back to olive | C (optional) |
| 7 | `ember` | engine `{skill:3, depth:6}`; falls back to olive | C (optional; Playground only) |

- **Band ladders** (used for trophies and the "next buddy" suggestion): S: shelly, hop, tuck. E: shelly, hop, tuck, fern, olive. C: shelly, hop, tuck, fern, olive, then the optional bruno and ember.
- **Handicaps** (as FENs):
  - knight home: `r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
  - queen home: `rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
  - queen and rook home: `rnb1kbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQq - 0 1`
  (all load in chess.js)
- **Data**: `{bot: BuddyId; fen?: string /* default start */; kidColor?: 'w' | 'b'; mission: 'win' | 'promote' | 'no-hang' | 'develop'}`.
- **Helpers**:
  - takebacks by setting;
  - the **Danger Alarm** (12.2; shown as a DangerSheet with Undo / Keep it);
  - threat lights;
  - Hint: 3 per game, the engine or olive best move as a green arrow;
  - the Oops shield (C option).
- **Missions**:
  - `win`
  - `promote`: the first queen made wins (Sprout army games)
  - `no-hang`: success if the game ends (any result, 12 or more kid moves) and the kid never kept a move that the alarm flagged
  - `develop`: the Golden Rules checklist is ticked live beside the board within the first 10 kid moves. The five rules: a pawn in the center (e4/d4 for White), both knights moved, both bishops moved, castled, and the queen not moved before kid move 6. Score: 5 ticks = 3, 3-4 = 2, else 1. The game can continue after the mission ends.
- **Pip owns buddy blunders**: when a buddy's move leaves a piece hanging (static loss of 3 or more), Pip may say (S and E, at most once per game): "Oops, Hop left a knight alone! Can you find it?"
- **End of game**: checkmate by the kid gives `celebrate('checkmate')` plus a trophy check. On a loss, "See how it ended": the final position with an arrow for the mating move ("Hop found this checkmate. Let's remember that trick!").
- **Score**: win 3, draw 2, loss 1. Ease and skip: 5.3.
- **validate**: the FEN loads; the bot id is in the band ladder of every band the item is visible to (so Sprouts never face fern, olive, bruno or ember); the ease steps validate.
- **Level sets** (content/games.ts; all `order: 'fixed'`):
  - `w7-armies`: vs shelly, mission `promote` or `win`:
    - `4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1`
    - `1n2k1n1/pppppppp/8/8/8/8/PPPPPPPP/1N2K1N1 w - - 0 1`
    - `2b1k1b1/pppppppp/8/8/8/8/PPPPPPPP/2B1K1B1 w - - 0 1`
  - `w7-boss`:
    - S E: `{bot:'hop', fen: <queen home>}`, ease `[{bot:'shelly', fen: <queen home>}, {bot:'shelly', fen: <queen+rook home>}]`
    - C: `{bot:'tuck'}`, ease `[{bot:'tuck', fen: <queen home>}, {bot:'hop', fen: <queen home>}, {bot:'shelly', fen: <queen home>}]`
  - `w8-golden-rules`: E `{bot:'tuck', mission:'develop'}`; C `{bot:'fern', mission:'develop'}`.
  - `w8-buddy-ladder`: S `{bot:'hop'}` (full army); E `{bot:'tuck'}`; C `{bot:'fern'}`. Each has an ease list ending in shelly plus the queen-home handicap.
  - `w8-crown` (FINAL, no skip):
    - S `{bot:'hop'}`, ease `[{bot:'hop', fen:<queen home>}, {bot:'shelly', fen:<queen home>}, {bot:'shelly', fen:<queen+rook home>}]`
    - E `{bot:'fern'}`, ease `[{bot:'fern', fen:<knight home>}, {bot:'tuck'}, {bot:'hop', fen:<queen home>}, {bot:'shelly', fen:<queen home>}]`
    - C `{bot:'olive'}`, ease `[{bot:'olive', fen:<knight home>}, {bot:'fern'}, {bot:'tuck', fen:<queen home>}, {bot:'shelly', fen:<queen home>}]`
- **Playground**: every buddy in the kid's band ladder that is beaten or next; bruno and ember for C; "Play a friend" (full chess, pass-and-play, unranked, with an optional queen/rook/knight handicap).

### 13.13 PUZZLE PATH (`puzzles`, Pack E, chess.js + `puzzles/kidPuzzles.ts`)
**Data**
```ts
{ source: 'hand', items: FindMoveItem[] }
| { source: 'db', themes: string[], maxRating: number, count: number }
| { source: 'streak' }   // Champion Puzzle Streak (Playground)
```
**db flow**:
- The puzzle FEN is the position before the opponent's move. `moves[0]` animates in over 700 ms ("Tuck moved!"), then the kid solves.
- Mate themes accept any mating move (`isCheckmate()`). Otherwise the move must match the solution (`acceptsMove` from `src/chess/utils.ts`), and scripted replies auto-play.
- 2 tries, then Watch Pip.
- The rating updates on the first try only (K from 3.3), and every puzzle is logged in `puzzle.seen`.

**hand flow**: exactly the find-move rules (it renders the framework FindMove component for each hand item).

**kidPuzzles.pick({themes, maxRating, band, rating, count, rng, seen})**:
- Filter by any theme in `themes` and `rating <= maxRating`.
- Explorers: only puzzles with exactly 2 UCI moves (one solver move).
- Below Champion: exclude the themes `long` and `veryLong`.
- Window `[rating - 150, rating + 100]`. It widens by 100 on each side until there are at least 3 × count candidates. Unseen puzzles come first. Seeded choice.
- The puzzle database's lowest rating is 540, so a rating floor of 500 never starves the pool.

**Verified pool sizes** (count of `src/data/puzzles.json`; section 17):
- mateIn1: 54 at 700 or below, 128 at 800 or below, 151 at 1000 or below (all of them)
- hangingPiece: 51 at 700 or below, 217 at 800 or below, 271 at 1000 or below
- pin: 47 at 1100 or below
- mateIn2: 60 at 1200 or below
- fork: **4 at 1100 or below**, 78 at 1300 or below
- skewer: 18 at 1400 or below

**Level sets (content/tactics.ts)**
- `w8-mate-hunt`:
  - S `{source:'hand'}` 3 items: `k7/2Q5/2K5/8/8/8/8/8 w` (Qb7#), `k7/8/1K6/8/8/8/8/6Q1 w` (Qg8#), `7k/8/6K1/8/8/8/8/1Q6 w` (Qb8#)
  - E `{source:'db', themes:['mateIn1'], maxRating:800, count:5}`
  - C `{source:'db', themes:['mateIn1'], maxRating:1000, count:6}`
- `w8-forks` (E C) `{source:'hand'}`: **20 hand-authored forks, budgeted at about 2 hours of Pack E time** (the database has only 4 forks at 1100 or below). Each fork item is a find-move `line` item. **validate for forks**:
  - the first kid move is not a capture of value 3 or more and is not mate;
  - after it, the moved piece attacks at least 2 targets that are the king or of value 3 or more;
  - a depth-4 material alpha-beta from the position after the fork (black to move) returns a gain of +2 or more for White;
  - the scripted reply is legal.
  Seeds that pass this validator:
  | fen | line | gain |
  |---|---|---|
  | `r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1` | b5c7, e8d7, c7a8 (K+R) | +5 |
  | `q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1` | b5c7, e8d7, c7a8 (K+Q) | +9 |
  | `4k3/8/8/1q6/4N3/8/8/4K3 w - - 0 1` | e4d6, e8e7, d6b5 (K+Q) | +9 |
  | `4k3/8/8/1r6/4N3/8/8/4K3 w - - 0 1` | e4d6, e8e7, d6b5 (K+R) | +5 |
  | `r5k1/8/8/8/8/8/8/4K2Q w - - 0 1` | h1d5, g8h8, d5a8 (queen: K+R) | +5 |
  | `r3k3/8/8/8/8/8/8/2Q1K3 w - - 0 1` | c1c6, e8e7, c6a8 (queen: K+R) | +5 |
  | `3k4/8/8/8/6b1/8/8/4K2Q w - - 0 1` | h1h4, d8c8, h4g4 (queen: K+B) | +3 |
  Pawn forks such as `d3-d4` against two minor pieces FAILED this validator in the positions tried (the black pieces counter-attack the pawn), so authors must check every pawn fork with it. Awards: trophy Fork Finder after 10 solved.
- `w8-pins` (C) `{source:'db', themes:['pin'], maxRating:1100, count:6}` (47 available).
- `w8-threats` (E C): find-move items with goal `no-hang` ("What does the knight want? Keep your rook safe!"). Verified:
  - `4k3/8/8/8/3n4/8/2R5/4K3 w - - 0 1`: the rook on c2 is attacked. Solutions include the safe rook moves and Kd2 or Kd1 defending it. Rc6, Kf2 and Kf1 fail.
  - `4k3/8/8/8/8/4b3/8/2N1K2R w - - 0 1`: the knight on c1 is attacked by the bishop. Knight moves, Kd1, Ke2 (unblocks Rh1's defense of c1) and Rh8+ pass. Kf1 and rook moves along the h-file and to g1/f1 fail.
  - `4k3/8/8/6b1/8/8/3N4/4K3 w - - 0 1`: the knight on d2 is attacked. Knight moves, Ke2 and Kd1 pass; Kf2 and Kf1 fail.
  Pack E authors 5 more (validated: at least 1 pass, at least 1 fail, and the start position has a hanging piece).
- The scripted replies in the lines above are legal (checked). For the queen lines, `g8h8` and `d8c8` are legal king moves out of check; validate re-checks them.

**Puzzle of the Day** (`puzzles/daily.ts`; Playground tile "Puzzle of the Day"; P2 graft):
- The seed is `hashSeed(dayKey(), band)`, so every kid in the same band gets the same puzzle that day (siblings can talk about it).
- S: from a hand list of 30 find-move mate and capture items (the w7-mate1 Sprout items, the w6 capture items, and more authored by E).
- E: db mateIn1 or hangingPiece at 800 or below, 2 UCI moves.
- C: db at 1200 or below, excluding `long`/`veryLong`.
- It marks `puzzle.dailyDone`. There is no streak.

**Puzzle Trio** (Playground, E C): 3 db puzzles from the kid's window.

**Puzzle Streak** (Playground, C): no timer; consecutive solves; the best is stored in `puzzle.bestStreak`; a miss ends the streak gently ("Great run: 7!").

---
## 14. Shared-file edits outside `src/kids` (framework step only; small, coordinated diffs)

The UI team, the board team and the pieces team are editing some of the same files in parallel. Every edit below is additive, is at most about 15 lines, and must be rebased onto their work. **No other file outside `src/kids` and `tests/kids*.test.ts` may change.** In particular, do not touch `src/store/profile.ts` (no BoardTheme union edit), `src/chess/sound.ts`, `src/styles/board.css`, `src/styles/pieces.css` or `src/store/cloud.ts`.

1. **`src/App.tsx`**. Today it imports `KidsApp` statically as a NAMED export (line 25) and renders it at the `section === 'kids'` branch (around line 217).
   ```ts
   - import { useEffect, type ReactNode } from 'react';
   + import { lazy, Suspense, useEffect, type ReactNode } from 'react';
   - import { KidsApp } from './kids/KidsApp';
   + import { isKidsLocked } from './kids/lock';
   + const KidsApp = lazy(() => import('./kids/KidsApp').then((m) => ({ default: m.KidsApp })));
   ...
     // inside App(), BEFORE the early return (hooks order):
   + const locked = isKidsLocked();
   + useEffect(() => { if (locked && section !== 'kids') navigate('kids', { replace: true }); }, [locked, section]);
     if (section === 'kids') {
       return (
         <>
   -       <KidsApp route={route} />
   +       <Suspense fallback={<div className="kids-loading" aria-busy="true" style={{ position: 'fixed', inset: 0, background: '#fffaf0' }} />}>
   +         <KidsApp route={route} />
   +       </Suspense>
           <Toasts />
         </>
       );
     }
   + if (locked) return null;   // avoid a flash of the grown-up app while redirecting
   ```
   - Nav: add `{ route: 'kids', label: 'Kids mode', icon: 'star' }` to the sidebar's "Play" group. `star` is an existing Icon name.
   - The mobile tab bar is unchanged (5 tabs). Mobile entry is through the Home card and the Settings row.
   - `build:single`: vite-plugin-singlefile sets `codeSplitting: false` / `inlineDynamicImports: true`, so the lazy chunk and its fonts are inlined. That is expected, and the fonts are why section 7.2 uses latin subsets. The normal build emits a separate chunk that the service worker precaches with the other built files.
2. **`src/pages/Home.tsx`**: one card at the end of the side column: "Teaching a kid? **Open Kids mode**", a `Button variant="secondary"` calling `navigate('kids')`, with the `star` icon.
3. **`src/pages/Settings.tsx`**: one row, "Kids mode: a playful chess course for ages 4-12", with an "Open" button calling `navigate('kids')`.
4. **`src/chess/Board.tsx`** (the only Board change):
   ```ts
     /** Override the learner's board theme / piece set (e.g. a Kids mode look). */
     boardTheme?: BoardTheme;
     pieceSet?: PieceSet;
   + /** Force auto-queen (true) or the promotion picker (false); defaults to the learner's setting. */
   + autoQueen?: boolean;
   ...
   -  pieceSet,
   +  pieceSet,
   +  autoQueen,
   }: BoardProps) {
   ...
   -      if (settings.autoQueen) finishMove(from, to, 'q');
   +      if (autoQueen ?? settings.autoQueen) finishMove(from, to, 'q');
   ```
   - Promotions in free-rule activities never reach Board: `freeMoves` has no promotion path, and `miniRules.applyMove` auto-queens.
   - Auto-select, kid dots, tap-only, the keyboard cursor, area clouds and sound muting all live in KidsBoard (11.5, 10.2) and need no Board change.
5. **`package.json`**: add the dependencies `"@fontsource-variable/fredoka": "^5"` and `"@fontsource/andika": "^5"` (pin to the installed majors), and run `npm install`.

---

## 15. Tests (vitest; `tests/**/*.test.ts`; node environment; import only `logic.ts` and store and lib modules)

**`tests/kids.test.ts`** (framework):
1. **Registry**:
   - every `NODES[i]` id is unique;
   - every registered level set's `activity` exists;
   - no level set id is registered twice across packs;
   - every level-set id is a node id or `cp1`..`cp8`;
   - every sticker and trophy id referenced by nodes exists.
2. **Content validation**: for every registered level set, every item, every band it is visible to, and every ease step: `ACTIVITIES.get(set.activity).validate(resolveItem(item, band, {ease}), band)` returns `[]`. (This covers all packs automatically once they are registered.)
3. **Every star item's `par` equals `starPar()`** (this is part of validate, and is also asserted for the table values in section 13.1).
4. **Curriculum shape**:
   - every world has at least 3 Sprout-visible non-bonus nodes including the boss;
   - `w1-hello` is the first node of w1, its activity is `stars`, and its first Sprout item has `par === 1`;
   - board-vision nodes are never first in a world.
5. **Progress logic** (pure functions in `store/progress.ts`):
   - stars never decrease;
   - the node score is `max(1, round(mean))`;
   - mastery (3 stars, or 2 stars on 2 days);
   - silver and gold crowns;
   - Leitner boxes and due days `[1, 2, 4, 7, 14]`;
   - the warm-up is empty on the first play day, with 1, 2 or 3 items for S, E or C;
   - the warm-up avoids `lastItems`.
6. **Unlocking with missing packs** (5.2): using fake `PACKS` lists:
   - (a) framework only: w1-w6 playable, and after w6's registered nodes are starred, w7 opens;
   - (b) a world whose boss is unregistered passes when its registered nodes have 1 star or more;
   - (c) a world with no registered nodes passes automatically;
   - (d) graduation is unavailable without `w8-crown`.
7. **Boss rules**:
   - Sprouts pass a non-game boss at 1 star; E and C need 2;
   - for game bosses, `losses` of 2, 3 and 4 produce offer, auto-ease and skip;
   - `w8-crown` never offers skip;
   - skip unlocks the next world, but blocks crowns and graduation.
8. **Placement**:
   - checkpoints exist for w1-w8 and use only `stars` or `find-move`;
   - 2 of 3 marks a world tested (1 star, `tested`, no stickers);
   - the Sprout cap stops at w5;
   - the puzzle rating is 600 + 40 per world, capped at 850.
9. **miniRules**: dests for every piece (rook on d4 = 14, knight on a1 = 2, pawn double step, pawn blocked, capture-only); lava; `placementFen({a1:'R'}) === '8/8/8/8/8/8/8/R7 w - - 0 1'`; `starPar` on 5 table items; `gobbleSolutions` counts from 13.5.
10. **danger.ts**:
    - the escape and fork fixtures;
    - `4k3/8/8/8/3n4/8/2R5/4K3 w`: Kf1 alarms and Kd2 does not;
    - an NxN equal trade gives no alarm;
    - a mating move gives no alarm;
    - at most one result per move.
11. **Store**: `normalizeKids` handles garbage, missing fields, `v` mismatch and over 8 kids; the `seen` ring is capped at 300; `days` is pruned to 60; localStorage throwing falls back to memory.
12. **Privacy and isolation**:
    - the source text of `src/store/cloud.ts` does not contain `kids` or `tempo.kids`;
    - the kids key is `'tempo.kids.v1'` and differs from the profile key;
    - no file under `src/kids/` imports `chess/sound` (grep via `fs`);
    - no file under `src/kids/` calls `engine.search` with `elo`.
13. **pronounce**: `'e4'` becomes "e four", `'a1'` becomes "ay one", `'Qb7#'` becomes "queen b seven, checkmate", `'O-O'` becomes "castles king side".

**Pack tests** each validate their own logic (their content is already covered by test 2):
- `kids-movement.test.ts` (A):
  - paint answer counts from 13.4;
  - gobble DFS counts;
  - the bite rule;
  - solo DFS (1, 1, 17, 0);
  - board-vision `tap-line` square sets;
  - setup strings.
- `kids-minigames.test.ts` (B):
  - miniBot always returns a legal pseudo move;
  - promotion is detected as a win;
  - stuck means a draw;
  - Queen vs 8 pawns loses when a pawn promotes;
  - crownBot `sleepy` always captures the king when it can;
  - danger bells fire for an en-prise king;
  - every ease step validates.
- `kids-rules.test.ts` (C):
  - every quiz answer recomputed with chess.js;
  - `munch` answer sets;
  - the mate-drill JS defender never picks a move that allows a mate-in-1 when an alternative exists;
  - it prefers higher mobility;
  - the drill FENs are legal and not check.
- `kids-buddies.test.ts` (D):
  - every persona returns a legal move on 20 fixed FENs (with `engine` mocked as failed, so bruno and ember fall back to olive);
  - shelly never plays a mate-in-1 when it has alternatives;
  - hop always captures the biggest piece;
  - olive always mates in 1 and finishes within 400 ms on fixtures (measured, with a lenient 1500 ms in CI);
  - the develop checklist logic;
  - the no-hang mission logic.
- `kids-tactics.test.ts` (E):
  - `pick()` respects themes, `maxRating`, the band rules (E: 2 UCI moves; below C: no long/veryLong) and widening;
  - the pool counts in section 13.13 equal counts over `puzzles.json` (so they can never drift from the data);
  - every fork passes the fork validator (depth-4 gain of +2 or more);
  - the daily seed is stable per (day, band);
  - Elo K and floor.

**Screenshot check** (script in the scratchpad, not in CI):
- The map, the player (stars with lava; find-move) and the results at 360, 390, 820 and 1440 wide, in day and Bedtime.
- No horizontal scroll at 360.
- The board shows meadow squares under every board-team theme (set `settings.boardTheme` to each value and confirm Kids squares are unchanged).

---

## 16. Build plan

### Step 0: FRAMEWORK (one engineer, done first; about 3,000 LOC; merge before any pack)
**MVP scope** (must ship in step 0):
- Integration diffs (section 14).
- `KidsApp`, `routes.ts`, `lock.ts`, `fonts.ts`, `kids.css` (all tokens, both themes, reduced motion, KidsBoard overrides).
- Store and progress (11.4, 5) with tests; `packs.ts`; `activities/types.ts`; `curriculum/*` (all 8 worlds and all nodes, skills, stickers and trophies, BAND_TUNING, buddy metadata, wardrobe with 8 colors, 6 faces and the first 4 hats).
- Player: `ActivityPlayer` (runs, intros with `pick`, hint ladder, Easier / Skip item / Super Star, ease ladder and Skip for now, warm-up, placement, playground and friend-opponent plumbing), `run.ts`, `KidsBoard`, `KidsPromoPicker`, `Results`, `speech.ts`, `useSession.ts`.
- `lib/`: `miniRules`, `danger`, `fen`, `rng`, `kidsSound`, `pronounce`, `pieceProbe`.
- `ui/`: every component in section 8. Pip gets all moods. PawnBuddy. BuddyFace for all 7 (simple shapes). SquareArt. ParentGate with the arithmetic gate and PIN.
- Screens: ProfilePicker (with the Family Jar), NewKid, Placement, MapScreen, WorldScreen, Playground (renders registered entries plus Star Hunt Endless; empty state), StickerBook (Stickers and Trophies tabs; Wardrobe tab with the MVP items), Grownups (report, settings, actions, device), BreakTime, Graduation (the promotion animation; the certificate can come in step 2).
- Flagship activities `stars` (with lava, area, multi-piece and `review()`) and `find-move` (all 9 goal kinds, including `no-hang`), exporting the `FindMove` component for embedding.
- Content: `content/core.ts` (every framework level set in 13.1 and 13.2) and `content/checkpoints.ts`.
- `tests/kids.test.ts`.

**Step 0 exit criteria**:
1. `npm run typecheck`, `npm test`, `npm run build` and `npm run build:single` all pass. The main bundle grows only by the lazy stub and `lock.ts` (compare `dist/assets` before and after). The kids chunk is separate.
2. From a fresh browser: create a Sprout, and the first screen after the wizard shows Pip, then the rook and a star. A move happens within 30 s. Play through w1 to w4 (stars nodes), w5 pawn steps and promo, w6 free lunch, lava and boss, w7 check and mate1. Earn stickers. Other nodes show "Coming soon". Worlds pass under the missing-pack rule.
3. Placement: an "I play real games" Champion who passes cp3 to cp5 starts at w6 with paper planes on w1-w5.
4. Gate: exit, Grown-ups and the session extension all require it. The PIN works. Lock mode opens `#/kids` on reload.
5. Speech works after the first tap on iOS Safari (manual check). Muting kid sound silences everything, including moves.
6. Screenshot check (section 15) passes.

### Step 1: PACKS (run in parallel after step 0 merges)
Each pack touches ONLY its own new files, plus its one import and one array entry in `src/kids/packs.ts`. Packs use framework modules read-only. If a pack needs a framework change, the framework owner makes it as a small follow-up PR. Packs never edit `curriculum/*`, `kids.css`, `types.ts`, the player or the stores. Moment sticker and trophy ids are already declared in `curriculum/stickers.ts`.

| pack | owns (new files only) | activities | level sets | playground | est. LOC |
|---|---|---|---|---|---|
| **A: Movement and Vision** | `activities/boardVision/**`, `activities/paint/**`, `activities/gobble/**`, `activities/memory/**`, `content/movement.ts`, `tests/kids-movement.test.ts` | board-vision (5 kinds plus dash), paint, gobble (plus bite and solo), memory | w1-roads, w1-colors, w1-rook-paint, w1-rook-gobble, w2-bishop-paint, w2-bishop-gobble, w2-treasure-map, w3-queen-paint, w3-queen-gobble, w4-knight-paint, w4-knight-gobble, w5-pawn-slant, w5-army, w5-setup, w6-bite | Coordinate Dash (C), Last Piece Standing (C), Magic Memory (E C) | ~1,000 |
| **B: Mini-games** | `activities/battle/**` (with `miniBot.ts`), `activities/captureCrown/**` (with `crownBot.ts`), `content/minigames.ts`, `tests/kids-minigames.test.ts` | battle, capture-crown, friend mode for both | w5-pawn-war-mini, w5-boss, w6-battles, w6-crown-game | Pawn War 3v3, Pawn War 8v8, Knight vs Pawns, Queen vs 8 Pawns, Capture the Crown (each with a friend option) | ~1,000 |
| **C: Rules and Mates** | `activities/quiz/**`, `activities/mateDrill/**` (with `defense.ts`), `content/rules.ts`, `tests/kids-rules.test.ts` | quiz (status2, status4, count, value, trade, can-castle, bishop-reach, munch, move), mate-drill | w2-bishop-color, w4-knight-count, w6-candy, w6-protect, w6-trade, w7-spot-check, w7-escape, w7-mate-or-not, w7-stalemate, w7-castle, w7-en-passant, w8-ladder, w8-box, w8-rook-mate | none | ~1,000 |
| **D: Buddies** | `activities/playBot/**` (with `kidBot.ts`, `missions.ts`), `content/games.ts`, `tests/kids-buddies.test.ts` | play-bot (buddies 1-7, missions, takebacks, Danger Alarm sheet, threat lights, hints, Oops shield, end-of-game replay, friend full chess) | w7-armies, w7-boss, w8-golden-rules, w8-buddy-ladder, w8-crown | every buddy; Play a friend | ~1,100 |
| **E: Puzzles and Tactics** | `activities/puzzles/**` (with `kidPuzzles.ts`, `daily.ts`), `content/tactics.ts`, `tests/kids-tactics.test.ts` | puzzles (hand, db, streak) | w8-mate-hunt, w8-forks (20 hand forks, about 2 h of authoring), w8-pins, w8-threats | Puzzle of the Day, Puzzle Trio (E C), Puzzle Streak (C) | ~800 |

**There are no cross-pack runtime dependencies.** `w5-pawn-slant` (gobble) is in Pack A. `danger.ts` is framework-owned. Packs C and E reuse the framework `FindMove` component. The content test skips unregistered sets by construction: it iterates only the registered ones.

### Step 2: INTEGRATION and POLISH (framework owner, after the packs; framework files only)
- Remaining wardrobe items and hat art; the sticker scene tab; the Family Party animation; the printable certificate page; left-handed layout QA.
- Tune copy and `itemsPerRun` after a play session with a real kid if possible.
- Integration checklist:
  - (1) `tests/kids.test.ts` passes with every pack registered, and no "Coming soon" remains;
  - (2) replay the full Sprout path, and an Explorer and a Champion placement path, in the browser;
  - (3) no horizontal scroll at 360px;
  - (4) the kids chunk is separate, and the main bundle is unchanged apart from the lazy import and `lock.ts`;
  - (5) with the engine blocked (offline or WASM denied): bruno and ember fall back, play-bot hints still work, the mate drill defends with JS;
  - (6) the screenshot check in day and Bedtime;
  - (7) the board team's final themes and the pieces team's `staunton3d` are merged, and the Kids board keeps meadow squares while 3D pieces appear automatically (`pieceSet: 'auto'`).

**Merge order**: step 0, then A-E in any order (the only conflict is the one line each adds to `packs.ts`), then step 2.

---

## 17. Verified facts and corrections (checked while writing this spec)

- **Puzzle pool counts** (`src/data/puzzles.json`, 2,885 puzzles, ratings 540-2415):
  - mateIn1: 54 at 700 or below, 128 at 800 or below, 151 at 1000 or below (all 151 are rated 1000 or below)
  - hangingPiece: 51 at 700 or below, 217 at 800 or below, 216 in 600-800, 271 at 1000 or below
  - fork: 4 at 1100 or below, 78 at 1300 or below, 84 in 1000-1400
  - pin: 47 at 1100 or below, 70 in 800-1400
  - mateIn2: 60 at 1200 or below, 59 in 1000-1200
  - skewer: 18 at 1400 or below; promotion: 13 at 1300 or below
  - `oneMove` at 800 or below: 411
  P2's larger figures (151, 270, about 120, about 100, 81) were wrong. P1's figures are confirmed.
- **P3's "Queen's Kiss"** `k7/8/1K6/8/8/8/8/1Q6 w` has **no** mating move (the king on b6 blocks the b-file), so it is not used. The correct Queen's Kiss is `k7/2Q5/2K5/8/8/8/8/8 w` (Qb7#), and it is used in w7-mate1 m1.
- `6k1/6pp/8/8/8/8/8/3QK3 w` has no mate-in-1 (f7 is open), so it is not used.
- **Star levels from the proposals that failed BFS and were replaced**:
  - `{f1:'B'} rocks [d3,g2] stars [h1,a6]` (unsolvable)
  - `{e1:'K'} statues {d5:'r'} stars [e8]` (unsolvable: a rook makes an uncrossable lava wall)
  - `{b1:'K'} statues {d3:'p', c5:'r'} stars [b4,e2]` (star on lava)
  - `{a1:'Q'} statues {c3:'n'} stars [d4,a4]` (star on lava)
  - `{c1:'B'} statues {f6:'p', b6:'n'} stars [g5,a3]` (star on lava)
  Every star level in this spec was re-run: the pars in section 13.1 are exact.
- **Gobble**: P1's examples (1, 2, 2, 3, 1 solutions) are confirmed. The bite example `{a1:'R'}` vs `{a6:'p', b7:'p', f6:'n'}` has 0 solutions and is not used.
- **Forks**: 7 seeds pass a depth-4 material search (gain +3 to +9). Pawn forks such as `d3-d4` against two knights, or against a knight and a bishop, and the "Nd6 vs two rooks" and "Bd2 vs two rooks" ideas FAILED (black saves both pieces or wins the forker back). The validator is mandatory.
- **All find-move, quiz, army, handicap, drill and castle FENs** in this spec load in chess.js, and their stated solutions are the complete legal sets (escape: `R3r1k1/8/8/8/8/8/3N4/4K3 w` = Rxe8+, Ne4, Kf2, Kf1, Kd1).
- **Board facts relied on**:
  - `new Chess(fen)` is wrapped in try/catch, so kingless placement FENs render;
  - `freeMoves` replaces the chess rules and has no promotion path;
  - `squareContent` renders inside `.sq`;
  - `onSquareClick` fires on every left-button pointerdown before move handling;
  - the dest dot class is `.dest`;
  - the theme class is `board-<theme>` on the `.board` element;
  - Board plays no sounds itself (callers use `playMoveSound`);
  - `setPointerCapture` is called on pointerdown (so synthetic pointer events are not used);
  - `settings.autoQueen` is read in `tryMove`.
- **Engine**: `SearchOptions` supports `depth`, `movetime`, `multipv`, `skill` and `elo`. `elo` is clamped to 1320 or more, which is why Kids never uses it. `engine.status` can be `'failed'`. `cancelAll()` exists.

---

## 18. MustFix resolution and graft ledger

### 18.1 Every mustFix item (all three judges, deduplicated)
| # | mustFix | resolution (section) |
|---|---|---|
| 1 | Guaranteed progression; no band hard-blocked by win-required bosses or the 2-star rule; after 2 losses offer an easier bot, then a handicap, then Skip; grown-up unlock; weakest settings for Sprout bosses; define the minimum boss requirement per band | Per-band `bossPass` S1/E2/C2; game-boss ease ladders ending at Shelly plus a handicap; offer at 2 losses, auto-ease at 3, Skip at 4 (not the final boss); non-game boss "Practice first" and Skip after 3 attempts; grown-up unlock (5.3, 13.7, 13.12) |
| 2 | The first minute must be play; the setup boss is out of Rank 1; board vision becomes interludes | Rank 1 is ROOK ROAD, starting with w1-hello (rook to a star within 30 s); tap-color is a bonus, tap-line a 3-item interlude; setup moves to w5-setup (4, 13.1) |
| 3 | Per-band level data and Sprout mini-board areas; per-node Sprout trims in worlds.ts data | `ItemMeta.tune/superTune/ease` with `resolveItem`; KidsBoard `area` clouds plus filtered dests (no Board change); node `bands` in worlds.ts, plus a test that each world has at least 3 Sprout nodes (4, 11.3, 11.5, 15) |
| 4 | Remove Ember at Elo 1320; recalibrate the ladder; Explorers top at Fox/Owl; no unreachable trophies | Ember is now skill 3 / depth 6, Champion-only and Playground-only; buddies 1-5 are pure JS; E ends at Owl with a Fox final; trophies use band ladders (6, 13.12) |
| 5 | Pack ownership: pawn-slant; placement works with the framework only | w5-pawn-slant is owned by Pack A; checkpoints cp1-cp8 use only framework activities (3.2, 16) |
| 6 | Exact Danger Alarm logic; engine fallbacks | `danger.ts` static exchange rule with thresholds, equal-trade, check and mate handling, one alarm per move; engine fallback table (12.2, 12.3) |
| 7 | Scoring gaps: short lost games, the same boss scoring, show the 2-star requirement up front | A loss is always 1 star; bosses use the same scoring; a BossCard requirement row (5.3, 5.4, 8) |
| 8 | Minimal coordinated shared edits: autoQueen, kid mute, staunton3d fallback, meadow via CSS only, lazy KidsApp, build:single | Section 14 diffs; `pieceProbe`; `.kids-board .sq.light/.dark` overrides with a written contract; kidsSound never imports sound.ts; singlefile inlining noted (7.3, 7.7, 11.6, 14) |
| 9 | Speech robustness: voiceschanged, the iOS first gesture, pronunciation, the gate never spoken, graceful onboundary, cancel on route change | Section 10.1 |
| 10 | Cap the warm-up; skip it on the first session; 1-2 items for Sprouts | S1/E2/C3, none on the first play day, skippable, and `lastItems` for variety (5.6) |
| 11 | Budget and validate the 20 hand forks; validate every FEN in tests | 20 forks in Pack E, about 2 h, with the fork validator and 7 verified seeds; `validate()` is mandatory and run over all registered content (13.13, 15) |
| 12 | Setup belongs after the pieces are learned (J2) | w5-setup (4) |
| 13 | Stronger parent gate (arithmetic in words or a PIN); gate the extension, exit, Grown-ups, delete and import | Section 10.4 |
| 14 | Scope the framework MVP; placement and playground work with what is registered; simple art first | Step 0 MVP list, with the wardrobe and scene in step 2 (16) |
| 15 | Exact missing-pack unlock rule, with a test | Section 5.2, test 15.6 |
| 16 | Tune bots by band; Sprout Pawn War at depth 1 with high randomness | Section 13.7, `w5-boss` S: depth 1, r 1.0 |
| 17 | Board theming must not break when the board team rewrites themes | Scoped square overrides at specificity (0,3,0), the contract, and a screenshot check under every theme (7.3, 15) |
| 18 | freeMoves has no promotion; the lazy named export | `miniRules.applyMove` auto-queens; the `.then(m => ({default: m.KidsApp}))` diff (11.5, 14) |
| 19 | Data model: lastItems, brave try, family jar, capped seen list | `NodeProgress.lastItems`, `st-brave-try`, `KidsState.family`, a `seen` ring of 300 (11.4) |
| 20 | Clarify the Sprout graduation | `w8-crown` win plus w8-mate-hunt (3 queen/rook mate-in-1s) (4) |
| 21 | Balance pack sizes | 5 packs of about 800-1,100 LOC each (16) |
| 22 | Champion session default not "off"; the extension needs the gate | 30 min default; the gate on extension (2, 10.5) |
| 23 | Mute Board move sounds | Kids code never imports sound.ts; kidsSound owns all audio; a test enforces it (7.7, 15) |
| 24 | Sibling pass-and-play plus Capture the Crown before Rank 7 | Friend mode in battle, capture-crown and play-bot; w6-crown-game (13.7, 13.8, 13.12) |
| 25 | Tested-out nodes still earn stickers, are visible, and the Sprout placement cap | Section 3.2 |
| 26 | Kids storage out of cloud.ts, with a test | Sections 10.6 and 15 |
| 27 | Correct the grafted puzzle counts and the P3 mate FEN | Section 17 |

### 18.2 Grafts adopted
- **From P2**:
  - per-band `tune` and `superTune`
  - cloud `area` mini-boards
  - Easier one? / Skip this one / Super Star (golden star)
  - Paint the Moves
  - check-spotter with scared/calm king buttons and "tap the attacker" (quiz `status2`)
  - "Who can munch?" (quiz `munch`)
  - Solo Chess "Last Piece Standing"
  - Magic Memory (Playground)
  - Sneak Past the Guards: a single goal star plus statues in the stars activity (no separate activity is needed)
  - Castle Time with a reason picker
  - Family Star Jar
  - sibling pass-and-play with handicaps
  - Puzzle of the Day seeded by day and band
  - golden stars
  - the endless generator (Star Hunt Endless)
  - sticker facts read aloud
  - total-days garden
  - Shelly skips mate-in-1
  - `aria-live` bubble
  - a big promotion picker
  - "touch the board within 2 seconds"
- **From P3**:
  - auto-select of a lone piece (in KidsBoard)
  - Piece Parade picture-quiz intros (`IntroStep.pick`)
  - Capture the Crown with danger bells
  - Mate Detective cards (quiz `status4`)
  - the pronunciation map, voiceschanged handling and the iOS unlock
  - optional PIN and "Lock Kids mode on this device"
  - kid mute covering move sounds
  - brave-try sticker
  - left-handed mirror
  - sticker scene
  - age number buttons 4-12
  - Oops shield (Champion)
  - visibility-aware session minutes
  - tap-only
  - Pip owning his mistakes
  - no left/right wording
  - "needed help with" in the report
  - unranked friend mode

### 18.3 Deliberately not adopted
| idea | source | reason |
|---|---|---|
| 12 lands | P3 | Fragmented; the 8-rank metaphor is stronger |
| Window cropping with a translate over Board | P3 | Clashes with the frame, coordinates and promotion popup; cloud areas replace it |
| Random adventure stickers | P3 | A variable reward |
| A week garden that resets on Monday | P3 | A loss cue |
| Sprouts barred from check and mate | P3 | Sprouts reach real chess through w6-w8 |
| Pawns first, and en passant in Land 1 | P2 | Pedagogically backwards |
| Sprouts always get 3 stars | P2 | Removes the feedback signal; parSlack and bossPass 1 are used instead |
| A session reminder with no gate | P2 | Weak parental control |
| Three new BoardTheme union values | P2 | Collides with the board team |
| A cast of host characters (Rocky, Bobbi and others) | P2 | Art burden; Pip and the buddies carry the personality |
| Crown Race | P2 | Promotion is covered by w5-promo, battles and the find-move `p` flag |
| Stockfish Elo 1320 bots | P1 and P2 | Too strong |
| The spelled-out "seven, two, five" gate | P1 | Kids who can read pass it |
| The "10 moves" loss rule | P1 | Replaced by a flat 1 star for any loss |
