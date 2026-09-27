'use client'

import { useState } from 'react'

export function CopyEmailButton({ email, targetId }: { email: string; targetId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email)
    } catch {
      const el = document.getElementById(targetId)
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button type="button" className="cc-button primary" onClick={handleCopy}>
      {copied ? 'Copied' : 'Copy email'}
    </button>
  )
}
