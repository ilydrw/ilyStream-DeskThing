import { useAppState } from './state/AppState'
import { SetupScreen } from './screens/SetupScreen'
import { GridScreen } from './screens/GridScreen'

export default function App() {
  const { status, notice } = useAppState()
  const showSetup = status.status === 'unconfigured' || (status.status === 'error' && !status.lastFetchAt)

  return (
    <div className="app-shell">
      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
      {showSetup ? <SetupScreen /> : <GridScreen />}
    </div>
  )
}
