// Dead code — static export does not serve API routes. Auth handled by Worker.
import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).json({ error: "Not available in static export" });
}
