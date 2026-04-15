import RosterView from '../components/roster/RosterView'

export default function Roster() {
  return (
    <div
      className="min-h-[100dvh]"
      style={{
        background: '#F7F7F9',
        fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        color: '#1D2939',
      }}
    >
      <div className="px-4 py-4 md:px-6 md:py-6">
        <div className="max-w-[1440px] mx-auto">
          <RosterView />
        </div>
      </div>
    </div>
  )
}
