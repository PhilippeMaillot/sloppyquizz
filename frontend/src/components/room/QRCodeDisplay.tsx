import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type QRCodeDisplayProps = {
  roomCode: string
  joinUrl: string
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

export function QRCodeDisplay({ roomCode, joinUrl }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const joinUrlPretty = useMemo(() => joinUrl.replace(/^https?:\/\//, ''), [joinUrl])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 1200)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleCopyLink() {
    await copyToClipboard(joinUrl)
    setCopied('link')
  }

  async function handleCopyCode() {
    await copyToClipboard(roomCode)
    setCopied('code')
  }

  return (
    <Card tone="brand">
      <div className="room-invite-grid">
        <div className="room-invite-code">
          <p className="eyebrow">Code</p>
          <div className="room-code-big">{roomCode}</div>
          <Button onClick={handleCopyCode} type="button" variant="secondary" size="lg">
            {copied === 'code' ? 'Code copié' : 'Copier le code'}
          </Button>
        </div>

        <div className="room-invite-qr">
          <div className="room-qr-frame">
            <QRCodeSVG value={joinUrl} size={156} />
          </div>
          <a className="text-link" href={joinUrl} target="_blank" rel="noreferrer">
            {joinUrlPretty}
          </a>
          <Button onClick={handleCopyLink} type="button" variant="primary" size="lg">
            {copied === 'link' ? 'Lien copié' : 'Copier le lien'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

