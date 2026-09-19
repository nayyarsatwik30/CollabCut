require('dotenv').config({ path: '.env.local', quiet: true })
const crypto = require('crypto')

const uploadId = process.argv[2]
if (!uploadId) {
  console.error('usage: node scripts/test-webhook.js <mux_upload_id>')
  process.exit(1)
}

const secret = process.env.MUX_WEBHOOK_SECRET
if (!secret) {
  console.error('MUX_WEBHOOK_SECRET not found in .env.local')
  process.exit(1)
}

const body = JSON.stringify({
  type: 'video.asset.ready',
  id: 'evt_test_' + Date.now(),
  created_at: new Date().toISOString(),
  environment: { id: 'test', name: 'test' },
  object: { type: 'asset', id: 'mux_asset_test_id' },
  attempts: [],
  data: {
    id: 'mux_asset_test_id',
    upload_id: uploadId,
    duration: 12.5,
    playback_ids: [{ id: 'mux_playback_test_id', policy: 'public' }],
  },
})

const timestamp = Math.floor(Date.now() / 1000)
const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

fetch('http://localhost:3000/api/auth-migration/webhooks/mux', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'mux-signature': `t=${timestamp},v1=${signature}`,
  },
  body,
}).then(async (res) => {
  console.log('status:', res.status)
  console.log('body:', await res.text())
})
