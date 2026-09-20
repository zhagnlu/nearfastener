export default function NotFound() {
  return <main id="main-content" className="flex-1 pt-20">
    <section className="bg-steel-dark py-16"><div className="max-w-max-content mx-auto px-4 lg:px-8">
      <p className="text-accent font-semibold mb-3">404</p>
      <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Page Not Found</h1>
      <p className="text-gray-400">The page you are looking for does not exist.</p>
    </div></section>
    <div className="max-w-max-content mx-auto px-4 lg:px-8 py-16">
      <a className="bg-accent text-white font-semibold px-6 py-3 rounded-card inline-block" href="/">Back to Home</a>
    </div>
  </main>;
}
