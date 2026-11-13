import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Listen } from './pages/Listen'
import { MockInterview } from './pages/MockInterview'
import { Results } from './pages/Results'
import { Setup } from './pages/Setup'
import { SpeakSelfCheck } from './pages/SpeakSelfCheck'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="setup" element={<Setup />} />
          <Route path="listen" element={<Listen />} />
          <Route path="speak" element={<SpeakSelfCheck />} />
          <Route path="mock" element={<MockInterview />} />
          <Route path="results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
