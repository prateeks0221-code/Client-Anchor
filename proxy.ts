import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  // All pages public — auth handled per-route if needed
  "/(.*)",
]);

const isWebhookRoute = createRouteMatcher(["/api/webhook(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Webhooks bypass auth entirely (Svix signature handles security).
  if (isWebhookRoute(req)) return;

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
