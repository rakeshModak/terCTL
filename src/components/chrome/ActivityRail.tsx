import { useNavigate, useRouterState } from '@tanstack/react-router'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { to: '/hosts', label: 'Hosts', icon: 'M3 5h18v4H3zM3 15h18v4H3z' },
  { to: '/sessions', label: 'Terminal', icon: 'M4 17l6-5-6-5M13 18h7' },
  {
    to: '/transfer',
    label: 'Transfer',
    icon: 'M8 3v13M8 3l-3.5 3.5M8 3l3.5 3.5M16 21V8M16 21l3.5-3.5M16 21l-3.5-3.5',
  },
  { to: '/keys', label: 'Keys', icon: 'M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z' },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v2.6M12 19.4V22M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2 12h2.6M19.4 12H22M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9',
  },
]

export function ActivityRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  return (
    <div
      style={{
        width: 60,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: 6,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
      }}
    >
      {NAV.map((item) => {
        const active = pathname === item.to
        return (
          <button
            key={item.to}
            onClick={() => navigate({ to: item.to })}
            title={item.label}
            style={{
              position: 'relative',
              width: 42,
              height: 42,
              border: 'none',
              borderRadius: 11,
              background: active ? 'var(--brand-soft-2)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: -9,
                top: 11,
                width: 3,
                height: 20,
                borderRadius: 3,
                background: active ? 'var(--brand)' : 'transparent',
              }}
            />
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke={active ? 'var(--brand)' : 'var(--text-muted)'}
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
