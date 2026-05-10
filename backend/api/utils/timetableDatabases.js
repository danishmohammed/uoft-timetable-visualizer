export const getSummerYear = (dbName) => {
  const [, year] = dbName.split("_");
  return Number(year) || null;
};

export const getFallWinterStartYear = (dbName) => {
  const [, yearRange] = dbName.split("_");
  const [startYear] = (yearRange || "").split("-");
  return Number(startYear) || null;
};

export const getTimetableFamily = (dbName) => {
  if (dbName.startsWith("Summer_") && getSummerYear(dbName)) return "Summer";
  if (dbName.startsWith("Fall-Winter_") && getFallWinterStartYear(dbName)) {
    return "Fall-Winter";
  }
  return null;
};

export const getDatabaseYear = (dbName) => {
  if (dbName.startsWith("Summer_")) {
    return getSummerYear(dbName) || 0;
  }
  if (dbName.startsWith("Fall-Winter_")) {
    return getFallWinterStartYear(dbName) || 0;
  }
  return 0;
};

export const hasUsableTimetableData = async (client, dbName) => {
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();

  for (const collection of collections) {
    const timingDoc = await db
      .collection(collection.name)
      .findOne({ course_name: { $exists: true } }, { projection: { _id: 1 } });

    if (timingDoc) {
      return true;
    }
  }

  return false;
};

export const getLatestDatabaseForFamily = async (client, databases, family) => {
  const candidates = databases
    .map(({ name }) => name)
    .filter((name) => getTimetableFamily(name) === family)
    .sort((a, b) => getDatabaseYear(b) - getDatabaseYear(a));

  for (const name of candidates) {
    if (await hasUsableTimetableData(client, name)) {
      return name;
    }
  }

  return null;
};

export const getLatestTimetableDatabases = async (client, databases) => {
  const latestByFamily = {};
  const candidates = databases
    .map(({ name }) => name)
    .filter((name) => getTimetableFamily(name))
    .sort((a, b) => getDatabaseYear(b) - getDatabaseYear(a));

  for (const name of candidates) {
    const family = getTimetableFamily(name);
    if (latestByFamily[family]) continue;
    if (await hasUsableTimetableData(client, name)) {
      latestByFamily[family] = name;
    }
  }

  return Object.values(latestByFamily);
};

export const getSemesterYear = (semester) => {
  const parts = semester.split(" ");
  const year = parts.find((part) => Number(part));
  return Number(year) || null;
};

export const getDatabaseNameFromSemester = (semester) => {
  const year = getSemesterYear(semester);

  if (semester.includes("Summer") && year) {
    return `Summer_${year}`;
  }

  if (semester.includes("Fall") && year) {
    return `Fall-Winter_${year}-${year + 1}`;
  }

  if (semester.includes("Winter") && year) {
    return `Fall-Winter_${year - 1}-${year}`;
  }

  return semester.includes("Summer") ? "Summer" : "Fall-Winter";
};
