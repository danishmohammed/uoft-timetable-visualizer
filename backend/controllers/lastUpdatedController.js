const { MongoClient } = require("mongodb");

const getLastUpdatedDate = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();

    const databases = await client.db().admin().listDatabases();
    let latestDateString = null;
    let latestDateObject = null;

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
            if (!latestDateObject || currentDateObj > latestDateObject) {
              latestDateObject = currentDateObj;
              latestDateString = doc.last_updated; // Save original string
            }
          }
        }
      }
    }

    if (latestDateString) {
      res.json({ last_updated: latestDateString });
    } else {
      res.status(404).json({ message: "No last_updated date found" });
    }
  } catch (error) {
    console.error("Error fetching last updated date:", error);
    res.status(500).json({ error: "Failed to fetch last updated date" });
  } finally {
    await client.close();
  }
};

module.exports = {
  getLastUpdatedDate,
};
