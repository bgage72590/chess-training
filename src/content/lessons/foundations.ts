import type { Unit } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const foundations: Unit = {
  id: 'foundations',
  title: 'Foundations',
  tagline: 'How every piece moves and captures, what it is worth, the special rules, and how to stop dropping pieces.',
  level: 'Beginner',
  lessons: [
    // ---------------------------------------------------------------- 1
    {
      id: 'found-pieces',
      title: 'How the Pieces Move',
      summary: 'The board, the goal of the game, and how each piece moves and captures.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'The board and the goal',
          text:
            'The board has eight **files** (a to h, left to right from White\'s side) and eight **ranks** (1 to 8). Every square is named file first, then rank: the marked square is **e4**.\n\n' +
            'White starts on ranks 1 and 2, Black on ranks 7 and 8, and White moves first. The goal is not to capture pieces but to **checkmate** the enemy king: attack it so that it cannot escape.',
          fen: START,
          marks: [{ square: 'e4', color: 'yellow' }],
        },
        {
          kind: 'read',
          title: 'Rook, bishop and queen',
          text:
            'These three **slide** any distance in a straight line until something blocks them.\n\n' +
            '- The **rook** moves along ranks and files (green).\n' +
            '- The **bishop** moves diagonally (blue), so it stays on one colour all game.\n' +
            '- The **queen** combines both.\n\n' +
            'A slider **captures** by landing on the first enemy piece in its path. It can never jump over anything.',
          fen: '1k6/8/8/8/3Q4/8/7K/8 w - - 0 1',
          arrows: [
            { from: 'd4', to: 'd8', color: 'green' },
            { from: 'd4', to: 'd1', color: 'green' },
            { from: 'd4', to: 'a4', color: 'green' },
            { from: 'd4', to: 'h4', color: 'green' },
            { from: 'd4', to: 'a7', color: 'blue' },
            { from: 'd4', to: 'a1', color: 'blue' },
            { from: 'd4', to: 'h8', color: 'blue' },
            { from: 'd4', to: 'g1', color: 'blue' },
          ],
        },
        {
          kind: 'read',
          title: 'Knight and king',
          text:
            'The **knight** moves in an L: two squares in one direction, then one to the side. It is the only piece that **jumps** over others, and every move takes it to a square of the other colour. From d5 it reaches the eight marked squares.\n\n' +
            'The **king** steps one square in any direction. It may never move onto a square the enemy attacks.',
          fen: '7k/8/8/3N4/8/8/8/K7 w - - 0 1',
          marks: [
            { square: 'b4', color: 'green' },
            { square: 'b6', color: 'green' },
            { square: 'c3', color: 'green' },
            { square: 'c7', color: 'green' },
            { square: 'e3', color: 'green' },
            { square: 'e7', color: 'green' },
            { square: 'f4', color: 'green' },
            { square: 'f6', color: 'green' },
          ],
        },
        {
          kind: 'read',
          title: 'Pawns',
          text:
            'Pawns move straight forward one square, or two from their starting square: the e2-pawn can go to e3 or e4. They **capture diagonally forward**, one square: the g4-pawn can take on h5.\n\n' +
            'A pawn never captures straight ahead and never moves backwards. The c5-pawn is stuck until the c6-pawn moves or is captured.',
          fen: '4k3/8/2p5/2P4p/6P1/8/4P3/4K3 w - - 0 1',
          arrows: [
            { from: 'e2', to: 'e3', color: 'green' },
            { from: 'e2', to: 'e4', color: 'green' },
            { from: 'g4', to: 'h5', color: 'green' },
          ],
          marks: [{ square: 'c6', color: 'red' }],
        },
        {
          kind: 'demo',
          title: 'The pieces at work',
          text: 'Step through a real opening and watch each piece type move and capture.',
          fen: START,
          moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6'],
          notes: [
            '1.e4: the pawn uses its double step from the starting square.',
            '1...e5: Black does the same. The two pawns now block each other.',
            '2.Nf3: the knight jumps over the pawn wall and attacks e5.',
            '2...Nc6: Black\'s knight defends the e5-pawn.',
            '3.Bb5: the bishop slides along the diagonal and attacks the knight.',
            '3...a6: the a-pawn attacks the bishop in turn.',
            '4.Bxc6: the bishop captures by landing on the knight\'s square. The knight leaves the board.',
            '4...dxc6: the d-pawn recaptures diagonally. Bishop and knight have been traded.',
          ],
        },
        {
          kind: 'move',
          title: 'Your turn: the rook',
          text: 'White to move. Black\'s bishop on e5 has no defender. Capture it.',
          fen: '6k1/5ppp/8/4b3/8/8/5PPP/4R1K1 w - - 0 1',
          solution: ['Rxe5'],
          hint: 'Your rook slides up the open e-file. What does it meet first?',
          success: 'Rxe5 wins a bishop for nothing. Nothing stood on e2, e3 or e4, and nothing defended e5.',
        },
        {
          kind: 'move',
          title: 'Your turn: the bishop',
          text: 'White to move. Your bishop on b2 can reach the far corner. Win the rook.',
          fen: '4k2r/p4p1p/6p1/8/8/8/PB3PPP/6K1 w - - 0 1',
          solution: ['Bxh8'],
          hint: 'Follow the long diagonal from b2 to h8. Is anything in the way?',
          success: 'Bxh8 takes a whole rook from across the board. Black\'s g-pawn had moved to g6, so the long diagonal was open.',
        },
        {
          kind: 'move',
          title: 'Your turn: the knight',
          text: 'White to move. Black\'s queen has landed on a square your knight attacks. Take it.',
          fen: '6k1/p4ppp/8/4q3/8/5N2/P3BPPP/6K1 w - - 0 1',
          solution: ['Nxe5'],
          hint: 'Knights move two squares one way and one to the side. Count from f3.',
          success: 'Nxe5 wins the queen. Queens are strong, but the knight\'s L-shaped attack is easy to overlook.',
        },
        {
          kind: 'quiz',
          title: 'Pawn rules',
          text: 'Which move can the white pawn on e4 play?',
          fen: '4k3/8/8/3np3/4P3/8/8/4K3 w - - 0 1',
          choices: [
            { text: 'exd5', correct: true, why: 'Pawns capture one square diagonally forward, and d5 holds a black knight.' },
            { text: 'e5', why: 'e5 is occupied. A pawn cannot capture straight ahead, so it is blocked.' },
            { text: 'exf5', why: 'f5 is empty. A pawn moves diagonally only when it captures.' },
            { text: 'e3', why: 'Pawns never move backwards.' },
          ],
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Rooks slide on ranks and files, bishops on diagonals, the queen on both. None of them can jump.\n' +
            '- Knights move in an L and jump over anything in between.\n' +
            '- The king moves one square and may never step into an attack.\n' +
            '- Pawns move forward, capture diagonally, and never go backwards.\n' +
            '- On every move, look for enemy pieces you can take for free.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'found-values',
      title: 'Piece Values and Trading',
      summary: 'Count material in points so you know which captures and trades help you.',
      minutes: 9,
      steps: [
        {
          kind: 'read',
          title: 'What the pieces are worth',
          text:
            'Count material in **points**:\n' +
            '- Pawn 1\n' +
            '- Knight 3, bishop 3\n' +
            '- Rook 5\n' +
            '- Queen 9\n\n' +
            'The king has no value because it can never be traded. The numbers are a guide, not a law: an active knight can outplay a buried rook. But when in doubt, the side with more points usually wins.',
          fen: '4k3/8/8/2PNBRQ1/8/8/8/4K3 w - - 0 1',
        },
        {
          kind: 'read',
          title: 'Trades and the exchange',
          text:
            'When both sides capture, add up what you gave and what you got.\n\n' +
            '- Knight for bishop: an **even trade**, 3 for 3.\n' +
            '- Your rook for a knight or bishop: you **lose the exchange**, 5 for 3.\n' +
            '- Your queen for a rook: a disaster, 9 for 5.\n\n' +
            'A simple rule: when you are ahead in material, trade pieces. When you are behind, avoid trades.',
        },
        {
          kind: 'demo',
          title: 'A check that loses material',
          text: 'A classic beginner mistake: grabbing a pawn with check and giving away a piece.',
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
          moves: ['Bxf7+', 'Kxf7', 'Ng5+', 'Kg8'],
          notes: [
            '4.Bxf7+ grabs a pawn with check. It looks aggressive.',
            '4...Kxf7: the king simply recaptures. White has given a bishop (3) for a pawn (1).',
            '5.Ng5+ checks again, hoping for more.',
            '5...Kg8: the king is safe and Black is two points up. The checks achieved nothing.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Which trade helps you?',
          text: 'You can make one of these trades. Which one gains material?',
          choices: [
            { text: 'Your knight for a rook', correct: true, why: 'You give 3 and get 5: you win the exchange, a two-point gain.' },
            { text: 'Your rook for a bishop', why: 'You give 5 and get 3: you lose the exchange.' },
            { text: 'Your bishop for a knight', why: '3 for 3 is an even trade. It may be good or bad for other reasons, but it wins nothing.' },
            { text: 'Your queen for a rook and a pawn', why: 'You give 9 and get 6: three points down.' },
          ],
        },
        {
          kind: 'move',
          title: 'Take the bigger prize',
          text: 'White to move. Your knight can capture a pawn or a rook. Choose well.',
          fen: '6k1/p1q2ppp/8/1r1p4/8/2N5/PP3PPP/3Q2K1 w - - 0 1',
          solution: ['Nxb5'],
          hint: 'Compare the prizes: the d5-pawn is worth 1, the b5-rook is worth 5.',
          success: 'Nxb5 wins a rook. The d5-pawn can wait: count material in points, not in number of captures.',
        },
        {
          kind: 'move',
          title: 'Win the exchange',
          text: 'White to move. The f6-rook is defended, but compare its value with the value of your knight.',
          fen: '6k1/pp2qppp/5r2/8/4N3/8/PPP2PPP/3Q2K1 w - - 0 1',
          solution: ['Nxf6+'],
          hint: 'Capture the rook with check. Black can take back, but count the points.',
          success: 'Nxf6+ Qxf6 gives a knight (3) for a rook (5). You have **won the exchange**.',
        },
        {
          kind: 'move',
          title: 'Recapture with the right piece',
          text: 'Black\'s knight has just captured on d4. You can take back with the queen or the c3-pawn. Which is right?',
          fen: '6k1/5ppp/8/2b5/3n4/2P5/5PPP/3Q2K1 w - - 0 1',
          solution: ['cxd4'],
          hint: 'The c5-bishop also guards d4. Recapture with your least valuable piece.',
          success: 'cxd4 wins the knight and attacks the bishop too. Qxd4?? would have lost the queen to ...Bxd4.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Pawn 1, knight 3, bishop 3, rook 5, queen 9.\n' +
            '- Before capturing, count what you give and what you get.\n' +
            '- A rook for a knight or bishop wins the exchange: two points.\n' +
            '- On a guarded square, recapture with your least valuable piece.\n' +
            '- Ahead in material? Trade pieces. Behind? Keep them on.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'found-check',
      title: 'Check, Checkmate and Stalemate',
      summary: 'How to escape check, what makes a checkmate, and the stalemate rule that turns wins into draws.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Check',
          text:
            'A king under attack is in **check**, and you must deal with it on this move. There are exactly three ways:\n' +
            '- **Capture** the checking piece: Bxe8.\n' +
            '- **Block** the line: Ne2.\n' +
            '- **Move** the king to a safe square: Kf1.\n\n' +
            'If none of the three works, it is checkmate.',
          fen: '4r1k1/5ppp/8/1B6/8/2N5/PPP2PPP/4K2R w - - 0 1',
          arrows: [
            { from: 'e8', to: 'e1', color: 'red' },
            { from: 'b5', to: 'e8', color: 'green' },
            { from: 'c3', to: 'e2', color: 'green' },
            { from: 'e1', to: 'f1', color: 'green' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Choose your answer to check',
          text: 'Same position. White is in check from the e8-rook. Which reply is best?',
          fen: '4r1k1/5ppp/8/1B6/8/2N5/PPP2PPP/4K2R w - - 0 1',
          choices: [
            { text: 'Bxe8', correct: true, why: 'Capturing the checker ends the check and wins a rook.' },
            { text: 'Ne2', why: 'Legal, and it blocks the check, but Black keeps the rook and can pile up on the pinned knight.' },
            { text: 'Kf1', why: 'Legal, but why run when you can take a rook for free?' },
            { text: 'O-O', why: 'You may never castle out of check.' },
          ],
        },
        {
          kind: 'move',
          title: 'The king can capture too',
          text: 'White is in check. Find the reply that wins material.',
          fen: '6k1/5ppp/8/8/8/8/5PPq/3Q2K1 w - - 0 1',
          solution: ['Kxh2'],
          hint: 'Is the black queen protected by anything?',
          success: 'Kxh2. The king may capture a checking piece as long as nothing protects it.',
        },
        {
          kind: 'read',
          title: 'Checkmate',
          text:
            '**Checkmate** is check with no way out: no capture, no block, no safe square. The game ends on the spot.\n\n' +
            'Here the e8-rook checks along the back rank. The king cannot reach it, nothing can block, and f7, g7 and h7 are filled by Black\'s own pawns.',
          fen: '4R1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1',
          arrows: [{ from: 'e8', to: 'g8', color: 'red' }],
          marks: [
            { square: 'g8', color: 'red' },
            { square: 'f7', color: 'blue' },
            { square: 'g7', color: 'blue' },
            { square: 'h7', color: 'blue' },
          ],
        },
        {
          kind: 'move',
          title: 'Deliver checkmate',
          text: 'White to move. Black threatens ...Qa1+ with mate on your own back rank. Strike first: mate in one.',
          fen: '1r4k1/5ppp/5P2/8/6Q1/8/q4PPP/6K1 w - - 0 1',
          solution: ['Qxg7#'],
          hint: 'The f6-pawn can support a capture right next to the black king.',
          success: 'Qxg7#. The f6-pawn protects the queen, so the king cannot take it, and the queen covers every escape square.',
        },
        {
          kind: 'read',
          title: 'Stalemate',
          text:
            '**Stalemate**: the side to move is **not** in check but has no legal move. The game is a **draw**.\n\n' +
            'It is Black\'s move here. The king is not attacked, but every square next to it is covered and Black has no other piece. White has thrown away a won game. When you are winning, always make sure your opponent has a legal move.',
          fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
          marks: [
            { square: 'h8', color: 'yellow' },
            { square: 'g8', color: 'red' },
            { square: 'g7', color: 'red' },
            { square: 'h7', color: 'red' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Mate or stalemate?',
          text: 'Black to move. What is the result?',
          fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1',
          choices: [
            { text: 'Checkmate', why: 'The king is not in check: the queen on c7 does not attack a8.' },
            { text: 'Stalemate: a draw', correct: true, why: 'Black is not in check and has no legal move. The white king covers a7 and b7, the queen covers b8.' },
            { text: 'Play goes on with ...Kb8', why: 'b8 is attacked by the queen on c7.' },
            { text: 'Play goes on with ...Ka7', why: 'a7 is next to the white king on b6.' },
          ],
        },
        {
          kind: 'move',
          title: 'Save a lost game',
          text: 'Black to move, and White has a queen. But your king has no legal move and your h-pawn is blocked. Find the draw.',
          fen: '7k/7p/4Q2P/8/8/7K/8/r7 b - - 0 1',
          solution: ['Rh1+'],
          hint: 'If your rook disappeared, what would happen on your next turn? Offer it with check.',
          success: 'Rh1+! The rook keeps checking. If the king ever takes it, Black has no legal move: stalemate. A rook used like this is called a **desperado**.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Check means the king is attacked. Answer it by capturing, blocking or moving the king.\n' +
            '- Checkmate is check with no answer. The game is over.\n' +
            '- Stalemate is no legal move while not in check. It is a draw.\n' +
            '- The king may capture a checking piece that is unprotected.\n' +
            '- When you are winning, make sure your opponent always has a legal move.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'found-special',
      title: 'Castling, En Passant and Promotion',
      summary: 'The three special moves: when you may castle, how to capture in passing, and what a pawn becomes on the last rank.',
      minutes: 12,
      steps: [
        {
          kind: 'read',
          title: 'Castling',
          text:
            '**Castling** is the only move that uses two pieces. The king steps two squares toward a rook, and that rook jumps to the square the king crossed.\n\n' +
            '- Kingside, **O-O**: king to g1, rook to f1.\n' +
            '- Queenside, **O-O-O**: king to c1, rook to d1.\n\n' +
            'In one move the king gets to safety and a rook heads for the centre.',
          fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
          arrows: [
            { from: 'e1', to: 'g1', color: 'green' },
            { from: 'h1', to: 'f1', color: 'green' },
            { from: 'e1', to: 'c1', color: 'blue' },
            { from: 'a1', to: 'd1', color: 'blue' },
          ],
        },
        {
          kind: 'demo',
          title: 'Castling in a real game',
          text: 'Clear the squares between king and rook, then castle.',
          fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
          moves: ['O-O', 'Nf6', 'd3', 'O-O'],
          notes: [
            '4.O-O: the knight and bishop have left g1 and f1, so White castles. The king now sits behind the f2-, g2- and h2-pawns.',
            '4...Nf6: Black clears the last square on the kingside.',
            '5.d3 supports e4 and opens a path for the c1-bishop.',
            '5...O-O: both kings are safe within five moves. In most games, castle early.',
          ],
        },
        {
          kind: 'read',
          title: 'When you cannot castle',
          text:
            'Castling is illegal if:\n' +
            '- the king or that rook has already moved, even if it came back,\n' +
            '- any square between them is occupied,\n' +
            '- the king is in check,\n' +
            '- the king would pass through or land on an attacked square.\n\n' +
            'Only the king\'s path matters: in queenside castling the rook may cross b1 even if it is attacked.',
        },
        {
          kind: 'quiz',
          title: 'Can White castle?',
          text: 'Can White castle kingside here?',
          fen: 'r3k2r/ppp2ppp/8/8/2b5/5N2/PPP2PPP/R3K2R w KQkq - 0 1',
          choices: [
            { text: 'Yes: the squares between king and rook are empty', why: 'Empty is not enough. The king must also cross safe squares.' },
            { text: 'No: the king would pass through f1, which the c4-bishop attacks', correct: true, why: 'The bishop hits f1 through d3 and e2. The king may not cross an attacked square.' },
            { text: 'No: the king is in check', why: 'Nothing attacks e1.' },
            { text: 'No: Black can still castle', why: 'Your castling rights do not depend on your opponent\'s.' },
          ],
        },
        {
          kind: 'move',
          title: 'Castle the legal way',
          text: 'Same position. Your king is stuck in the centre on an open file. Castle on the side where it is legal.',
          fen: 'r3k2r/ppp2ppp/8/8/2b5/5N2/PPP2PPP/R3K2R w KQkq - 0 1',
          solution: ['O-O-O'],
          hint: 'b1, c1 and d1 are empty, and the bishop does not reach c1 or d1.',
          success: 'O-O-O. The king goes to c1 and the rook to d1, straight onto the open file.',
        },
        {
          kind: 'read',
          title: 'En passant',
          text:
            'Black\'s pawn has just jumped from d7 to d5, straight past your e5-pawn. On this move only, you may capture it as if it had moved one square: **exd6**, landing on d6 and removing the d5-pawn.\n\n' +
            'This is **en passant** ("in passing"). If you play something else first, the right is gone.',
          fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
          lastMove: ['d7', 'd5'],
          arrows: [{ from: 'e5', to: 'd6', color: 'green' }],
          marks: [{ square: 'd5', color: 'red' }],
        },
        {
          kind: 'move',
          title: 'Capture in passing',
          text: 'Black has just played ...d7-d5. Use the special capture to win material.',
          fen: '8/ppr1kppp/8/3pP3/8/8/PP3PPP/3R2K1 w - d6 0 1',
          solution: ['exd6+'],
          hint: 'Capture en passant onto d6. What will the pawn attack from there?',
          success: 'exd6+! The pawn checks the king on e7 and attacks the c7-rook, and your d1-rook protects it. After the king moves, dxc7 wins the rook.',
        },
        {
          kind: 'read',
          title: 'Promotion',
          text:
            'A pawn that reaches the last rank must **promote**: it becomes a queen, rook, bishop or knight of your colour. Almost always you choose a queen.\n\n' +
            'Choosing anything else is **underpromotion**. It matters when a knight gives a vital check or fork, or when a new queen would leave your opponent stalemated.',
          fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1',
          arrows: [{ from: 'b7', to: 'b8', color: 'green' }],
        },
        {
          kind: 'move',
          title: 'Promote with mate',
          text: 'White to move. Black threatens ...Qxf2+ and a quick mate. Your pawn is one step from the last rank.',
          fen: '6k1/4Pppp/1q6/8/8/8/r4PPP/6K1 w - - 0 1',
          solution: ['e8=Q#'],
          hint: 'Promote on e8. Can anything of Black\'s block a check along the back rank?',
          success: 'e8=Q#. The new queen checks along the eighth rank and the king is walled in by its own pawns. A rook would also mate here.',
        },
        {
          kind: 'move',
          title: 'Underpromotion',
          text: 'White to move. Black threatens ...Qxh2#, and a new queen on e8 would not stop it. Find the promotion that does.',
          fen: '8/2q1P1kp/6p1/8/6n1/8/5PPP/R6K w - - 0 1',
          solution: ['e8=N+'],
          hint: 'Which piece, landing on e8, would give check and attack c7 at the same time?',
          success: 'e8=N+! The new knight forks king and queen. After the king moves, Nxc7 removes the queen and the mate threat with it.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Castle by moving the king two squares toward the rook; the rook jumps over it.\n' +
            '- You may not castle out of, through or into check, or after the king or that rook has moved.\n' +
            '- En passant is only possible on the move right after the double step.\n' +
            '- Promote to a queen by default. Take a knight when its check or fork wins more.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'found-safety',
      title: 'Hanging Pieces and Counting',
      summary: 'Spot undefended pieces, count attackers against defenders, and capture in the right order.',
      minutes: 10,
      steps: [
        {
          kind: 'read',
          title: 'Hanging pieces',
          text:
            'A piece is **hanging** when it can be taken for free: attacked and not defended. Most beginner games are decided by hanging pieces, not by deep plans.\n\n' +
            'Build a habit. Before every move, ask:\n' +
            '- What does my opponent\'s last move attack?\n' +
            '- Can I capture something for free?\n' +
            '- Does my move leave anything of mine undefended?',
        },
        {
          kind: 'move',
          title: 'Punish the loose knight',
          text: 'Black has just played ...Ng4, eyeing f2. Before you defend, run the checklist: is anything of Black\'s hanging?',
          fen: 'r2q1rk1/ppp2ppp/2np4/2b1p3/2B1P1n1/2NP4/PPP2PPP/R1BQ1RK1 w - - 0 1',
          solution: ['Qxg4'],
          hint: 'Look along the diagonal from your queen on d1.',
          success: 'Qxg4 wins a knight. Nothing defended g4, so Black\'s attack on f2 simply cost a piece.',
        },
        {
          kind: 'read',
          title: 'Counting attackers and defenders',
          text:
            'A defended piece can still be won if you **attack it more times than it is defended**.\n\n' +
            'Count the d5-pawn: two attackers (Nc3 and Bf3) against one defender (Nf6). Each capture removes one piece from each side, and whoever captures last keeps the material. Values matter too: if the defender is cheaper than your attacker, the first capture already costs you.',
          fen: '6k1/pp3ppp/5n2/3p4/8/2N2B2/PP3PPP/6K1 w - - 0 1',
          arrows: [
            { from: 'c3', to: 'd5', color: 'green' },
            { from: 'f3', to: 'd5', color: 'green' },
            { from: 'f6', to: 'd5', color: 'red' },
          ],
        },
        {
          kind: 'demo',
          title: 'Winning the count',
          text: 'Two attackers against one defender: watch White come out a pawn ahead.',
          fen: '6k1/pp3ppp/5n2/3p4/8/2N2B2/PP3PPP/6K1 w - - 0 1',
          moves: ['Nxd5', 'Nxd5', 'Bxd5'],
          notes: [
            '1.Nxd5: the first attacker takes the pawn.',
            '1...Nxd5: the only defender recaptures.',
            '2.Bxd5: the second attacker has the last word. Knight for knight, and White is a pawn up.',
          ],
        },
        {
          kind: 'quiz',
          title: 'Count before you capture',
          text: 'White to move. Count the attackers and defenders of the e5-pawn. Can White win it?',
          fen: '6k1/ppp2ppp/2np4/4p3/8/5N2/PPP1QPPP/6K1 w - - 0 1',
          choices: [
            { text: 'Yes: Nxe5 wins a pawn', why: 'After Nxe5 dxe5 White has given a knight for a pawn.' },
            { text: 'Yes: Qxe5 wins a pawn', why: 'After Qxe5 dxe5 (or ...Nxe5) the queen is gone for a pawn.' },
            { text: 'No: two attackers meet two defenders, and one of them is a pawn', correct: true, why: 'With equal numbers the defender captures last, and the cheap d6-pawn makes the first capture a losing trade.' },
          ],
        },
        {
          kind: 'move',
          title: 'Lowest attacker first',
          text: 'White to move. The d5-knight is attacked three times and defended once, by the e6-pawn. Capture it the right way.',
          fen: '6k1/pp2qppp/4p3/3n4/2P5/6P1/PP3PBP/3Q2K1 w - - 0 1',
          solution: ['cxd5'],
          hint: 'Take with the piece that loses least if it is recaptured.',
          success: 'cxd5 wins a knight for a pawn. Bxd5 exd5 cxd5 would net only a pawn, and Qxd5?? exd5 would drop the queen.',
        },
        {
          kind: 'move',
          title: 'Free or defended?',
          text: 'White to move. Your queen attacks two pawns, b7 and f7. Only one of them is free.',
          fen: '6k1/pp3ppp/8/3Q4/7q/8/PP3PPP/6K1 w - - 0 1',
          solution: ['Qxb7'],
          hint: 'Which of the two pawns does the black king protect?',
          success: 'Qxb7 takes a pawn that nothing defends. Qxf7+?? gives check, but ...Kxf7 wins your queen.',
        },
        {
          kind: 'read',
          title: 'Key takeaways',
          text:
            '- Hanging means attacked and undefended. Check for it every move, for both sides.\n' +
            '- To win a defended piece, attack it more times than it is defended.\n' +
            '- Capture with your least valuable piece first.\n' +
            '- Count values, not just numbers: a pawn defender makes piece captures expensive.\n' +
            '- A check is never a reason to give away material.',
        },
      ],
    },
  ],
};
