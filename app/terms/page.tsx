export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-4">
        <a href="/" className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">←</a>
        <h1 className="text-lg font-semibold text-white">Terms of Service</h1>
      </header>

      <div className="p-4 text-slate-300 space-y-6">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">Inoka Terms of Service</h2>
          <p className="text-slate-400 text-sm mb-4">Last updated: December 2024</p>
          <p>Welcome to Inoka. By using our rideshare service, you agree to these terms.</p>
        </section>

        <section className="bg-red-900/20 border border-red-800 rounded-xl p-4">
          <h2 className="text-xl font-bold text-red-400 mb-3">⚠️ Zero-Tolerance Drug and Alcohol Policy</h2>
          <p className="mb-3">In accordance with <strong>Illinois Transportation Network Company Act (625 ILCS 57/10)</strong>, Inoka maintains a strict zero-tolerance policy regarding drug and alcohol use.</p>
          
          <h3 className="font-semibold text-white mt-4 mb-2">Driver Requirements:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Drivers must NOT be under the influence of drugs or alcohol while logged into the Inoka driver platform</li>
            <li>Drivers must NOT use drugs or alcohol while providing rides</li>
            <li>Drivers must NOT have any drugs or open alcohol containers in the vehicle</li>
          </ul>
          
          <h3 className="font-semibold text-white mt-4 mb-2">Consequences:</h3>
          <p className="text-sm">Any violation of this policy will result in <strong>immediate and permanent deactivation</strong> from the Inoka platform.</p>
          
          <h3 className="font-semibold text-white mt-4 mb-2">Reporting Violations:</h3>
          <p className="text-sm">If you suspect a driver is under the influence, immediately:</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Request to end the ride safely</li>
            <li>Call 911 if you feel unsafe</li>
            <li>Report to Inoka through the app or email: safety@inoka.online</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">1. Service Description</h2>
          <p>Inoka provides a technology platform connecting riders with independent driver partners in Springfield, Illinois.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">2. User Requirements</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Must be at least 18 years old</li>
            <li>Must provide accurate account information</li>
            <li>Must maintain a valid payment method</li>
            <li>Must treat drivers with respect</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">3. Driver Requirements</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Must be at least 21 years old</li>
            <li>Must have a valid Illinois driver's license</li>
            <li>Must pass a background check</li>
            <li>Must maintain valid auto insurance</li>
            <li>Must comply with the Zero-Tolerance Policy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">4. Fares and Payment</h2>
          <p>Fares are calculated based on distance and time. Payment is processed automatically through your saved payment method.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">5. Cancellations</h2>
          <p>Cancellation fees may apply if you cancel after a driver has been dispatched.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">6. Safety</h2>
          <p>Your safety is our priority. All drivers undergo background checks and vehicle inspections. Report any safety concerns immediately.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">7. Contact</h2>
          <p>For questions about these terms, contact us at:</p>
          <p className="text-amber-400 mt-2">legal@inoka.online</p>
        </section>

        <section className="pt-6 border-t border-slate-800">
          <p className="text-slate-500 text-sm">Inoka is operated by Petri Wai, LLC</p>
          <p className="text-slate-500 text-sm">Springfield, Illinois</p>
        </section>
      </div>
    </div>
  )
}
