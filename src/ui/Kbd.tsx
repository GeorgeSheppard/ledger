import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { formatKeys } from '../lib/shortcuts/keys';
import { useIsMac } from '../state/shortcuts';
import './Kbd.css';

/** Renders a shortcut's keys, e.g. `⌘ ↵` or `G then D`. */
export function Kbd({ shortcut }: { shortcut: ShortcutId }) {
  const isMac = useIsMac();
  const chords = formatKeys(getBinding(shortcut).keys, isMac);
  return (
    <span className="kbd" aria-hidden="true">
      {chords.map((chord, i) => (
        <span key={i} className="kbd__chord">
          {i > 0 && <span className="kbd__then">then</span>}
          {chord.map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </span>
      ))}
    </span>
  );
}
