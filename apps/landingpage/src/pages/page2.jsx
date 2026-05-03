function Skills() {
  return (
    <section className="bg-[#f7fbfa] px-10 py-16 lg:px-16 xl:px-24 xl:py-24">
      
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-sm font-semibold tracking-widest text-[#2d8c74]">
          Skills
        </p>

        <h2 className="mt-4 font-['Fraunces'] text-4xl leading-tight text-[#0f1f1c] sm:text-5xl lg:text-6xl xl:text-7xl">
          Plug agents into
          <br />
          <span className="italic text-[#6b7f7a]">
            HyPaper fast.
          </span>
        </h2>

        <p className="mt-6 text-base text-[#5c6f69] sm:text-lg lg:text-xl">
          Open the HyPaper skills folder and hand your agent a machine-readable
          starting point for discovery, execution, and account workflows.
        </p>
      </div>

      {/* Terminal Card */}
      <div className="mt-12 rounded-2xl border border-[#cfe3dd] bg-[#eef6f3] lg:mt-16">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-[#d6e8e2] px-5 py-3 lg:px-8">
          <span className="text-xs font-medium text-[#6c847f] sm:text-sm">
            Agent skills folder
          </span>

          <span className="rounded-full bg-[#d7efe8] px-3 py-1 text-xs font-semibold text-[#2d8c74]">
            GITHUB
          </span>
        </div>

        {/* Content */}
        <div className="px-5 py-6 font-mono text-sm text-[#2f3d3a] sm:text-base lg:px-8 lg:py-8">
          
          <p className="text-[#1f2e2b]">skills/hypaper-api</p>

          <div className="mt-4 space-y-2 text-[#5f736e]">
            <p>- machine-readable API context</p>
            <p>- account and order workflows</p>
            <p>- ready for agent ingestion</p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-8 flex gap-4">
        <button className="rounded-full bg-[#78e4cd] px-6 py-2.5 text-sm font-semibold text-[#0f2a25] hover:bg-[#6edac3] transition">
          Open Skills
        </button>

        <button className="rounded-full border border-[#cfe3dd] bg-white px-6 py-2.5 text-sm font-semibold text-[#1f2e2b] hover:bg-gray-50 transition">
          View Repo
        </button>
      </div>
    </section>
  );
}

export default Skills;