import type { Metadata } from "next";

import LoginPage from "../../components/auth/LoginPage";

export const metadata: Metadata = {
  title: "DeliGo | Login",
  description: "Login or create your DeliGo account.",
};

export default function LoginRoute() {
  return <LoginPage />;
}