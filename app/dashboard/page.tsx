'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">XLO</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <Button variant="outline" onClick={signOut}>
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">ダッシュボード</h2>
          <p className="text-gray-600">X (Twitter) 自動化プラットフォーム</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>アカウント管理</CardTitle>
              <CardDescription>Twitter アカウントを管理</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/accounts/main">
                  <Button variant="outline" className="w-full justify-start">
                    メインアカウント
                  </Button>
                </Link>
                <Link href="/accounts/follow">
                  <Button variant="outline" className="w-full justify-start">
                    フォローアカウント
                  </Button>
                </Link>
                <Link href="/accounts/spam">
                  <Button variant="outline" className="w-full justify-start">
                    スパムアカウント
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>投稿管理</CardTitle>
              <CardDescription>投稿の作成と管理</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/posts">
                  <Button variant="outline" className="w-full justify-start">
                    投稿一覧
                  </Button>
                </Link>
                <Link href="/posts/create">
                  <Button className="w-full justify-start">
                    新規投稿
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>エンゲージメント</CardTitle>
              <CardDescription>自動エンゲージメント管理</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/engagement">
                  <Button variant="outline" className="w-full justify-start">
                    エンゲージメント設定
                  </Button>
                </Link>
                <Link href="/loops">
                  <Button variant="outline" className="w-full justify-start">
                    ループ管理
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Twitter Apps</CardTitle>
              <CardDescription>複数のTwitter Appを管理</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/twitter-apps">
                <Button variant="outline" className="w-full justify-start">
                  App管理
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>NordVPN</CardTitle>
              <CardDescription>プロキシとVPN設定</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/nordvpn">
                <Button variant="outline" className="w-full justify-start">
                  NordVPN設定
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>設定</CardTitle>
              <CardDescription>システム設定</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings">
                <Button variant="outline" className="w-full justify-start">
                  設定を開く
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>総アカウント数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>今日の投稿</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>アクティブなループ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>総エンゲージメント</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
