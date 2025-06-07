import Fastify from 'fastify'
import cors from '@fastify/cors'
import fs from 'fs/promises'
import path from 'path'
import { parse } from 'csv-parse/sync'

async function main() {
  const fastify = Fastify()
  await fastify.register(cors)

  let rawData: any[] = []
  let statsData: any[] = []

  async function loadCSVFiles() {
    const rawCsv = await fs.readFile(path.join(__dirname, '../scripts/release_raw.csv'), 'utf-8')
    const statsCsv = await fs.readFile(
      path.join(__dirname, '../scripts/release_stats.csv'),
      'utf-8'
    )

    rawData = parse(rawCsv, { columns: true, skip_empty_lines: true })
    statsData = parse(statsCsv, { columns: true, skip_empty_lines: true })
  }

  await loadCSVFiles()

  fastify.get('/api/raw', async () => rawData)
  fastify.get('/api/stats', async () => statsData)

  fastify.listen({ port: 4000 }, (err, address) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Server listening at ${address}`)
  })
}

main()
