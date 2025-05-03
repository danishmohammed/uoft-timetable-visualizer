import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  const allowedOrigin = "https://ttv.danishmohammed.ca";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const databases = await client.db().admin().listDatabases();

    let latestDateObj = null;
    let latestDateStr = null;

    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      if (dbName.includes("Fall-Winter") || dbName.includes("Summer")) {
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();

        for (const collection of collections) {
          const doc = await db
            .collection(collection.name)
            .findOne({ faculty_name: collection.name.replace(/_/g, " ") });

          if (doc?.last_updated) {
            const parsedDateStr = doc.last_updated.replace(" at ", " ");
            const currentDateObj = new Date(parsedDateStr);

            if (!latestDateObj || currentDateObj > latestDateObj) {
              latestDateObj = currentDateObj;
              latestDateStr = doc.last_updated;
            }
          }
        }
      }
    }

    if (latestDateStr) {
      res.status(200).json({ last_updated: latestDateStr });
    } else {
      res.status(404).json({ message: "No last_updated date found" });
    }
  } catch (error) {
    console.error("Error in /api/lastUpdated:", error);
    res.status(500).json({ error: "Failed to fetch last updated date" });
  } finally {
    await client.close();
  }
}
