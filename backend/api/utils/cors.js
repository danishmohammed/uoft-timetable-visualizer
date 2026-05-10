const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://ttv.danishmohammed.ca",
];

export const applyCorsHeaders = (req, res, methods) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigin = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : "https://ttv.danishmohammed.ca";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};
