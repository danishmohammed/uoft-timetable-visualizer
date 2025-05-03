import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  const { session, faculty } = req.query;

  if (!session || !faculty) {
    return res.status(400).json({ error: "Missing session or faculty" });
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(session);
    const collection = db.collection(faculty.replace(/ /g, "_"));
    const result = await collection
      .find({}, { projection: { department: 1, campus: 1 } })
      .toArray();

    const campuses = new Set();
    const departments = new Set();

    result.forEach((doc) => {
      if (doc.campus) campuses.add(doc.campus);
      if (doc.department) departments.add(doc.department);
    });

    res.status(200).json({
      campuses: Array.from(campuses).sort(),
      departments: Array.from(departments).sort(),
    });
  } catch (error) {
    console.error("Error in /api/filterData:", error);
    res.status(500).json({ error: "Failed to fetch filter data" });
  } finally {
    await client.close();
  }
}
