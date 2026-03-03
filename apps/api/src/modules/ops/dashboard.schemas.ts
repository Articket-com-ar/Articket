import { z } from "zod";

export const opsDashboardQuerySchema = z.object({}).passthrough();

export type OpsDashboardQuery = z.infer<typeof opsDashboardQuerySchema>;
