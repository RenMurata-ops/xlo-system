'use client';

import Sidebar from './Sidebar';
import MobileMenu from './MobileMenu';
import Header from './Header';

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
        {/* Header with Notifications */}
        <Header />

        {/* Content Area */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
