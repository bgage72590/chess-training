import type { Unit } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const tactics: Unit = {
  id: 'tactics',
  title: 'Tactical Motifs',
  tagline: 'Forks, pins, skewers and the other patterns that win material, drilled until you spot them in your own games.',
  level: 'Intermediate',
  lessons: [
    // ---------------------------------------------------------------- 1
    {
      id: 'tac-fork',
      title: 'The Fork',
      summary: 'One piece attacks two targets at once, and the opponent can only save one.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Two targets, one move',
          text:
            'A **fork** is a single move that attacks two or more targets. Your opponent gets one move to answer, so something usually falls.\n\n' +
            'Look for the triggers: **loose pieces** (no defender), a king and a queen or rook standing a knight\'s jump from the same square, and pieces on lines your queen can reach with check. Here Nxc7+ hits the king on e8 and the rook on a8.',
          fen: 'r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w - - 0 1',
          arrows: [
            { from: 'd5', to: 'c7', color: 'green' },
            { from: 'c7', to: 'e8', color: 'red' },
            { from: 'c7', to: 'a8', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'The fork trick',
          text: 'A pawn fork is a standard way to free your game in the opening. Watch Black give up a knight for one move and win it straight back.',
          fen: START,
          moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Nc3', 'Nxe4', 'Nxe4', 'd5', 'Bd3', 'dxe4', 'Bxe4'],
          notes: [
            '',
            '',
            '',
            '',
            '',
            '',
            '4.Nc3 defends e4 once. It looks safe.',
            '4...Nxe4! Black gives up the knight on purpose.',
            '5.Nxe4 and now the point:',
            '5...d5! The pawn attacks the bishop on c4 and the knight on e4 at the same time.',
            '6.Bd3 saves the bishop...',
            '6...dxe4 ...and Black takes the knight back.',
            '7.Bxe4. Material is level and Black has freed his game. A pawn is the cheapest possible forker.',
          ],
        },
        {
          kind: 'move',
          title: 'Royal fork',
          text: 'White to move. Black\'s king and rook are both loose on the back rank. Win material.',
          fen: '2r3k1/pp3ppp/5n2/3N4/8/8/PP3PPP/4R1K1 w - - 0 1',
          solution: ['Ne7+', 'Kf8', 'Nxc8'],
          hint: 'Checks first: which knight check also attacks c8?',
          success: 'Ne7+ forks king and rook. The knight is protected by the e1-rook, so after the king steps aside, Nxc8 wins a whole rook.',
        },
        {
          kind: 'move',
          title: 'Pawn fork',
          text: 'White to move. Pawns fork too. Find the push that attacks two black pieces.',
          fen: 'r4rk1/pp2qppp/2pb1n2/8/4PP2/2N2Q2/PPPB2PP/R3R2K w - - 0 1',
          solution: ['e5'],
          hint: 'The bishop on d6 and the knight on f6 stand two squares apart on the same rank. Which pawn can hit both?',
          success: 'e5 forks bishop and knight. The pawn is guarded by f4, so even ...Bxe5 fxe5 leaves the knight hanging. Black loses a piece.',
        },
        {
          kind: 'quiz',
          title: 'The knight\'s colour rule',
          text: 'Black\'s king is on g8 and the queen on d8. Is there any square from which a white knight would attack both?',
          fen: '3q2k1/5ppp/8/4N3/8/8/5PPP/6K1 w - - 0 1',
          choices: [
            {
              text: 'No, never',
              correct: true,
              why: 'g8 is a light square and d8 a dark one. A knight always attacks squares of a single colour, the opposite of the one it stands on, so it can only fork pieces on the same colour.',
            },
            { text: 'Yes, from f7', why: 'From f7 the knight hits d8 and h8, but not g8.' },
            { text: 'Yes, from e7', why: 'From e7 the knight hits g8 and c8, but not d8.' },
          ],
        },
        {
          kind: 'move',
          title: 'Queen fork',
          text: 'White to move. The bishop on b4 has no defender. Find the double attack.',
          fen: 'r1bqk2r/ppp2ppp/4pn2/3p4/1bPP4/3BP3/PP1N1PPP/R1BQ1RK1 w - - 0 1',
          solution: ['Qa4+', 'Bd7', 'Qxb4'],
          hint: 'A queen check on the a4-e8 diagonal also looks along the fourth rank.',
          success: 'Qa4+ hits the king and the loose bishop. Black blocks with ...Bd7 and Qxb4 wins a piece. Loose pieces are the favourite targets of a queen fork.',
        },
        {
          kind: 'move',
          title: 'Check and collect',
          text: 'White to move. The a8-rook is undefended and the diagonal to Black\'s king is open.',
          fen: 'r1b3k1/p1pnq1pp/1p6/8/8/2N1B3/PPP2PPP/3Q1RK1 w - - 0 1',
          solution: ['Qd5+', 'Qf7', 'Qxa8'],
          hint: 'Find one queen move that checks the king on g8 and also eyes the long diagonal to a8.',
          success: 'Qd5+ forks king and rook. Black offers a queen trade with ...Qf7, but Qxa8 simply takes the rook first.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- A fork attacks two targets with one move; the opponent can save only one.\n' +
            '- Look for loose pieces, and for king, queen and rooks that sit a knight\'s jump from one square.\n' +
            '- Forks with check are the strongest, because the reply is forced.\n' +
            '- A knight can only fork pieces standing on squares of the same colour.\n' +
            '- Every piece forks, including the king and the humble pawn.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'tac-pin',
      title: 'The Pin',
      summary: 'A piece that cannot move without exposing something bigger behind it is a target, not a defender.',
      minutes: 12,
      steps: [
        {
          kind: 'read',
          title: 'Stuck in front of the king',
          text:
            'A **pin** attacks a piece that shields a more valuable one behind it. Only bishops, rooks and queens can pin.\n\n' +
            'Here the c6-knight is pinned to the king, so moving it is illegal: an **absolute pin**. If the piece behind is a queen or rook, the pin is **relative**: the piece may move, but it costs material.\n\n' +
            'The trigger: an enemy king, queen or rook on an open line with one piece in front of it.',
          fen: 'r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
          arrows: [{ from: 'b5', to: 'e8', color: 'red' }],
          marks: [{ square: 'c6', color: 'yellow' }],
        },
        {
          kind: 'demo',
          title: 'A pawn against a pinned piece',
          text: 'The e4-knight is pinned to its king by the e1-rook. A pinned piece cannot run away, so hit it with something cheap.',
          fen: 'r3k3/ppp2ppp/8/3p4/4n3/2P5/PP3PPP/4RBK1 w - - 0 1',
          moves: ['f3', 'Kf8', 'fxe4', 'dxe4'],
          notes: [
            '1.f3! The pawn attacks the knight, and the knight cannot move.',
            '1...Kf8 unpins, but it is too late: the knight is still attacked.',
            '2.fxe4 wins it.',
            '2...dxe4. White has won a knight for a pawn.',
          ],
        },
        {
          kind: 'move',
          title: 'Win the pinned knight',
          text: 'White to move. The knight on e5 is pinned to Black\'s king. Win it.',
          fen: '4k2r/pppq2pp/2bp4/4n3/8/1BN5/PPPQ1PPP/4R1K1 w - - 0 1',
          solution: ['f4'],
          hint: 'The pinned knight cannot move. Attack it with a pawn.',
          success: 'f4! The knight is attacked and pinned, so Black loses it for a pawn. Attacking a pinned piece with a pawn is the simplest way to cash in a pin.',
        },
        {
          kind: 'move',
          title: 'A pinned piece is a fake defender',
          text: 'White to move. The g6-knight looks protected by the f7-pawn. Look again.',
          fen: '3r2k1/ppqb1pp1/2p3np/8/2B5/2PQ1N2/PP3PPP/4R1K1 w - - 0 1',
          solution: ['Qxg6'],
          hint: 'The f7-pawn stands on the diagonal between your c4-bishop and the black king.',
          success: 'Qxg6 wins a knight. The f7-pawn is pinned to the king by Bc4, so ...fxg6 is illegal. Never count a pinned piece as a defender.',
        },
        {
          kind: 'quiz',
          title: 'Dealing with a pin',
          text: 'Black to move. The f6-knight is pinned to the queen by the bishop on g5. Which move does nothing about the pin?',
          fen: 'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 3 4',
          choices: [
            { text: '...Be7', why: 'The bishop steps between: the knight now only shields a bishop, not the queen.' },
            { text: '...h6', why: 'This puts the question to the bishop at once: take on f6 or retreat.' },
            { text: '...Nbd7', why: 'A second defender for f6, so Bxf6 can be met by ...Nxf6 without damage.' },
            {
              text: '...a6',
              correct: true,
              why: 'A useful pawn move elsewhere, but the pin stays exactly as it is. Break a pin by blocking, adding defenders, attacking the pinner, or moving the piece behind.',
            },
          ],
        },
        {
          kind: 'move',
          title: 'Relative pins count too',
          text: 'White to move. The bishop on d5 is defended only by the f6-knight.',
          fen: 'r4rk1/ppp1qppp/5n2/3bp1B1/8/5N2/PPP1QPPP/3R1RK1 w - - 0 1',
          solution: ['Rxd5'],
          hint: 'What is standing behind the f6-knight on the diagonal from g5?',
          success: 'Rxd5 wins a bishop. The knight is pinned to the queen on e7: ...Nxd5 would be answered by Bxe7. A relative pin still paralyses the defender.',
        },
        {
          kind: 'move',
          title: 'Pin the queen',
          text: 'White to move. Black\'s queen and king share a diagonal.',
          fen: '2r2rk1/pp2b1pp/2p1q1n1/5p2/8/1PN5/P1PQ1PPP/R2R1BK1 w - - 0 1',
          solution: ['Bc4', 'Qxc4', 'bxc4'],
          hint: 'The diagonal from c4 to g8 is empty apart from the e6-queen. Which bishop move pins it? Make sure the bishop is protected.',
          success: 'Bc4 pins the queen to the king. Black\'s best is to take the bishop, and bxc4 leaves White a queen for a bishop up.',
        },
        {
          kind: 'move',
          title: 'Legal\'s trap',
          text: 'White to move, after 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6. Your f3-knight is pinned to the queen. Is it really stuck?',
          fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
          solution: ['Nxe5', 'dxe5', 'Qxg4'],
          hint: 'A relative pin can be broken if the reward is big enough. What happens if Black takes your queen?',
          success: 'Nxe5! If 5...Bxd1?? then 6.Bxf7+ Ke7 7.Nd5# is Legal\'s mate. After 5...dxe5 6.Qxg4 White is simply a pawn up.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- A pin freezes a piece in front of a more valuable one.\n' +
            '- Attack a pinned piece with a pawn or pile up more attackers than it has defenders.\n' +
            '- A pinned piece is a fake defender: take what it seems to protect.\n' +
            '- Relative pins are not walls. Check whether breaking one wins something bigger.\n' +
            '- Break pins early: block, add a defender, challenge the pinner, or move the piece behind.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'tac-skewer',
      title: 'The Skewer',
      summary: 'Attack a valuable piece so that when it moves, the piece behind it falls.',
      minutes: 9,
      steps: [
        {
          kind: 'read',
          title: 'A pin turned around',
          text:
            'A **skewer** attacks a valuable piece that has another piece behind it on the same line. The front piece must move, and the one behind is captured.\n\n' +
            'In a pin the weaker piece is in front; in a skewer the stronger one is. Here Re1+ has just been played: the king must leave the e-file and the rook on e8 falls.\n\n' +
            'The trigger: king or queen lined up with another piece, especially when you can attack with check.',
          fen: '4r3/5pp1/7p/4k3/8/6P1/5P1P/4R1K1 b - - 0 1',
          arrows: [{ from: 'e1', to: 'e8', color: 'red' }],
          marks: [{ square: 'e5', color: 'yellow' }],
        },
        {
          kind: 'demo',
          title: 'Through the king',
          text: 'Black\'s king and queen stand on the long diagonal. White checks along it.',
          fen: '7q/5p2/5kp1/7p/8/6P1/5PKP/3Q4 w - - 0 1',
          moves: ['Qd4+', 'Ke6', 'Qxh8'],
          notes: [
            '1.Qd4+ The check runs along the long diagonal. Black cannot block it.',
            '1...Ke6 The king has to leave the diagonal.',
            '2.Qxh8 and the queen behind the king is gone.',
          ],
        },
        {
          kind: 'move',
          title: 'Bishop skewer',
          text: 'White to move. Black\'s king and rook share the long diagonal.',
          fen: 'r7/5p1p/p5p1/1p1k4/8/6P1/PP2BPKP/8 w - - 0 1',
          solution: ['Bf3+', 'Kc5', 'Bxa8'],
          hint: 'Put the bishop on the h1-a8 diagonal with check.',
          success: 'Bf3+ forces the king off the diagonal and Bxa8 wins the rook. Bishop against pawns is an easy win.',
        },
        {
          kind: 'move',
          title: 'Promote with a skewer',
          text: 'White to move. Black has just queened on a1. Your pawn is one step from promotion too.',
          fen: '8/7P/8/8/3k4/6K1/8/q7 w - - 0 1',
          solution: ['h8=Q+', 'Kd5', 'Qxa1'],
          hint: 'Look at the long diagonal from h8 to a1. What stands on it?',
          success: 'h8=Q+ checks along the long diagonal, the king must step off it, and Qxa1 wins Black\'s new queen.',
        },
        {
          kind: 'quiz',
          title: 'Pin or skewer?',
          text: 'Your bishop attacks a rook, and behind the rook on the same diagonal stands the enemy queen. What is this?',
          choices: [
            { text: 'A pin', correct: true, why: 'The less valuable piece is in front, so it is stuck shielding the queen. In a skewer the more valuable piece is in front and must move away.' },
            { text: 'A skewer', why: 'A skewer has the more valuable piece in front, like a king or queen that must step aside.' },
            { text: 'A discovered attack', why: 'A discovered attack needs one of your own pieces to move out of the way.' },
          ],
        },
        {
          kind: 'move',
          title: 'Skewer without check',
          text: 'White to move. Black\'s queen on c6 and rook on e8 stand on one diagonal. The b5-square is covered by your a4-pawn.',
          fen: 'r3rbk1/pp3ppp/2q2n2/8/P7/1Q3N2/1PP2PPP/2RR1BK1 w - - 0 1',
          solution: ['Bb5', 'Qc5', 'Bxe8'],
          hint: 'Attack the queen with a protected bishop on the a4-e8 diagonal.',
          success: 'Bb5 hits the queen, which must leave the diagonal, and Bxe8 wins the exchange. Skewers work against the queen as well as the king.',
        },
        {
          kind: 'move',
          title: 'The rook-ending skewer',
          text: 'White to move. Your rook stands in front of your a-pawn, Black\'s rook is behind it. Black\'s king is on the seventh rank. Win.',
          fen: 'R7/P4k2/8/8/8/r7/6K1/8 w - - 0 1',
          solution: ['Rh8', 'Rxa7', 'Rh7+', 'Kf6', 'Rxa7'],
          hint: 'Clear a8 for the pawn with a rook move that can later check along the seventh rank.',
          success: 'Rh8! If Black takes the pawn, Rh7+ skewers king and rook. If not, a8=Q follows. Every rook-endgame player needs this trick.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- A skewer attacks the more valuable piece first; when it moves, the piece behind falls.\n' +
            '- Look for king or queen on a line with another piece, especially one you can hit with check.\n' +
            '- Kings in the endgame and freshly promoted queens are frequent victims.\n' +
            '- In rook endings, remember Rh8 and Rh7+ when the pawn is on the seventh rank.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'tac-discovered',
      title: 'Discovered Attack and Discovered Check',
      summary: 'Move one piece out of the way to unleash the one behind it, and make two threats at once.',
      minutes: 11,
      steps: [
        {
          kind: 'read',
          title: 'The hidden battery',
          text:
            'In a **discovered attack** one of your pieces moves off a line and uncovers an attack by the bishop, rook or queen behind it. The moving piece can make a threat of its own, so the opponent faces two at once.\n\n' +
            'If the uncovered attack is on the king, it is a **discovered check**, the strongest version: the front piece can go almost anywhere. Here any bishop move uncovers Rd1 against the queen, and Bxh7+ does it with check.',
          fen: '3q1rk1/5ppp/8/8/8/3B4/5PPP/3R2K1 w - - 0 1',
          arrows: [
            { from: 'd1', to: 'd8', color: 'red' },
            { from: 'd3', to: 'h7', color: 'green' },
          ],
        },
        {
          kind: 'demo',
          title: 'A trap in the Petroff',
          text: 'Copying your opponent can be dangerous. Watch the e-file.',
          fen: START,
          moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'Nxe4', 'Qe2', 'Nf6', 'Nc6+', 'Be7', 'Nxd8'],
          notes: [
            '',
            '',
            '',
            '',
            '',
            '3...Nxe4? copies White. The main line is 3...d6 first.',
            '4.Qe2! The queen lines up against Black\'s king on the open e-file.',
            '4...Nf6?? retreats. 4...Qe7 was necessary.',
            '5.Nc6+! Discovered check from the queen, and the knight itself attacks the queen on d8.',
            '5...Be7 Black must answer the check first.',
            '6.Nxd8 and White has won the queen.',
          ],
        },
        {
          kind: 'move',
          title: 'Discovered check',
          text: 'White to move. Black is a queen up for a knight, but look at the long diagonal from b2.',
          fen: '5r2/pb1q1pkp/1p4p1/2p1N3/2P5/1P6/PB3PPP/4R1K1 w - - 0 1',
          solution: ['Nxd7+'],
          hint: 'Only your knight stands between the b2-bishop and Black\'s king. Where can it go with the biggest gain?',
          success: 'Nxd7+ takes the queen with discovered check. Black has to deal with the check, and the queen is gone for nothing.',
        },
        {
          kind: 'move',
          title: 'Check, then collect',
          text: 'White to move. Your rook on d1 is aimed at Black\'s queen, with your own bishop in the way.',
          fen: 'r4rk1/pppq1ppp/2n2b2/8/8/2NB4/PPP2PPP/2QR1RK1 w - - 0 1',
          solution: ['Bxh7+', 'Kxh7', 'Rxd7'],
          hint: 'Move the bishop with the biggest possible threat, so Black has no time to save the queen.',
          success: 'Bxh7+ uncovers the rook with check. Black must answer the check, and Rxd7 wins the queen for a bishop.',
        },
        {
          kind: 'quiz',
          title: 'Why discovered checks are so strong',
          text: 'Your bishop aims at the enemy king, with your own knight in between. Why is this such a powerful setup?',
          choices: [
            {
              text: 'The knight can move anywhere, even to an attacked square, because the opponent must answer the check first.',
              correct: true,
              why: 'The check buys a free move. The knight can grab material or attack something big, and the opponent never gets time to punish it.',
            },
            { text: 'The knight is pinned and cannot move.', why: 'Only enemy pieces get pinned against their own king. Your knight is free to move and uncover the check.' },
            { text: 'The opponent can always block, so it does not matter.', why: 'Blocking uses up the move, which is exactly what the moving knight exploits.' },
          ],
        },
        {
          kind: 'move',
          title: 'The rook uncovers the bishop',
          text: 'White to move. Black\'s rook on d8 attacks your rook. Don\'t retreat: find the discovered attack.',
          fen: '2rr4/pp2kppp/5q2/8/3R4/1P5P/PBQ2PP1/6K1 w - - 0 1',
          solution: ['Re4+', 'Kf8', 'Bxf6'],
          hint: 'Your rook blocks the b2-bishop\'s diagonal to f6. Move it with check.',
          success: 'Re4+ gives check and uncovers the bishop against the queen. After the king moves, Bxf6 wins the queen for a bishop.',
        },
        {
          kind: 'move',
          title: 'Discovery with a mating threat',
          text: 'White to move. Your queen and bishop form a battery aimed at h7, with your knight in front. Mate in two.',
          fen: 'r4rk1/pbq1bppp/1p2p3/8/4N3/2PQ4/PPB2PPP/3RR1K1 w - - 0 1',
          solution: ['Nf6+', 'Bxf6', 'Qxh7#'],
          hint: 'The knight should move with check, so the queen\'s line to h7 opens with tempo.',
          success: 'Nf6+! Whether Black takes the knight or moves the king, Qxh7# follows. The knight check uncovered the battery and Black had no time to cover h7.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Look for your own piece standing between your bishop, rook or queen and an enemy target.\n' +
            '- Move the front piece with a threat of its own: now there are two attacks.\n' +
            '- A discovered check lets the front piece grab anything, even defended material.\n' +
            '- Watch for the same pattern against you: an enemy piece in front of a line piece aimed at your king or queen.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'tac-double-check',
      title: 'Double Check',
      summary: 'Two pieces give check at once: the only defence is to move the king.',
      minutes: 9,
      steps: [
        {
          kind: 'read',
          title: 'Two checks, one answer',
          text:
            'A **double check** is a discovered check in which the moving piece also gives check. Nothing can capture or block two checkers at once, so the king must move.\n\n' +
            'That makes the checking piece untouchable. Here the knight on f6 could be taken by the g7-pawn or the queen, but the e1-rook also gives check. The king has no square: this is mate.',
          fen: 'rnbqkb1r/pp3ppp/2p2N2/8/3P4/8/PPP2PPP/R1BQR1K1 b - - 0 1',
          arrows: [
            { from: 'e1', to: 'e8', color: 'red' },
            { from: 'f6', to: 'e8', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'Philidor\'s legacy',
          text: 'The most famous double check of all leads to a smothered mate.',
          fen: 'r3r2k/pp3ppp/3q4/6N1/2Q5/8/PP3PPP/5RK1 w - - 0 1',
          moves: ['Nxf7+', 'Kg8', 'Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#'],
          notes: [
            '1.Nxf7+ forks king and queen, but White is playing for more.',
            '1...Kg8 is forced.',
            '2.Nh6+ Double check: the knight and the c4-queen both attack g8.',
            '2...Kh8 (2...Kf8 3.Qf7#)',
            '3.Qg8+!! The queen sacrifice lures the rook onto g8.',
            '3...Rxg8 is forced: the knight guards g8, so the king cannot take.',
            '4.Nf7#. Smothered mate: the king is buried by its own pieces.',
          ],
        },
        {
          kind: 'move',
          title: 'Mate with two checks',
          text: 'White to move. Black is a queen up, but the king stands on the open d-file.',
          fen: 'rnbkrbn1/ppp2ppp/8/8/4q3/8/PPPB1PPP/2KR1BNR w - - 0 1',
          solution: ['Bg5#'],
          hint: 'Move the d2-bishop off the d-file with check of its own.',
          success: 'Bg5# is a double check from bishop and rook. The king has no square, and nothing can block or capture both checkers.',
        },
        {
          kind: 'move',
          title: 'The untouchable knight',
          text: 'White to move. Your rook stares down the open e-file at Black\'s king. Win the queen.',
          fen: 'rnb1kb1r/pp1q1ppp/2p5/2B5/3PN3/8/PPP2PPP/R2QR1K1 w - - 0 1',
          solution: ['Nf6+', 'Kd8', 'Nxd7'],
          hint: 'Find a knight move that gives check itself and also attacks the queen.',
          success: 'Nf6+ is a double check. The g7-pawn attacks f6 but may not capture, so the king must go to d8 and Nxd7 wins the queen.',
        },
        {
          kind: 'quiz',
          title: 'Answering a double check',
          text: 'You are in double check. Which reply can be legal?',
          choices: [
            { text: 'A king move', correct: true, why: 'Moving the king is the only way to get out of two checks at once.' },
            { text: 'Capturing one of the checking pieces', why: 'The other piece would still be giving check, so the capture is illegal (unless the king itself captures and escapes both checks).' },
            { text: 'Blocking one of the checks', why: 'The second check remains, so a block is never enough.' },
          ],
        },
        {
          kind: 'move',
          title: 'Double check, then mate',
          text: 'White to move. Your bishop on b3 is aimed at g8, with your knight in the way. Mate in two.',
          fen: 'r2q1rk1/pppb2pp/8/3N4/4Q3/1B6/PPP2PPP/6K1 w - - 0 1',
          solution: ['Nf6+', 'Kh8', 'Qxh7#'],
          hint: 'Which knight check also uncovers the bishop and guards h7?',
          success: 'Nf6+ is a double check, so ...gxf6 is illegal and the king must go to h8. Qxh7# follows, with the knight guarding the queen.',
        },
        {
          kind: 'move',
          title: 'Réti\'s combination',
          text: 'White to move. Your queen, bishop and rook are stacked on the d-file. Black\'s king is still in the centre. Mate in three.',
          fen: 'rnb1kb1r/pp3ppp/2p5/2q5/4n3/3Q4/PPPB1PPP/2KR1BNR w - - 0 1',
          solution: ['Qd8+', 'Kxd8', 'Bg5+', 'Kc7', 'Bd8#'],
          hint: 'Sacrifice the queen on d8 to drag the king onto the d-file, then unleash the bishop.',
          success: 'Qd8+!! Kxd8 Bg5+ is a double check from bishop and rook. After ...Kc7, Bd8# (or ...Ke8, Rd8#). Réti used this idea to beat Tartakower in 1910.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Double check comes from a discovered check where the moving piece also checks.\n' +
            '- Against double check only a king move helps, so the checking piece can land on a defended square.\n' +
            '- When the enemy king has few squares, a double check is often mate.\n' +
            '- Look for it whenever your piece stands between your line piece and the enemy king.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'tac-remove-defender',
      title: 'Removing the Defender',
      summary: 'If one piece holds the position together, capture it, chase it away or trade it off.',
      minutes: 11,
      steps: [
        {
          kind: 'read',
          title: 'Find the guard',
          text:
            'Many targets are protected by a single piece. **Removing the defender** means capturing, trading or chasing that guard; then the target falls.\n\n' +
            'The trigger: count attackers and defenders on a key piece or square, and ask which enemy piece does all the defending. Here the knight on f6 is the only guard of h7 against Qxh7#.',
          fen: 'r4rk1/ppqb1ppp/2p1pn2/8/3PP3/2PQ1N2/PPB2PPP/R3R1K1 w - - 0 1',
          marks: [
            { square: 'f6', color: 'yellow' },
            { square: 'h7', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'Chase the guard away',
          text: 'A pawn attack on the defender works just as well as a capture.',
          fen: 'r4rk1/ppqb1ppp/2p1pn2/8/3PP3/2PQ1N2/PPB2PPP/R3R1K1 w - - 0 1',
          moves: ['e5', 'g6', 'exf6'],
          notes: [
            '1.e5! The pawn attacks the knight and opens the queen\'s diagonal to h7. If the knight moves, Qxh7# follows.',
            '1...g6 blocks the diagonal, Black\'s best try.',
            '2.exf6 and White has won a piece.',
          ],
        },
        {
          kind: 'move',
          title: 'Take the guard',
          text: 'White to move. The same idea with a different tool.',
          fen: 'r4rk1/ppq1bppp/2p1pn2/6B1/3P4/2PQ4/PPB2PPP/R3R1K1 w - - 0 1',
          solution: ['Bxf6'],
          hint: 'Which black piece guards h7? Capture it.',
          success: 'Bxf6 removes the only guard of h7. Recapturing with ...Bxf6 or ...gxf6 allows Qxh7#, so Black must give up the piece and stays a knight down.',
        },
        {
          kind: 'move',
          title: 'Trade off the guard',
          text: 'White to move. Your pawn on b7 wants to promote, but Black\'s rook guards b8.',
          fen: '3r4/1P2kp1p/6p1/8/8/6P1/5PKP/3R4 w - - 0 1',
          solution: ['Rxd8'],
          hint: 'The d8-rook is the only piece covering b8. Get rid of it.',
          success: 'Rxd8! After ...Kxd8, b8=Q+ follows and the black king is one square too far away. Trading off the defender cleared the way.',
        },
        {
          kind: 'quiz',
          title: 'Who holds the fort?',
          text: 'White\'s queen and bishop both aim at g7. Which black piece is stopping Qxg7 mate?',
          fen: 'r4rk1/pp3ppp/4n3/8/8/1P4Q1/PB3PPP/5RK1 w - - 0 1',
          choices: [
            { text: 'The knight on e6', correct: true, why: 'It guards g7. With the knight gone, Qxg7 would be mate because the bishop protects the queen.' },
            { text: 'The rook on f8', why: 'It guards f7 and the back rank, not g7.' },
            { text: 'The king on g8', why: 'The king does touch g7, but it cannot take a queen protected by the bishop. The knight is the real defender.' },
          ],
        },
        {
          kind: 'move',
          title: 'Capture the guard with check',
          text: 'White to move. Black\'s knight guards h7 and attacks your queen. Mate in two.',
          fen: 'r2q1rk1/pbp1bppp/1p2pn2/3N3Q/8/3B4/PPP2PPP/4R1K1 w - - 0 1',
          solution: ['Nxf6+', 'gxf6', 'Qxh7#'],
          hint: 'Take the defender, and do it with check so Black has no time for ...Nxh5.',
          success: 'Nxf6+ removes the guard with check. Whatever Black recaptures with, Qxh7# follows, protected by the d3-bishop.',
        },
        {
          kind: 'move',
          title: 'Remove the guard of the fork square',
          text: 'White to move. Your knight would love to fork king and queen from e7, but the c6-knight covers that square.',
          fen: 'r1q2rk1/ppp2ppp/2npb3/1B1Np3/4P3/3P4/PPPQ1PPP/R4RK1 w - - 0 1',
          solution: ['Bxc6', 'bxc6', 'Ne7+', 'Kh8', 'Nxc8'],
          hint: 'Capture the piece that guards e7, then land on e7 with check.',
          success: 'Bxc6 bxc6 Ne7+ and Nxc8 wins the queen for a bishop. First remove the defender, then play the fork it was preventing.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Count attackers and defenders. If one enemy piece does all the guarding, it is the target.\n' +
            '- You can capture the defender, trade it off, or chase it with a pawn.\n' +
            '- Removing the defender with check is best: the opponent gets no time to regroup.\n' +
            '- Ask what each enemy piece guards; the answer often shows the combination.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7
    {
      id: 'tac-deflection',
      title: 'Deflection and Overloading',
      summary: 'Force a defender away from its post, or give a busy defender one job too many.',
      minutes: 11,
      steps: [
        {
          kind: 'read',
          title: 'One defender, two jobs',
          text:
            'A **deflection** forces a defender to leave the square or line it guards, usually with a capture it must answer or a sacrifice it must accept.\n\n' +
            'An **overloaded** piece guards two things at once. Attack one of them, and when the defender takes, the other is left bare.\n\n' +
            'Here the queen on d7 guards both the knight on d4 and the e8-square against Re8#. She cannot do both.',
          fen: '6k1/pp1q1ppp/8/8/3n4/8/PP3PPP/3QR1K1 w - - 0 1',
          arrows: [
            { from: 'd7', to: 'd4', color: 'blue' },
            { from: 'd7', to: 'e8', color: 'blue' },
          ],
        },
        {
          kind: 'demo',
          title: 'Overloaded queen',
          text: 'White takes the knight and dares Black to recapture.',
          fen: '6k1/pp1q1ppp/8/8/3n4/8/PP3PPP/3QR1K1 w - - 0 1',
          moves: ['Qxd4', 'Qxd4', 'Re8#'],
          notes: [
            '1.Qxd4! The knight\'s only defender is also guarding the back rank.',
            '1...Qxd4?? Taking back deflects the queen from e8. Black had to accept being a piece down.',
            '2.Re8#. Nothing guards the back rank any more.',
          ],
        },
        {
          kind: 'move',
          title: 'Deflect the back-rank guard',
          text: 'White to move. The d8-rook guards both the queen on d7 and Black\'s back rank. Mate in two.',
          fen: '3r2k1/pp1q1ppp/8/8/8/8/PP1Q1PPP/4R1K1 w - - 0 1',
          solution: ['Qxd7', 'Rxd7', 'Re8#'],
          hint: 'Offer a queen trade the rook must accept.',
          success: 'Qxd7! Rxd7 Re8#. If Black does not recapture, he is simply a queen down. The rook could not guard the queen and the back rank at the same time.',
        },
        {
          kind: 'move',
          title: 'The overloaded queen',
          text: 'White to move. Black\'s queen defends both the rook on e8 and the bishop on c7.',
          fen: '4r1k1/ppbq1ppp/1n6/8/8/5N1P/PPQB1PP1/4R1K1 w - - 0 1',
          solution: ['Rxe8+', 'Qxe8', 'Qxc7'],
          hint: 'Capture on e8 with check. Where does the queen stand after recapturing?',
          success: 'Rxe8+ Qxe8 and the queen no longer guards c7: Qxc7 wins a bishop. The move order matters: 1.Qxc7? Rxe1+ would lose.',
        },
        {
          kind: 'quiz',
          title: 'Spot the overloaded piece',
          text: 'White plays 1.Qxd4, grabbing the bishop. Why can\'t Black recapture with 1...Rxd4?',
          fen: '3r2k1/pp3ppp/8/8/3b4/8/PQ3PPP/4R1K1 w - - 0 1',
          choices: [
            { text: 'Because 2.Re8# follows: the rook was also guarding the back rank', correct: true, why: 'The d8-rook had two jobs. Taking on d4 abandons the back rank.' },
            { text: 'Because the rook on d8 is pinned', why: 'Nothing pins the rook. It can legally take, it just gets mated.' },
            { text: 'Because d4 is defended twice', why: 'After 1.Qxd4 the queen on d4 is defended by nothing. The problem is what the recapture leaves behind.' },
          ],
        },
        {
          kind: 'move',
          title: 'Deflect the king',
          text: 'White to move. Your d-pawn needs one more step, but the black king guards d8.',
          fen: '8/3Pk2p/6p1/8/8/r5P1/6KP/5R2 w - - 0 1',
          solution: ['Rf7+', 'Kxf7', 'd8=Q'],
          hint: 'Offer the rook with check on a square away from d8.',
          success: 'Rf7+! If ...Kxf7, d8=Q and the queen beats the rook. The king was deflected from the queening square.',
        },
        {
          kind: 'move',
          title: 'The overloaded knight',
          text: 'White to move. Black\'s knight on f6 guards both the queen and h7.',
          fen: '5rk1/p1pq1ppp/1p2pn2/6N1/8/7Q/PPP2PPP/3R2K1 w - - 0 1',
          solution: ['Rxd7', 'Nxd7', 'Qxh7#'],
          hint: 'Take the thing the knight guards on one side, and see what it leaves on the other.',
          success: 'Rxd7! wins the queen. If ...Nxd7, the knight deserts h7 and Qxh7# follows, supported by the g5-knight.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- For every enemy defender, ask what it guards. Two jobs means it is overloaded.\n' +
            '- Deflect with a capture the defender must answer, or a sacrifice it must accept.\n' +
            '- Back-rank guards are the classic victims: lure them away and mate.\n' +
            '- Move order matters: start with the capture that forces the defender to move.',
        },
      ],
    },

    // ---------------------------------------------------------------- 8
    {
      id: 'tac-decoy',
      title: 'Decoy',
      summary: 'Sacrifice to lure the king or queen onto the square where your tactic works.',
      minutes: 11,
      steps: [
        {
          kind: 'read',
          title: 'Lure it onto the wrong square',
          text:
            'A **decoy** (or attraction) sacrifice forces an enemy piece, usually the king or queen, onto a particular square, where a fork, skewer or mate is waiting.\n\n' +
            'Deflection drags a defender away from a square; a decoy drags a piece onto one. Look for tactics that would work if the enemy king or queen stood one square differently. Here, if the queen were forced to d8, Nf7+ would fork it with the king.',
          fen: '3q3k/pp4pp/8/6N1/8/8/PP3PPP/6K1 w - - 0 1',
          arrows: [
            { from: 'g5', to: 'f7', color: 'green' },
            { from: 'f7', to: 'h8', color: 'red' },
            { from: 'f7', to: 'd8', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'Réti vs Tartakower, 1910',
          text: 'One of the most famous short games ever played. Watch White\'s queen decoy the king.',
          fen: START,
          moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nf6', 'Qd3', 'e5', 'dxe5', 'Qa5+', 'Bd2', 'Qxe5', 'O-O-O', 'Nxe4', 'Qd8+', 'Kxd8', 'Bg5+', 'Kc7', 'Bd8#'],
          notes: [
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '8.O-O-O puts the rook behind the queen and bishop on the d-file.',
            '8...Nxe4? Black grabs a knight while his king is still in the centre.',
            '9.Qd8+!! The decoy: the queen drags the king onto the d-file.',
            '9...Kxd8 is forced.',
            '10.Bg5+ Double check from bishop and rook.',
            '10...Kc7 (10...Ke8 11.Rd8#)',
            '11.Bd8#',
          ],
        },
        {
          kind: 'move',
          title: 'Smothered mate',
          text: 'White to move. Black is far ahead in material, but look at the king on h8. Mate in two.',
          fen: 'r4r1k/pb4pp/1p5N/8/2Q5/8/PPq2PPP/5RK1 w - - 0 1',
          solution: ['Qg8+', 'Rxg8', 'Nf7#'],
          hint: 'Put your queen where the king cannot take it and the rook must.',
          success: 'Qg8+! The knight guards g8, so the rook must take, and Nf7# is smothered mate. The queen decoyed the rook onto g8 to block the king\'s last square.',
        },
        {
          kind: 'move',
          title: 'Decoy the queen into a fork',
          text: 'White to move. Black\'s king has no luft. Win the queen.',
          fen: '7k/pp2q1pp/8/6N1/8/8/PP3PPP/3R2K1 w - - 0 1',
          solution: ['Rd8+', 'Qxd8', 'Nf7+', 'Kg8', 'Nxd8'],
          hint: 'A rook check on the back rank can only be answered by the queen. Where does that leave her?',
          success: 'Rd8+ Qxd8 Nf7+ Kg8 Nxd8. The rook sacrifice lured the queen onto d8, a knight\'s fork away from the king.',
        },
        {
          kind: 'quiz',
          title: 'Decoy or deflection?',
          text: 'White sacrifices a rook on h8 with check. The black king must take it, and then a knight check forks king and queen. What was the rook sacrifice?',
          choices: [
            { text: 'A decoy', correct: true, why: 'The sacrifice attracted the king onto h8, the square where the fork works.' },
            { text: 'A deflection', why: 'A deflection pulls a defender away from a square it guards. Here the point was to bring the king onto a square.' },
            { text: 'A desperado', why: 'A desperado is a piece that is lost anyway grabbing what it can. The rook was not in danger.' },
          ],
        },
        {
          kind: 'move',
          title: 'Drag the king to the corner',
          text: 'White to move. Win Black\'s queen.',
          fen: '2b1r1k1/ppp2pp1/3q4/6N1/8/8/PPP2PP1/2Q3KR w - - 0 1',
          solution: ['Rh8+', 'Kxh8', 'Nxf7+', 'Kg8', 'Nxd6'],
          hint: 'From f7 a knight attacks d6 and h8. Can you force the king onto h8?',
          success: 'Rh8+! Kxh8 Nxf7+ and Nxd6. The rook sacrifice decoyed the king into the fork.',
        },
        {
          kind: 'move',
          title: 'Punish the greedy queen',
          text: 'White to move. Black\'s queen has grabbed a pawn on e4 and now attacks your bishop.',
          fen: 'r1b1kb1r/ppp2ppp/2n5/4p3/2B1q3/5N2/PPPQ1PPP/R1B2RK1 w - - 0 1',
          solution: ['Bxf7+', 'Kxf7', 'Ng5+', 'Kg8', 'Nxe4'],
          hint: 'The knight on g5 would fork f7 and e4. Lure the king to f7 first.',
          success: 'Bxf7+! Kxf7 Ng5+ and Nxe4 wins the queen. Declining the bishop leaves Black a pawn down with his king stuck in the centre.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- A decoy sacrifice pulls a piece onto a square where another tactic hits it.\n' +
            '- Ask: which fork, skewer or mate would work if the enemy king or queen stood elsewhere?\n' +
            '- Checks and captures make the best decoys because they cannot be refused.\n' +
            '- Calculate to the end: the decoy only pays if the follow-up wins more than you gave.',
        },
      ],
    },

    // ---------------------------------------------------------------- 9
    {
      id: 'tac-intermezzo',
      title: 'Intermezzo and Desperado',
      summary: 'Before you recapture, look for a stronger move in between; when a piece is lost anyway, make it pay.',
      minutes: 12,
      steps: [
        {
          kind: 'read',
          title: 'The move in between',
          text:
            'An **intermezzo** (German: zwischenzug) is a move inserted into an exchange when a recapture seems forced: a check, a capture or a bigger threat. The recapture is still there afterwards.\n\n' +
            'A **desperado** is the same idea for a doomed piece: if it will be captured anyway, let it capture something first.\n\n' +
            'The trigger is any moment when a move looks "forced". That is exactly when to look for checks and captures.',
        },
        {
          kind: 'demo',
          title: 'The Elephant Trap',
          text: 'A Queen\'s Gambit trap that has caught thousands of players. White thinks the f6-knight is pinned.',
          fen: START,
          moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Nbd7', 'cxd5', 'exd5', 'Nxd5', 'Nxd5', 'Bxd8'],
          notes: [
            '',
            '',
            '',
            '',
            '',
            '',
            '4.Bg5 pins the knight to the queen.',
            '4...Nbd7 sets the trap.',
            '',
            '',
            '6.Nxd5?? White grabs the pawn, trusting the pin.',
            '6...Nxd5! Black gives up the queen.',
            '7.Bxd8. White has won the queen... or has he? Black to move.',
          ],
        },
        {
          kind: 'move',
          title: 'Spring the trap',
          text: 'Black to move. White has just taken your queen. Before recapturing, find the intermezzo.',
          fen: 'r1bBkb1r/pppn1ppp/8/3n4/3P4/8/PP2PPPP/R2QKBNR b KQkq - 0 7',
          solution: ['Bb4+'],
          hint: 'The queen on d8 is not going anywhere. First give a check that wins something.',
          success: '7...Bb4+! 8.Qd2 Bxd2+ 9.Kxd2 Kxd8 and Black is a piece up. Recapturing at once would have left Black with only two minor pieces for the queen.',
        },
        {
          kind: 'move',
          title: 'Checks before recaptures',
          text: 'White to move. Black has just played ...Qxd1, taking your queen. Recapture?',
          fen: '6k1/pb3ppp/1p6/8/8/1P5P/P1r2PPK/R2qR3 w - - 0 1',
          solution: ['Re8#'],
          hint: 'Before taking back, look at Black\'s back rank.',
          success: 'Re8#. The recapture could wait forever. Black\'s queen trade abandoned the back rank.',
        },
        {
          kind: 'move',
          title: 'The rook first',
          text: 'White to move. Black\'s knight has just taken on e4. It used to guard the rook on e8.',
          fen: '4r1k1/pbq2pp1/1p5p/8/Q3n3/2N1B3/PPP2PPP/4R1K1 w - - 0 1',
          solution: ['Qxe8+'],
          hint: 'The knight on e4 is not running away. What did its last move leave undefended?',
          success: 'Qxe8+ wins a rook with check. After ...Kh7 the knight on e4 is still there to be taken. Recapturing first would have let Black guard e8 again.',
        },
        {
          kind: 'quiz',
          title: 'The reflex to fight',
          text: 'Your opponent captures one of your pieces and you have an obvious recapture. What should you do first?',
          choices: [
            { text: 'Scan for checks, captures and threats that gain more than the recapture', correct: true, why: 'The recapture usually stays available. An intermezzo can win material or improve the version of the exchange you get.' },
            { text: 'Recapture at once so you do not forget', why: 'Automatic recaptures are how intermezzos catch players. Take ten seconds first.' },
            { text: 'Count the material and ignore the position', why: 'Material matters, but the forcing moves available right now decide what you actually end up with.' },
          ],
        },
        {
          kind: 'move',
          title: 'Take with check, then take back',
          text: 'White to move. Black\'s queen has just captured yours on f3, and Black\'s rook attacks your rook on e1.',
          fen: '4r1k1/ppp2pp1/2n4p/8/8/2P2qP1/PP1N1P1P/4R1K1 w - - 0 1',
          solution: ['Rxe8+', 'Kh7', 'Nxf3'],
          hint: 'Nxf3 is natural, but then Black trades rooks. Take the rook first, with check.',
          success: 'Rxe8+ Kh7 Nxf3. The in-between capture wins a whole rook. 1.Nxf3? Rxe1+ would have left material level.',
        },
        {
          kind: 'move',
          title: 'Same idea, other file',
          text: 'White to move. Black\'s queen has just taken yours on e2 and now attacks your rook on d1.',
          fen: '3r2k1/pp3pp1/7p/8/8/2N5/PP2qPPP/3R2K1 w - - 0 1',
          solution: ['Rxd8+', 'Kh7', 'Nxe2'],
          hint: 'Which capture comes with check?',
          success: 'Rxd8+ Kh7 Nxe2. First the rook, with check, then the queen. White ends a rook up.',
        },
        {
          kind: 'move',
          title: 'Desperado',
          text: 'White to move. Your knight on c6 is attacked by the b7-pawn and every retreat square is covered. Sell it as dearly as possible.',
          fen: 'r4rk1/ppq1bppp/2N2n2/4p3/4P1b1/5N2/PPP1QPPP/R1B2RK1 w - - 0 1',
          solution: ['Nxe7+'],
          hint: 'A doomed piece should capture something on its way out, ideally with check.',
          success: 'Nxe7+ Qxe7: the knight is traded for a bishop instead of being lost for nothing. That is a desperado.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- A "forced" recapture is the moment to look for checks, captures and threats first.\n' +
            '- An intermezzo only works if the original recapture is still available afterwards.\n' +
            '- Check your opponent\'s in-between moves too, before you start an exchange.\n' +
            '- A piece that is lost anyway should take something with it: that is a desperado.',
        },
      ],
    },

    // ---------------------------------------------------------------- 10
    {
      id: 'tac-trapped-xray',
      title: 'Trapped Pieces, X-ray and Interference',
      summary: 'Win pieces that have run out of squares, and use lines that pass through or get cut by other pieces.',
      minutes: 12,
      steps: [
        {
          kind: 'read',
          title: 'No way out',
          text:
            'A piece is **trapped** when every square it can move to is covered. Attack it, and it is lost.\n\n' +
            'The usual victims: a bishop that grabbed a pawn on a2 or h7, a knight on the edge of the board, a queen that went pawn-hunting behind enemy lines.\n\n' +
            'The trigger: count the escape squares of any enemy piece that has wandered far from home. If it has one or none, look for a way to attack it.',
        },
        {
          kind: 'demo',
          title: 'Noah\'s Ark Trap',
          text: 'In the Ruy Lopez, White\'s bishop on b3 can be trapped by Black\'s queenside pawns.',
          fen: START,
          moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'd6', 'd4', 'b5', 'Bb3', 'Nxd4', 'Nxd4', 'exd4', 'Qxd4', 'c5', 'Qd5', 'Be6', 'Qc6+', 'Bd7', 'Qd5', 'c4'],
          notes: [
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '5...b5 pushes the bishop back.',
            '6.Bb3 The bishop now lives on the a2-g8 diagonal.',
            '',
            '',
            '',
            '8.Qxd4?? walks into the trap.',
            '8...c5! The queen must move, and the pawns gain time.',
            '',
            '',
            '',
            '',
            '',
            '11...c4. The bishop on b3 has no safe square left. Black wins a piece.',
          ],
        },
        {
          kind: 'move',
          title: 'The poisoned a-pawn',
          text: 'White to move. Black\'s bishop has just taken your pawn on a2. Punish it.',
          fen: '4r1k1/ppp2ppp/5n2/8/8/3B1N2/bPP2PPP/2KR4 w - - 0 1',
          solution: ['b3'],
          hint: 'The bishop wants to escape along the a2-g8 diagonal. Close the door.',
          success: 'b3! The bishop is shut in: b1 is covered by your king and b3 by the c2-pawn. Kb2 next wins it.',
        },
        {
          kind: 'move',
          title: 'Knight on the rim',
          text: 'White to move. Count the escape squares of the knight on h5.',
          fen: 'r4rk1/pp3ppp/2p1pb2/3p3n/3P4/2NBP3/PPP2PPP/2KR3R w - - 0 1',
          solution: ['g4'],
          hint: 'f4 and g3 are covered by your pawns; f6 and g7 are blocked by Black\'s own pieces. Attack it.',
          success: 'g4 traps the knight: every retreat is covered or occupied. A knight on the rim is dim, and sometimes dead.',
        },
        {
          kind: 'read',
          title: 'X-ray and interference',
          text:
            'An **x-ray** is a line piece working through another piece. A rook behind an enemy rook on the same file still defends the square beyond it: once the front piece captures or is exchanged, the rook behind takes over.\n\n' +
            '**Interference** means placing a piece on the line between an enemy defender and the square it guards. Whether the defender captures or not, the line is broken.',
        },
        {
          kind: 'move',
          title: 'X-ray on the e-file',
          text: 'White to move. The e8-square looks covered by Black\'s rook on e7, but your rook on e1 sees through it. Mate in two.',
          fen: '6k1/pb2rppp/1p6/1Q6/8/8/PPq2PPP/4R1K1 w - - 0 1',
          solution: ['Qe8+', 'Rxe8', 'Rxe8#'],
          hint: 'The e8-square looks guarded by the black rook, but your e1-rook defends it through that rook.',
          success: 'Qe8+! Rxe8 Rxe8#. The e1-rook x-rayed through the black rook: once it captured on e8, the way was open.',
        },
        {
          kind: 'move',
          title: 'Cut the defender\'s line',
          text: 'White to move. Black\'s rook on b8 guards d8, the queening square of your pawn.',
          fen: '1r6/3P1pkp/6p1/8/8/6P1/5PKP/2R5 w - - 0 1',
          solution: ['Rc8', 'Rxc8', 'dxc8=Q'],
          hint: 'Put your rook on the eighth rank between the black rook and d8.',
          success: 'Rc8! blocks the b8-rook\'s path to d8. If ...Rxc8, dxc8=Q wins, and if the rook moves away, d8=Q follows.',
        },
        {
          kind: 'quiz',
          title: 'Name the idea',
          text: 'You put a knight on d5, between Black\'s bishop on b7 and the g2-square it was guarding. What is this called?',
          choices: [
            { text: 'Interference', correct: true, why: 'Your piece blocks the line between the defender and the square it guards.' },
            { text: 'X-ray', why: 'An x-ray works through a piece. Here you are blocking a line, not using one.' },
            { text: 'Decoy', why: 'A decoy lures an enemy piece onto a square. Here you block a line instead.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Count the escape squares of enemy pieces far from home; with none left, attack them.\n' +
            '- Bishops on a2/h7, knights on the rim and pawn-grabbing queens are the usual victims.\n' +
            '- An x-ray lets a rook or bishop act through another piece once that piece moves or is exchanged.\n' +
            '- Interference cuts a defender\'s line by placing a piece in the way.',
        },
      ],
    },
  ],
};
