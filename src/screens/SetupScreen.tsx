import { useState } from 'react'
import { useAppState } from '../state/AppState'
import { NumberPad } from '../components/NumberPad'

export function SetupScreen() {
  const { status, pair } = useAppState()
  const [host, setHost] = useState(status.host || '192.168.1.100:8899')
  const [code, setCode] = useState('')
  const [showPad, setShowPad] = useState(false)

  const canSubmit = host.trim().length > 0 && code.trim().length === 6
  const isConnecting = status.status === 'connecting'

  const handleSubmit = () => {
    if (!canSubmit) return
    pair(host, code)
  }

  return (
    <div className="setup">
      <h1>Pair with ilyStream</h1>
      <p>
        Easiest way: open <strong>DeskThing → Settings → ilyStream</strong> on your PC and run the
        "Pair with ilyStream" task. Or pair right here: enter your PC's LAN address and the
        6-digit code from <strong>ilyStream → Connections → DeskThing</strong>.
      </p>

      <div className="form">
        <input
          type="text"
          inputMode="url"
          placeholder="LAN host (e.g. 192.168.1.100:8899)"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <input
          type="text"
          placeholder="6-digit pair code"
          value={code}
          readOnly
          onClick={() => setShowPad(true)}
          style={{ cursor: 'pointer' }}
        />
        <button onClick={handleSubmit} disabled={!canSubmit || isConnecting}>
          {isConnecting ? 'Connecting…' : 'Pair'}
        </button>
      </div>

      {status.status === 'error' && status.errorMessage && (
        <p style={{ color: 'var(--danger)' }}>{status.errorMessage}</p>
      )}

      {showPad && (
        <NumberPad
          value={code}
          onChange={setCode}
          onClose={() => setShowPad(false)}
        />
      )}
    </div>
  )
}
