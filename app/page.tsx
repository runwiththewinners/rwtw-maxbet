import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import MaxBetClient from "./MaxBetClient";

const PRODUCTS: Record<string, string> = {
  maxbet: "prod_12U89lKiPpVxP",
  premium: "prod_o1jjamUG8rP8W",
  highrollers: "prod_bNsUIqwSfzLzU",
};

const CHECKOUT_URL = "https://whop.com/rwtw/max-bet-play-of-the-day/";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const headersList = await headers();

  let hasAccess = false;
  let authenticated = false;

  try {
    const result = await whopsdk.verifyUserToken(headersList, {
      dontThrow: true,
    });
    const userId = (result as any)?.userId ?? null;

    if (userId) {
      authenticated = true;

      // Check if user has access via maxbet, premium, or highrollers
      const checks = await Promise.all(
        Object.entries(PRODUCTS).map(async ([key, prodId]) => {
          try {
            const response = await whopsdk.users.checkAccess(prodId, {
              id: userId,
            });
            return response.has_access === true;
          } catch {
            return false;
          }
        })
      );

      hasAccess = checks.some((v) => v);
    }
  } catch (e) {
    console.error("[MAXBET] Auth error:", e);
  }

  return (
    <MaxBetClient
      hasAccess={hasAccess}
      authenticated={authenticated}
      checkoutUrl={CHECKOUT_URL}
    />
  );
}
