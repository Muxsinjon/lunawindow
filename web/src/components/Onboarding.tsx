import { useEffect, useRef, useState } from 'react'
import { storageGet, storageSet } from '../lib/prefs'
import { Icon } from './ui'

const KEY = 'llsn.onboarded'

/** First-visit hint: three short steps, dismissible, remembered in localStorage (if available). */
export default function Onboarding() {
  const [open, setOpen] = useState(() => storageGet(KEY) !== '1')
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) btn.current?.focus({ preventScroll: true })
  }, [open])
  if (!open) return null
  const close = () => {
    storageSet(KEY, '1')
    setOpen(false)
  }
  return (
    <aside className="onboard" role="dialog" aria-modal="false" aria-labelledby="onboard-title" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <h2 id="onboard-title">Three things to try</h2>
      <ol>
        <li>
          Look at the big view. The Sun is above a flat horizon, but a ridge is about to hide it. That is the problem this tool solves.
        </li>
        <li>
          Drag the time slider, or press <kbd>←</kbd> <kbd>→</kbd> (hold <kbd>Shift</kbd> to jump a day; <kbd>Space</kbd> plays).
        </li>
        <li>Click anywhere on the south pole map, or open the landing calendar to see which dates work.</li>
      </ol>
      <button ref={btn} type="button" className="btn primary" onClick={close}>
        <Icon name="check" /> Got it
      </button>
    </aside>
  )
}
