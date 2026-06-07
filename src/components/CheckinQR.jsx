import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download } from 'lucide-react'

// Renders the check-in QR with the URL and a Download-PNG button. Any extra
// buttons (e.g. "Full session view", "Reopen session") render beside Download.
export default function CheckinQR({ url, size = 200, downloadName = 'checkin-qr.png', children }) {
  const wrapRef = useRef(null)

  function download() {
    const canvas = wrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.download = downloadName
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  return (
    <div className="flex flex-col items-center">
      <div ref={wrapRef} className="rounded-xl bg-white p-3">
        <QRCodeCanvas value={url} size={size} fgColor="#111827" level="M" />
      </div>
      <p className="mt-4 break-all text-center text-xs text-gray-400">{url}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Download QR
        </button>
        {children}
      </div>
    </div>
  )
}
