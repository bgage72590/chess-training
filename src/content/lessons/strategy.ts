import type { Unit } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const strategy: Unit = {
  id: 'strategy',
  title: 'Strategy & Planning',
  tagline: 'What to do when there is no tactic: piece activity, pawn structure, weak squares, open files and the art of the trade.',
  level: 'Advanced',
  lessons: [
    // ---------------------------------------------------------------------------------------------
    {
      id: 'strat-piece-activity',
      title: 'Piece Activity and the Worst Piece',
      summary: 'Measure your pieces by what they do, and keep improving the one that does least.',
      minutes: 13,
      steps: [
        {
          kind: 'read',
          title: 'What a piece is worth',
          text: 'The point values (knight 3, rook 5) are averages. In a real position a piece is worth what it does: the squares it controls, the targets it hits, the pieces it restricts.\n\nHere material is equal, but White\'s knight on d5 is a monster: no pawn can ever chase it. Black\'s bishop on f6 runs into its own pawns on e5 and d6 and does very little.',
          fen: 'r4rk1/1pqb1ppp/p2p1b2/3Np3/4P3/3B4/PPPQ1PPP/R4RK1 b - - 1 2',
          marks: [
            { square: 'd5', color: 'green' },
            { square: 'f6', color: 'red' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Spot the passive piece',
          text: 'Same position, Black to move. Which black piece is doing the least?',
          fen: 'r4rk1/1pqb1ppp/p2p1b2/3Np3/4P3/3B4/PPPQ1PPP/R4RK1 b - - 1 2',
          choices: [
            {
              text: 'The bishop on f6',
              correct: true,
              why: 'It is a dark-squared bishop hemmed in by Black\'s own pawns on the dark squares d6 and e5. It defends, but it attacks nothing.',
            },
            {
              text: 'The queen on c7',
              why: 'The queen eyes the c-file and c2. She is not ideally placed, but she is far more active than the f6-bishop.',
            },
            {
              text: 'The rook on a8',
              why: 'Not yet in play, but it can reach the c-file in one move. The f6-bishop has no such prospects.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Improve your worst piece',
          text: 'When there is nothing forcing to do, find your **worst-placed piece** and improve it. This simple question, asked every move, is how strong players outplay weaker ones in quiet positions.\n\nIn this Italian Game position White\'s knight on d2 blocks the c1-bishop and the queen, and it controls nothing important. Its classic route is d2-f1-g3, toward f5.',
          fen: 'r1bqr1k1/bpp2pp1/p1np1n1p/4p3/4P3/1BPP1N1P/PP1N1PP1/R1BQR1K1 w - - 2 11',
          arrows: [
            { from: 'd2', to: 'f1', color: 'green' },
            { from: 'f1', to: 'g3', color: 'green' },
            { from: 'g3', to: 'f5', color: 'blue' },
          ],
        },
        {
          kind: 'demo',
          title: 'The knight tour',
          text: 'Three moves transform the position of White\'s pieces.',
          fen: 'r1bqr1k1/bpp2pp1/p1np1n1p/4p3/4P3/1BPP1N1P/PP1N1PP1/R1BQR1K1 w - - 2 11',
          moves: ['Nf1', 'Be6', 'Ng3'],
          notes: [
            '11.Nf1: the knight leaves d2, and the c1-bishop and the queen can breathe.',
            '11...Be6 offers a trade of bishops.',
            '12.Ng3: from g3 the knight eyes f5 and h5, next to Black\'s king. The worst piece has become a useful one, and Be3 and Qe2 will connect the rooks.',
          ],
        },
        {
          kind: 'move',
          title: 'Punish the worst piece',
          text: 'The flip side: look for your opponent\'s worst piece. Black\'s knight has wandered to h5. Find the move that exposes its problem.',
          fen: 'r1bq1rk1/pp1nbppp/4p3/2ppP2n/3P4/2PB1N2/PP1B1PPP/RN1Q1RK1 w - - 0 1',
          solution: ['g4'],
          hint: 'Count the knight\'s escape squares. Attack it with a pawn.',
          success: '1.g4! The knight has no retreat: f4 is covered by the d2-bishop, f6 by the e5-pawn, g3 by two pawns, and g7 is blocked. Black must give it up for a pawn or two. A knight on the rim with no squares is a target.',
        },
        {
          kind: 'move',
          title: 'The king is a piece too',
          text: 'In the endgame the most important piece to activate is often the king. Pawns are even. Find the only winning move.',
          fen: '8/6pp/p4k2/1p6/1P6/P2K4/6PP/8 w - - 0 1',
          solution: ['Kd4'],
          hint: 'Black\'s queenside pawns cannot be defended by Black\'s king in time.',
          success: '1.Kd4! heads for c5 and b6 to win a6 and b5. Black\'s king is two moves behind in the race, so White\'s queenside pawns decide.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text: '- Judge pieces by what they do, not by their point value.\n- In quiet positions, ask every move: which is my worst piece, and how do I improve it?\n- Knights need outposts, bishops need open diagonals, rooks need open files.\n- Your opponent\'s worst piece is a target: restrict it, trap it, or leave it out of play.\n- In the endgame, the king is often the piece to activate first.',
        },
      ],
    },

    // ---------------------------------------------------------------------------------------------
    {
      id: 'strat-pawn-structure',
      title: 'Pawn Structure and Plans',
      summary: 'Isolated, doubled, backward and passed pawns, pawn majorities, and the plans each one suggests.',
      minutes: 15,
      steps: [
        {
          kind: 'read',
          title: 'The skeleton of the position',
          text: 'Pieces move quickly; pawns move slowly and never go back. That makes the pawn structure the most permanent feature of a position, and the best guide to a plan.\n\nThe main types:\n- **isolated**: no friendly pawns on the neighbouring files\n- **doubled**: two pawns on one file\n- **backward**: cannot be protected by a pawn, and its advance is controlled\n- **passed**: no enemy pawn can stop it\n- **majority**: more pawns than the opponent on one wing',
        },
        {
          kind: 'read',
          title: 'The isolated pawn',
          text: 'White\'s d4-pawn has no neighbours on the c- or e-files. It needs pieces to defend it, and the square in front of it, d5, is a perfect blockade square for Black.\n\nBut it also gives White space and open lines. With pieces on the board, White attacks; in the endgame, the pawn is just weak. Hence the rule: the side with the isolated pawn avoids trades, the side playing against it welcomes them.',
          fen: 'r1bq1rk1/pp2bppp/2n1p3/3n4/3P4/2NB1N2/PP3PPP/R1BQR1K1 b - - 5 10',
          marks: [
            { square: 'd4', color: 'yellow' },
            { square: 'd5', color: 'blue' },
          ],
        },
        {
          kind: 'demo',
          title: 'Doubled pawns: target the front one',
          text: 'In the Sämisch Nimzo-Indian, Black gives up the bishop pair to saddle White with doubled c-pawns. Watch how Black aims everything at c4.',
          fen: START,
          moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'a3', 'Bxc3+', 'bxc3', 'c5', 'e3', 'Nc6', 'Bd3', 'b6', 'Ne2', 'Ba6'],
          notes: [
            '1.d4.',
            '1...Nf6.',
            '2.c4.',
            '2...e6.',
            '3.Nc3.',
            '3...Bb4, the Nimzo-Indian: Black pins the knight.',
            '4.a3 asks the bishop to decide at once.',
            '4...Bxc3+ gives up the bishop pair.',
            '5.bxc3: White has the two bishops and a strong center, but doubled c-pawns.',
            '5...c5 fixes the front pawn on c4, where it cannot be defended by another pawn.',
            '6.e3.',
            '6...Nc6 adds pressure on d4.',
            '7.Bd3.',
            '7...b6 prepares the bishop\'s route to a6.',
            '8.Ne2.',
            '8...Ba6: the bishop hits c4. Next come ...Na5 and ...Rc8. White must play actively in the center before c4 falls.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Find the backward pawn',
          text: 'This Sveshnikov Sicilian position arises after 10.Nd5. Which black pawn is backward?',
          fen: 'r1bqkb1r/5p1p/p1np1p2/1p1Np3/4P3/N7/PPP2PPP/R2QKB1R b KQkq - 1 10',
          choices: [
            {
              text: 'The d6-pawn',
              correct: true,
              why: 'Black has no c-pawn, and the e-pawn has already advanced to e5, so no pawn can ever protect d6. It sits on the half-open d-file and the square in front of it, d5, belongs to White\'s knight.',
            },
            {
              text: 'The f6-pawn',
              why: 'The f-pawns are doubled, which is a different weakness. The f6-pawn is protected by nothing but can still advance to f5, which Black often plays.',
            },
            {
              text: 'The b5-pawn',
              why: 'b5 is supported by the a6-pawn, so it is not backward.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Passed pawns',
          text: 'A passed pawn is a long-term trump: every step forward makes it more dangerous and ties down more enemy pieces. Two rules:\n- **Passed pawns must be pushed**, unless pushing loses them.\n- Against a passed pawn, **blockade** it, ideally with a knight on the square in front of it. A knight blockader is not blocked by the pawn.',
        },
        {
          kind: 'move',
          title: 'Push the passer',
          text: 'White has a passed c-pawn on the sixth rank and a rook on the seventh. Black\'s rook guards c8. Find the winning plan.',
          fen: '2r3k1/1R3ppp/2P5/8/8/6P1/5PKP/8 w - - 0 1',
          solution: ['c7'],
          hint: 'Push the pawn, then use the rook to deflect Black\'s rook from c8.',
          success: '1.c7! threatens 2.Rb8, when Black\'s rook must leave c8 or be lost. Black\'s king is too far away to help. Pushed at the right moment, a passed pawn ties the defender down completely.',
        },
        {
          kind: 'read',
          title: 'Majorities',
          text: 'A healthy pawn majority on one wing can create a passed pawn, especially in the endgame. A majority spoiled by doubled or isolated pawns often cannot.\n\nThat is why the choice of which pieces to trade depends on the structure: if your pawns are healthier, head for the endgame where structure counts most.',
        },
        {
          kind: 'move',
          title: 'Trade into a better structure',
          text: 'The rooks face each other on the c-file. Find the move that gives White a clearly better pawn structure.',
          fen: '6k1/pp3pp1/2r4p/8/8/7P/PP3PP1/2R3K1 w - - 0 1',
          solution: ['Rxc6'],
          hint: 'Force Black to recapture with a pawn.',
          success: '1.Rxc6! bxc6 leaves Black with isolated pawns on a7 and c6, while White\'s a- and b-pawns are healthy. White\'s king walks to the queenside and attacks them. Any other move keeps the balance.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text: '- The pawn structure is the most permanent feature of a position; plan around it.\n- Isolated pawn: its owner wants activity and pieces; the opponent wants trades and a blockade.\n- Doubled pawns: fix the front one and attack it.\n- Backward pawns: occupy the square in front and pile up on the half-open file.\n- Passed pawns must be pushed; blockade the opponent\'s.\n- Trade into endgames where your structure is the healthier one.',
        },
      ],
    },

    // ---------------------------------------------------------------------------------------------
    {
      id: 'strat-bishops',
      title: 'Good Bishops, Bad Bishops',
      summary: 'How pawn placement makes a bishop good or bad, how to fix a bad one, and how to use the bishop pair.',
      minutes: 13,
      steps: [
        {
          kind: 'read',
          title: 'Good and bad bishops',
          text: 'A bishop is **bad** when its own central pawns stand on its colour and block it. It is **good** when its pawns stand on the other colour, leaving its diagonals open.\n\nIn the French Advance, Black\'s pawns on e6 and d5 are on light squares, so the c8-bishop is Black\'s problem piece. White\'s pawns on d4 and e5 are on dark squares, so White\'s light-squared bishop has a bright future.',
          fen: 'r1b1kbnr/pp3ppp/1qn1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R w KQkq - 3 6',
          marks: [
            { square: 'c8', color: 'red' },
            { square: 'f1', color: 'green' },
          ],
        },
        {
          kind: 'demo',
          title: 'Get the bishop out first',
          text: 'The Caro-Kann Advance shows one cure for a bad bishop: develop it outside the pawn chain before closing the chain.',
          fen: START,
          moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5'],
          notes: [
            '1.e4.',
            '1...c6 prepares ...d5 without blocking the c8-bishop.',
            '2.d4.',
            '2...d5.',
            '3.e5 locks the center.',
            '3...Bf5! The bishop steps outside the chain first.',
            '4.Nf3.',
            '4...e6: only now does Black close the chain. The bishop is already free.',
            '5.Be2.',
            '5...c5 attacks the base of White\'s chain, as in the French, but with a good bishop.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Curing a bad bishop',
          text: 'Your bishop is blocked by your own pawns. Which of these is NOT a standard remedy?',
          choices: [
            {
              text: 'Push more pawns onto the bishop\'s colour.',
              correct: true,
              why: 'That makes the bishop even worse. Pawns should go on the opposite colour of your bishop.',
            },
            {
              text: 'Trade it for an enemy piece.',
              why: 'A standard remedy: in the French, Black often plays ...b6 and ...Ba6 to swap the bad bishop for White\'s good one.',
            },
            {
              text: 'Bring it outside the pawn chain.',
              why: 'Also standard: the bishop becomes active in front of its pawns, as in the Caro-Kann.',
            },
            {
              text: 'Change the pawn structure with a pawn break.',
              why: 'Also standard: exchanging the blocking pawns opens diagonals for the bishop.',
            },
          ],
        },
        {
          kind: 'move',
          title: 'A bishop needs squares',
          text: 'A bishop outside the chain can also be hunted. Black\'s bishop on g6 looks safe. Find the pawn move that shows otherwise.',
          fen: 'r4rk1/ppqnbppp/2p1p1b1/8/3PP1PP/2NBQP2/PPPN4/2KR3R w - - 0 1',
          solution: ['h5'],
          hint: 'Where can the bishop go if a pawn attacks it? Check h7, f7, f5 and e4.',
          success: '1.h5! The bishop has no square: h7 and f7 hold its own pawns, and f5 is covered by the e4- and g4-pawns. Black cannot save it and must look for compensation elsewhere.',
        },
        {
          kind: 'read',
          title: 'The bishop pair',
          text: 'Two bishops together cover squares of both colours and work well in **open positions** with pawns on both wings. Against a bishop and a knight, or two knights, they are usually worth an extra half pawn.\n\nThe side with the bishop pair wants to open the position with pawn breaks. The side with the knights wants to keep it closed and find outposts.',
        },
        {
          kind: 'move',
          title: 'Colour complexes',
          text: 'White has a knight, Black a dark-squared bishop. White\'s pawns stand on dark squares, where the bishop attacks them; Black\'s pawns stand on light squares, where the bishop can never defend them. Black threatens ...Bxb4. Find the only good move.',
          fen: '8/3k4/p2bp1p1/Pp1p1p1p/1P1P1P1P/3KP1P1/4N3/8 w - - 0 1',
          solution: ['Kc3'],
          hint: 'Defend b4 with a piece that does not need to be anywhere else.',
          success: '1.Kc3! The king guards the pawn on the bishop\'s colour. Next the knight goes Nc1-d3-c5 and wins the a6-pawn, which Black\'s bishop can never protect. White is clearly better.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text: '- Put your pawns on the opposite colour of your bishop.\n- Put your pawns on the colour of the enemy bishop only if you can defend them.\n- Cure a bad bishop: trade it, bring it outside the chain, or change the structure.\n- A bishop without squares can be trapped by pawns.\n- The bishop pair wants open lines; the knights want closed positions and outposts.',
        },
      ],
    },

    // ---------------------------------------------------------------------------------------------
    {
      id: 'strat-outposts',
      title: 'Outposts and Weak Squares',
      summary: 'Holes that no pawn can defend are the best squares for your pieces, especially knights on d5, e5 and f5.',
      minutes: 14,
      steps: [
        {
          kind: 'read',
          title: 'Holes and outposts',
          text: 'Every pawn move leaves squares behind that the pawn can no longer protect. A square in the opponent\'s half that no enemy pawn can attack is a **hole**. If your own pawn supports it, it is an **outpost**.\n\nKnights love outposts: a knight on d5, e5 or f5 that cannot be chased away radiates power in all directions. The only way to challenge it is to trade a piece for it.',
        },
        {
          kind: 'demo',
          title: 'Creating and taking d5',
          text: 'The Sveshnikov Sicilian is a fight for the d5-square. Black accepts a hole on d5 in return for activity; White does everything to occupy it.',
          fen: START,
          moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5', 'Bxf6', 'gxf6', 'Nd5'],
          notes: [
            '1.e4.',
            '1...c5, the Sicilian.',
            '2.Nf3.',
            '2...Nc6.',
            '3.d4.',
            '3...cxd4.',
            '4.Nxd4.',
            '4...Nf6.',
            '5.Nc3.',
            '5...e5! gains time but gives up control of d5: no black pawn can ever cover it again.',
            '6.Ndb5.',
            '6...d6.',
            '7.Bg5 targets the knight on f6, the main guard of d5.',
            '7...a6.',
            '8.Na3.',
            '8...b5.',
            '9.Bxf6! removes the defender of d5.',
            '9...gxf6.',
            '10.Nd5: the knight lands on the outpost. Black has the bishop pair and play on the kingside in return.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Fighting the outpost',
          text: 'Black faces the knight on d5. What is Black\'s realistic way to deal with it?',
          fen: 'r1bqkb1r/5p1p/p1np1p2/1p1Np3/4P3/N7/PPP2PPP/R2QKB1R b KQkq - 1 10',
          choices: [
            {
              text: 'Trade it off with a minor piece, for example ...Ne7 or ...Bb7 and ...Bxd5.',
              correct: true,
              why: 'No pawn can attack d5 any more, so the knight can only be removed by exchanging a piece for it.',
            },
            {
              text: 'Chase it with ...c6.',
              why: 'Black has no c-pawn. That is exactly why d5 is an outpost.',
            },
            {
              text: 'Ignore it: knights in the center are not dangerous.',
              why: 'A knight on d5 hits c7, e7, f6 and b6 and supports White\'s play everywhere. Ignoring it is how games are lost.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Holes around the king',
          text: 'Weak squares near the king are the most dangerous of all. Black has played ...g6 but no longer has a dark-squared bishop to guard f6 and h6. Those holes are invitations for White\'s pieces.\n\nKnights are especially good at using such holes: a knight on f6 checks the king and attacks everything around it.',
          fen: '4r1k1/pp1q1p1p/6p1/3N4/8/8/PP3PPP/3Q2K1 w - - 0 1',
          marks: [
            { square: 'f6', color: 'red' },
            { square: 'h6', color: 'red' },
          ],
        },
        {
          kind: 'move',
          title: 'Use the hole',
          text: 'White to move. Exploit the hole on f6.',
          fen: '4r1k1/pp1q1p1p/6p1/3N4/8/8/PP3PPP/3Q2K1 w - - 0 1',
          solution: ['Nf6+'],
          hint: 'The knight can jump into the hole with check. What else does it attack from there, and what does it uncover?',
          success: '1.Nf6+ forks king, queen and rook, and uncovers the d1-queen against the d7-queen. White wins the queen.',
        },
        {
          kind: 'read',
          title: 'Holes in the center',
          text: 'Here Black has pawns on c5 and e5 but no d-pawn. The d6-square can never be covered by a pawn again: a permanent hole right in front of Black\'s position.\n\nWhite\'s knight on b5 and rook on d1 are already aiming at it. A hole is not only a home for a knight; rooks and queens can use it too.',
          fen: '2b1r1k1/pp3ppp/1q3n2/1Np1p3/2B1P3/8/PPP2PPP/3RQ1K1 w - - 0 1',
          marks: [{ square: 'd6', color: 'red' }],
          arrows: [
            { from: 'b5', to: 'd6', color: 'green' },
            { from: 'd1', to: 'd6', color: 'green' },
          ],
        },
        {
          kind: 'move',
          title: 'Invade the hole',
          text: 'White to move. Which piece should go to d6?',
          fen: '2b1r1k1/pp3ppp/1q3n2/1Np1p3/2B1P3/8/PPP2PPP/3RQ1K1 w - - 0 1',
          solution: ['Rd6'],
          hint: 'Look at Black\'s queen. How many squares does she have?',
          success: '1.Rd6! attacks the queen, and she has nowhere to go: a5 is covered by the e1-queen, c7 by the knight, a6 and d8 by the rook. After 1...Rd8 2.Rxb6 axb6 White has won the queen for a rook. 1.Nd6 was good too, but the rook is even stronger.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text: '- Every pawn move leaves weak squares behind; think before you push.\n- A hole supported by your pawn is an outpost: put a knight there.\n- Remove the pieces that guard the key square, then occupy it.\n- The only way to fight an outpost is to trade a piece for its occupant.\n- Holes near the king (f6, h6 after ...g6) are the most dangerous of all.',
        },
      ],
    },

    // ---------------------------------------------------------------------------------------------
    {
      id: 'strat-open-files',
      title: 'Open Files and the Seventh Rank',
      summary: 'Rooks need open files; the side that controls them invades the seventh rank or the back rank.',
      minutes: 13,
      steps: [
        {
          kind: 'read',
          title: 'Where rooks belong',
          text: 'Rooks are the last pieces to join the game and need open lines. An **open file** has no pawns on it; a **half-open file** has only enemy pawns, which become targets.\n\nIn the Queen\'s Gambit Exchange structure White\'s c-file is half-open (Black\'s c6-pawn is the target), and Black\'s e-file is half-open (White\'s e3-pawn is the target). Each side puts rooks on its own half-open file.',
          fen: 'r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 b - - 9 11',
          arrows: [
            { from: 'e8', to: 'e3', color: 'blue' },
            { from: 'c1', to: 'c6', color: 'blue' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Which file?',
          text: 'In the same position, where does White\'s rook on f1 belong in the long run?',
          fen: 'r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 b - - 9 11',
          choices: [
            {
              text: 'On the c-file, supporting pressure against c6.',
              correct: true,
              why: 'The c-file is half-open for White and leads to Black\'s weakest point after the minority attack b4-b5.',
            },
            {
              text: 'On the f-file behind the f2-pawn.',
              why: 'The f-file is closed; the rook would have nothing to do there.',
            },
            {
              text: 'On the e-file, opposite Black\'s rook.',
              why: 'The e-file is half-open for Black, not for White. White\'s rook there would only defend.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Control of the file',
          text: 'When a file opens, the side that occupies it first, and **doubles** rooks on it (or puts queen and rook together), usually wins it. The prize is entry into the enemy position: the seventh rank, or the back rank if the enemy king has no escape square.',
        },
        {
          kind: 'move',
          title: 'The back rank',
          text: 'Both sides have a queen and rook fighting over the d-file. White\'s pieces are doubled on it. Find the finish.',
          fen: '3r2k1/ppq2ppp/8/8/8/8/PP1Q1PPP/3R2K1 w - - 0 1',
          solution: ['Qxd8+', 'Qxd8', 'Rxd8#'],
          hint: 'Black\'s back rank has no escape square. Sacrifice to open it.',
          success: '1.Qxd8+! Qxd8 2.Rxd8#. The d-file belonged to the side with two heavy pieces on it, and Black\'s king had no escape square.',
        },
        {
          kind: 'read',
          title: 'The seventh rank',
          text: 'A rook on the seventh rank attacks pawns on their home squares from the side, where they are hardest to defend, and keeps the enemy king on the back rank. Two rooks on the seventh often decide the game on their own.\n\nHere 1.Rc7 hits b7 at once and forces Black\'s rook into passive defence.',
          fen: 'r5k1/1p3ppp/p7/8/8/1P6/P4PPP/2R3K1 w - - 0 1',
          arrows: [{ from: 'c1', to: 'c7', color: 'green' }],
        },
        {
          kind: 'move',
          title: 'Trade and invade',
          text: 'White to move. Make a trade that lets your rook reach the seventh rank.',
          fen: '4r1k1/pp3ppp/4q3/8/8/1Q6/PP3PPP/3R2K1 w - - 0 1',
          solution: ['Qxe6', 'fxe6', 'Rd7'],
          hint: 'Swap queens first, then use the open d-file.',
          success: '1.Qxe6! fxe6 2.Rd7 leaves Black with an isolated e-pawn and White\'s rook on the seventh, attacking b7. Black\'s rook must defend passively. (1.Qxb7?? would lose to 1...Qe1+ with mate.)',
        },
        {
          kind: 'quiz',
          title: 'Why the seventh?',
          text: 'Why is a rook on the seventh rank usually so strong?',
          choices: [
            {
              text: 'It attacks pawns that are hard to defend and confines the enemy king to the back rank.',
              correct: true,
              why: 'Pawns on their starting squares can only be defended by pieces, and the king cannot come out to help.',
            },
            {
              text: 'Because a rook on the seventh can promote.',
              why: 'Rooks never promote. The strength comes from attacking pawns and restricting the king.',
            },
            {
              text: 'Because it protects its own king.',
              why: 'A rook on the seventh is far from its own king; its value is purely offensive.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text: '- Put rooks on open and half-open files.\n- Double rooks, or queen and rook, to win a contested file.\n- An open file is a road to the seventh rank or the back rank.\n- A rook on the seventh attacks pawns and confines the king.\n- Before invading, check your own back rank.',
        },
      ],
    },

    // ---------------------------------------------------------------------------------------------
    {
      id: 'strat-prophylaxis-trades',
      title: 'Prophylaxis and the Art of the Trade',
      summary: 'Stop your opponent\'s plans before they start, and know which pieces to trade and when.',
      minutes: 13,
      steps: [
        {
          kind: 'read',
          title: 'What does my opponent want?',
          text: '**Prophylaxis** means preventing your opponent\'s plan before it becomes a threat. Before choosing a move, ask what your opponent would play if it were their turn. If that move is annoying, consider stopping it first.\n\nNimzowitsch described the idea, and Petrosian and Karpov built their styles on it: a quiet move that takes away the opponent\'s best option is often stronger than an active move of your own.',
        },
        {
          kind: 'demo',
          title: 'A classic prophylactic move',
          text: 'In the main line of the Ruy Lopez, White plays a quiet pawn move before pushing d4.',
          fen: START,
          moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3'],
          notes: [
            '1.e4.',
            '1...e5.',
            '2.Nf3.',
            '2...Nc6.',
            '3.Bb5, the Ruy Lopez.',
            '3...a6.',
            '4.Ba4.',
            '4...Nf6.',
            '5.O-O.',
            '5...Be7.',
            '6.Re1 defends e4.',
            '6...b5.',
            '7.Bb3.',
            '7...d6.',
            '8.c3 prepares d4.',
            '8...O-O.',
            '9.h3! Prophylaxis: it stops ...Bg4, which would pin the f3-knight and add pressure on d4. Now White can build the center with d4 in peace.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Read the quiet move',
          text: 'In the position after 9.h3, what does the move take away from Black?',
          fen: 'r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 b - - 0 9',
          choices: [
            {
              text: 'The ...Bg4 pin against the f3-knight.',
              correct: true,
              why: 'With the knight pinned, White\'s d4 advance would be much harder to support. h3 removes the idea before it appears.',
            },
            {
              text: 'The ...Nd4 jump.',
              why: 'h3 has nothing to do with d4. The pawn controls g4.',
            },
            {
              text: 'Queenside castling.',
              why: 'Black has already castled kingside, and h3 does not affect it.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Which pieces to trade',
          text: 'Every trade changes the position. Guidelines:\n- **Ahead in material**: trade pieces, not pawns. The fewer pieces left, the more an extra pawn counts.\n- **Behind in material**: trade pawns, keep pieces, look for counterplay.\n- **Attacking the king**: keep pieces on; every trade helps the defender.\n- **Cramped**: trade pieces to free your position.\n- Trade your bad pieces for the opponent\'s good ones, and check the resulting pawn ending before you trade the last pieces.',
        },
        {
          kind: 'move',
          title: 'Trade into a won ending',
          text: 'White is a pawn up with an outside passed a-pawn. Find the simplest way to win.',
          fen: '3r4/4kppp/8/8/P7/4K3/5PPP/3R4 w - - 0 1',
          solution: ['Rxd8'],
          hint: 'The fewer pieces, the more the extra pawn counts. Check the pawn ending.',
          success: '1.Rxd8! Kxd8 and the pawn ending is an easy win: the a-pawn drags Black\'s king to the queenside while White\'s king eats the kingside pawns. With rooks on, Black would have far more drawing chances.',
        },
        {
          kind: 'move',
          title: 'Trade the queens',
          text: 'Same idea with queens: White is a pawn up. Find the move that makes the win simple.',
          fen: '8/4kp2/3q2p1/7p/P2Q3P/5KP1/5P2/8 w - - 0 1',
          solution: ['Qxd6+'],
          hint: 'Queen endings are full of perpetual checks. Pawn endings are not.',
          success: '1.Qxd6+! Kxd6 and the outside passed a-pawn decides the pawn ending. With queens on, Black could hope for perpetual check.',
        },
        {
          kind: 'quiz',
          title: 'When not to trade',
          text: 'You are attacking the enemy king with queen, rook and knight. Your opponent offers a queen trade. What should you usually do?',
          choices: [
            {
              text: 'Avoid the trade and keep the attacking pieces on the board.',
              correct: true,
              why: 'The queen is your strongest attacker. Trading it usually ends the attack and relieves the defender.',
            },
            {
              text: 'Accept: trades are always good for the attacker.',
              why: 'The opposite is true. Trades help the defender, because fewer attackers remain.',
            },
            {
              text: 'Accept only if it wins a pawn.',
              why: 'A pawn rarely compensates for giving up a winning attack. Check whether the attack is worth more first.',
            },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text: '- Before each move, ask what your opponent wants, and whether you can prevent it cheaply.\n- Ahead: trade pieces, not pawns, and aim for a winning pawn ending.\n- Behind: keep pieces, trade pawns, look for counterplay.\n- Attacking: avoid trades. Defending: welcome them.\n- Always check the pawn ending before trading the last pieces.',
        },
      ],
    },
  ],
};
