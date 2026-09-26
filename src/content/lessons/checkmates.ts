import type { Unit } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const checkmates: Unit = {
  id: 'checkmates',
  title: 'Checkmate Patterns',
  tagline: 'The mating nets that decide most games, drilled until you see them instantly.',
  level: 'Beginner',
  lessons: [
    // ---------------------------------------------------------------- 1
    {
      id: 'mate-back-rank',
      title: 'The Back-Rank Mate',
      summary: 'A king trapped behind its own pawns can be mated by a single rook or queen.',
      minutes: 8,
      steps: [
        {
          kind: 'read',
          title: 'Trapped by its own pawns',
          text:
            'The black king sits behind three unmoved pawns. They shield it from the front, but they also leave it without **luft** (air): no square to step to.\n\n' +
            'A rook or queen that reaches the back rank with check is mate, unless something can capture it or block. Here Rd8 is mate. Your own king faces the same danger, so this pattern cuts both ways.',
          fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
          arrows: [{ from: 'd1', to: 'd8', color: 'green' }],
          marks: [{ square: 'g8', color: 'red' }],
        },
        {
          kind: 'move',
          title: 'Mate in one',
          text: 'White to move. Black has a queen against your rook, but Black\'s king has no luft. Mate in one.',
          fen: '6k1/5ppp/1q6/8/8/8/P4PPP/4R1K1 w - - 0 1',
          solution: ['Re8#'],
          hint: 'Which rank can the black king not escape from?',
          success: 'Re8#. The pawns on f7, g7 and h7 are the king\'s own prison bars, and nothing can capture the rook or block the check.',
        },
        {
          kind: 'demo',
          title: 'Two attackers beat one defender',
          text: 'Black\'s c8-rook guards the back rank alone. White has two rooks on the open d-file.',
          fen: '2r3k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1',
          moves: ['Rd8+', 'Rxd8', 'Rxd8#'],
          notes: [
            '1.Rd8+: the first rook offers itself on the back rank.',
            '1...Rxd8: forced. Black\'s only guard of the eighth rank has to take.',
            '2.Rxd8#: the second rook arrives and nothing is left to defend.',
          ],
        },
        {
          kind: 'move',
          title: 'Deflect the defender',
          text: 'White to move. Your queen and rook are lined up on the open d-file, and only the c8-rook guards Black\'s back rank. Mate in two.',
          fen: '2r3k1/5ppp/8/8/8/1q6/3Q1PPP/3R2K1 w - - 0 1',
          solution: ['Qd8+', 'Rxd8', 'Rxd8#'],
          hint: 'Offer your queen on the back rank with check. Only the c8-rook can take it, and your d1-rook stands behind.',
          success: 'Qd8+! Rxd8 Rxd8#. The queen sacrifice drags the defender onto d8, and the rook behind it finishes the job.',
        },
        {
          kind: 'quiz',
          title: 'Give your king air',
          text: 'White to move, with no immediate threat. Which quiet move best protects your king against back-rank tricks for the rest of the game?',
          fen: '4r1k1/5pp1/7p/8/8/8/PP3PPP/3R2K1 w - - 0 1',
          choices: [
            { text: 'h3', correct: true, why: 'The king gets h2 as an escape square, and a pawn on h3 is hard to attack. Black already did the same with ...h6.' },
            { text: 'Kf1', why: 'The king stays on the back rank and steps toward the open e-file, where Black\'s rook is waiting.' },
            { text: 'b3', why: 'A reasonable pawn move elsewhere, but it gives the king nothing.' },
          ],
        },
        {
          kind: 'move',
          title: 'Now as Black',
          text: 'Black to move. Your h6-pawn gives your king luft; White\'s king has none. Exploit the difference: mate in two.',
          fen: '3r2k1/5pp1/7p/8/3q4/8/2Q2PPP/3R2K1 b - - 0 1',
          solution: ['Qxd1+', 'Qxd1', 'Rxd1#'],
          hint: 'White\'s d1-rook is defended only by the queen. What happens if you take it with check?',
          success: '...Qxd1+! Qxd1 Rxd1#. Your queen lures White\'s queen onto d1, and your rook takes it with mate on the back rank.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- A king behind unmoved pawns can be mated by one rook or queen on the back rank.\n' +
            '- Count guards: with more heavy pieces on the file than the defender has, sacrifice to break through.\n' +
            '- A queen sacrifice that deflects the last defender is the most common finish.\n' +
            '- Give your own king luft (h3 or ...h6) once the heavy pieces start to come into play.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'mate-queen-king',
      title: 'Queen and King Mates',
      summary: 'Drive the lone king to the edge with the queen, bring your king, and never stalemate.',
      minutes: 9,
      steps: [
        {
          kind: 'read',
          title: 'The queen needs her king',
          text:
            'A queen alone cannot mate a lone king in the open. With her own king\'s help, two final pictures cover almost every case.\n\n' +
            'The first: the queen gives check right next to the enemy king and is protected by her own king. Here Qg7 is mate. It works on any edge square.',
          fen: '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1',
          marks: [
            { square: 'h8', color: 'red' },
            { square: 'g7', color: 'green' },
          ],
        },
        {
          kind: 'read',
          title: 'Mate along the edge',
          text:
            'The second picture: the kings stand **face to face** and the queen checks along the edge. The white king covers c7, d7 and e7; the queen covers the whole eighth rank.\n\n' +
            'Both pictures need the enemy king on the edge. So the method is: drive it there with the queen, then bring your king.',
          fen: '3k3Q/8/3K4/8/8/8/8/8 b - - 0 1',
          arrows: [{ from: 'h8', to: 'd8', color: 'green' }],
          marks: [
            { square: 'c7', color: 'blue' },
            { square: 'd7', color: 'blue' },
            { square: 'e7', color: 'blue' },
          ],
        },
        {
          kind: 'demo',
          title: 'Shrinking the box',
          text: 'Keep the queen a knight\'s jump from the enemy king. It shrinks the king\'s box without giving check.',
          fen: '8/8/1k6/8/8/3K4/8/2Q5 w - - 0 1',
          moves: ['Qc4', 'Kb7', 'Qc5', 'Ka6', 'Qb4', 'Ka7', 'Qb5', 'Ka8', 'Kc4', 'Ka7', 'Kc5', 'Ka8', 'Kc6', 'Ka7', 'Qb7#'],
          notes: [
            '1.Qc4: the queen stands a knight\'s jump from the king. Black is confined to the top-left corner.',
            '1...Kb7: the king looks for a way out.',
            '2.Qc5: follow it, again a knight\'s jump away. The box shrinks.',
            '2...Ka6',
            '3.Qb4: now the king has a single square, a7.',
            '3...Ka7',
            '4.Qb5: the king is locked on a7 and a8. Stop here: another queen move risks stalemate.',
            '4...Ka8',
            '5.Kc4: bring the king. The queen stays where she is.',
            '5...Ka7',
            '6.Kc5',
            '6...Ka8',
            '7.Kc6: close enough to support the queen.',
            '7...Ka7',
            '8.Qb7#: the queen mates next to the king, protected from c6.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Spot the stalemate',
          text: 'White to move. One of these moves throws away the win. Which one?',
          fen: 'k7/7Q/1K6/8/8/8/8/8 w - - 0 1',
          choices: [
            { text: 'Qc7', correct: true, why: 'Black is not in check, and a7, b7 and b8 are all covered: stalemate, a draw.' },
            { text: 'Qb7#', why: 'This is mate: the queen is protected by the king on b6.' },
            { text: 'Qh8#', why: 'Mate along the back rank: your king covers a7 and b7.' },
            { text: 'Qd7', why: 'Not stalemate, because Black can play ...Kb8. It is not mate either, but the win is still there.' },
          ],
        },
        {
          kind: 'move',
          title: 'Finish it',
          text: 'Same position. Now deliver checkmate.',
          fen: 'k7/7Q/1K6/8/8/8/8/8 w - - 0 1',
          solution: ['Qb7#'],
          hint: 'Mate next to the king with protection, or check along the back rank.',
          success: 'Mate. Qb7#, Qa7#, Qg8# and Qh8# all work. What matters is check with nowhere to go, not a quiet squeeze.',
        },
        {
          kind: 'move',
          title: 'Face to face',
          text: 'White to move. The kings stand face to face. Mate in one.',
          fen: '4k3/7Q/4K3/8/8/8/8/8 w - - 0 1',
          solution: ['Qe7#'],
          hint: 'Check along the back rank, or right next to the king where your own king protects the queen.',
          success: 'Mate. Qe7#, Qg8# and Qh8# all finish. Qf7+ is check but lets the king out to d8.',
        },
        {
          kind: 'move',
          title: 'On the side edge',
          text: 'White to move. The black king is on the h-file. Mate in one.',
          fen: '8/8/8/8/5K1k/8/8/6Q1 w - - 0 1',
          solution: ['Qg4#'],
          hint: 'Your king on f4 covers g3, g4 and g5. Use the h-file, or a protected square next to the black king.',
          success: 'Mate. Qg4#, Qh2# and Qh1# all work: the same two pictures, turned on their side.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- The queen cannot mate alone. Drive the king to the edge, then bring your own king.\n' +
            '- Keep the queen a knight\'s jump from the enemy king to shrink its box without checking.\n' +
            '- When the king has two squares left, stop moving the queen and walk your king in.\n' +
            '- Before every quiet queen move, ask: does my opponent still have a legal move?',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'mate-ladder',
      title: 'The Ladder: Two Heavy Pieces',
      summary: 'Two rooks, or queen and rook, mate on the edge by taking turns up the board.',
      minutes: 8,
      steps: [
        {
          kind: 'read',
          title: 'Two rooks need no king',
          text:
            'Two rooks, or a queen and a rook, can mate without their king\'s help. One piece builds a wall; the other gives check on the next rank.\n\n' +
            'Here the a7-rook seals off the seventh rank, so Rb8 is mate. Because the pieces take turns stepping up rank by rank, this is called the **ladder** (or lawnmower) mate.',
          fen: '4k3/R7/8/8/8/8/8/1R4K1 w - - 0 1',
          arrows: [
            { from: 'a7', to: 'h7', color: 'blue' },
            { from: 'b1', to: 'b8', color: 'green' },
          ],
        },
        {
          kind: 'demo',
          title: 'Climbing the ladder',
          text: 'Watch the rooks push the king from the centre to the back rank, one rank at a time.',
          fen: '8/8/8/3k4/8/8/7R/R5K1 w - - 0 1',
          moves: ['Ra4', 'Ke5', 'Rh5+', 'Kf6', 'Ra6+', 'Kg7', 'Rb5', 'Kf7', 'Rb7+', 'Ke8', 'Ra8#'],
          notes: [
            '1.Ra4: the first rook cuts the king off from the lower half of the board.',
            '1...Ke5',
            '2.Rh5+: the second rook checks from far away, one rank higher. The king must climb.',
            '2...Kf6',
            '3.Ra6+: the rooks swap roles. The a-rook checks while the h-rook holds the fifth rank.',
            '3...Kg7: the king heads for the h5-rook. Rh7+ now would lose it to ...Kxh7.',
            '4.Rb5: so that rook moves to the far side of the board, staying on its rank.',
            '4...Kf7',
            '5.Rb7+: check on the seventh. One rank to go.',
            '5...Ke8',
            '6.Ra8#: the a-rook checks on the eighth while the b-rook covers the seventh.',
          ],
        },
        {
          kind: 'quiz',
          title: 'When the king attacks',
          text: 'The black king has come toward your h5-rook. What is the cleanest continuation?',
          fen: '8/6k1/R7/7R/8/8/8/6K1 w - - 0 1',
          choices: [
            { text: 'Rb5: slide the rook to the far side of the same rank', correct: true, why: 'It stays out of the king\'s reach and still guards the fifth rank. Rb7+ comes next.' },
            { text: 'Rh7+', why: 'h7 is next to the king: ...Kxh7 wins the rook.' },
            { text: 'Ra7+', why: 'The king steps to g6, attacks the h5-rook and escapes the net.' },
          ],
        },
        {
          kind: 'move',
          title: 'Ladder in the middlegame',
          text: 'White to move. Black\'s queen has wandered off to a2. Mate in one.',
          fen: '6k1/1R6/6p1/7p/8/8/q4PPP/2R3K1 w - - 0 1',
          solution: ['Rc8#'],
          hint: 'One rook already holds the seventh rank. Where can the other one check?',
          success: 'Rc8#. The b7-rook covers f7, g7 and h7; the c8-rook covers f8 and h8.',
        },
        {
          kind: 'move',
          title: 'Mate in two',
          text: 'White to move. The a6-rook already keeps the king off the sixth rank. Mate in two.',
          fen: '8/4k3/R7/8/8/8/5qPP/1R5K w - - 0 1',
          solution: ['Rb7+', 'Kd8', 'Ra8#'],
          hint: 'Check on the seventh rank first, then climb to the eighth.',
          success: 'Rb7+ Kd8 Ra8#. Wherever the king steps on the back rank, the a-rook mates it there.',
        },
        {
          kind: 'move',
          title: 'Queen and rook',
          text: 'White to move. A queen and a rook cooperate the same way: one controls a rank, the other strikes. Black threatens ...Qa1+. Mate in one.',
          fen: '1r4k1/4R1pp/8/8/6Q1/8/q4PPP/6K1 w - - 0 1',
          solution: ['Qxg7#'],
          hint: 'Your rook on e7 controls the seventh rank. Which square next to the king does it support?',
          success: 'Qxg7#. The e7-rook protects the queen along the seventh rank, and the queen covers f8, h8 and f7.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Two rooks, or queen and rook, mate a king on the edge without their own king.\n' +
            '- One piece holds a rank; the other checks on the next one. Then they swap.\n' +
            '- If the enemy king approaches a rook, move that rook to the far side of the same rank.\n' +
            '- In the middlegame, a rook on the seventh plus a second heavy piece often means mate.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'mate-smothered',
      title: 'Smothered Mate',
      summary: 'A lone knight mates a king buried by its own pieces, often after a queen sacrifice.',
      minutes: 8,
      steps: [
        {
          kind: 'read',
          title: 'A king buried alive',
          text:
            'A **smothered mate** is a knight check against a king surrounded by its own pieces. The king on h8 is boxed in by the g8-rook and the g7- and h7-pawns, so the check from f7 has no answer.\n\n' +
            'A knight check can never be blocked. If the king cannot move and nothing can capture the knight, it is mate.',
          fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1',
          marks: [
            { square: 'h8', color: 'red' },
            { square: 'g8', color: 'blue' },
            { square: 'g7', color: 'blue' },
            { square: 'h7', color: 'blue' },
          ],
        },
        {
          kind: 'move',
          title: 'Mate in one',
          text: 'White to move. Black threatens ...Qxd1+ with mate on your back rank. Get there first.',
          fen: '6rk/pp4pp/8/6N1/8/8/2q2PPP/3R2K1 w - - 0 1',
          solution: ['Nf7#'],
          hint: 'Every square around the black king is filled by Black\'s own pieces. Which knight check has no answer?',
          success: 'Nf7#. The king cannot move, nothing can capture on f7, and a knight check can never be blocked.',
        },
        {
          kind: 'demo',
          title: 'Philidor\'s Legacy',
          text: 'The most famous smothered mate: a queen on the a2-g8 diagonal and a knight dance.',
          fen: '3qr2k/pp4pp/8/6N1/2Q5/8/PP3PPP/6K1 w - - 0 1',
          moves: ['Nf7+', 'Kg8', 'Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#'],
          notes: [
            '1.Nf7+: check, and a fork of king and queen. White is after bigger game.',
            '1...Kg8: the only move.',
            '2.Nh6+: a **double check** from knight and queen, so the king must move. (2...Kf8 3.Qf7# is also mate.)',
            '2...Kh8',
            '3.Qg8+!: the queen sacrifice. The knight on h6 guards g8, so the king cannot take.',
            '3...Rxg8: forced. Now the rook blocks the king\'s last flight square.',
            '4.Nf7#: smothered. This sequence is known as **Philidor\'s Legacy**.',
          ],
        },
        {
          kind: 'move',
          title: 'Queen sacrifice, knight mate',
          text: 'White to move. Black threatens ...Qxf2+ and ...gxh6. Your knight is on h6 and your queen on the a2-g8 diagonal. Mate in two.',
          fen: 'r4r1k/6pp/7N/8/3q4/1Q6/5PPP/6K1 w - - 0 1',
          solution: ['Qg8+', 'Rxg8', 'Nf7#'],
          hint: 'The knight on h6 protects g8. Offer the queen there.',
          success: 'Qg8+! Rxg8 Nf7#. Note that Nf7+ at once fails to ...Rxf7. The sacrifice pulls that rook off f8 and onto the king\'s last free square.',
        },
        {
          kind: 'quiz',
          title: 'The point of the sacrifice',
          text: 'In the combination Qg8+ Rxg8 Nf7#, what does the queen sacrifice achieve?',
          choices: [
            { text: 'It forces a black piece onto g8, the king\'s last free square', correct: true, why: 'After ...Rxg8 the king is completely surrounded by its own pieces, so the knight check is mate.' },
            { text: 'It wins material', why: 'It gives away the queen. It works only because mate follows at once.' },
            { text: 'It opens the h-file for a rook', why: 'No file is opened. The point is to fill g8.' },
          ],
        },
        {
          kind: 'move',
          title: 'Now as Black',
          text: 'Black to move. This time White\'s king is hemmed in by its own pieces. Mate in two.',
          fen: '6k1/5ppp/1q6/3Q4/8/7n/6PP/R4R1K b - - 0 1',
          solution: ['Qg1+', 'Rxg1', 'Nf2#'],
          hint: 'Your knight on h3 guards g1. Offer the queen there.',
          success: '...Qg1+! Rxg1 Nf2#. The same pattern mirrored: the rook fills g1, and the knight checks a king with nowhere to go.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Smothered mate: a knight checks a king surrounded by its own pieces.\n' +
            '- Look for it when the enemy king sits in the corner behind unmoved pawns.\n' +
            '- The standard trick: sacrifice the queen on g8 (or g1), guarded by the knight, to force a rook onto the king\'s last square.\n' +
            '- A knight-and-queen double check forces the king to move, which is how Philidor\'s Legacy begins.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'mate-knight-rook',
      title: 'Knight and Rook Mates',
      summary: 'The Arabian, Anastasia\'s and hook mates: a knight covers what the rook cannot.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'The Arabian mate',
          text:
            'A knight and a rook complement each other: the knight covers squares the rook cannot reach.\n\n' +
            'In the **Arabian mate**, one of the oldest recorded mates, the rook checks from right next to the cornered king. The knight does two jobs: it protects the rook on h7 and covers g8.',
          fen: '7k/7R/5N2/8/8/8/8/6K1 b - - 0 1',
          arrows: [
            { from: 'f6', to: 'h7', color: 'green' },
            { from: 'f6', to: 'g8', color: 'green' },
          ],
          marks: [{ square: 'h8', color: 'red' }],
        },
        {
          kind: 'move',
          title: 'Arabian mate',
          text: 'White to move. Black threatens ...Qd1+ and ...Rc1+, both mating you. Strike first.',
          fen: '2r4k/1R6/5N2/8/3q4/8/5PPP/6K1 w - - 0 1',
          solution: ['Rh7#'],
          hint: 'Your knight on f6 covers g8 and h7. Bring the rook next to the king.',
          success: 'Rh7#. The knight protects the rook and covers g8, and the rook covers g7. It travelled the whole seventh rank to get there.',
        },
        {
          kind: 'read',
          title: 'Anastasia\'s mate',
          text:
            'In **Anastasia\'s mate** a knight on e7 covers g8 and g6, the king\'s own g7-pawn blocks another square, and a rook or queen mates along the h-file.\n\n' +
            'The usual way to set it up is forcing: a queen sacrifice on h7 drags the king onto the file.',
          fen: '8/4N1pk/8/7R/8/8/8/6K1 b - - 0 1',
          arrows: [
            { from: 'e7', to: 'g8', color: 'green' },
            { from: 'e7', to: 'g6', color: 'green' },
            { from: 'h5', to: 'h7', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'The queen sacrifice',
          text: 'The knight is already on e7. Watch the h-file open.',
          fen: '5r1k/2q1Nppp/8/7Q/8/3R4/5PPP/6K1 w - - 0 1',
          moves: ['Qxh7+', 'Kxh7', 'Rh3#'],
          notes: [
            '1.Qxh7+!: the queen gives herself up to open the h-file.',
            '1...Kxh7: forced.',
            '2.Rh3#: the knight covers g8 and g6, Black\'s own pawn blocks g7, and the rook checks along the open file.',
          ],
        },
        {
          kind: 'move',
          title: 'Anastasia in three',
          text: 'White to move. Build the pattern yourself: mate in three.',
          fen: 'q4rk1/5ppp/8/3N3Q/8/4R3/5PPP/6K1 w - - 0 1',
          solution: ['Ne7+', 'Kh8', 'Qxh7+', 'Kxh7', 'Rh3#'],
          hint: 'First put the knight on e7 with check. Then open the h-file.',
          success: 'Ne7+ Kh8 Qxh7+! Kxh7 Rh3#. Knight to e7, queen sacrifice on h7, rook to the h-file.',
        },
        {
          kind: 'read',
          title: 'The hook mate',
          text:
            'The **hook mate** is a chain: the c5-pawn protects the knight, the knight protects the rook on e8, and the rook gives check.\n\n' +
            'The king cannot take the rook. The knight covers f7, the rook covers e7 and g8, and Black\'s own g7-pawn blocks the last square.',
          fen: '4Rk2/6pp/3N4/2P5/8/8/8/6K1 b - - 0 1',
          arrows: [
            { from: 'c5', to: 'd6', color: 'blue' },
            { from: 'd6', to: 'e8', color: 'blue' },
          ],
          marks: [
            { square: 'f8', color: 'red' },
            { square: 'g7', color: 'yellow' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Name the mate',
          text: 'Black is checkmated. Which pattern is this?',
          fen: 'k7/R7/2N5/8/8/8/8/6K1 b - - 0 1',
          choices: [
            { text: 'Arabian mate', correct: true, why: 'The rook checks right next to the cornered king, and the knight protects it while covering b8.' },
            { text: 'Anastasia\'s mate', why: 'In Anastasia\'s mate the rook checks along a file from a distance, and the king\'s own pawn blocks an escape square.' },
            { text: 'Hook mate', why: 'The hook needs a pawn guarding the knight and a king hemmed in by its own pawn. Here the knight stands alone.' },
            { text: 'Smothered mate', why: 'The king is not surrounded by its own pieces, and the rook, not the knight, gives check.' },
          ],
        },
        {
          kind: 'move',
          title: 'Hook mate',
          text: 'White to move. Black\'s queen attacks your knight and eyes f2. Mate in one.',
          fen: '5k2/6pp/3N4/2P5/3q4/8/5PPP/4R1K1 w - - 0 1',
          solution: ['Re8#'],
          hint: 'The c5-pawn guards the knight, and the knight guards e8.',
          success: 'Re8#. Pawn protects knight, knight protects rook, and the g7-pawn walls in its own king.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- The knight covers squares a rook cannot, so together they mate in many shapes.\n' +
            '- Arabian: rook next to the cornered king, protected by the knight.\n' +
            '- Anastasia\'s: knight on e7, king on h7 behind its g-pawn, heavy piece on the h-file.\n' +
            '- Hook: pawn guards knight, knight guards rook, and the king\'s own pawn blocks the last square.\n' +
            '- A queen sacrifice on h7 often sets these patterns up.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'mate-diagonals',
      title: 'Diagonal Mates: Boden, Greek Gift, Damiano',
      summary: 'Bishops on crossing diagonals, the queen-and-bishop battery on h7, and pawn-supported queen mates.',
      minutes: 12,
      steps: [
        {
          kind: 'read',
          title: 'Boden\'s mate',
          text:
            'In **Boden\'s mate** two bishops strike along crossing diagonals. The pattern is named after Samuel Boden, who beat Schulder in London, 1853, with the finish ...Qxc3+! bxc3 Ba3#. Here the a3-bishop checks, the f5-bishop covers b1 and c2, and White\'s own rook and knight block d1 and d2.\n\n' +
            'Its usual victim is a king castled queenside whose pawn cover has been torn open.',
          fen: '2k1r2r/ppp3pp/2n5/3B1b2/5P2/b1P1BQ2/P2N1P1P/2KR3R w - - 1 16',
          arrows: [
            { from: 'a3', to: 'c1', color: 'red' },
            { from: 'f5', to: 'b1', color: 'red' },
          ],
          marks: [{ square: 'c1', color: 'red' }],
        },
        {
          kind: 'move',
          title: 'Play Boden\'s combination',
          text: 'Black to move, in the game position a move earlier. Find Boden\'s idea: mate in two.',
          fen: '2k1rb1r/ppp3pp/2n2q2/3B1b2/5P2/2P1BQ2/PP1N1P1P/2KR3R b - - 0 14',
          solution: ['Qxc3+', 'bxc3', 'Ba3#'],
          hint: 'Your queen can smash the pawns in front of White\'s king. Then which bishop gives check?',
          success: '...Qxc3+! bxc3 Ba3#. The queen sacrifice removes the b-pawn, and the two bishops cover every square around the king.',
        },
        {
          kind: 'read',
          title: 'The h7 battery',
          text:
            'Line up queen and bishop on the same diagonal and you have a **battery**: the queen in front, the bishop behind. Qxh7 is mate when nothing else defends h7.\n\n' +
            'The usual defender of h7 is a knight on f6. When it is missing, or can be chased away, look at h7.',
          fen: '5rk1/5ppp/8/8/8/3Q4/2B2PPP/6K1 w - - 0 1',
          arrows: [
            { from: 'c2', to: 'd3', color: 'blue' },
            { from: 'd3', to: 'h7', color: 'green' },
          ],
          marks: [{ square: 'h7', color: 'red' }],
        },
        {
          kind: 'move',
          title: 'Battery mate',
          text: 'White to move. Black is ahead in material and attacking your bishop. Use the battery.',
          fen: '5rk1/p4ppp/8/8/8/3Q4/1qB2PPP/6K1 w - - 0 1',
          solution: ['Qxh7#'],
          hint: 'Queen in front, bishop behind, both aiming at h7.',
          success: 'Qxh7#. The c2-bishop protects the queen, Black\'s own rook blocks f8, and the queen covers h8.',
        },
        {
          kind: 'demo',
          title: 'The Greek gift',
          text: 'The bishop sacrifice Bxh7+ needs three things: a bishop aiming at h7, a knight that can reach g5, and a queen that can reach the h-file. Here e5 has already chased Black\'s knight away from f6.',
          fen: 'r1bq1rk1/pp1n1ppp/2n1p3/2ppP3/3P4/2PB1N2/PP3PPP/R1BQK2R w KQ - 0 1',
          moves: ['Bxh7+', 'Kxh7', 'Ng5+', 'Kg8', 'Qh5', 'Qxg5', 'Bxg5'],
          notes: [
            '1.Bxh7+!: the bishop is sacrificed to tear open the king\'s cover. This is the **Greek gift**.',
            '1...Kxh7',
            '2.Ng5+: the knight checks and hits h7 again.',
            '2...Kg8: the natural retreat. (2...Kg6 is Black\'s toughest try, but the king is left exposed.)',
            '3.Qh5: queen and knight both hit h7, and Qh7# is threatened.',
            '3...Qxg5: the only way to stop the mate is to give up the queen.',
            '4.Bxg5: White has traded bishop and knight for queen and pawn.',
          ],
        },
        {
          kind: 'quiz',
          title: 'The key defender',
          text: 'Why does a black knight on f6 usually stop both the h7 battery and the Greek gift?',
          choices: [
            { text: 'It defends h7', correct: true, why: 'A knight on f6 guards h7, so Qxh7 is no longer mate and the attacking pieces run into a defender.' },
            { text: 'It blocks the b1-h7 diagonal', why: 'f6 is not on that diagonal. The knight guards h7 directly.' },
            { text: 'It attacks the square g5', why: 'It does not: a knight on f6 covers e4, g4, h5 and h7, among others, but not g5.' },
          ],
        },
        {
          kind: 'demo',
          title: 'Damiano\'s mate',
          text: 'A queen on h7 protected by a pawn on g6 is **Damiano\'s mate**, named after Pedro Damiano, who published it in 1512. Here is the classic route, with two rook sacrifices on the h-file.',
          fen: '5rk1/6p1/6P1/8/8/7R/1K6/Q3R3 w - - 0 1',
          moves: ['Rh8+', 'Kxh8', 'Rh1+', 'Kg8', 'Rh8+', 'Kxh8', 'Qh1+', 'Kg8', 'Qh7#'],
          notes: [
            '1.Rh8+!: the first rook is given up to drag the king into the corner.',
            '1...Kxh8: forced. The g6-pawn covers f7 and h7.',
            '2.Rh1+: the second rook takes over the open h-file.',
            '2...Kg8',
            '3.Rh8+!: and is sacrificed too, gaining time.',
            '3...Kxh8',
            '4.Qh1+: the queen arrives on the h-file with check.',
            '4...Kg8',
            '5.Qh7#: the g6-pawn protects the queen and covers f7. Black\'s own rook blocks f8.',
          ],
        },
        {
          kind: 'move',
          title: 'Damiano in three',
          text: 'White to move. Your g6-pawn is a thorn in Black\'s position. Mate in three.',
          fen: '5rk1/p5p1/1q2p1P1/8/8/7R/5PP1/3Q2K1 w - - 0 1',
          solution: ['Rh8+', 'Kxh8', 'Qh5+', 'Kg8', 'Qh7#'],
          hint: 'Sacrifice the rook to pull the king into the corner, then bring the queen to the h-file with check.',
          success: 'Rh8+! Kxh8 Qh5+ Kg8 Qh7#. The g6-pawn protects the queen and covers f7.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Boden\'s mate: two bishops on crossing diagonals against a boxed-in king.\n' +
            '- Queen in front, bishop behind on the b1-h7 diagonal: Qxh7 is mate if nothing guards h7.\n' +
            '- The Greek gift Bxh7+ needs a knight for g5 and a queen for the h-file.\n' +
            '- Damiano\'s mate: queen on h7 supported by a pawn on g6.\n' +
            '- A knight on f6 is h7\'s key defender. Remove it and look for mate.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7
    {
      id: 'mate-scholars',
      title: 'Scholar\'s Mate and How to Stop It',
      summary: 'The four-move attack on f7, how to defend it calmly, and how to punish an early queen.',
      minutes: 9,
      steps: [
        {
          kind: 'read',
          title: 'The weakest square',
          text:
            'In the starting position, f7 is guarded only by Black\'s king, and f2 only by White\'s. They are the easiest targets on the board.\n\n' +
            '**Scholar\'s mate** aims queen and bishop at f7 and captures there with mate, often on move four. You will meet it in casual games. Learn to spot it, stop it, and punish the queen that comes out too early.',
          fen: START,
          marks: [
            { square: 'f7', color: 'red' },
            { square: 'f2', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'Scholar\'s mate',
          text: 'The whole trap in seven moves.',
          fen: START,
          moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'],
          notes: [
            '1.e4 opens diagonals for the queen and the f1-bishop.',
            '1...e5',
            '2.Qh5: the queen attacks e5 and eyes f7.',
            '2...Nc6: a good move, defending e5.',
            '3.Bc4: now bishop and queen both aim at f7.',
            '3...Nf6??: Black attacks the queen but ignores the threat.',
            '4.Qxf7#: the bishop protects the queen, and the king has nowhere to go.',
          ],
        },
        {
          kind: 'move',
          title: 'Punish the oversight',
          text: 'White to move. Black has just attacked your queen with ...Nf6. Punish it.',
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
          solution: ['Qxf7#'],
          hint: 'Two of your pieces aim at the same square next to the black king.',
          success: 'Qxf7#. The c4-bishop protects the queen, so the king cannot recapture.',
        },
        {
          kind: 'move',
          title: 'Defend e5 first',
          text: 'Black to move. White\'s queen attacks your e5-pawn. Defend it by developing a knight.',
          fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
          solution: ['Nc6'],
          hint: 'Bring a knight to a square that guards e5.',
          success: '...Nc6 develops a piece and protects e5. Avoid ...Nf6?, which drops the pawn to Qxe5+.',
        },
        {
          kind: 'move',
          title: 'Block and hit the queen',
          text: 'Black to move. White threatens Qxf7#. Stop the mate and attack the queen with one move.',
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
          solution: ['g6'],
          hint: 'A pawn move can cut the h5-f7 diagonal and hit the queen at the same time.',
          success: '...g6 blocks the diagonal and kicks the queen, which has to move yet again.',
        },
        {
          kind: 'move',
          title: 'The threat returns',
          text: 'Black to move. White\'s queen has come back to f3, hitting f7 once more. Stop the mate by developing a knight: knights come out before the queen.',
          fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4',
          solution: ['Nf6'],
          hint: 'Put a piece between the queen and f7 on the f-file.',
          success: '...Nf6 blocks the f-file and brings out a piece. White\'s queen has moved twice for nothing, while Black develops with gain of time.',
        },
        {
          kind: 'quiz',
          title: 'Why f7?',
          text: 'Why is f7 (f2 for White) the favourite target of early attacks?',
          choices: [
            { text: 'At the start it is defended only by the king', correct: true, why: 'Every other pawn on Black\'s second rank is guarded by at least one piece besides the king. f7 has only the king.' },
            { text: 'It is a centre pawn', why: 'The centre pawns are on the d- and e-files. f7 is weak for a different reason.' },
            { text: 'The queen can never defend it', why: 'The queen can defend f7, for example with ...Qe7 or ...Qf6. The problem is that at the start only the king does.' },
          ],
        },
        {
          kind: 'move',
          title: 'Fool\'s mate',
          text: 'Black to move. White has opened the diagonal to the king with f3 and g4. Mate in one.',
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
          solution: ['Qh4#'],
          hint: 'Your queen can reach the e1-h4 diagonal, which White has left wide open.',
          success: '...Qh4#. This is **Fool\'s mate**, the fastest checkmate possible. Moving the f- and g-pawns early leaves the king\'s diagonal defenceless.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- At the start, only the king guards f7 (and f2). Watch those squares.\n' +
            '- Against an early Qh5 or Qf3, defend first (...Nc6, ...g6, ...Nf6) and gain time by attacking the queen.\n' +
            '- Never answer a threat on f7 with a move that ignores it.\n' +
            '- An early queen raid wastes time once you develop with tempo.\n' +
            '- Keep your f- and g-pawns at home in the opening.',
        },
      ],
    },
  ],
};
