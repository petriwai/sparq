export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-4">
        <a href="/" className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">←</a>
        <h1 className="text-lg font-semibold text-white">Privacy Policy</h1>
      </header>

      <div className="p-4 text-slate-300 space-y-6">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">Inoka Privacy Policy</h2>
          <p className="text-slate-400 text-sm mb-4">Last updated: December 2025</p>
          <p>This policy describes how Inoka collects, uses, and protects your personal information.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">1. Information We Collect</h2>
          
          <h3 className="font-semibold text-amber-400 mt-3 mb-2">Account Information</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Name and email address</li>
            <li>Phone number</li>
            <li>Payment information</li>
            <li>Profile photo (optional)</li>
          </ul>
          
          <h3 className="font-semibold text-amber-400 mt-3 mb-2">Location Data</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Pickup and dropoff locations</li>
            <li>Real-time GPS location during rides</li>
            <li>Saved places you create</li>
          </ul>
          
          <h3 className="font-semibold text-amber-400 mt-3 mb-2">Ride Information</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Ride history and routes</li>
            <li>Payment transactions</li>
            <li>Ratings and feedback</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To provide rideshare services</li>
            <li>To process payments</li>
            <li>To improve our services</li>
            <li>To communicate with you</li>
            <li>To ensure safety and security</li>
            <li>To comply with legal requirements</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">3. Information Sharing</h2>
          <p className="mb-3">We share information with:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Drivers:</strong> Your name, pickup location, and rating</li>
            <li><strong>Payment processors:</strong> To process transactions</li>
            <li><strong>Law enforcement:</strong> When legally required</li>
            <li><strong>Insurance providers:</strong> For claims processing</li>
          </ul>
          <p className="mt-3 text-sm">We do not sell your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">4. Data Security</h2>
          <p>We use industry-standard security measures to protect your data, including encryption, secure servers, and access controls.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">5. Your Rights</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account</li>
            <li>Opt out of marketing communications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">6. Data Retention</h2>
          <p>We retain your data for as long as your account is active or as needed to provide services. Ride history is kept for 7 years for legal and tax purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">7. Children's Privacy</h2>
          <p>Inoka is not intended for users under 18 years old. We do not knowingly collect data from children.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">8. Changes to This Policy</h2>
          <p>We may update this policy periodically. We will notify you of significant changes via email or app notification.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">9. Contact Us</h2>
          <p>For privacy questions or data requests:</p>
          <p className="text-amber-400 mt-2">privacy@inoka.online</p>
        </section>

        <section className="pt-6 border-t border-slate-800">
          <p className="text-slate-500 text-sm">Inoka is operated by Petri Wai, LLC</p>
          <p className="text-slate-500 text-sm">Springfield, Illinois</p>
        </section>
      </div>
    </div>
  )
}
