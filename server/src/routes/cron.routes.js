'use strict'

const { Router } = require('express')
const { runMorningNudge, runDigestEmail } = require('../cron/jobs')

const router = Router()

function validateSecret(req, res, next) {
  const secret = req.headers['x-cron-secret']
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  next()
}

router.post('/nudge', validateSecret, async (req, res) => {
  try {
    await runMorningNudge()
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /cron/nudge error:', err)
    res.json({ ok: false, error: err.message })
  }
})

router.post('/digest', validateSecret, async (req, res) => {
  try {
    await runDigestEmail()
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /cron/digest error:', err)
    res.json({ ok: false, error: err.message })
  }
})

// CRON-JOB.ORG SETUP
// Create two jobs at https://cron-job.org (free account)
//
// Job 1 — Morning nudge
//   URL:    POST https://<your-render-url>/api/v1/cron/nudge
//   Header: x-cron-secret: <CRON_SECRET value>
//   Time:   07:30 SGT (= 23:30 UTC previous night, i.e. Sun–Thu UTC)
//   Days:   Mon–Fri SGT (= Sun–Thu UTC)
//
// Job 2 — Digest email
//   URL:    POST https://<your-render-url>/api/v1/cron/digest
//   Header: x-cron-secret: <CRON_SECRET value>
//   Time:   08:30 SGT (= 00:30 UTC)
//   Days:   Mon–Fri only

module.exports = router
