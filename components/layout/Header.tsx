'use client';

import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-gray-950/80">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Mobile Menu Button */}
        <div className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileMenuClick}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Left side - Can add breadcrumbs or page title here */}
        <div className="flex-1 lg:flex-none">
          {/* Reserved for future use */}
        </div>

        {/* Right side - Notifications and User Menu */}
        <div className="flex items-center gap-2">
          <NotificationCenter />

          {/* User Profile Menu - Reserved for future implementation */}
          {/* <UserMenu /> */}
        </div>
      </div>
    </header>
  );
}
