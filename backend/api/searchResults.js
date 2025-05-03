import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://ttv.danishmohammed.ca");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  const { session, faculty, department, campus, query } = req.query;

  if (!session || !faculty) {
    return res.status(400).json({ error: "Missing session or faculty" });
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(session);
    const collection = db.collection(faculty.replace(/ /g, "_"));

    const mongoQuery = {};
    if (department) mongoQuery.department = department;
    if (campus) mongoQuery.campus = campus;
    if (query) {
      mongoQuery.$or = [
        { course_code: { $regex: query, $options: "i" } },
        { course_title: { $regex: query, $options: "i" } },
      ];
    }

    const results = await collection.find(mongoQuery).toArray();
    res.status(200).json(results);
  } catch (error) {
    console.error("Error in /api/searchResults:", error);
    res.status(500).json({ error: "Failed to fetch search results" });
  } finally {
    await client.close();
  }
}
