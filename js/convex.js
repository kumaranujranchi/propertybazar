import { ConvexHttpClient } from "https://esm.sh/convex@1.32.0/browser";

export const convex = new ConvexHttpClient("https://compassionate-mockingbird-459.convex.cloud");
window.convex = convex;
