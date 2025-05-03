import { MongoClient } from "mongodb";

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
  res.setHeader("Access-Control-Allow-Origin", "https://ttv.danishmohammed.ca");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

    let dbName;
    if (semester.includes("Summer")) {
      dbName = databases.databases.find((db) =>
        db.name.includes("Summer")
      )?.name;
    } else {
      dbName = databases.databases.find((db) =>
        db.name.includes("Fall-Winter")
      )?.name;
    }

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
                { $ne: ["$start_time", "TBA"] },
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
                { $ne: ["$end_time", "TBA"] },
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
