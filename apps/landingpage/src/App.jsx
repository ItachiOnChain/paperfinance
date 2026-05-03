import Navbar from './Component/navbar'
import Page1 from './pages/Page1'
import Page2 from './pages/page2'
import Page3 from './pages/Page3'
import Page4 from './pages/Page4'

function App() {
  return (
    <div className=" w-screen bg-[#eff7f4] text-[#3f5551]">
      <Navbar />

      <main
        className="mx-auto grid  grid-cols-1 gap-7 px-5 pb-18 pt-8 lg:grid-cols-[1.03fr_0.97fr] lg:gap-14 lg:px-[60px] lg:pb-20 lg:pt-[52px] xl:gap-[66px] xl:px-24 xl:pb-[120px] xl:pt-[78px]"
        id="features"
      >
        <section>
          {/* Badge */}
          <p className="flex items-center gap-3 text-sm font-semibold tracking-wider text-[#1d7f68] lg:text-base xl:text-lg">
            <span className="h-2 w-2 rounded-full bg-[#78e4cd]" />
            Paper Trading on 0G
          </p>

          {/* Main Heading */}
          <h1 className="mt-6 font-['Fraunces'] text-4xl leading-tight font-semibold text-[#041617] sm:text-5xl lg:text-6xl xl:text-7xl">
            Execution with
            <br />
            <span className="text-[#1f7f66] italic">real prices.</span>
          </h1>

          {/* Subheading */}
          <h2 className="mt-3 font-['Fraunces'] text-lg italic text-[#4d5f5b] sm:text-xl lg:text-2xl xl:text-3xl">
            1:1 mapped with Binance APIs.
          </h2>

          {/* Description */}
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#4b5f5b] sm:text-lg lg:text-xl xl:text-2xl">
            Run your bot locally and test your strategies natively. Same requests, same
            responses, same WebSocket protocol.{" "}
            <strong className="text-[#15221f]">Your bot sees no difference.</strong>{" "}
            <strong className="text-[#15221f]">Your wallet does.</strong>
          </p>

          {/* API Badge */}
          <div
            className="mt-6 flex w-fit items-center gap-3 rounded-full border border-[#bddad3] bg-[#f4faf8] px-4 py-2 lg:mt-10"
            id="api"
          >
            <span className="rounded-full bg-[#ccece4] px-3 py-1 text-xs font-bold tracking-wider text-[#1d7862] sm:text-sm">
              LOCAL API
            </span>
            <span className="text-sm text-[#182523] sm:text-base lg:text-lg font-mono">
              http://127.0.0.1:3001
            </span>
          </div>

          {/* Buttons */}
          <div className="mt-8 flex flex-wrap gap-3 lg:mt-12">
            <button className="flex items-center gap-2 rounded-full bg-[#78e4cd] px-5 py-2.5 text-sm font-semibold text-[#102322] sm:text-base lg:px-7 lg:py-3">
              View on GitHub
            </button>

            <button className="rounded-full border border-[#b9d8d1] bg-[#f7fbfa] px-5 py-2.5 text-sm font-semibold text-[#102322] sm:text-base lg:px-7 lg:py-3">
              Skills
            </button>
          </div>
        </section>
        <section className="relative pt-6 lg:pt-20 xl:pt-28">

          {/* Terminal Card */}
          <div className="overflow-hidden rounded-2xl border border-[#cfe3dd] bg-[#fbfdfc] shadow-sm lg:rounded-3xl">

            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-[#d8ebe5] bg-[#eaf4f1] px-4 py-2.5 lg:px-6 lg:py-4">

              {/* Dots */}
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
              </div>

              {/* URL */}
              <span className="text-xs font-medium text-[#7b908a] sm:text-sm lg:text-base font-mono">
                127.0.0.1:3001
              </span>

              {/* Status */}
              <span className="text-xs font-semibold text-[#4f9f89] sm:text-sm lg:text-base">
                • LIVE
              </span>
            </div>

            {/* Code Block */}
            <div className="px-4 py-4 font-mono text-xs leading-relaxed text-[#2b3332] sm:text-sm lg:px-8 lg:py-6 lg:text-base">

              <p>
                <span className="mr-2 text-[#2f8f70]">$</span> curl -X POST /exchange \
              </p>
              <p className="pl-4 text-[#7d9991]"># limit buy 0.1 BTC @ $83,000</p>
              <p>{'{"status":"ok","response":{"type":"order",'}</p>
              <p>{'"data":{"statuses":[{"filled":{'}</p>
              <p>{'"totalSz":"", "avgPx":"", "oid":4821}}]}}}'}</p>

              <br />

              <p>
                <span className="mr-2 text-[#2f8f70]">$</span> curl -X POST /info \
              </p>
              <p className="pl-4 text-[#7d9991]"># check clearinghouseState</p>
              <p>{'{"crossMarginSummary":{'}</p>
              <p>{'"accountValue":"",'}</p>
              <p>{'"totalMarginUsed":""}}'}</p>
            </div>
          </div>

          {/* Bottom Badge */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#cfe3dd] bg-[#f7fbfa] px-4 py-2 text-xs text-[#4d6360] sm:text-sm lg:absolute lg:bottom-[-30px] lg:right-6 lg:mt-0">
            <span className="h-2 w-2 rounded-full bg-[#78e4cd]" />
            No wallet signing - VWAP from L2 book
          </div>
        </section>
      </main>

      <Page1 />
      <Page2 />
      <Page3 />
      <Page4 />
    </div>
  )
}

export default App
