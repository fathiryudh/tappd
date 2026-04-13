const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic()

async function parseAvailabilityMessage(rawMessage, todayISO, tomorrowISO) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Parse this officer availability message. Return valid JSON only, no explanation.

Message: "${rawMessage}"
Today: ${todayISO}
Tomorrow: ${tomorrowISO}

Return: {"status":"AVAILABLE"|"UNAVAILABLE"|"MC"|"ON_LEAVE"|"DUTY"|"UNKNOWN","date":"YYYY-MM-DD","notes":"brief"}

Examples:
"MC today" → {"status":"MC","date":"${todayISO}","notes":"medical certificate"}
"available" → {"status":"AVAILABLE","date":"${todayISO}","notes":""}
"on leave" → {"status":"ON_LEAVE","date":"${todayISO}","notes":"on leave"}
"duty tmr" → {"status":"DUTY","date":"${tomorrowISO}","notes":"duty tomorrow"}
"不来" → {"status":"UNAVAILABLE","date":"${todayISO}","notes":"not coming"}
"报到" → {"status":"AVAILABLE","date":"${todayISO}","notes":"reporting"}
"sick" → {"status":"MC","date":"${todayISO}","notes":"sick"}
"off" → {"status":"UNAVAILABLE","date":"${todayISO}","notes":"off today"}`
    }]
  })

  return JSON.parse(msg.content[0].text)
}

module.exports = { parseAvailabilityMessage }
