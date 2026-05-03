function Page4() {
  return (
    <section className="border-y border-[#d3e6df] bg-[#eff7f4]">
      
      {/* MAIN */}
      <div className="mx-auto max-w-6xl px-6 py-20 text-center lg:py-28">
        
        {/* Tag */}
        <p className="flex items-center justify-center gap-3 text-sm font-semibold tracking-widest text-[#237d65] sm:text-base">
          <span className="h-[2px] w-8 bg-[#78e4cd]" />
          Get Started
        </p>

        {/* Heading */}
        <h2 className="mt-6 font-['Fraunces'] text-4xl leading-tight text-[#071516] sm:text-5xl lg:text-6xl xl:text-7xl">
          Ship your bot.
          <br />
          <span className="italic text-[#1f7f66]">
            Without blowing up.
          </span>
        </h2>

        {/* Description */}
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#4f605c] sm:text-lg lg:text-xl">
          Clone the repo, set your balance, and run Docker Compose. Your paper
          environment is live in minutes.
        </p>

        {/* Command Box */}
        <div className="mt-10 w-full max-w-4xl rounded-xl border border-[#bfd9d2] bg-[#f4faf8] px-4 py-4 text-left sm:px-6">
          <p className="font-mono text-sm text-[#2a3331] sm:text-base">
            <span className="mr-2 text-[#258062]">$</span>
            git clone https://github.com/GigabrainGG/HyPaper.git && docker compose up -d
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          
          {/* Primary */}
          <button className="inline-flex items-center gap-2 rounded-full bg-[#78e4cd] px-6 py-3 text-sm font-semibold text-[#102322] transition hover:opacity-90 sm:text-base">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4a3.1 3.1 0 0 0-1.3-1.7c-1.1-.8.1-.8.1-.8a2.4 2.4 0 0 1 1.8 1.2 2.5 2.5 0 0 0 3.5 1 2.6 2.6 0 0 1 .8-1.6c-2.7-.3-5.5-1.3-5.5-5.9a4.6 4.6 0 0 1 1.2-3.2 4.3 4.3 0 0 1 .1-3.1s1-.3 3.3 1.2a11 11 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2a4.3 4.3 0 0 1 .1 3.1 4.6 4.6 0 0 1 1.2 3.2c0 4.6-2.8 5.6-5.5 5.9a2.9 2.9 0 0 1 .8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"
              />
            </svg>
            View on GitHub
          </button>

          {/* Secondary */}
          <button className="inline-flex items-center rounded-full border border-[#bfd9d2] bg-[#f7fbfa] px-6 py-3 text-sm font-semibold text-[#2a3331] transition hover:bg-[#eef6f3] sm:text-base">
            Read skills.md
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-[#d3e6df] bg-[#fdfefe]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          
          {/* Left */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#6f8480]">
            <span className="font-['Fraunces'] text-xl font-semibold text-[#49615b]">
              Hy<span className="italic text-[#2d8c74]">Paper</span>
            </span>
            <span>|</span>
            <span>Open source</span>
            <span>•</span>
            <span>MIT License</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-6 text-sm font-semibold text-[#546863]">
            <a href="#docs" className="hover:text-[#1f7f66]">Docs</a>
            <a href="#github" className="hover:text-[#1f7f66]">GitHub</a>
            <a href="#issues" className="hover:text-[#1f7f66]">Issues</a>
          </div>
        </div>
      </footer>
    </section>
  );
}

export default Page4;