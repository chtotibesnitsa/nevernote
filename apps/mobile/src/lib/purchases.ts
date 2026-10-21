// In-app subscriptions through RevenueCat (Apple requires IAP for digital
// subscriptions). The RevenueCat webhook on our server flips the plan to Pro,
// keyed by the Supabase user id, so Pro follows the account to the laptop.
import Constants from "expo-constants";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || (Constants.expoConfig?.extra as Record<string, string> | undefined)?.revenueCatIosKey;
export const purchasesEnabled = !!key;
let configured = "";

function setup(userId: string) {
  if (!key) throw new Error("Purchases aren't set up in this build yet");
  if (configured === userId) return;
  if (!configured) Purchases.configure({ apiKey: key, appUserID: userId });
  else void Purchases.logIn(userId);
  configured = userId;
}

export async function packages(userId: string): Promise<{ monthly?: PurchasesPackage; yearly?: PurchasesPackage }> {
  setup(userId);
  const o = await Purchases.getOfferings();
  return { monthly: o.current?.monthly ?? undefined, yearly: o.current?.annual ?? undefined };
}

/** True when the purchase went through (Pro arrives via the webhook a moment later). */
export async function buy(userId: string, pkg: PurchasesPackage): Promise<boolean> {
  setup(userId);
  const r = await Purchases.purchasePackage(pkg);
  return !!r.customerInfo.entitlements.active.pro;
}

export async function restore(userId: string): Promise<boolean> {
  setup(userId);
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active.pro;
}
