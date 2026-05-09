import { useEffect, useState } from 'react'
import { useAppState } from '../state/AppState'
import type { ClockSync } from '../state/AppState'

/**
 * Center-of-header clock. Format and visibility are user-configurable from the
 * DeskThing settings panel for this app — see `clockFormat` / `clockSeconds`.
 */
export function Clock() {
  const { appConfig, clockSync } = useAppState()
  const [now, setNow] = useState(() => getSyncedClock(clockSync))

  useEffect(() => {
    if (appConfig.clockFormat === 'off') return
    // Tick once per second when seconds are visible, otherwise every 15s is
    // plenty (and saves wakeups on the Car Thing).
    const intervalMs = appConfig.showSeconds ? 1000 : 15000
    const tick = () => setNow(getSyncedClock(clockSync))
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [appConfig.clockFormat, appConfig.showSeconds, clockSync])

  if (appConfig.clockFormat === 'off') return null

  const text = formatClock(now, appConfig.clockFormat, appConfig.showSeconds)

  return (
    <div className="header-clock" aria-label="Current time">
      {text}
    </div>
  )
}

interface ClockParts {
  hours: number
  minutes: number
  seconds: number
}

function getSyncedClock(sync: ClockSync | null): ClockParts {
  if (!sync) {
    const local = new Date()
    return {
      hours: local.getHours(),
      minutes: local.getMinutes(),
      seconds: local.getSeconds()
    }
  }

  const baseMs =
    ((sync.hours * 60 + sync.minutes) * 60 + sync.seconds) * 1000 + sync.milliseconds
  const elapsedMs = Math.max(0, performance.now() - sync.receivedAtMs)
  const dayMs = 24 * 60 * 60 * 1000
  const totalMs = (baseMs + elapsedMs) % dayMs
  const totalSeconds = Math.floor(totalMs / 1000)
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  }
}

function formatClock(clock: ClockParts, format: '12h' | '24h', showSeconds: boolean): string {
  const h24 = clock.hours
  const m = clock.minutes
  const s = clock.seconds
  const mm = m.toString().padStart(2, '0')
  const ss = s.toString().padStart(2, '0')

  if (format === '24h') {
    const hh = h24.toString().padStart(2, '0')
    return showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`
  }

  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = ((h24 + 11) % 12) + 1
  return showSeconds ? `${h12}:${mm}:${ss} ${period}` : `${h12}:${mm} ${period}`
}
