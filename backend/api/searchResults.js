import { MongoClient } from "mongodb";
import { applyCorsHeaders } from "./utils/cors.js";
import {
  getDatabaseNameFromSemester,
  getLatestDatabaseForFamily,
} from "./utils/timetableDatabases.js";

const convertToMinutes = (timeStr) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":");

  if (hours === "12") {
    hours = modifier === "AM" ? "00" : "12";
  } else if (modifier === "PM") {
    hours = String(parseInt(hours, 10) + 12);
  }

  return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
};

export default async function handler(req, res) {
  applyCorsHeaders(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const {
    semester,
    campuses,
    delivery,
    faculties,
    departments,
    buildings,
    instructorsList,
    startTime,
    endTime,
  } = req.body;

  const startTimeInMinutes = convertToMinutes(startTime);
  const endTimeInMinutes = convertToMinutes(endTime);

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const databases = await client.db().admin().listDatabases();

    const requestedDbName = getDatabaseNameFromSemester(semester);
    const dbExists = databases.databases.some((db) => db.name === requestedDbName);
    const dbName =
      requestedDbName === "Summer" || requestedDbName === "Fall-Winter"
        ? await getLatestDatabaseForFamily(
            client,
            databases.databases,
            requestedDbName
          )
        : dbExists
        ? requestedDbName
        : await getLatestDatabaseForFamily(
            client,
            databases.databases,
            semester.includes("Summer") ? "Summer" : "Fall-Winter"
          );

    if (!dbName) {
      return res.status(404).json({ error: "No matching database found" });
    }

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();

    let allResults = [];

    for (const collection of collections) {
      const collectionName = collection.name.replace(/_/g, " ");

      if (
        (collectionName === "University of Toronto Scarborough" &&
          !campuses.includes("UTSC")) ||
        (collectionName === "University of Toronto Mississauga" &&
          !campuses.includes("UTM")) ||
        (![
          "University of Toronto Scarborough",
          "University of Toronto Mississauga",
        ].includes(collectionName) &&
          !campuses.includes("UTSG"))
      ) {
        continue;
      }

      if (faculties.length > 0 && !faculties.includes(collectionName)) {
        continue;
      }

      const query = {
        ...(departments.length > 0 && { department: { $in: departments } }),
        ...(buildings.length > 0 && { location: { $in: buildings } }),
        ...(instructorsList.length > 0 && {
          instructors: { $in: instructorsList },
        }),
        ...(delivery.length > 0 && { delivery_mode: { $in: delivery } }),
        session: { $in: [semester] },
        $expr: {
          $and: [
            {
              $and: [
                {
                  $regexMatch: {
                    input: { $toString: "$start_time" },
                    regex: /^([01]\d|2[0-3]):[0-5]\d$/,
                  },
                },
                {
                  $lt: [
                    {
                      $add: [
                        {
                          $multiply: [
                            { $toInt: { $substr: ["$start_time", 0, 2] } },
                            60,
                          ],
                        },
                        { $toInt: { $substr: ["$start_time", 3, 2] } },
                      ],
                    },
                    endTimeInMinutes,
                  ],
                },
              ],
            },
            {
              $and: [
                {
                  $regexMatch: {
                    input: { $toString: "$end_time" },
                    regex: /^([01]\d|2[0-3]):[0-5]\d$/,
                  },
                },
                {
                  $gt: [
                    {
                      $add: [
                        {
                          $multiply: [
                            { $toInt: { $substr: ["$end_time", 0, 2] } },
                            60,
                          ],
                        },
                        { $toInt: { $substr: ["$end_time", 3, 2] } },
                      ],
                    },
                    startTimeInMinutes,
                  ],
                },
              ],
            },
          ],
        },
      };

      const results = await db
        .collection(collection.name)
        .find(query)
        .toArray();
      allResults = allResults.concat(results);
    }

    res.status(200).json(allResults);
  } catch (error) {
    console.error("Error in /api/searchResults:", error);
    res.status(500).json({ error: "Failed to fetch search results" });
  } finally {
    await client.close();
  }
}
