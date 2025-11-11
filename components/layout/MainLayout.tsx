'use client';

import Sidebar from './Sidebar';
import MobileMenu from './MobileMenu';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Menu */}
      <MobileMenu />

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile Header Spacer */}
        <div className="lg:hidden h-16" />

        {/* Content Area */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
