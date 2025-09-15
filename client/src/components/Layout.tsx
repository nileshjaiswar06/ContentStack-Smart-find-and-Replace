import React, { ReactNode } from "react";
import { Menu, LogOut } from "lucide-react";

type Props = { children: ReactNode };

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="flex h-screen">
        <aside className="w-64 bg-white border-r p-4">
          <div className="flex items-center space-x-2 mb-6">
            <div className="h-8 w-8 bg-indigo-600 rounded" />
            <div>
              <div className="font-semibold">Smart Replace</div>
              <div className="text-xs text-slate-500">Content tools</div>
            </div>
          </div>

          <nav className="space-y-2">
            <a className="block px-3 py-2 rounded hover:bg-slate-100">Dashboard</a>
            <a className="block px-3 py-2 rounded hover:bg-slate-100">Entries</a>
            <a className="block px-3 py-2 rounded hover:bg-slate-100">Jobs</a>
            <a className="block px-3 py-2 rounded hover:bg-slate-100">Settings</a>
          </nav>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="h-14 bg-white border-b flex items-center px-4 justify-between">
            <div className="flex items-center space-x-3">
              <button className="p-2 rounded hover:bg-slate-100">
                <Menu size={18} />
              </button>
              <div className="text-lg font-semibold">Smart Replace</div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-sm text-slate-600">Signed in</div>
              <button className="p-2 rounded hover:bg-slate-100"><LogOut size={16} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
