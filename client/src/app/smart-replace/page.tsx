import React from "react";
import Layout from "../../components/Layout";
import { Search, ChevronRight } from "lucide-react";

export default function SmartReplacePage() {
  return (
    <Layout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Smart Replace</h1>
            <p className="mt-1 text-sm text-slate-600">Preview and apply smart find & replace across your entries.</p>
          </header>

          <section className="grid grid-cols-12 gap-6">
            <aside className="col-span-3">
              <div className="bg-white border rounded p-4 sticky top-6">
                <div className="flex items-center gap-2 mb-3">
                  <Search size={16} />
                  <input className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Filter content types" />
                </div>

                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">Blog Post (12)</button>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">Product (34)</button>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">Landing Page (8)</button>
                </div>

                <div className="mt-4 border-t pt-3 text-sm text-slate-500">Select a content type to list entries</div>
              </div>
            </aside>

            <main className="col-span-6">
              <div className="bg-white border rounded p-4">
                <h2 className="text-lg font-medium">Replace Form</h2>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-slate-700">Find</label>
                    <input className="w-full border rounded p-2 mt-1" placeholder="Text to find (regex supported)" />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Replace</label>
                    <input className="w-full border rounded p-2 mt-1" placeholder="Replacement text" />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" />
                      <span>Case sensitive</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" />
                      <span>Regex</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded">Preview</button>
                    <button className="px-4 py-2 border rounded">Suggest</button>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-white border rounded p-4">
                <h3 className="text-sm font-medium">Entries (sample)</h3>
                <ul className="mt-3 divide-y">
                  <li className="py-2 flex justify-between items-center">
                    <div>
                      <div className="font-medium">Home Page</div>
                      <div className="text-xs text-slate-500">en-us · entry_uid_123</div>
                    </div>
                    <button className="text-sm text-indigo-600 flex items-center gap-1">Open <ChevronRight size={14} /></button>
                  </li>
                  <li className="py-2 flex justify-between items-center">
                    <div>
                      <div className="font-medium">Product A</div>
                      <div className="text-xs text-slate-500">en-us · entry_uid_456</div>
                    </div>
                    <button className="text-sm text-indigo-600 flex items-center gap-1">Open <ChevronRight size={14} /></button>
                  </li>
                </ul>
              </div>
            </main>

            <aside className="col-span-3">
              <div className="bg-white border rounded p-4 sticky top-6">
                <h3 className="font-medium">Preview</h3>
                <div className="mt-3 text-sm text-slate-600">Select an entry and click Preview to see suggested changes.</div>

                <div className="mt-4 border rounded p-3 bg-slate-50">
                  <div className="text-xs text-slate-500">Before</div>
                  <div className="mt-2 text-sm">Welcome to Product A version 1.0.0 - contact support@oldcompany.com</div>
                </div>

                <div className="mt-3 border rounded p-3 bg-white">
                  <div className="text-xs text-slate-500">After</div>
                  <div className="mt-2 text-sm">Welcome to Product A version 1.1.0 - contact support@newcompany.com</div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded">Apply</button>
                  <button className="px-3 py-2 border rounded">Queue</button>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </Layout>
  );
}
