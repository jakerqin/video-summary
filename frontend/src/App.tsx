import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Video Insight
        </h1>
        <p className="text-gray-600 mb-4">
          AI-powered video to markdown converter
        </p>
        <button
          onClick={() => setCount((count) => count + 1)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Count: {count}
        </button>
      </div>
    </div>
  )
}

export default App
