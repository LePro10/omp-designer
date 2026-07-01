import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <strong>Northline</strong>
        <nav className="flex gap-6 text-sm text-slate-600">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="mb-4 text-sm uppercase tracking-wide text-slate-500">Workflow software</p>
        <h1 className="max-w-3xl text-6xl font-bold tracking-tight">Organize field teams without losing the thread.</h1>
        <p className="mt-6 max-w-2xl text-xl text-slate-600">Northline keeps dispatch notes, site photos, and follow-up tasks in one shared place.</p>
        <button className="mt-8 rounded-full bg-slate-950 px-6 py-3 text-white">Request a walkthrough</button>
      </section>
      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-6 py-16 md:grid-cols-3">
        <article className="rounded-3xl bg-slate-100 p-6"><h2>Dispatch board</h2><p>See who is assigned and what changed.</p></article>
        <article className="rounded-3xl bg-slate-100 p-6"><h2>Site notes</h2><p>Collect photos and decisions from the field.</p></article>
        <article className="rounded-3xl bg-slate-100 p-6"><h2>Follow-up</h2><p>Turn open questions into tracked tasks.</p></article>
      </section>
    </main>
  );
}
