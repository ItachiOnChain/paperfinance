function Page3() {
  return (
    <section className="bg-[#eff7f4] px-1 py-8 sm:px-3 lg:px-6 lg:py-10">
      <div className="mx-auto max-w-[2100px]">
        <div className="space-y-8 lg:space-y-10">
          <article className="overflow-hidden rounded-[24px] border border-[#bcd6cf] bg-[#f8fcfb]">
            <div className="flex items-center justify-between border-b border-[#c8ded8] bg-[#eaf3f0] px-8 py-5">
              <span className="font-mono text-[16px] text-[#7c958e] lg:text-[42px]">
                Place a limit order
              </span>
              <span className="rounded-[10px] bg-[#f1eee4] px-3 py-1.5 font-mono text-[14px] text-[#de943d] lg:px-6 lg:py-3 lg:text-[40px]">
                JSON
              </span>
            </div>

            <div className="px-8 py-8 font-mono text-[15px] leading-[1.55] text-[#536662] lg:px-12 lg:py-12 lg:text-[49px]">
              <p className="text-[#7f9790]">// POST /exchange</p>
              <p>{'{'}</p>
              <p>{'  "wallet": "0xYourBot",'}</p>
              <p>{'  "action": {'}</p>
              <p>{'    "type": "order",'}</p>
              <p>{'    "grouping": "na",'}</p>
              <p>{'    "orders": ['}</p>
              <p>{'      { "a": 0, "b": true, "p": "83000", "s": "0.1", "r": false }'}</p>
              <p>{'    ]'}</p>
              <p>{'  }'}</p>
              <p>{'}'}</p>
            </div>
          </article>

          <article className="overflow-hidden rounded-[24px] border border-[#bcd6cf] bg-[#f8fcfb]">
            <div className="flex items-center justify-between border-b border-[#c8ded8] bg-[#eaf3f0] px-8 py-5">
              <span className="font-mono text-[16px] text-[#7c958e] lg:text-[42px]">
                Switch from live to paper
              </span>
              <span className="rounded-[10px] bg-[#d9eee7] px-3 py-1.5 font-mono text-[14px] text-[#1e7a63] lg:px-6 lg:py-3 lg:text-[40px]">
                PYTHON
              </span>
            </div>

            <div className="space-y-2 px-8 py-8 font-mono text-[15px] leading-[1.55] lg:px-12 lg:py-12 lg:text-[49px]">
              <p className="text-[#7f9790]"># Before (real HL)</p>
              <p>
                <span className="text-[#b57beb]">base_url</span>
                <span className="text-[#536662]"> = </span>
                <span className="text-[#df943f]">"https://api.hyperliquid.xyz"</span>
              </p>
              <p className="h-4 lg:h-10" />
              <p className="text-[#7f9790]"># After (HyPaper)</p>
              <p>
                <span className="text-[#b57beb]">base_url</span>
                <span className="text-[#536662]"> = </span>
                <span className="text-[#df943f]">"http://localhost:3000"</span>
              </p>
              <p className="text-[#7f9790]"># That's it. Same requests, same responses.</p>
            </div>
          </article>

          <article className="overflow-hidden rounded-[24px] border border-[#bcd6cf] bg-[#f8fcfb]">
            <div className="flex items-center justify-between border-b border-[#c8ded8] bg-[#eaf3f0] px-8 py-5">
              <span className="font-mono text-[16px] text-[#7c958e] lg:text-[42px]">
                Quick start
              </span>
              <span className="rounded-[10px] bg-[#d9eee7] px-3 py-1.5 font-mono text-[14px] text-[#1e7a63] lg:px-6 lg:py-3 lg:text-[40px]">
                BASH
              </span>
            </div>

            <div className="space-y-2 px-8 py-8 font-mono text-[15px] leading-[1.55] text-[#536662] lg:px-12 lg:py-12 lg:text-[49px]">
              <p>
                <span className="text-[#1d7d65]">$</span> git clone https://github.com/GigabrainGG/HyPaper.git
              </p>
              <p>
                <span className="text-[#1d7d65]">$</span> cd hypaper-backend && cp .env.example .env
              </p>
              <p>
                <span className="text-[#1d7d65]">$</span> docker compose up -d
              </p>
              <p className="text-[#7f9790]"># server at http://localhost:3000</p>
              <p className="text-[#7f9790]"># ws at ws://localhost:3000/ws</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default Page3
