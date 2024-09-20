const { MongoClient } = require("mongodb");

// Helper function to convert 12-hour time to minutes
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

const getSearchResults = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();

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

    const databases = await client.db().admin().listDatabases();

    // Determine the correct database based on the semester keyword
    let dbName;
    if (semester.includes("Summer")) {
      dbName = databases.databases.find((db) =>
        db.name.includes("Summer")
      ).name;
    } else {
      dbName = databases.databases.find((db) =>
        db.name.includes("Fall-Winter")
      ).name;
    }

    const db = client.db(dbName);

    const collections = await db.listCollections().toArray();

    let allResults = [];

    for (const collection of collections) {
      const collectionName = collection.name.replace(/_/g, " ");

      if (campuses.length > 0) {
        if (
          (collectionName === "University of Toronto Scarborough" &&
            !campuses.includes("UTSC")) ||
          (collectionName === "University of Toronto Mississauga" &&
            !campuses.includes("UTM")) ||
          (collectionName !== "University of Toronto Scarborough" &&
            collectionName !== "University of Toronto Mississauga" &&
            !campuses.includes("UTSG"))
        ) {
          continue; // Skip the collection if the faculty doesn't match any selected campus
        }
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

    res.json(allResults);
  } catch (error) {
    console.error("Error fetching search results:", error);
    res.status(500).json({ error: "Failed to fetch search results" });
  } finally {
    await client.close();
  }
};

module.exports = {
  getSearchResults,
};
