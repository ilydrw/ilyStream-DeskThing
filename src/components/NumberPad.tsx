import React from 'react'

interface NumberPadProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  maxLength?: number
}

export function NumberPad({ value, onChange, onClose, maxLength = 6 }: NumberPadProps) {
  const handlePress = (num: string) => {
    if (value.length < maxLength) {
      onChange(value + num)
    }
  }

  const handleBackspace = () => {
    onChange(value.slice(0, -1))
  }

  return (
    <div className="number-pad-overlay">
      <div className="number-pad">
        <div className="number-pad-header">
          <div className="display">
            {value.split('').map((char, i) => (
              <span key={i} className="digit">{char}</span>
            ))}
            {Array.from({ length: maxLength - value.length }).map((_, i) => (
              <span key={i + value.length} className="digit placeholder">·</span>
            ))}
          </div>
          <button className="done-btn" onClick={onClose}>Done</button>
        </div>
        <div className="number-pad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => (
            <button
              key={i}
              className={`pad-key ${key === '' ? 'empty' : ''} ${key === '⌫' ? 'backspace' : ''}`}
              onClick={() => {
                if (key === '⌫') handleBackspace()
                else if (key !== '') handlePress(key)
              }}
              disabled={key === ''}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
