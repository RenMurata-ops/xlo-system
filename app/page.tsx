import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          XLO
        </h1>
        <p className="text-xl text-muted-foreground max-w-md">
          X (Twitter) Automation & Engagement Platform
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/login">
            <Button size="lg">ログイン</Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              ダッシュボード
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
