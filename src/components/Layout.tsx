import { Link, Outlet, useLocation } from 'react-router-dom'
import { isOfflineReady } from '../lib/storage'
import { useDevMode } from '../hooks/useDevMode'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function Layout() {
  const online = useOnlineStatus()
  const dev = useDevMode()
  // Re-read when the route changes (e.g. after Setup completes)
  useLocation()
  const offlineReady = isOfflineReady()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="font-semibold text-slate-900 no-underline">
            Voice Practice Demo
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                online
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {online ? 'Online' : 'Offline'}
            </span>
            {offlineReady && (
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                Offline-ready
              </span>
            )}
            {dev && (
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                Dev
              </span>
            )}
            <Link
              to="/results"
              className="text-slate-600 underline-offset-2 hover:underline"
            >
              Results
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
