// "use client";

// import { useCuisineFilterStore } from "@/stores/cuisineFilterStore";
// import { useTranslation } from "@/hooks/useTranslation";

// type Props = {
//   open: boolean;
//   onClose: () => void;
// };

// const CUISINE_OPTIONS = [
//   {
//     value: "Portuguese Food",
//     labelKey: "cuisinePortugueseFood",
//   },
//   {
//     value: "Sushi",
//     labelKey: "cuisineSushi",
//   },
//   {
//     value: "Kebab",
//     labelKey: "cuisineKebab",
//   },
//   {
//     value: "Barbecue",
//     labelKey: "cuisineBarbecue",
//   },
//   {
//     value: "Indian Food",
//     labelKey: "cuisineIndianFood",
//   },
//   {
//     value: "Italian Food",
//     labelKey: "cuisineItalianFood",
//   },
//   {
//     value: "Vegetarian Food",
//     labelKey: "cuisineVegetarianFood",
//   },
//   {
//     value: "Thai Food",
//     labelKey: "cuisineThaiFood",
//   },
//   {
//     value: "Japanese Food",
//     labelKey: "cuisineJapaneseFood",
//   },
//   {
//     value: "Ramen",
//     labelKey: "cuisineRamen",
//   },
//   {
//     value: "Seafood",
//     labelKey: "cuisineSeafood",
//   },
//   {
//     value: "Burger",
//     labelKey: "cuisineBurger",
//   },
//   {
//     value: "Halal",
//     labelKey: "cuisineHalal",
//   },
//   {
//     value: "Others",
//     labelKey: "cuisineOthers",
//   },
// ];

// export default function RestaurantFilterModal({ open, onClose }: Props) {
//   const { t } = useTranslation();
//   const { selectedCuisines, toggleCuisine, clearCuisines } =
//     useCuisineFilterStore();

//   if (!open) return null;

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-end bg-black/40"
//       onClick={onClose}
//     >
//       <div
//         className="max-h-[80vh] w-full rounded-t-4xl bg-white p-6"
//         onClick={(e) => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div className="mb-6 flex items-center justify-between">
//           <h2 className="text-2xl font-bold text-[#191c1d]">{t("filter")}</h2>

//           <button
//             onClick={clearCuisines}
//             className="font-semibold text-[#d81b60]"
//           >
//             {t("clearAll")}
//           </button>
//         </div>

//         {/* Filter Options */}
//         <div className="mb-8 flex flex-wrap gap-3 overflow-y-auto">
//           {CUISINE_OPTIONS.map((item) => {
//             const active = selectedCuisines.includes(item.value);

//             return (
//               <button
//                 key={item.value}
//                 onClick={() => toggleCuisine(item.value)}
//                 className={`rounded-full px-5 py-3 text-sm font-medium transition-all ${
//                   active
//                     ? "bg-[#d81b60] text-white"
//                     : "border border-[#e7e8e9] bg-white text-[#191c1d]"
//                 }`}
//               >
//                 {active && "✓ "}
//                 {t(item.labelKey)}
//               </button>
//             );
//           })}
//         </div>

//         {/* Apply Button */}
//         <button
//           onClick={onClose}
//           className="w-full rounded-full bg-[#d81b60] py-4 text-lg font-bold text-white"
//         >
//           {t("apply")}{" "}
//           {selectedCuisines.length > 0 ? `(${selectedCuisines.length})` : ""}
//         </button>
//       </div>
//     </div>
//   );
// }
