/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Bike, Plus, Star } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import ProductDetailsModal from "./ProductDetailsModal";
import VendorDetailsModal from "./VendorDetailsModal";

interface Vendor {
  id: string;
  userId: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    openingHours: string;
    closingHours: string;
    preparationTimeMinutes: number;
    restaurantCuisineType?: string;
    isStoreOpen: boolean;
  };
  storePhoto?: string[];
  availableCategories?: { _id: string; name: string; icon: string }[];
}

interface Product {
  id: string;
  productId: string;
  name: string;
  description: string;
  images: string[];
  pricing: {
    price: number;
    discount: number;
    finalPrice: number;
    currency: string;
  };
  category?: { name: string };
}

interface VendorDetailsPageProps {
  vendorId: string;
}

export default function VendorDetailsPage({
  vendorId,
}: VendorDetailsPageProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        let currentPage = 1;
        let foundVendor: Vendor | null = null;

        while (!foundVendor) {
          const { data } = await apiClient.get(
            `/vendors/customer?page=${currentPage}&limit=50`,
          );
          const vendors: Vendor[] = data.data;
          if (vendors.length === 0) break;
          foundVendor = vendors.find((v) => v.userId === vendorId) || null;
          if (foundVendor) break;
          if (currentPage >= (data.meta?.totalPage || 1)) break;
          currentPage++;
        }

        if (!foundVendor) throw new Error("Vendor not found");
        setVendor(foundVendor);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  useEffect(() => {
    if (!vendor) return;

    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const { data } = await apiClient.get(
          `/products?vendorId=${vendor.id}&limit=100`,
        );
        setProducts(data.data || []);
      } catch (err) {
        setProductsError(getApiErrorMessage(err, "Unable to load menu"));
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, [vendor]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-lg font-medium">
        Loading vendor...
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center text-red-500">
        {error || "Vendor not found"}
      </div>
    );
  }

  const heroImage = vendor.storePhoto?.[0] || "/placeholder-store.jpg";
  const prepTime = vendor.businessDetails.preparationTimeMinutes || 30;

  const vendorCategoryNames =
    vendor.availableCategories?.map((cat) => cat.name) || [];
  const categories = ["All", "POPULAR", ...vendorCategoryNames];

  const filteredProducts = products.filter((product) => {
    if (selectedCategory === "All" || selectedCategory === "POPULAR")
      return true;
    const productCategory = product.category?.name;
    if (!productCategory) return false;
    return productCategory.toLowerCase() === selectedCategory.toLowerCase();
  });

  const formatPrice = (price: number, currency: string) => {
    return `${currency}${price.toFixed(2)}`.replace(".", ",");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto max-w-full px-4 py-6 lg:px-8">
        {/* Hero Section */}
        <section className="mb-6">
          <div className="relative overflow-hidden rounded-3xl shadow-lg">
            <div className="relative h-62.5 md:h-90">
              <Image
                src={heroImage}
                alt={vendor.businessDetails.businessName}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-white p-5 shadow-xl">
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {vendor.businessDetails.businessName}
                    </h1>
                    <span
                      className={`h-3 w-3 rounded-full ${
                        vendor.businessDetails.isStoreOpen
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                  </div>
                  <p className="mb-4 text-sm text-gray-500">
                    {vendor.businessDetails.restaurantCuisineType ||
                      vendor.businessDetails.businessType}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <button
                      onClick={() => setIsVendorModalOpen(true)}
                      className="font-semibold text-pink-600"
                    >
                      More Info →
                    </button>
                    <div className="flex items-center gap-1">
                      <Star
                        size={16}
                        className="fill-yellow-400 text-yellow-400"
                      />
                      <span className="font-medium">New</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Bike size={16} />
                      <span>
                        {prepTime}-{prepTime + 10} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Dynamic Categories with Filtering */}
        <section className="mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-3">
            {categories.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-pink-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>
        <VendorDetailsModal
          isOpen={isVendorModalOpen}
          onClose={() => setIsVendorModalOpen(false)}
          vendorId={vendorId}
        />
        ;{/* Dynamic Menu with Filtering */}
        <section>
          <h2 className="mb-6 text-xl font-bold text-gray-900">Menu</h2>

          {productsLoading && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl bg-gray-100"
                />
              ))}
            </div>
          )}

          {productsError && (
            <div className="rounded-2xl bg-red-50 p-6 text-center text-red-600">
              {productsError}
            </div>
          )}

          {!productsLoading &&
            !productsError &&
            filteredProducts.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-6 text-center text-gray-500">
                No items found in this category.
              </div>
            )}

          {!productsLoading &&
            !productsError &&
            filteredProducts.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const hasDiscount = product.pricing.discount > 0;
                  const originalPrice = product.pricing.price;
                  const finalPrice = product.pricing.finalPrice;
                  const currency = product.pricing.currency || "€";

                  return (
                    <div
                      key={product.id}
                      className="group flex overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg"
                    >
                      <div className="relative h-36 w-32 shrink-0">
                        <Image
                          src={
                            product.images?.[0] || "/placeholder-product.jpg"
                          }
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                        {hasDiscount && (
                          <span className="absolute left-2 top-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-bold text-white">
                            {Math.round(product.pricing.discount)}% OFF
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {product.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                            {product.description ||
                              "Delicious item from our menu."}
                          </p>
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <p className="text-xl font-bold text-pink-600">
                              {formatPrice(finalPrice, currency)}
                            </p>
                            {hasDiscount && (
                              <p className="text-xs text-gray-400 line-through">
                                {formatPrice(originalPrice, currency)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setSelectedProductId(product.productId)
                            }
                            className="rounded-xl bg-pink-600 p-2 text-white transition hover:scale-105"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </section>
        {/* Product Details Modal */}
        <ProductDetailsModal
          isOpen={!!selectedProductId}
          onClose={() => setSelectedProductId(null)}
          productId={selectedProductId || ""}
        />
      </div>
    </div>
  );
}