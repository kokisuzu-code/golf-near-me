import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromRequest, isPremiumUser } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Course {
  id: string
  name: string
  weekday: number
  weekend: number
  holes: number
  km: number
  driveH: number
  toll: number
  tags: string[]
  rating: number
  totalWeekend: number
}

interface Preferences {
  budget?: 'cheap' | 'mid' | 'prem'
  maxDriveH?: number
  groupSize?: number
  playStyle?: 'casual' | 'serious' | 'beginner'
}

export async function POST(req: NextRequest) {
  // 認証チェック
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // プレミアム会員チェック
  const premium = await isPremiumUser(user.id)
  if (!premium) {
    return NextResponse.json({ error: 'PREMIUM_REQUIRED' }, { status: 403 })
  }

  const { courses, preferences = {}, question } = await req.json() as {
    courses: Course[]
    preferences: Preferences
    question?: string
  }

  if (!courses || courses.length === 0) {
    return NextResponse.json({ error: 'COURSES_REQUIRED' }, { status: 400 })
  }

  // コース情報を整形してプロンプトに渡す
  const courseList = courses.map((c, i) =>
    `[${i + 1}] ${c.name}
  - 住所: 距離${c.km.toFixed(1)}km / ドライブ約${Math.round(c.driveH * 60)}分
  - 料金: 土日¥${c.weekend.toLocaleString()} / 平日¥${c.weekday.toLocaleString()}
  - 高速代(往復): ¥${c.toll.toLocaleString()} / 土日トータル: ¥${c.totalWeekend.toLocaleString()}
  - ホール数: ${c.holes}H / 評価: ${c.rating}
  - タグ: ${c.tags.join(', ') || 'なし'}
  - コースID: ${c.id}`
  ).join('\n\n')

  const prefText = [
    preferences.budget      && `予算感: ${{ cheap: '〜¥10,000', mid: '¥10,000〜¥15,000', prem: '¥15,000〜' }[preferences.budget]}`,
    preferences.maxDriveH  && `移動時間: ${preferences.maxDriveH}時間以内`,
    preferences.groupSize  && `グループ人数: ${preferences.groupSize}人`,
    preferences.playStyle  && `プレースタイル: ${{ casual: 'カジュアル', serious: '本格派', beginner: '初心者' }[preferences.playStyle]}`,
  ].filter(Boolean).join(' / ') || '特になし'

  const userQuestion = question || `上記のコースの中で一番おすすめはどれですか？理由も教えてください。`

  const prompt = `以下のゴルフコースリストを参考に、ユーザーの質問に答えてください。

【ユーザーの希望】
${prefText}

【コース一覧】
${courseList}

【質問】
${userQuestion}

必ず以下のJSON形式のみで回答してください。余分なテキスト・マークダウンは一切不要です。
{
  "recommendation": "おすすめの説明（150字以内・Gen Zに刺さるカジュアルな日本語）",
  "ranked": [
    { "id": "コースID", "rank": 1, "reason": "このコースを選んだ理由（50字以内）", "score": 85 }
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: 'あなたは日本のGen Z向けゴルフアドバイザーです。コースを比較・提案する際は、距離・料金・高速代のトータルコストを重視し、カジュアルで情報量の多い日本語で答えます。回答はJSONのみで返してください。',
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')

    // JSONパース（```json フェンスがあれば除去）
    const clean = rawText.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[ai/recommend]', err)
    return NextResponse.json({ error: 'AI_ERROR' }, { status: 500 })
  }
}
