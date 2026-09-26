import type { Unit } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const thinking: Unit = {
  id: 'thinking',
  title: 'How to Think',
  tagline: 'A move-by-move routine that catches your blunders, spots the opponent\'s threats and finds the best ideas.',
  level: 'Intermediate',
  lessons: [
    // ---------------------------------------------------------------- 1
    {
      id: 'think-cct',
      title: 'Checks, Captures, Threats',
      summary: 'Scan every forcing move for both sides before you choose, and tactics stop being a matter of luck.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Scan before you choose',
          text:
            'Strong players do not wait for tactics to jump out at them. Before choosing a move they run a quick scan:\n\n' +
            '- **Checks**: every check, even the silly-looking ones.\n' +
            '- **Captures**: every capture, and what it wins or loses.\n' +
            '- **Threats**: moves that attack something or threaten mate.\n\n' +
            'Then they run the same scan for the opponent. Forcing moves limit the replies, so they are the easiest to calculate and the most likely to decide the game.',
        },
        {
          kind: 'read',
          title: 'A scan in practice',
          text:
            'White to move in a quiet Italian Game. Nothing is attacked, but a strong player still notes the forcing moves: White\'s checks, captures and threats against f7 and e5, and Black\'s against f2 and e4.\n\n' +
            'None of them wins right now, so White can calmly develop. The scan takes a few seconds and tells you where the tension is.',
          fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
          marks: [
            { square: 'f7', color: 'yellow' },
            { square: 'f2', color: 'yellow' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Sort the moves',
          text: 'In the same position, which of these White moves is not a forcing move?',
          fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
          choices: [
            { text: 'Bxf7+', why: 'A capture and a check: the most forcing move there is, even if it loses a bishop for a pawn here.' },
            { text: 'Nxe5', why: 'A capture. After ...Nxe5 White has lost a knight for a pawn, but it belongs on the scan list.' },
            { text: 'Ng5', why: 'A threat: the knight and bishop both hit f7, which only the king defends.' },
            { text: 'O-O', correct: true, why: 'A good developing move, but it attacks nothing. Quiet moves come after the forcing ones in your scan.' },
          ],
        },
        {
          kind: 'move',
          title: 'Captures: count the defenders',
          text: 'White to move. Scan the captures. How many times is the knight on d5 attacked, and how many times is it defended?',
          fen: 'r2q1rk1/ppp1bppp/8/3n4/8/1BN5/PPP1QPPP/R4RK1 w - - 0 1',
          solution: ['Nxd5'],
          accept: ['Bxd5'],
          hint: 'The knight is attacked by your knight and your bishop, and defended only by the queen.',
          success: 'Nxd5 (or Bxd5) wins a piece. If ...Qxd5, the other piece takes the queen. Two attackers beat one defender.',
        },
        {
          kind: 'move',
          title: 'Checks: look at every one',
          text: 'White to move. Start with checks. One of them wins material.',
          fen: 'r7/p1qn1ppk/1p5p/2b5/8/1P3N2/P1P1QPPP/4R1K1 w - - 0 1',
          solution: ['Qe4+', 'f5', 'Qxa8'],
          hint: 'Which queen check also looks down the long diagonal to a8?',
          success: 'Qe4+ forks the king and the loose rook. Whether Black blocks with ...f5 or ...g6 or moves the king, Qxa8 follows.',
        },
        {
          kind: 'move',
          title: 'Threats: find the target',
          text: 'White to move. No check or capture helps here. Look for a threat: which black piece is short of squares?',
          fen: 'rnbq1rk1/p1p2ppp/1p2pn2/b2p4/3P4/P1PBPN2/1P1N1PPP/R1BQ1RK1 w - - 0 1',
          solution: ['b4'],
          hint: 'The bishop on a5 has no retreat: b6, c7 and d8 are all taken by Black\'s own pieces.',
          success: 'b4 traps the bishop. Your pawn is protected by a3 and c3, so ...Bxb4 axb4 only gets a pawn for the piece.',
        },
        {
          kind: 'quiz',
          title: 'Why checks first?',
          text: 'Why do strong players look at every check first, even ones that seem to lose material?',
          choices: [
            { text: 'Checks force the reply, so they are quick to calculate and often hide a combination', correct: true, why: 'With only a few legal answers, you can see to the end of a check line much faster than a quiet move.' },
            { text: 'Checks always win material', why: 'Many checks achieve nothing or lose material. You look at them because they are forcing, not because they are good.' },
            { text: 'The opponent might panic', why: 'Hoping for a panic is not a plan. The scan is about finding the truth of the position.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Before every move, list your checks, captures and threats, then your opponent\'s.\n' +
            '- Forcing moves narrow the replies, so calculate them first.\n' +
            '- For captures, count attackers and defenders.\n' +
            '- For threats, look for loose pieces and pieces with no escape squares.\n' +
            '- Make the scan a habit in every game, not only when you expect a tactic.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'think-blunder-check',
      title: 'The Blunder Check',
      summary: 'Ten seconds before every move: what does it allow, and what did the moved piece stop defending?',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Ten seconds that save games',
          text:
            'Most club games are decided by a piece left hanging or a tactic overlooked. The cure is a short check before you touch a piece. Picture the board after your move and ask:\n\n' +
            '- What checks, captures and threats does it give my opponent?\n' +
            '- What was the moved piece defending?\n' +
            '- Is anything of mine now loose?\n\n' +
            'If an answer is bad, go back to your candidates.',
        },
        {
          kind: 'demo',
          title: 'One question too few',
          text: 'White spots a loose bishop on d7 and grabs it. The queen on d1 had another job.',
          fen: '4r1k1/pp1b1ppp/8/q7/8/1B6/PP3PPP/2RQ2K1 w - - 0 1',
          moves: ['Qxd7', 'Re1+', 'Rxe1', 'Qxe1#'],
          notes: [
            '1.Qxd7?? wins a bishop, but the queen was the only guard of e1.',
            '1...Re1+! The rook invades the back rank.',
            '2.Rxe1 is forced.',
            '2...Qxe1#. The question "what was my queen defending?" would have saved the game.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Check before you grab',
          text: 'White would like to play 1.Nxe5, winning a pawn and attacking the knight on g4. Run the blunder check: what does the move allow?',
          fen: 'r1b2rk1/pppp1ppp/2n5/4p2q/3P2n1/5N2/PPP2PPP/RNBQRBK1 w - - 0 1',
          choices: [
            { text: '1...Qxh2 mate', correct: true, why: 'The f3-knight was the only white piece guarding h2. Once it leaves, the queen and the g4-knight mate on h2.' },
            { text: '1...Nxe5, winning a piece', why: 'After 1...Nxe5 2.dxe5 White is simply a pawn up. The real problem is elsewhere.' },
            { text: 'Nothing: White wins a pawn', why: 'Black has a mating reply. Always ask what the moving piece was defending.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Which question was skipped?',
          text: 'Black has just played ...Nd7, moving the knight from f6. Which blunder-check question did Black forget?',
          fen: 'r1q2rk1/pb1nbppp/1p2p3/2p5/3P4/2PQ1N2/PPB2PPP/R1B1R1K1 w - - 0 1',
          arrows: [{ from: 'f6', to: 'd7', color: 'blue' }],
          choices: [
            { text: 'What was the knight defending?', correct: true, why: 'On f6 the knight guarded h7 against White\'s queen and bishop battery.' },
            { text: 'Does the move attack anything?', why: 'That is a useful question for choosing moves, but it does not protect you from blunders.' },
            { text: 'Is the knight safe on d7?', why: 'It is safe there. The danger is on the other side of the board.' },
          ],
        },
        {
          kind: 'move',
          title: 'Punish the missing check',
          text: 'White to move. Take advantage of Black\'s last move.',
          fen: 'r1q2rk1/pb1nbppp/1p2p3/2p5/3P4/2PQ1N2/PPB2PPP/R1B1R1K1 w - - 0 1',
          solution: ['Qxh7#'],
          hint: 'Your queen and the c2-bishop both aim at h7.',
          success: 'Qxh7#. The knight on f6 was the only guard of h7. Black moved it without asking what it was defending.',
        },
        {
          kind: 'move',
          title: 'A new line for the queen',
          text: 'White to move. Black\'s last move was ...Qd8-d7. It looks harmless. Punish it.',
          fen: 'r1b1kb1r/pp1q1ppp/n3pn2/2pp4/3P4/2N1PN2/PPP1BPPP/R1BQ1RK1 w - - 0 1',
          solution: ['Bb5'],
          hint: 'Look at the diagonal from b5 to e8. What stands on it now?',
          success: 'Bb5 pins the queen to the king and wins it for a bishop, since the c3-knight guards b5. Black\'s blunder check should have asked: which lines does my queen stand on now?',
        },
        {
          kind: 'move',
          title: 'What did the queen leave behind?',
          text: 'White to move. Black has just played ...Qd8-h4, eyeing your f2-pawn. What was the queen guarding on d8?',
          fen: 'rnb3k1/ppp2ppp/3p4/8/3P3q/2N5/PPP2PPP/2BQR1K1 w - - 0 1',
          arrows: [{ from: 'd8', to: 'h4', color: 'blue' }],
          solution: ['Re8#'],
          hint: 'Look at the open e-file and Black\'s back rank.',
          success: 'Re8#. On d8 the queen covered e8. Black\'s attacking move left the back rank bare, and the c8-bishop blocks the a8-rook.',
        },
        {
          kind: 'quiz',
          title: 'The tempting capture',
          text: 'White to move. 6.Nxd5 grabs a pawn, because the f6-knight seems pinned to the queen. Blunder-check it: what is Black\'s answer?',
          fen: 'r1bqkb1r/pppn1ppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w KQkq - 0 6',
          choices: [
            { text: '6...Nxd5! 7.Bxd8 Bb4+, and Black wins a piece', correct: true, why: 'The intermezzo check picks up White\'s queen before Black recaptures on d8. This is the Elephant Trap.' },
            { text: '6...Nxd5 7.Bxd8 Kxd8, and White has won the queen', why: 'Black does not have to recapture at once: 7...Bb4+ comes first.' },
            { text: 'Nothing: the knight is pinned, so White wins a pawn', why: 'The pin is only relative. Black may move the knight if he gets more back.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Before you touch a piece, picture the position after your move.\n' +
            '- Ask what your move allows: checks, captures and threats for the opponent.\n' +
            '- Ask what the moving piece was defending; that is where most blunders hide.\n' +
            '- Use the same questions on your opponent\'s last move to find their mistakes.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'think-opponent-threat',
      title: 'What Does Their Move Want?',
      summary: 'After every opponent move, find its threat, and what it gave up, before you look for your own ideas.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Every move has a purpose',
          text:
            'When your opponent moves, resist jumping straight to your own plans. First ask:\n\n' +
            '- What does this move attack or threaten?\n' +
            '- Which lines did it open or close?\n' +
            '- What did the moved piece stop defending?\n\n' +
            'The first two questions find the danger. The last one finds the chances it gives you.',
        },
        {
          kind: 'quiz',
          title: 'Read the threat',
          text: 'Black has just played ...Qh4. What is Black threatening?',
          fen: 'r4rk1/pbp2ppp/1p1pp3/8/2PP2nq/1P2P3/PBQN1PPP/R4RK1 w - - 0 1',
          arrows: [{ from: 'd8', to: 'h4', color: 'blue' }],
          choices: [
            { text: '...Qxh2 mate', correct: true, why: 'The queen and the g4-knight both hit h2, and only your king defends it.' },
            { text: '...Qxf2+, winning a pawn', why: 'f2 is guarded by the rook and the king. The queen would simply be lost.' },
            { text: '...Nxe3, forking queen and rook', why: 'The e3-pawn is defended by f2, so ...Nxe3 fxe3 just loses the knight.' },
          ],
        },
        {
          kind: 'move',
          title: 'Parry the threat',
          text: 'White to move. Stop ...Qxh2 mate. Several moves seem to do it; only one works.',
          fen: 'r4rk1/pbp2ppp/1p1pp3/8/2PP2nq/1P2P3/PBQN1PPP/R4RK1 w - - 0 1',
          solution: ['h3'],
          hint: 'Nf3 adds a defender, but the b7-bishop can remove it. Block the queen\'s path instead.',
          success: 'h3 closes the h-file so the queen cannot reach h2, and it attacks the knight. The natural Nf3? fails to ...Bxf3, removing the new defender.',
        },
        {
          kind: 'read',
          title: 'Parry, move, or hit back',
          text:
            'When your opponent threatens something, you have three kinds of answer: parry the threat, move out of its way, or ignore it for a bigger threat of your own, usually a check.\n\n' +
            'So scan your own forcing moves before you defend. And look at what the threatening move gave up: an attacking move often leaves a hole behind.',
        },
        {
          kind: 'demo',
          title: 'Ignoring a threat',
          text: 'White wins a pawn and misses what Black\'s queen move wants.',
          fen: START,
          moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'],
          notes: [
            '',
            '',
            '',
            '',
            '',
            '3...Nd4 looks odd, and it invites 4.Nxe5.',
            '4.Nxe5? takes the bait.',
            '4...Qg5! What does it want? It attacks the knight on e5 and the g2-pawn at once.',
            '5.Nxf7?? ignores the threat to g2. 5.Bxf7+ was the best try, and even then Black is fine.',
            '5...Qxg2 hits the rook.',
            '6.Rf1',
            '6...Qxe4+ The queen checks from e4.',
            '7.Be2 blocks, but the bishop is now pinned.',
            '7...Nf3#. Smothered on e1.',
          ],
        },
        {
          kind: 'move',
          title: 'What did it give up?',
          text: 'White to move. Black has just played ...Ne4, attacking your queen. Before you move the queen, ask what the knight\'s move gave up.',
          fen: 'r4rk1/pb1qbppp/1p1pp3/8/2P1n3/1PQBPN2/PB3PPP/R4RK1 w - - 0 1',
          arrows: [{ from: 'f6', to: 'e4', color: 'blue' }],
          solution: ['Qxg7#'],
          hint: 'Where was the knight before, and which square did it guard? Look at the long diagonal.',
          success: 'Qxg7#. The knight left f6, opening the diagonal and abandoning g7. Running away with the queen would have missed mate.',
        },
        {
          kind: 'quiz',
          title: 'The quiet threat',
          text: 'Black has just played ...Qe5. What does it threaten?',
          fen: '4r1k1/1p3ppp/8/4q3/8/1Q6/1P3PPP/3R2K1 w - - 0 1',
          choices: [
            { text: '...Qe1+ Rxe1 Rxe1 mate', correct: true, why: 'Queen and rook are doubled on the open e-file and White\'s king has no luft. White should play h3 or g3 now.' },
            { text: '...Qxb2, winning a pawn', why: 'The b2-pawn is defended by your queen. ...Qxb2 would lose the queen.' },
            { text: 'Nothing: the position is quiet', why: 'Quiet-looking moves can carry the biggest threats. Always ask what it wants.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- After every opponent move, find its threat before you look for your own ideas.\n' +
            '- Check which lines the move opened and what the moved piece stopped defending.\n' +
            '- When threatened, scan your own checks first: a bigger threat can be the best defence.\n' +
            '- Prefer the defence that does not create a new weakness.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'think-candidates',
      title: 'Candidate Moves and Calculation',
      summary: 'List your candidates, calculate the forcing lines to a quiet position, then compare.',
      minutes: 12,
      steps: [
        {
          kind: 'read',
          title: 'List before you look deep',
          text:
            'Before calculating anything, list your **candidate moves**: two to four moves worth a closer look. Start with the forcing ones, then add the natural positional moves.\n\n' +
            'Listing first protects you from falling in love with the first idea you see, and from spending all your time on one line while a better move sits unexamined.',
        },
        {
          kind: 'read',
          title: 'Calculate to a quiet position',
          text:
            'For each forcing candidate, follow the most forcing replies move by move until the position goes **quiet**: no checks, no pieces hanging, no immediate threats. Only then evaluate: material, king safety, active pieces.\n\n' +
            'Compare candidates by where they end up, not by how exciting the first move looks. In races, count tempi exactly.',
        },
        {
          kind: 'demo',
          title: 'Counting a breakthrough',
          text: 'Three pawns against three, both kings far away. White calculates a forcing line to the end.',
          fen: '8/1k3ppp/8/5PPP/8/8/1K6/8 w - - 0 1',
          moves: ['g6', 'hxg6', 'f6', 'gxf6', 'h6'],
          notes: [
            '1.g6! If 1...fxg6, then 2.h6! gxh6 3.f6 and the f-pawn queens.',
            '1...hxg6',
            '2.f6! The same idea from the other side.',
            '2...gxf6',
            '3.h6. The h-pawn runs to h8 and the black king is far too slow.',
          ],
        },
        {
          kind: 'quiz',
          title: 'When to stop',
          text: 'You are calculating a line full of captures and checks. When can you stop and evaluate?',
          choices: [
            { text: 'When the position is quiet: no checks, captures or direct threats left', correct: true, why: 'Evaluating in the middle of a sequence is how players miss the last recapture or the final check.' },
            { text: 'After exactly three moves', why: 'Depth depends on the position. Some lines end after one move, others need six.' },
            { text: 'As soon as you are ahead in material', why: 'Being ahead mid-sequence means little if the opponent still has a capture or check to come.' },
          ],
        },
        {
          kind: 'move',
          title: 'Your turn to count',
          text: 'White to move. Same structure on the queenside. Calculate the breakthrough to the end.',
          fen: '8/ppp3k1/8/PPP5/8/8/6K1/8 w - - 0 1',
          solution: ['b6', 'axb6', 'c6', 'bxc6', 'a6'],
          hint: 'Start with the middle pawn, and answer each capture by pushing the pawn that is left free.',
          success: 'b6! axb6 c6! bxc6 a6, and the a-pawn queens. After 1...cxb6, 2.a6! works the same way. Every line was forcing, so you could calculate it to the end.',
        },
        {
          kind: 'move',
          title: 'Calculate the mate',
          text: 'White to move. Black is far ahead in material and attacks your rook on d3. Find the forcing line: mate in three.',
          fen: 'r4rk1/p1p2ppp/bp6/3N3Q/8/1P1R4/PqP2PPP/6K1 w - - 0 1',
          solution: ['Ne7+', 'Kh8', 'Qxh7+', 'Kxh7', 'Rh3#'],
          hint: 'Checks first. Once your knight covers g8 and g6, the king on h7 has nowhere to go.',
          success: 'Ne7+ Kh8 Qxh7+! Kxh7 Rh3#. Every move was a check, so the calculation was short and certain. This mating pattern is called Anastasia\'s mate.',
        },
        {
          kind: 'quiz',
          title: 'Before you sacrifice',
          text: 'You have found a queen sacrifice that seems to lead to mate. What do you check before playing it?',
          choices: [
            { text: 'Every defence at each step, especially checks and captures for the opponent', correct: true, why: 'A combination is only as good as its answer to the best defence. Look for the in-between move that breaks it.' },
            { text: 'Nothing: sacrifices are always worth a try', why: 'An unsound sacrifice just loses material. Calculate first.' },
            { text: 'Only the most natural reply', why: 'Natural replies are the ones you already considered. The dangerous ones are the surprising checks and captures.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- List two to four candidates before calculating any of them, forcing moves first.\n' +
            '- Follow each forcing line until the position is quiet, then evaluate.\n' +
            '- Compare the end positions of your candidates, not the first moves.\n' +
            '- Check the opponent\'s best defence at every step, including in-between moves.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'think-practical',
      title: 'Practical Play',
      summary: 'Manage your clock, simplify when ahead, fight when behind, and never play hope chess.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Use your clock',
          text:
            'Time is a resource, like material. Spend it where the game is decided: when pieces are under attack, when you choose a plan, and before moves you cannot take back, such as pawn breaks and big trades.\n\n' +
            'Play obvious recaptures and familiar opening moves quickly. Keep a reserve for the end: most blunders happen in the last minutes.',
        },
        {
          kind: 'read',
          title: 'Ahead or behind',
          text:
            'When you are **ahead**: trade pieces (not pawns), take away your opponent\'s counterplay before grabbing more, and choose the simplest winning line.\n\n' +
            'When you are **behind**: keep pieces on the board, create threats, and look for perpetual check, stalemate tricks and traps.\n\n' +
            'In both cases avoid **hope chess**: a move that only works if your opponent misses the obvious reply.',
        },
        {
          kind: 'move',
          title: 'Simplify when ahead',
          text: 'White to move. You are a pawn up, and your a-pawn is an outside passed pawn. Find the simplest winning plan.',
          fen: '3r4/4kp1p/6p1/8/P7/2K3P1/5P1P/3R4 w - - 0 1',
          solution: ['Rxd8'],
          hint: 'King and pawn endings with an outside passed pawn are usually winning. Can you force one?',
          success: 'Rxd8! Kxd8 and the pawn ending is won: the a-pawn drags Black\'s king away while your king eats the kingside pawns. With rooks on, Black would keep drawing chances.',
        },
        {
          kind: 'move',
          title: 'Save the game with checks',
          text: 'White to move. You are two rooks down and Black is threatening your king. Find the draw.',
          fen: 'r4rk1/pp3p1p/8/8/8/8/PP2qPPP/2Q3K1 w - - 0 1',
          solution: ['Qg5+', 'Kh8', 'Qf6+'],
          hint: 'The black king has no g-pawn in front of it. Can your queen check from g5 and f6 forever?',
          success: 'Qg5+ Kh8 Qf6+ Kg8 Qg5+ is perpetual check: a draw. When you are losing, look for forcing moves your opponent cannot escape.',
        },
        {
          kind: 'move',
          title: 'The stalemate trick',
          text: 'White to move. Black threatens mate on g2 and f1, and your king has no legal moves. Use that.',
          fen: '8/6rk/6pp/3Q4/8/7p/5q1P/7K w - - 0 1',
          solution: ['Qg8+'],
          hint: 'If your queen disappeared, could White move at all?',
          success: 'Qg8+! After ...Kxg8 or ...Rxg8, White has no legal move and it is stalemate: a draw. When your king is boxed in, look for ways to give away your last active piece.',
        },
        {
          kind: 'quiz',
          title: 'Ahead on the clock',
          text: 'You are a knight up with five minutes left. Your opponent offers a queen trade. What should you usually do?',
          choices: [
            { text: 'Accept the trade', correct: true, why: 'Each exchange makes your extra knight count for more and removes your opponent\'s best attacking piece.' },
            { text: 'Avoid it to keep attacking', why: 'With the material already won, an attack only adds risk, especially with little time left.' },
            { text: 'Spend most of your time deciding', why: 'The principle is clear. Save your minutes for positions that really need them.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Hope chess',
          text: 'Which of these is hope chess?',
          choices: [
            { text: 'Threatening mate with a move that loses a piece to the obvious defence, hoping it will be missed', correct: true, why: 'The move only works if the opponent misses an easy answer. Always check the best reply, not the one you hope for.' },
            { text: 'Setting a trap that also improves your position if the opponent sees it', why: 'That is good practical play: nothing is lost if the trap is avoided.' },
            { text: 'Offering a draw in a worse position', why: 'That is a practical decision, not a move that depends on a mistake.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Spend your time on critical moments; play obvious moves quickly.\n' +
            '- Ahead: trade pieces, kill counterplay, choose the simple win.\n' +
            '- Behind: keep pieces on, make threats, look for perpetual check and stalemate.\n' +
            '- Never play hope chess. Assume the opponent will find the best reply.',
        },
      ],
    },
  ],
};
