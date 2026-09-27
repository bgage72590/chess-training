// The game strip above the board for Pack B games: the buddy (with "Zzz" and a thinking bubble)
// against the kid, or two players in pass-and-play with the current player's avatar pulsing.
// Also the end-of-game card. Shared by battle and capture-crown.
import type { BuddyId } from '../../curriculum/buddies';
import { BUDDIES } from '../../curriculum/buddies';
import type { KidProfile } from '../../store/kidsStore';
import { getKid } from '../../store/kidsStore';
import { BuddyFace } from '../../ui/BuddyFace';
import { PawnBuddy } from '../../ui/PawnBuddy';
import { KidsIcon } from '../../ui/KidsIcon';
import './battle.css';

export interface Seat {
  name: string;
  kid?: KidProfile;
}

/** The two seats of a friend game: the kid plays White, the friend (a profile or a guest) Black. */
export function friendSeats(kid: KidProfile, friendId: string | null): { w: Seat; b: Seat } {
  const f = friendId ? getKid(friendId) : undefined;
  return { w: { name: kid.name || 'Player 1', kid }, b: { name: f?.name || 'Guest', kid: f } };
}

function SeatChip({ seat, active, color }: { seat: Seat; active: boolean; color: 'w' | 'b' }) {
  return (
    <span className={`k-game-seat${active ? ' active' : ''}`}>
      <span className="k-game-avatar">
        {seat.kid ? <PawnBuddy color={seat.kid.avatar.color} face={seat.kid.avatar.face} hat={seat.kid.avatar.hat} size={34} /> : <KidsIcon name="user" size={30} />}
      </span>
      <span className="k-game-name">{seat.name}</span>
      <span className={`k-game-dot ${color}`} aria-hidden="true" />
    </span>
  );
}

export function GameBar(props: { friend: { w: Seat; b: Seat } | null; turn: 'w' | 'b'; buddy: BuddyId; zzz?: number; thinking: boolean; over: boolean; kidColor: 'w' | 'b' }) {
  const { friend, turn, thinking, over } = props;
  if (friend) {
    const who = friend[turn].name;
    return (
      <div className="k-game-bar friend" aria-live="polite">
        <SeatChip seat={friend.w} color="w" active={!over && turn === 'w'} />
        <span className="k-game-turn">{over ? 'Game over' : `${who}'s turn`}</span>
        <SeatChip seat={friend.b} color="b" active={!over && turn === 'b'} />
      </div>
    );
  }
  const b = BUDDIES[props.buddy];
  const mine = turn === props.kidColor;
  return (
    <div className="k-game-bar" aria-live="polite">
      <span className="k-game-seat">
        <BuddyFace id={props.buddy} mood={thinking ? 'thinking' : 'happy'} size={40} zzz={props.zzz ?? 0} />
        <span className="k-game-name">{b.name}</span>
        {thinking && (
          <span className="k-game-think" aria-label={`${b.name} is thinking`}>
            <i />
            <i />
            <i />
          </span>
        )}
      </span>
      <span className={`k-game-turn${mine && !over ? ' mine' : ''}`}>{over ? 'Game over' : mine ? 'Your turn!' : `${b.name}'s turn`}</span>
    </div>
  );
}

export function ResultCard({ outcome, text }: { outcome: 'win' | 'draw' | 'loss'; text: string }) {
  return (
    <div className={`k-game-result ${outcome}`} role="status">
      <KidsIcon name={outcome === 'win' ? 'trophy' : outcome === 'draw' ? 'heart' : 'star'} size={40} fill />
      <span>{text}</span>
    </div>
  );
}
