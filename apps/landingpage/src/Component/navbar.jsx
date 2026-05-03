function Navbar() {
  return (
    <header className="flex h-[80px] items-center justify-between border-b border-[#e6f0ec] bg-[#f9fbfa] px-6 lg:px-8 xl:px-8">
      
      {/* Logo */}
      <div className="flex items-center rounded-lg border border-[#cfe5df] overflow-hidden">
        <div className="bg-[#e8f3f0] px-3 py-2 font-['Fraunces'] text-[20px] font-semibold leading-none lg:text-[17px]">
          <span className="text-[#0f2332]">Hy</span>
          <span className="text-[#2d8c74] italic">Paper</span>
        </div>
        <div className="bg-[#dff5ee] px-4 py-2 text-[14px] font-semibold text-[#2d8c74] lg:text-[15px]">
          Open Source
        </div>
      </div>

      {/* Nav Links */}
      <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
        <a className="text-[14px] font-medium text-[#5c6f69] hover:text-black transition">
          Features
        </a>
        <a className="text-[14px] font-medium text-[#5c6f69] hover:text-black transition">
          Skills
        </a>
        <a className="text-[14px] font-medium text-[#5c6f69] hover:text-black transition">
          API
        </a>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        
        {/* GitHub Button */}
        <button className="flex items-center gap-2 rounded-full border border-[#d3e7e1] bg-white px-4 py-2 text-[13px] font-medium text-[#1f2e2b] hover:bg-gray-50 transition">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4a3.1 3.1 0 0 0-1.3-1.7c-1.1-.8.1-.8.1-.8a2.4 2.4 0 0 1 1.8 1.2 2.5 2.5 0 0 0 3.5 1 2.6 2.6 0 0 1 .8-1.6c-2.7-.3-5.5-1.3-5.5-5.9a4.6 4.6 0 0 1 1.2-3.2 4.3 4.3 0 0 1 .1-3.1s1-.3 3.3 1.2a11 11 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2a4.3 4.3 0 0 1 .1 3.1 4.6 4.6 0 0 1 1.2 3.2c0 4.6-2.8 5.6-5.5 5.9a2.9 2.9 0 0 1 .8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"
            />
          </svg>
          GitHub
        </button>

        {/* CTA */}
        <button className="rounded-full bg-[#7ce5cf] px-4 py-2 text-[13px] font-semibold text-[#0f2a25] hover:bg-[#6edac3] transition">
          Get Started →
        </button>
      </div>
    </header>
  );
}

export default Navbar;