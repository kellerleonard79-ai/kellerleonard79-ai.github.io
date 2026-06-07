import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Join from './pages/Join.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join" element={<Join />} />
    </Routes>
  )
}
