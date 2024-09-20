const { MongoClient } = require("mongodb");

const getLastUpdatedDate = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();

    const databases = await client.db().admin().listDatabases();
    let lastUpdatedDate = "";

    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      if (dbName.includes("Fall-Winter") || dbName.includes("Summer")) {
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();

        for (const collection of collections) {
          const facultyData = await db
            .collection(collection.name)
            .findOne({ faculty_name: collection.name.replace(/_/g, " ") });
          if (facultyData && facultyData.last_updated) {
            lastUpdatedDate = facultyData.last_updated;
            break;
          }
        }

        if (lastUpdatedDate) {
          break;
        }
      }
    }

    if (lastUpdatedDate) {
      res.json({ last_updated: lastUpdatedDate });
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
