// import Image from "next/image";

// import { ArrowRight } from "lucide-react";

// export default function ShopSection() {
//   return (
//     <section>
//       <div className="mb-8 flex items-center justify-between">
//         <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">Shop On DeliGo</h2>
//       </div>

//       <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-6">
//         <div className="group flex cursor-pointer items-center gap-10 rounded-4xl border-2 border-transparent bg-[#ffffff] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-[#ffd9de] hover:shadow-2xl">
//           <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl bg-[#ffd9de] shadow-inner transition-transform duration-500 group-hover:scale-105">
//             <Image
//               alt="A detailed digital illustration of a charming boutique grocery store storefront with striped awnings and fresh produce baskets outside."
//               className="h-full w-full object-cover"
//               height={160}
//               width={160}
//               src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxj88Rjmu_ERpujbFv3n0OVzhl2t0bq-lypR7EHEuyP_nQ9s3LYOb3DdkHIIlIdES02HBBUCLCC0WClYxU_bLOo1mENq87K5lMGw4pPrn2iItJKTnvRtqDjKT8es6jh5IcKwM6A3dvbwbUrGvxc_QfG2gZeY_YNleTd4D1iuTpVm5ECJNou-XbMg5-hz1gsE8_jx-Gsk03KBKKisQ6iQgyCSLywCdK3JJMSBCn3muopqJRMSdyru-rzvWPY0pjcSeqG1JTXto8lKQ"
//             />
//           </div>

//           <div className="flex-1">
//             <h3 className="mb-3 text-[24px] font-black leading-8 text-[#191c1d]">STORE</h3>
//             <p className="text-[18px] leading-7 text-[#5a4044]">
//               Fresh groceries and daily essentials from your favorite local shops delivered in minutes.
//             </p>
//               <span className="mt-6 inline-flex items-center gap-2 text-[18px] font-bold leading-7 text-[#b0004a] transition-all group-hover:gap-4">
//               Order Now <ArrowRight size={18} />
//             </span>
//           </div>
//         </div>

//         <div className="group flex cursor-pointer items-center gap-10 rounded-4xl border-2 border-transparent bg-[#ffffff] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-[#ffb1c1] hover:shadow-2xl">
//           <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl bg-[#ffb1c1] shadow-inner transition-transform duration-500 group-hover:scale-105">
//             <Image
//               alt="A stylized 3D rendered restaurant icon featuring a cozy cafe facade with warm interior lighting and outdoor seating."
//               className="h-full w-full object-cover"
//               height={160}
//               width={160}
//               src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7RTNOGCLc94svbWC4Ge52W-fXG5pnGLJxhIJqaKryNFXJJnvEORvIFHbumHt4x9YBzpqMznbXAVAM5wrn22YxrF01JPcVe2uTDjldbDB9bLMLE4gctNN3lUdV9hOSwiss61vzrrOWra3mkAGdFcaiobl2b4vLkedBUP81inJPBa7gjIBDvn19dt9XXNN0SY8Nx5rtSVfnnwEa1ZnXsI_q6iWTkldLVL5nf2mVO4Qb7B19K75wB6rnpuYpUYzNA2WcKBXV2Qex5o8"
//             />
//           </div>

//           <div className="flex-1">
//             <h3 className="mb-3 text-[24px] font-black leading-8 text-[#b70052]">RESTAURANT</h3>
//             <p className="text-[18px] leading-7 text-[#5a4044]">
//               Delicious meals prepared by the top-rated local chefs and restaurants in the heart of the city.
//             </p>
//               <span className="mt-6 inline-flex items-center gap-2 text-[18px] font-bold leading-7 text-[#b70052] transition-all group-hover:gap-4">
//               Browse Menus <ArrowRight size={18} />
//             </span>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";

type BusinessCategory = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success: boolean;
  message: string;
  data: {
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPage: number;
    };
    data: BusinessCategory[];
  };
};

export default function ShopSection() {
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchBusinessCategories() {
      const token = getAccessToken();

      if (!token) {
        if (alive) {
          setError("Authentication token missing. Please log in again.");
          setLoading(false);
        }
        return;
      }

      try {
        const response = await apiClient.get<ApiResponse>("/categories/businessCategory", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = response.data;
        const activeCategories = (payload.data?.data ?? []).filter(
          (cat) => cat.isActive && !cat.isDeleted
        );

        if (alive) {
          setCategories(activeCategories);
          setError(null);
        }
      } catch {
        if (alive) {
          setError("Unable to load shop categories. Please try again.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchBusinessCategories();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">Shop On DeliGo</h2>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-500">Loading shop categories...</div>
        </div>
      </section>
    );
  }

  if (error || categories.length === 0) {
    return (
      <section>
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">Shop On DeliGo</h2>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-red-500">{error || "No shop categories available."}</div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">Shop On DeliGo</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-6">
        {categories.map((category) => (
          <div
            key={category._id}
            className="group flex cursor-pointer items-center gap-10 rounded-4xl border-2 border-transparent bg-[#ffffff] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-[#ffd9de] hover:shadow-2xl"
          >
            <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl bg-gray-100 shadow-inner transition-transform duration-500 group-hover:scale-105">
              {category.icon ? (
                <Image
                  alt={category.name}
                  className="h-full w-full object-cover"
                  style={{ height: "100%", width: "100%" }}
                  height={160}
                  width={160}
                  src={category.icon}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-gray-400">
                  {category.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h3 className="mb-3 text-[24px] font-black leading-8 text-[#191c1d]">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-[18px] leading-7 text-[#5a4044]">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
