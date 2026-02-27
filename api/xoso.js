export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://kqxs.p.rapidapi.com/?id=mien-bac",
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "kqxs.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "API error" });
  }
}