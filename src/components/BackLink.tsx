import { Link } from 'react-router-dom'

export function BackLink({ to = '/', label = 'Back to options' }: { to?: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-block text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
    >
      ← {label}
    </Link>
  )
}
