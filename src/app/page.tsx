export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold">Flashcard Frenzy</h1>
        <p className="text-gray-600">Sharpen your knowledge in fast, turn-based matches.</p>
        <a href="/play" className="inline-block w-full px-4 py-3 bg-green-600 text-white rounded">Find Match</a>
        <div className="flex gap-3 justify-center">
          <a href="/auth" className="underline text-sm">Log in / Sign up</a>
        </div>
      </main>
    </div>
  );
}
