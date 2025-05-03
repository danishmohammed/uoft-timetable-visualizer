import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://ttv.danishmohammed.ca");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();

    const databases = await client.db().admin().listDatabases();
    const allData = {};

    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      if (dbName.includes("Fall-Winter") || dbName.includes("Summer")) {
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

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error in /api/filterData:", error);
    res.status(500).json({ error: "Failed to fetch filter data" });
  } finally {
    await client.close();
  }
}
