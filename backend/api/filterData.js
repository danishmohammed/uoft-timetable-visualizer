import { MongoClient } from "mongodb";
import { applyCorsHeaders } from "./utils/cors.js";
import { getLatestTimetableDatabases } from "./utils/timetableDatabases.js";

export default async function handler(req, res) {
  applyCorsHeaders(req, res, "GET, OPTIONS");

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

    const timetableDatabases = await getLatestTimetableDatabases(
      client,
      databases.databases
    );

    for (const dbName of timetableDatabases) {
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
            facultyData.semesters || {}
          ).reduce((acc, semesterName) => {
            const semester = facultyData.semesters[semesterName];
            const departments = semester?.departments || {};
            if (Object.keys(departments).length === 0) {
              return acc;
            }

            acc[semesterName] = Object.keys(departments).reduce(
              (deptAcc, deptName) => {
                const dept = departments[deptName];
                deptAcc[deptName] = {
                  buildings: dept.buildings || [],
                  instructors: dept.instructors || [],
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

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error in /api/filterData:", error);
    res.status(500).json({ error: "Failed to fetch filter data" });
  } finally {
    await client.close();
  }
}
