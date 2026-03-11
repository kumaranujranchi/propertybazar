import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210");

async function checkProps() {
  try {
    // import the api dynamically since it's an ES module that might need special handling in some environments,
    // actually, let's just use the string literal 'properties:getProperties' to be safe for this script
    // Wait, getProperties takes an object. 
    // Is there a simpler way? Let's just use the query directly if possible.
    const { api } = await import("../convex/_generated/api.js");
    const props = await client.query(api.properties.getProperties, {});
    
    console.log("Total properties:", props.length);
    const targetProps = props.filter((p) => 
      JSON.stringify(p.location).toLowerCase().includes("patut")
    );
    console.log("Patut properties:");
    targetProps.forEach((p) => {
      console.log(JSON.stringify(p.location, null, 2));
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

checkProps();
