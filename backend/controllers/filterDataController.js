const { MongoClient } = require("mongodb");

const getAllFilterData = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();

    const databases = await client.db().admin().listDatabases(); // Get all databases
    const allData = {};

    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      if (dbName.includes("Fall-Winter") || dbName.includes("Summer")) {
        // Assuming these are the session databases
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();

        allData[dbName] = {};

        for (const collection of collections) {
          const collectionName = collection.name.replace(/_/g, " ");
          const facultyData = await db
            .collection(collection.name)
            .findOne({ faculty_name: collectionName });

          if (facultyData) {
            allData[dbName][collectionName] = Object.keys(
              facultyData.semesters
            ).reduce((acc, semesterName) => {
              const semester = facultyData.semesters[semesterName];
              acc[semesterName] = Object.keys(semester.departments).reduce(
                (deptAcc, deptName) => {
                  const dept = semester.departments[deptName];
                  deptAcc[deptName] = {
                    buildings: dept.buildings,
                    instructors: dept.instructors,
                  };
                  return deptAcc;
                },
                {}
              );
              return acc;
            }, {});
          } else {
            console.warn(
              `No faculty data found for collection: ${collectionName} in ${dbName}`
            );
          }
        }
      }
    }

    res.json(allData);
  } catch (error) {
    console.error("Error fetching all faculty data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  } finally {
    await client.close();
  }
};

module.exports = {
  getAllFilterData,
};
