import axios from 'axios'
import * as path from 'path'
import { createObjectCsvWriter } from 'csv-writer'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

// 1. 조회할 레포 리스트
const repos = [
  { name: 'stackflow', url: 'https://api.github.com/repos/daangn/stackflow/releases' },
  { name: 'seed-design', url: 'https://api.github.com/repos/daangn/seed-design/releases' }
]

// 2. 릴리즈 기본 타입 정의 (raw 데이터용)
interface ReleaseRaw {
  repo: string // 레포지토리 이름
  tag_name: string // 태그명
  name: string // 릴리즈명
  author: string // 작성자 로그인명
  published_at: string // 배포일시 ISO
  draft: boolean // 드래프트 여부
  prerelease: boolean // 프리릴리즈 여부
}

// 3. 통계 데이터 타입 정의
interface StatRow {
  repo: string
  period: 'yearly' | 'monthly' | 'weekly' | 'daily'
  year: number
  month?: number
  week?: number
  day?: string
  count: number
}

// 4. GitHub API 호출해서 릴리즈 raw 데이터 가져오기
async function fetchReleases(): Promise<ReleaseRaw[]> {
  const allReleases: ReleaseRaw[] = []

  for (const repo of repos) {
    const res = await axios.get(repo.url)
    for (const release of res.data) {
      allReleases.push({
        repo: repo.name,
        tag_name: release.tag_name,
        name: release.name || '',
        author: release.author?.login || 'unknown',
        published_at: release.published_at,
        draft: release.draft,
        prerelease: release.prerelease
      })
    }
  }
  return allReleases
}

// 5. 주말(토,일) 제외 함수
function isWeekday(date: dayjs.Dayjs) {
  const day = date.day()
  return day !== 0 && day !== 6
}

// 6. 릴리즈 raw 데이터를 기반으로 통계 데이터 생성 (주말 제외)
function buildStats(releases: ReleaseRaw[]): StatRow[] {
  // 주말 제외
  const weekdays = releases.filter(r => isWeekday(dayjs(r.published_at)))

  const yearlyMap = new Map<string, number>()
  const monthlyMap = new Map<string, number>()
  const weeklyMap = new Map<string, number>()
  const dailyMap = new Map<string, number>()

  for (const r of weekdays) {
    const date = dayjs(r.published_at)
    const repo = r.repo
    const year = date.year()
    const month = date.month() + 1
    const week = date.isoWeek()
    const day = date.format('YYYY-MM-DD')

    // 연간 집계
    const yKey = `${repo}_${year}`
    yearlyMap.set(yKey, (yearlyMap.get(yKey) ?? 0) + 1)

    // 월간 집계
    const mKey = `${repo}_${year}_${month}`
    monthlyMap.set(mKey, (monthlyMap.get(mKey) ?? 0) + 1)

    // 주간 집계
    const wKey = `${repo}_${year}_${week}`
    weeklyMap.set(wKey, (weeklyMap.get(wKey) ?? 0) + 1)

    // 일간 집계
    const dKey = `${repo}_${day}`
    dailyMap.set(dKey, (dailyMap.get(dKey) ?? 0) + 1)
  }

  // Map -> 배열 변환
  const yearlyStats: StatRow[] = []
  yearlyMap.forEach((count, key) => {
    const [repo, yearStr] = key.split('_')
    yearlyStats.push({
      repo,
      period: 'yearly',
      year: Number(yearStr),
      count
    })
  })

  const monthlyStats: StatRow[] = []
  monthlyMap.forEach((count, key) => {
    const [repo, yearStr, monthStr] = key.split('_')
    monthlyStats.push({
      repo,
      period: 'monthly',
      year: Number(yearStr),
      month: Number(monthStr),
      count
    })
  })

  const weeklyStats: StatRow[] = []
  weeklyMap.forEach((count, key) => {
    const [repo, yearStr, weekStr] = key.split('_')
    weeklyStats.push({
      repo,
      period: 'weekly',
      year: Number(yearStr),
      week: Number(weekStr),
      count
    })
  })

  const dailyStats: StatRow[] = []
  dailyMap.forEach((count, key) => {
    const [repo, day] = key.split('_')
    dailyStats.push({
      repo,
      period: 'daily',
      year: Number(day.slice(0, 4)),
      day,
      count
    })
  })

  return [...yearlyStats, ...monthlyStats, ...weeklyStats, ...dailyStats]
}

// 7. raw 데이터 CSV 저장
async function writeRawCSV(rawData: ReleaseRaw[]) {
  const csvWriter = createObjectCsvWriter({
    path: path.join(__dirname, 'release_raw.csv'),
    header: [
      { id: 'repo', title: '레포지토리' },
      { id: 'tag_name', title: '태그명' },
      { id: 'name', title: '릴리즈명' },
      { id: 'author', title: '작성자' },
      { id: 'published_at', title: '배포일시' },
      { id: 'draft', title: '드래프트' },
      { id: 'prerelease', title: '프리릴리즈' }
    ]
  })

  await csvWriter.writeRecords(rawData)
}

// 8. 통계 데이터 CSV 저장
async function writeStatsCSV(stats: StatRow[]) {
  const csvWriter = createObjectCsvWriter({
    path: path.join(__dirname, 'release_stats.csv'),
    header: [
      { id: 'repo', title: '레포지토리' },
      { id: 'period', title: '기간' },
      { id: 'year', title: '연도' },
      { id: 'month', title: '월' },
      { id: 'week', title: '주차' },
      { id: 'day', title: '일자' },
      { id: 'count', title: '배포수' }
    ]
  })

  await csvWriter.writeRecords(stats)
}

// 9. 실행 함수: 모든 단계 연결
;(async () => {
  try {
    // 릴리즈 raw 데이터 가져오기
    const releases = await fetchReleases()

    // raw 데이터 CSV 저장
    await writeRawCSV(releases)

    // 통계 데이터 생성 (주말 제외)
    const stats = buildStats(releases)

    // 통계 CSV 저장
    await writeStatsCSV(stats)

    console.log('📄 release_raw.csv 및 release_stats.csv 파일이 생성되었습니다!')
  } catch (error) {
    console.error('에러 발생:', error)
  }
})()
