function Capabilities() {
  const features = [
    {
      id: "01",
      icon: "⚡",
      title: "Live Price Matching",
      desc: "Streams HyperLiquid's live feed and fills paper orders off real mid prices with L2 VWAP slippage.",
      tag: "wss://api.hyperliquid.xyz/ws",
    },
    {
      id: "02",
      icon: "📋",
      title: "Full Order Suite",
      desc: "Limit, IOC, ALO, stop loss, and take profit with the same order model your HL bot already expects.",
      tag: "POST /exchange",
    },
    {
      id: "03",
      icon: "🔄",
      title: "1:1 API Compatibility",
      desc: "Drop-in replacement for HyperLiquid APIs. No code changes required for integration.",
      tag: "/info /exchange",
    },
    {
      id: "04",
      icon: "🧠",
      title: "Smart Execution Engine",
      desc: "Simulates real fills using orderbook depth and realistic execution behavior.",
      tag: "VWAP Engine",
    },
  ];

  return (
    <section className="bg-[#f7fbfa]  px-6 py-16 lg:px-16 xl:px-30 xl:py-24">
      
      {/* Header */}
      <div className="max-w-4xl">
        <p className="text-sm font-semibold tracking-widest text-[#2d8c74]">
          Capabilities
        </p>

        <h2 className="mt-4 font-['Fraunces'] text-4xl leading-tight text-[#0f1f1c] sm:text-5xl lg:text-6xl xl:text-7xl">
          Everything your bot needs.
          <br />
          <span className="italic text-[#6b7f7a]">
            Nothing it doesn't.
          </span>
        </h2>

        <p className="mt-6 max-w-2xl text-base text-[#5c6f69] sm:text-lg lg:text-xl">
          Built to mirror the HyperLiquid API exactly. Switch between paper and live with a single URL change.
        </p>
      </div>

      {/* Cards */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:gap-8 xl:mt-16">
        {features.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[#d6e8e2] bg-white p-6 transition hover:shadow-md lg:p-8"
          >
            {/* Top */}
            <div className="flex items-center justify-between text-sm text-[#8aa39d]">
              <span>{item.id}</span>
            </div>

            {/* Icon */}
            <div className="mt-4 text-2xl">{item.icon}</div>

            {/* Title */}
            <h3 className="mt-4 font-['Fraunces'] text-xl text-[#1b2b28] lg:text-2xl">
              {item.title}
            </h3>

            {/* Description */}
            <p className="mt-3 text-sm leading-relaxed text-[#5f736e] lg:text-base">
              {item.desc}
            </p>

            {/* Tag */}
            <div className="mt-5 inline-block rounded-full bg-[#e6f4f0] px-4 py-1.5 text-xs font-medium text-[#2d8c74] lg:text-sm">
              {item.tag}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Capabilities;