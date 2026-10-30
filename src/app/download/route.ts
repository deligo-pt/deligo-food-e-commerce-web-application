import { NextRequest, NextResponse } from "next/server";

const IOS_URL =
  "https://apps.apple.com/pt/app/deligo-food/id6770233877?l=en-GB";

const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.deligo.customer";

const WEBSITE_URL = "https://deligo.pt";

export function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";

  // Redirect Android users to Google Play Store
  if (/android/i.test(userAgent)) {
    return NextResponse.redirect(ANDROID_URL, 302);
  }

  // Redirect Apple users to Apple App Store
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return NextResponse.redirect(IOS_URL, 302);
  }

  // Redirect desktop and other devices to the website
  return NextResponse.redirect(WEBSITE_URL, 302);
}