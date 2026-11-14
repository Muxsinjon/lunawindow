import { useState } from 'react'
import type { TimeZoneMode } from '../lib/format'
import type { Mode } from '../lib/prefs'
import type { Theme } from '../lib/theme'
import type { Tab } from '../lib/url'
import { Icon } from './ui'

interface Props {
  tab: Tab
  setTab: (t: Tab) => void
  mode: Mode
  setMode: (m: Mode) => void
  tz: TimeZoneMode
  setTz: (t: TimeZoneMode) => void
  theme: Theme
  setTheme: (t: Theme) => void
}

const TAB_LABEL: Record<Tab, string> = {
  site: 'Explore a site',
  compare: 'Compare',
  slip: 'Landing calendar',
  about: 'Data and methods',
}

export function Mark() {
  // Original mark: a horizon line with a low Sun and a crescent Earth. No agency insignia.
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden className="mark">
      <rect width="32" height="32" rx="8" fill="var(--c-raised)" />
      <path d="M3 22 L9 17 L13 20 L19 13 L24 18 L29 15 L29 29 L3 29Z" fill="var(--c-terrain-top)" />
      <circle cx="21.5" cy="10.5" r="3.2" fill="var(--c-sun)" />
      <circle cx="9" cy="9" r="2.6" fill="var(--c-earth)" />
    </svg>
  )
}

export default function Header({ tab, setTab, mode, setMode, tz, setTz, theme, setTheme }: Props) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    window.setTimeout(() => setCopied('idle'), 2200)
  }
  return (
    <header className="topbar">
      <div className="brand">
        <Mark />
        <div>
          <h1>Lunar Landing Site Navigator</h1>
          <p>See when a landing site on the Moon gets sunlight and a direct line to Earth, using the real terrain.</p>
        </div>
      </div>
      <div className="top-controls">
        <div className="seg" role="radiogroup" aria-label="Audience mode">
          {(['planner', 'explore'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? 'on' : ''}
              onClick={() => setMode(m)}
            >
              {m === 'planner' ? 'Planner' : 'Explore'}
            </button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label="Time zone">
          {(['utc', 'local'] as TimeZoneMode[]).map((z) => (
            <button key={z} type="button" role="radio" aria-checked={tz === z} className={tz === z ? 'on' : ''} onClick={() => setTz(z)}>
              {z === 'utc' ? 'UTC' : 'Local time'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn quiet icon-only"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <Icon name="theme" />
        </button>
        <button type="button" className="btn" onClick={copy} aria-live="polite">
          <Icon name={copied === 'ok' ? 'check' : 'link'} />
          {copied === 'ok' ? 'Link copied' : copied === 'fail' ? 'Copy failed: use the address bar' : 'Copy link'}
        </button>
      </div>
      <nav className="tabs" role="tablist" aria-label="Views">
        {(Object.keys(TAB_LABEL) as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-controls="view-panel"
            aria-selected={tab === k}
            className={tab === k ? 'on' : ''}
            onClick={() => setTab(k)}
          >
            {TAB_LABEL[k]}
          </button>
        ))}
      </nav>
    </header>
  )
}
