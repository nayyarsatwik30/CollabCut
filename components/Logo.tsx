import { COLORS } from '../lib/constants';

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.amber }} />
      <span className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
       COLLABCUT
      </span>
    </div>
  );
}
