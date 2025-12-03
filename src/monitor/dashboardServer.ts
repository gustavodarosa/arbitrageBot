import express, { Request, Response } from "express";
import { readRecent } from "../logging/logger";

export function startDashboard(port = 3001) {
  const app = express();
  
  app.get("/metrics", (req: Request, res: Response) => {
    const recent = readRecent(500);
    // compute simple metrics
    const total = recent.length;
    const success = recent.filter((r: any) => r.status === "success").length;
    const failed = recent.filter((r: any) => r.status === "failed").length;
    const totalProfit = recent.reduce((sum: number, r: any) => sum + (r.profit || 0), 0);
    
    res.json({ 
      total, 
      success, 
      failed,
      totalProfit,
      recentTransactions: recent.slice(-50) 
    });
  });

  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.listen(port, () => {
    console.log(`📊 Dashboard running on http://localhost:${port}/metrics`);
  });
}
