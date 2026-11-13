import { useEffect, useState } from 'react'
import { allEngines } from '../engines'
import { loadPreferredEngine, setPreferredEngine } from '../lib/storage'

export function DevEnginePanel({
  listenMs,
  processMs,
  engineId,
}: {
  listenMs?: number
  processMs?: number
  engineId?: string
}) {
  const engines = allEngines()
  const [selected, setSelected] = useState(
    () => loadPreferredEngine() ?? engines[0]?.id ?? '',
  )

  useEffect(() => {
    if (selected) setPreferredEngine(selected)
  }, [selected])

  return (
    <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-950">
      <p className="m-0 font-semibold">Developer panel</p>
      <label className="mt-2 flex items-center gap-2">
        Engine
        <select
          className="rounded border border-violet-300 bg-white px-2 py-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {engines.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 mb-0">
        Last: engine={engineId ?? '—'} · listen={listenMs ?? '—'}ms · process=
        {processMs ?? '—'}ms
      </p>
    </div>
  )
}
