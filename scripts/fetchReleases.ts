import axios from 'axios'
import * as path from 'path'
import { createObjectCsvWriter } from 'csv-writer'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

// 조회할 레포 리스트
const repos = [
  { name: 'stackflow', url: 'https://api.github.com/repos/daangn/stackflow/releases' },
  { name: 'seed-design', url: 'https://api.github.com/repos/daangn/seed-design/releases' }
]

interface ReleaseInfo {
  repo: string
  published_at: string
}

interface StatRow {
  repo: string
  level: 'yearly' | 'weekly' | 'daily' // 통계 단위 구분
  year: number
  month?: number
  week?: number
  day?: string
  count: number
}

// GitHub API 호출해서 릴리즈 데이터 가져오기
async function fetchReleases(): Promise<ReleaseInfo[]> {
  const allReleases: ReleaseInfo[] = []

  for (const repo of repos) {
    const res = await axios.get(repo.url)
    const releases = res.data

    for (const release of releases) {
      allReleases.push({
        repo: repo.name,
        published_at: release.published_at
      })
    }
  }

  return allReleases
}

// 릴리즈 데이터로부터 연간, 주간, 일간 배포 수 집계
function buildStats(releases: ReleaseInfo[]): StatRow[] {
  const yearlyMap = new Map<string, StatRow>()
  const weeklyMap = new Map<string, StatRow>()
  const dailyMap = new Map<string, StatRow>()

  for (const release of releases) {
    const date = dayjs(release.published_at)

    // 연간 키 및 집계
    const yearlyKey = `${release.repo}-${date.year()}`
    if (!yearlyMap.has(yearlyKey)) {
      yearlyMap.set(yearlyKey, {
        repo: release.repo,
        level: 'yearly',
        year: date.year(),
        count: 1
      })
    } else {
      yearlyMap.get(yearlyKey)!.count++
    }

    // 주간 키 및 집계
    const weeklyKey = `${release.repo}-${date.year()}-${date.isoWeek()}`
    if (!weeklyMap.has(weeklyKey)) {
      weeklyMap.set(weeklyKey, {
        repo: release.repo,
        level: 'weekly',
        year: date.year(),
        week: date.isoWeek(),
        count: 1
      })
    } else {
      weeklyMap.get(weeklyKey)!.count++
    }

    // 일간 키 및 집계
    const dayStr = date.format('YYYY-MM-DD')
    const dailyKey = `${release.repo}-${dayStr}`
    if (!dailyMap.has(dailyKey)) {
      dailyMap.set(dailyKey, {
        repo: release.repo,
        level: 'daily',
        year: date.year(),
        month: date.month() + 1,
        week: date.isoWeek(),
        day: dayStr,
        count: 1
      })
    } else {
      dailyMap.get(dailyKey)!.count++
    }
  }

  return [...yearlyMap.values(), ...weeklyMap.values(), ...dailyMap.values()]
}

// CSV 파일로 저장
async function writeCSV(stats: StatRow[]) {
  const csvWriter = createObjectCsvWriter({
    path: path.join(__dirname, 'release_stats.csv'),
    header: [
      { id: 'repo', title: '레포지토리' },
      { id: 'level', title: '통계단위' },
      { id: 'year', title: '연도' },
      { id: 'month', title: '월' },
      { id: 'week', title: '주차' },
      { id: 'day', title: '날짜' },
      { id: 'count', title: '배포수' }
    ]
  })

  await csvWriter.writeRecords(stats)
}

;(async () => {
  try {
    const releases = await fetchReleases()
    const stats = buildStats(releases)
    await writeCSV(stats)
    console.log('📄 CSV 파일이 생성되었습니다!')
  } catch (error) {
    console.error('에러 발생:', error)
  }
})()
