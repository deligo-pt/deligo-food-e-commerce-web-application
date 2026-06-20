import {
  Bike,
  Coffee,
  Cookie,
  Home,
  IceCream,
  Pizza,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  const floatingIcons = [
    {
      Icon: Pizza,
      x: "10%",
      y: "20%",
      size: 48,
      className: "animate-bounce delay-75 duration-3000",
    },
    {
      Icon: Coffee,
      x: "85%",
      y: "15%",
      size: 40,
      className: "animate-pulse delay-150 duration-4000",
    },
    {
      Icon: IceCream,
      x: "15%",
      y: "75%",
      size: 52,
      className: "animate-bounce delay-300 duration-5000",
    },
    {
      Icon: Cookie,
      x: "80%",
      y: "65%",
      size: 44,
      className: "animate-pulse delay-500 duration-3000",
    },
    {
      Icon: UtensilsCrossed,
      x: "50%",
      y: "10%",
      size: 36,
      className: "animate-bounce delay-1000 duration-4000",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-[#DC3173]/10 to-white overflow-hidden relative flex flex-col items-center justify-center p-4">
      {/* Soft Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-[10%] w-[40%] h-[40%] bg-[#DC3173]/20 blur-3xl rounded-full" />
        <div className="absolute bottom-[0%] right-[10%] w-[50%] h-[50%] bg-[#DC3173]/15 blur-3xl rounded-full" />
      </div>

      {/* Floating Food Icons Layer */}
      {floatingIcons.map((item, index) => (
        <div
          key={index}
          className={`absolute text-[#DC3173]/60 pointer-events-none transition-all ${item.className}`}
          style={{
            left: item.x,
            top: item.y,
          }}
        >
          <item.Icon size={item.size} />
        </div>
      ))}

      {/* Main Content Container */}
      <div className="relative z-10 max-w-3xl w-full text-center">
        {/* Animated 404 Display */}
        <div className="relative mb-8 inline-block transition-transform duration-500 hover:scale-105">
          <h1 className="text-[150px] md:text-[220px] font-black leading-none text-transparent bg-clip-text bg-linear-to-br from-[#DC3173] to-[#D60059] select-none drop-shadow-sm">
            404
          </h1>

          {/* Scooter Icon next to the 404 */}
          <div className="absolute bottom-4 right-0 animate-pulse">
            <Bike size={64} className="transform -scale-x-100 text-[#DC3173]" />
            <div className="absolute -right-4 top-1/2 w-8 h-4 bg-gray-200/50 blur-sm rounded-full animate-ping" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-6">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900">
            Page Not Found
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-lg mx-auto leading-relaxed">
            Oops! It looks like you&apos;ve stumbled upon a dead end 🗺️. The
            page you&apos;re searching for seems to have been misplaced or
            moved to a different location.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link
              href="/"
              className="group relative px-8 py-4 bg-[#DC3173] text-white rounded-full font-bold text-lg shadow-lg shadow-[#DC317330] overflow-hidden flex items-center gap-2 hover:bg-[#b0004a] transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              <Home size={20} />
              Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Decoration */}
      <div className="absolute bottom-0 left-0 w-full h-2 bg-linear-to-r from-[#DC3173] via-[#ff5fa0] to-[#DC3173] opacity-60" />
    </div>
  );
}
